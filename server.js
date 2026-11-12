const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');
const { ATTACKS, DEFENCES, EFFECTIVENESS, PRIORITY_MAP,
  ATTACK_COST, START_BUDGET, MAX_ROUNDS, SPIN_DURATION, DEFAULT_TIMER } = require('./public/shared');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 120000,
  pingInterval: 30000,
});

// Static files: HTML is never cached (so updates show immediately); audio/images are cached for a day.
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  setHeaders(res, filePath) {
    if (/\.(html|js)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
    else res.setHeader('Cache-Control', 'public, max-age=86400');
  },
}));

const FACILITATOR_PIN = process.env.FACILITATOR_PIN || 'wmrocu';
if (!process.env.FACILITATOR_PIN) {
  console.warn('WARNING: FACILITATOR_PIN is not set — using the default phrase from the public repo. Set it on Railway.');
}
const LOBBY_IDS = (process.env.LOBBIES || 'A,B').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const HOST_GRACE_MS = Number(process.env.HOST_GRACE_MS) || 5 * 60 * 1000; // host may drop out this long without losing the game
const IDLE_RESET_MS = 60 * 60 * 1000; // 1 hour

/* ---------- helpers ---------- */
function pinOk(pin) {
  return String(pin || '').trim().toLowerCase() === String(FACILITATOR_PIN).trim().toLowerCase();
}
function sanitise(name) {
  return String(name || '').trim().slice(0, 20) || 'Anonymous';
}
function newToken() {
  return crypto.randomBytes(16).toString('hex');
}
function defName(id) {
  const d = DEFENCES.find(x => x.id === id);
  return d ? d.name : id;
}

// PIN brute-force limiter (per client IP)
const pinFails = new Map();
function clientIp(socket) {
  const xff = socket.handshake.headers['x-forwarded-for'];
  return (xff ? String(xff).split(',')[0].trim() : socket.handshake.address) || 'unknown';
}
function pinLocked(socket) {
  const f = pinFails.get(clientIp(socket));
  return !!(f && f.until && f.until > Date.now());
}
function pinAttempt(socket, ok) {
  const ip = clientIp(socket);
  if (ok) { pinFails.delete(ip); return; }
  const f = pinFails.get(ip) || { count: 0, until: 0 };
  f.count++;
  if (f.count >= 5) { f.until = Date.now() + 60000; f.count = 0; }
  pinFails.set(ip, f);
}

const rooms = new Map();

function genUniqueCode() {
  const taken = new Set([...rooms.values()].map(r => r.game.sessionCode));
  for (let i = 0; i < 200; i++) {
    const c = String(Math.floor(100 + Math.random() * 900));
    if (!taken.has(c)) return c;
  }
  return String(Math.floor(100 + Math.random() * 900));
}

function roomByCode(code) {
  const c = String(code || '').trim();
  return [...rooms.values()].find(r => r.game.sessionCode === c) || null;
}

/* ---------- a single lobby / game session ---------- */
class Room {
  constructor(id) {
    this.id = id;
    this.name = 'Lobby ' + id;
    this.channel = 'lobby:' + id;
    this.players = {};
    this.host = null; // { socketId, token, connected, graceTimer }
    this.lastActivity = Date.now();
    this.game = {
      phase: 'lobby',
      round: 0,
      timerDuration: DEFAULT_TIMER,
      timerRemaining: DEFAULT_TIMER,
      timerInterval: null,
      currentAttack: null,
      usedAttacks: [],
      sessionCode: genUniqueCode(),
      startTime: null,
      priorityStartTime: null,
      roundStartTimes: [],
      plannedAttacks: [],
      queuedNext: false,
    };
  }

  emit(ev, ...args) { io.to(this.channel).emit(ev, ...args); }

  /* --- host management --- */
  claimHost(socket, token) {
    const h = this.host;
    if (!h) {
      this.host = { socketId: socket.id, token: newToken(), connected: true, graceTimer: null };
      return { ok: true, token: this.host.token };
    }
    if (h.socketId === socket.id) return { ok: true, token: h.token };
    if (token && token === h.token) { // same host coming back (reload / wifi drop)
      clearTimeout(h.graceTimer);
      h.graceTimer = null;
      const old = io.sockets.sockets.get(h.socketId);
      if (old) old.data.facilitator = false;
      h.socketId = socket.id;
      h.connected = true;
      return { ok: true, token: h.token };
    }
    return { ok: false, busy: true, status: this.status() };
  }

  isHost(socket) {
    return !!(this.host && this.host.socketId === socket.id && socket.data.facilitator);
  }

  hostDisconnected(socket) {
    const h = this.host;
    if (!h || h.socketId !== socket.id) return;
    h.connected = false;
    if (this.game.phase === 'lobby' && Object.keys(this.players).length === 0) {
      this.releaseHost(); // nothing to protect
      return;
    }
    console.log(`[${this.id}] host disconnected — holding lobby for ${HOST_GRACE_MS / 1000}s`);
    clearTimeout(h.graceTimer);
    h.graceTimer = setTimeout(() => {
      console.log(`[${this.id}] host did not return — releasing lobby`);
      this.releaseHost();
    }, HOST_GRACE_MS);
  }

  // Frees the lobby: ends any session and clears the host. A free lobby is always clean.
  releaseHost(notify = false) {
    if (this.host) {
      clearTimeout(this.host.graceTimer);
      if (notify) {
        const s = io.sockets.sockets.get(this.host.socketId);
        if (s) { s.data.facilitator = false; s.emit('lobby-released'); }
      }
    }
    this.host = null;
    this.hardReset();
  }

  status() {
    const g = this.game;
    let state = 'free';
    if (this.host) state = g.phase === 'lobby' ? 'open' : 'in-progress';
    return {
      id: this.id,
      name: this.name,
      state,
      phase: g.phase,
      round: g.round,
      maxRounds: MAX_ROUNDS,
      players: Object.keys(this.players).length,
      hostAway: !!(this.host && !this.host.connected),
    };
  }

  /* --- players --- */
  flushPlayers() {
    Object.keys(this.players).forEach(key => {
      io.to(key).emit('flushed');
      const s = io.sockets.sockets.get(key);
      if (s) { s.leave(this.channel); s.data.roomId = null; }
      delete this.players[key];
    });
  }

  hardReset() {
    this.flushPlayers();
    this.game.sessionCode = genUniqueCode();
    this.game.plannedAttacks = [];
    console.log(`[${this.id}] Session cleared. New join code: ${this.game.sessionCode}`);
    this.resetGame();
  }

  resetPlayer(p) {
    p.selected = [];
    p.carriedOver = [];
    p.budget = START_BUDGET;
    p.blocked = 0;
    p.breaches = 0;
    p.eliminated = false;
    p.lastAttack = null;
    p.lastResult = null;
    p.preventInfo = null;
    p.maxSelect = 2;
    p.roundHistory = [];
    p.priority = [];
    p.prioritySubmitTime = null;
    p.roundSelectTimes = [null, null, null];
  }

  /* --- game logic --- */
  selectAttack() {
    const game = this.game;
    if (game.plannedAttacks && game.plannedAttacks.length >= game.round) {
      const plannedId = game.plannedAttacks[game.round - 1];
      if (!game.usedAttacks.includes(plannedId)) {
        game.usedAttacks.push(plannedId);
        const planned = ATTACKS.find(a => a.id === plannedId);
        if (planned) return planned;
      }
    }
    const available = ATTACKS.filter(a => !game.usedAttacks.includes(a.id));
    if (available.length === 0) return ATTACKS[0];
    const pick = available[Math.floor(Math.random() * available.length)];
    game.usedAttacks.push(pick.id);
    return pick;
  }

  getGameState() {
    const g = this.game;
    return {
      phase: g.phase,
      round: g.round,
      timerRemaining: g.timerRemaining,
      timerDuration: g.timerDuration,
      currentAttack: g.currentAttack,
      usedAttacks: g.usedAttacks,
      sessionCode: g.sessionCode,
      lobbyId: this.id,
      lobbyName: this.name,
    };
  }

  calculateAward(player) {
    const game = this.game;
    if (!player.priority || player.priority.length === 0) {
      const b = Math.max(0, Math.min(100, Math.round((player.budget / START_BUDGET) * 100)));
      return { award: '—', score: b, priorityPct: 0, speedPct: 0, budgetPct: b };
    }

    const prio = player.priority;
    const weights = [3, 2, 1];
    const history = player.roundHistory || [];
    let points = 0, maxPoints = 0;

    prio.forEach((pName, i) => {
      const attacks = PRIORITY_MAP[pName] || [];
      const w = weights[i] || 1;
      history.forEach(r => {
        if (attacks.includes(r.attackId)) {
          maxPoints += w;
          if (r.blocked) points += w;
        }
      });
    });

    const prioPct = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 50;

    let speedPct = 50;
    const cap = (game.timerDuration || 120) * 1000;
    const times = [];
    (player.roundSelectTimes || []).forEach((t, idx) => {
      if (t && game.roundStartTimes[idx]) {
        times.push(Math.min(cap, Math.max(0, t - game.roundStartTimes[idx])));
      }
    });
    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const norm = Math.max(0, Math.min(1, 1 - (avg / cap)));
      speedPct = Math.round(norm * 100);
    }

    const score = Math.round(prioPct * 0.75 + speedPct * 0.25);

    let award = 'Bronze';
    if (score >= 78) award = 'Gold';
    else if (score >= 58) award = 'Silver';

    return { award, score, priorityPct: prioPct, speedPct, budgetPct: 0 };
  }

  compileGameAudit() {
    const game = this.game;
    const pArr = Object.values(this.players);
    const count = pArr.length;
    const picks = [{}, {}, {}];
    pArr.forEach(p => {
      if (p.priority) p.priority.forEach((v, i) => { picks[i][v] = (picks[i][v] || 0) + 1; });
    });
    const defCounts = {};
    DEFENCES.forEach(d => { defCounts[d.id] = 0; });
    pArr.forEach(p => {
      [...(p.carriedOver || []), ...(p.selected || [])].forEach(d => { if (defCounts[d] !== undefined) defCounts[d]++; });
    });
    const rounds = game.usedAttacks.map((aid, i) => {
      const atk = ATTACKS.find(a => a.id === aid);
      const blocked = pArr.filter(p => (p.roundHistory || [])[i]?.blocked).length;
      return { name: atk ? atk.name : aid, blockedPct: count ? Math.round(blocked / count * 100) : 0, breached: count - blocked };
    });
    return {
      SessionCode: game.sessionCode,
      Lobby: this.id,
      Date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      DurationSec: game.startTime ? Math.floor((Date.now() - game.startTime) / 1000) : 0,
      PlayerCount: count,
      RoundsPlayed: game.usedAttacks.length,
      R1_Attack: rounds[0]?.name || '', R1_BlockedPct: rounds[0]?.blockedPct || 0, R1_Breached: rounds[0]?.breached || 0,
      R2_Attack: rounds[1]?.name || '', R2_BlockedPct: rounds[1]?.blockedPct || 0, R2_Breached: rounds[1]?.breached || 0,
      R3_Attack: rounds[2]?.name || '', R3_BlockedPct: rounds[2]?.blockedPct || 0, R3_Breached: rounds[2]?.breached || 0,
      Pick1_Money: picks[0]['Money'] || 0, Pick1_Data: picks[0]['Data'] || 0, Pick1_Services: picks[0]['Maintain Services'] || 0,
      Pick2_Money: picks[1]['Money'] || 0, Pick2_Data: picks[1]['Data'] || 0, Pick2_Services: picks[1]['Maintain Services'] || 0,
      Pick3_Money: picks[2]['Money'] || 0, Pick3_Data: picks[2]['Data'] || 0, Pick3_Services: picks[2]['Maintain Services'] || 0,
      ...Object.fromEntries(DEFENCES.map(d => [`Def_${d.id}`, defCounts[d.id]])),
      AvgBudget: count ? Math.round(pArr.reduce((s, p) => s + p.budget, 0) / count) : 0,
      ZeroBudgetCount: pArr.filter(p => p.budget <= 0).length,
    };
  }

  async logGameToSheet() {
    if (!process.env.WEBHOOK_URL) return;
    try {
      await fetch(process.env.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.compileGameAudit()),
      });
      console.log(`[${this.id}] Audit sent to webhook`);
    } catch (err) {
      console.error('Audit log failed:', err.message);
    }
  }

  getPlayersData() {
    return Object.values(this.players).map(p => {
      const awardInfo = this.game.phase === 'gameover' ? this.calculateAward(p) : { award: null, score: 0, priorityPct: 0 };
      return {
        id: p.id,
        name: p.name,
        connected: p.connected,
        budget: p.budget,
        eliminated: !!p.eliminated,
        blocked: p.blocked,
        breaches: p.breaches,
        defences: [...p.carriedOver, ...p.selected],
        selected: p.selected,
        carriedOver: p.carriedOver,
        maxSelect: p.maxSelect,
        lastAttack: p.lastAttack,
        lastResult: p.lastResult,
        preventInfo: p.preventInfo,
        priority: p.priority || [],
        roundHistory: p.roundHistory || [],
        award: awardInfo.award,
        score: awardInfo.score,
        prioritySubmitTime: p.prioritySubmitTime || null,
        roundSelectTimes: p.roundSelectTimes || [],
        priorityPct: awardInfo.priorityPct,
        speedPct: awardInfo.speedPct || 0,
        budgetPct: awardInfo.budgetPct || 0,
      };
    });
  }

  broadcast() {
    this.lastActivity = Date.now();
    this.emit('game-state', this.getGameState());
    this.emit('players-update', this.getPlayersData());
  }

  startTimer() {
    const game = this.game;
    clearInterval(game.timerInterval);
    this.emit('timer-update', game.timerRemaining);
    game.timerInterval = setInterval(() => {
      game.timerRemaining--;
      this.emit('timer-update', game.timerRemaining);
      if (game.timerRemaining <= 0) this.endRound();
    }, 1000);
  }

  endRound() {
    const game = this.game;
    clearInterval(game.timerInterval);
    if (game.phase !== 'selecting') return;
    game.phase = 'spinning';
    const attack = this.selectAttack();
    game.currentAttack = attack;

    Object.values(this.players).forEach(p => {
      if (p.eliminated) {
        p.lastAttack = null;
        p.lastResult = null;
        p.preventInfo = null;
        return;
      }
      const allDefences = [...p.carriedOver, ...p.selected];
      const blocker = allDefences.find(d => EFFECTIVENESS[d] && EFFECTIVENESS[d].includes(attack.id));
      p.lastAttack = null;
      p.lastResult = null;
      p.preventInfo = null;
      const blocked = !!blocker;
      if (blocker) {
        p.blocked++;
        p.lastResult = 'blocked';
        p.lastAttack = { id: attack.id, name: attack.name, icon: attack.icon, desc: attack.desc, example: attack.example, blockedBy: defName(blocker) };
      } else {
        p.breaches++;
        p.budget = Math.max(0, p.budget - ATTACK_COST);
        if (p.budget <= 0) p.eliminated = true;
        p.lastResult = 'breached';
        const preventers = Object.entries(EFFECTIVENESS)
          .filter(([, attacks]) => attacks.includes(attack.id))
          .map(([defId]) => defName(defId));
        p.lastAttack = { id: attack.id, name: attack.name, icon: attack.icon, desc: attack.desc, example: attack.example, preventers };
        p.preventInfo = `ICO fine of £${ATTACK_COST.toLocaleString()} imposed`;
      }
      if (!p.roundHistory) p.roundHistory = [];
      p.roundHistory.push({ attackId: attack.id, blocked });
    });

    this.broadcast();

    const sessionCode = game.sessionCode;
    setTimeout(() => {
      // Ignore if the session was reset/rotated while the wheel was spinning
      if (game.sessionCode !== sessionCode) return;
      if (game.phase === 'spinning') {
        game.phase = 'reveal';
        this.broadcast();
        if (game.queuedNext) {
          game.queuedNext = false;
          this.startRound();
        }
      }
    }, SPIN_DURATION);
  }

  startRound() {
    const game = this.game;
    game.round++;
    if (game.round > MAX_ROUNDS) {
      game.phase = 'gameover';
      this.broadcast();
      this.logGameToSheet();
      return;
    }
    game.phase = 'selecting';
    game.timerRemaining = game.timerDuration;
    game.roundStartTimes[game.round - 1] = Date.now();
    game.currentAttack = null;

    Object.values(this.players).forEach(p => {
      if (p.eliminated) return;
      p.carriedOver = [...p.carriedOver, ...p.selected];
      p.selected = [];
      p.maxSelect = game.round === 3 ? 1 : 2;
      p.lastAttack = null;
      p.lastResult = null;
      p.preventInfo = null;
    });

    this.broadcast();
    this.startTimer();
  }

  startGame() {
    const game = this.game;
    game.startTime = Date.now();
    game.priorityStartTime = Date.now();
    game.roundStartTimes = [];
    game.phase = 'priority';
    game.round = 0;
    game.usedAttacks = [];
    game.currentAttack = null;
    game.queuedNext = false;
    // Pre-draw 3 attacks: one from each priority bucket, shuffled
    const buckets = [
      ['ransomware', 'insider', 'social_eng'],
      ['phishing', 'sql_injection', 'data_exfil'],
      ['malware', 'ddos', 'zero_day'],
    ];
    game.plannedAttacks = buckets.map(b => b[Math.floor(Math.random() * b.length)]);
    for (let i = 2; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [game.plannedAttacks[i], game.plannedAttacks[j]] = [game.plannedAttacks[j], game.plannedAttacks[i]];
    }
    Object.values(this.players).forEach(p => this.resetPlayer(p));
    this.broadcast();
  }

  resetGame() {
    const game = this.game;
    clearInterval(game.timerInterval);
    game.phase = 'lobby';
    game.round = 0;
    game.timerRemaining = DEFAULT_TIMER;
    game.currentAttack = null;
    game.usedAttacks = [];
    game.queuedNext = false;
    game.startTime = null;
    game.priorityStartTime = null;
    game.roundStartTimes = [];
    Object.values(this.players).forEach(p => this.resetPlayer(p));
    this.broadcast();
  }
}

LOBBY_IDS.forEach(id => rooms.set(id, new Room(id)));

// Idle housekeeping: a lobby untouched for an hour is wiped and freed.
setInterval(() => {
  rooms.forEach(room => {
    if (Date.now() - room.lastActivity < IDLE_RESET_MS) return;
    const g = room.game;
    const hasSomething = room.host || Object.keys(room.players).length > 0;
    if (!hasSomething) return;
    if (g.phase === 'reveal' || g.phase === 'gameover') {
      if (room.host && room.host.connected) return; // host still looking at results
    }
    console.log(`[${room.id}] Idle timeout (${IDLE_RESET_MS / 60000} min) reached — releasing lobby`);
    room.releaseHost(true);
  });
}, 60000);

/* ---------- HTTP ---------- */
app.get('/api/lobbies', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json([...rooms.values()].map(r => r.status()));
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/qr/:file', (req, res) => {
  const code = String(req.params.file || '').replace(/\.png$/i, '');
  if (!/^\d{3}$/.test(code)) return res.status(400).end();
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const data = `${proto}://${req.get('host')}/play.html?code=${code}`;
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.type('png');
  QRCode.toFileStream(res, data, { width: 420, margin: 1, color: { dark: '#111827', light: '#ffffff' } });
});

/* ---------- sockets ---------- */
io.on('connection', (socket) => {
  // A dashboard connects with ?room=A. Phones connect with no room and are placed in one when they join with a code.
  const wanted = String(socket.handshake.query.room || '').toUpperCase();
  const dashRoom = rooms.get(wanted);
  if (dashRoom) {
    socket.data.roomId = dashRoom.id;
    socket.join(dashRoom.channel);
    socket.emit('game-state', dashRoom.getGameState());
  }

  const roomOf = () => rooms.get(socket.data.roomId);
  const hostRoom = () => {
    const r = roomOf();
    return r && r.isHost(socket) ? r : null;
  };

  socket.on('facilitator-auth', (pin, token, ack) => {
    if (typeof token === 'function') { ack = token; token = null; }
    const reply = (o) => { if (typeof ack === 'function') ack(o); };
    if (pinLocked(socket)) return reply({ ok: false, locked: true });
    const ok = pinOk(pin);
    pinAttempt(socket, ok);
    if (!ok) return reply({ ok: false });
    const room = roomOf();
    if (!room) return reply({ ok: false, noRoom: true });
    const claim = room.claimHost(socket, token);
    if (!claim.ok) return reply({ ok: true, busy: true, status: claim.status });
    socket.data.facilitator = true;
    room.broadcast();
    reply({ ok: true, hostToken: claim.token });
  });

  // Facilitator deliberately takes over a lobby that is in use (ends that session).
  socket.on('take-over-lobby', (pin, ack) => {
    const reply = (o) => { if (typeof ack === 'function') ack(o); };
    if (pinLocked(socket)) return reply({ ok: false, locked: true });
    const ok = pinOk(pin);
    pinAttempt(socket, ok);
    const room = roomOf();
    if (!ok || !room) return reply({ ok: false });
    console.log(`[${room.id}] Lobby taken over by a new host`);
    room.releaseHost(true);
    const claim = room.claimHost(socket, null);
    socket.data.facilitator = true;
    room.broadcast();
    reply({ ok: true, hostToken: claim.token });
  });

  // Host leaves the lobby on purpose, freeing it for someone else.
  socket.on('release-lobby', (ack) => {
    const room = hostRoom();
    if (!room) return;
    socket.data.facilitator = false;
    room.releaseHost();
    if (typeof ack === 'function') ack({ ok: true });
  });

  function reclaim(room, existing) {
    if (existing.id !== socket.id) {
      io.to(existing.id).emit('session-taken');
      delete room.players[existing.id];
    }
    existing.id = socket.id;
    existing.connected = true;
    if (!existing.rejoinToken) existing.rejoinToken = newToken();
    if (!existing.roundSelectTimes) existing.roundSelectTimes = [null, null, null];
    room.players[socket.id] = existing;
    socket.emit('joined', { id: socket.id, rejoinToken: existing.rejoinToken, name: existing.name });
    room.broadcast();
  }

  socket.on('join', (code, name, token) => {
    const room = roomByCode(code);
    if (!room || !room.host) {
      // A lobby with no host is free, so any code it once had is dead.
      socket.emit('joined', { id: socket.id, error: 'Invalid session code' });
      return;
    }
    if (socket.data.roomId && socket.data.roomId !== room.id) {
      const old = rooms.get(socket.data.roomId);
      if (old) {
        socket.leave(old.channel);
        if (old.players[socket.id]) { old.players[socket.id].connected = false; old.broadcast(); }
      }
    }
    socket.data.roomId = room.id;
    socket.join(room.channel);
    const game = room.game;

    if (token) {
      const byToken = Object.values(room.players).find(p => p.rejoinToken && p.rejoinToken === token);
      if (byToken) { reclaim(room, byToken); return; }
    }
    const cleanName = sanitise(name);
    const existing = Object.values(room.players).find(p => p.name === cleanName);
    if (existing) {
      if (existing.connected && existing.id !== socket.id) {
        socket.emit('joined', { id: socket.id, error: 'That name is already in use. Pick another.' });
        return;
      }
      reclaim(room, existing);
      return;
    }
    if (game.phase === 'gameover') {
      socket.emit('joined', { id: socket.id, error: 'Game already in progress' });
      return;
    }
    const rejoinToken = newToken();
    room.players[socket.id] = {
      id: socket.id,
      name: cleanName,
      connected: true,
      selected: [],
      carriedOver: [],
      budget: START_BUDGET,
      blocked: 0,
      breaches: 0,
      lastAttack: null,
      lastResult: null,
      preventInfo: null,
      maxSelect: game.round === 3 ? 1 : 2,
      roundHistory: [],
      priority: [],
      rejoinToken,
      roundSelectTimes: [null, null, null],
    };
    socket.emit('joined', { id: socket.id, rejoinToken, name: cleanName });
    room.broadcast();
    console.log(`[${room.id}] ${cleanName} joined`);
  });

  socket.on('start-game', () => {
    const room = hostRoom();
    if (!room) return;
    if (room.game.phase !== 'lobby') return;
    if (Object.keys(room.players).length === 0) return;
    room.startGame();
  });

  socket.on('adjust-timer', (amount) => {
    const room = hostRoom();
    if (!room || room.game.phase !== 'selecting') return;
    const g = room.game;
    const n = Number(amount) || 0;
    g.timerDuration = Math.max(30, Math.min(600, g.timerDuration + n));
    g.timerRemaining = Math.max(1, Math.min(600, g.timerRemaining + n));
    room.emit('timer-update', g.timerRemaining);
  });

  socket.on('force-end', () => {
    const room = hostRoom();
    if (room && room.game.phase === 'selecting') room.endRound();
  });

  socket.on('start-next-round', () => {
    const room = hostRoom();
    if (!room) return;
    if (room.game.phase === 'reveal') room.startRound();
    else if (room.game.phase === 'spinning') room.game.queuedNext = true;
  });

  socket.on('start-first-round', () => {
    const room = hostRoom();
    if (room && room.game.phase === 'priority') room.startRound();
  });

  socket.on('reset-game', () => {
    const room = hostRoom();
    if (room) room.resetGame();
  });

  socket.on('flush-players', () => {
    const room = hostRoom();
    if (!room) return;
    room.flushPlayers();
    room.game.sessionCode = genUniqueCode();
    room.broadcast();
  });

  socket.on('hard-reset', (pin, ack) => {
    const room = hostRoom();
    if (!room) {
      if (typeof ack === 'function') ack({ ok: false });
      return;
    }
    room.hardReset();
    if (typeof ack === 'function') ack({ ok: true, code: room.game.sessionCode });
  });

  socket.on('remove-player', (playerId) => {
    const room = hostRoom();
    if (!room) return;
    const p = room.players[playerId];
    if (p) {
      io.to(playerId).emit('flushed');
      const s = io.sockets.sockets.get(playerId);
      if (s) { s.leave(room.channel); s.data.roomId = null; }
      delete room.players[playerId];
      room.broadcast();
    }
  });

  socket.on('select-defence', (defenceId) => {
    const room = roomOf();
    const p = room && room.players[socket.id];
    if (!p || p.eliminated || room.game.phase !== 'selecting') return;
    if (!DEFENCES.some(d => d.id === defenceId)) return;
    if (p.selected.includes(defenceId)) return;
    if (p.selected.length >= p.maxSelect) return;
    if (p.carriedOver.includes(defenceId)) return;
    if (!p.roundSelectTimes) p.roundSelectTimes = [null, null, null];
    p.selected.push(defenceId);
    if (p.selected.length === p.maxSelect && !p.roundSelectTimes[room.game.round - 1]) {
      p.roundSelectTimes[room.game.round - 1] = Date.now();
    }
    room.broadcast();
  });

  socket.on('set-priority', (priority) => {
    const room = roomOf();
    const p = room && room.players[socket.id];
    if (!p || (room.game.phase !== 'priority' && room.game.phase !== 'selecting')) return;
    if (!Array.isArray(priority) || priority.length !== 3) return;
    if (new Set(priority).size !== 3) return;
    const validPriorities = Object.keys(PRIORITY_MAP);
    if (!priority.every(v => validPriorities.includes(v))) return;
    p.priority = priority;
    if (!p.prioritySubmitTime && room.game.priorityStartTime) {
      p.prioritySubmitTime = Date.now();
    }
    room.broadcast();
  });

  socket.on('deselect-defence', (defenceId) => {
    const room = roomOf();
    const p = room && room.players[socket.id];
    if (!p || p.eliminated || room.game.phase !== 'selecting') return;
    if (p.selected.length >= p.maxSelect) return;
    const idx = p.selected.indexOf(defenceId);
    if (idx >= 0) p.selected.splice(idx, 1);
    room.broadcast();
  });

  socket.on('disconnect', () => {
    const room = roomOf();
    if (!room) return;
    if (room.host && room.host.socketId === socket.id) {
      room.hostDisconnected(socket);
      return;
    }
    const p = room.players[socket.id];
    if (p) {
      console.log(`[${room.id}] ${p.name} disconnected`);
      p.connected = false;
      room.broadcast();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Day Zero Live running on http://localhost:${PORT} — lobbies: ${LOBBY_IDS.join(', ')}`);
  const os = require('os');
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`  Network: http://${iface.address}:${PORT}`);
      }
    }
  }
});
