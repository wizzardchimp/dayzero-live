const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 120000,
  pingInterval: 30000,
});
app.use(express.static(path.join(__dirname, 'public')));

const ATTACKS = [
  {id:'phishing',name:'Phishing',icon:'🎣',desc:'Deceptive emails to steal credentials',example:'An email from your "CEO" requests urgent gift card purchases'},
  {id:'malware',name:'Malware',icon:'🦠',desc:'Malicious software to compromise systems',example:'An innocent-looking PDF attachment installs a keylogger'},
  {id:'ransomware',name:'Ransomware',icon:'🔒',desc:'Encrypts data and demands payment',example:'All company files encrypted — pay 10 BTC within 48 hours'},
  {id:'ddos',name:'DDoS',icon:'🌊',desc:'Overwhelming traffic to disrupt services',example:'Website returns 503 errors under 500Gbps traffic flood'},
  {id:'sql_injection',name:'SQL Injection',icon:'💉',desc:'Database manipulation via input fields',example:'Login form accepts "\' OR 1=1 —" as valid credentials'},
  {id:'mitm',name:'Man-in-the-Middle',icon:'👤',desc:'Intercepting communications between parties',example:'Coffee-shop WiFi injects malicious code into every page you load'},
  {id:'zero_day',name:'Zero-Day Exploit',icon:'⚡',desc:'Attacking unknown vulnerabilities',example:'An unpatched router vulnerability gives attackers full network access'},
  {id:'insider',name:'Insider Threat',icon:'🏢',desc:'Malicious or negligent internal actors',example:'A departing employee copies the entire client database before leaving'},
  {id:'data_exfil',name:'Data Exfiltration',icon:'📤',desc:'Stealing sensitive data from systems',example:'Sensitive spreadsheets are uploaded to a personal cloud account'},
  {id:'social_eng',name:'Social Engineering',icon:'🎭',desc:'Psychological manipulation to gain access',example:'Caller posing as IT support asks you to "verify" your password'}
];
const DEFENCES = [
  {id:'firewall',name:'Firewall',icon:'🛡️',desc:'Monitors and controls network traffic',counters:['phishing','ddos']},
   {id:'endpoint',name:'Endpoint Protection',icon:'💻',desc:'secure individual devices',counters:['malware','ransomware']},
  {id:'mfa',name:'Multi-Factor Auth',icon:'🔐',desc:'Requires multiple verification methods',counters:['insider','social_eng']},
  {id:'encryption',name:'Encryption',icon:'🔒',desc:'Scrambles data to prevent unauthorised access',counters:['data_exfil','mitm']},
   {id:'seg',name:'Network Segmentation',icon:'🔀',desc:'seperates the network into departmental areas',counters:['sql_injection','insider']},
  {id:'backup',name:'Backup & Recovery',icon:'💾',desc:'Restores data after loss or attack',counters:['ransomware','ddos']},
   {id:'threat',name:'Threat Detection',icon:'👁️',desc:'uses AI to monitor network usage of individuals',counters:['zero_day','phishing']},
  {id:'passwords',name:'Improved User Passwords',icon:'🔑',desc:'Enforces strong password policies',counters:['sql_injection','mitm']},
  {id:'training',name:'Security Training',icon:'📚',desc:'Educates users to recognise threats',counters:['malware','social_eng']},
  {id:'monitoring',name:'Continuous Monitoring',icon:'📊',desc:'Tracks systems for unusual behaviour',counters:['data_exfil','zero_day']}
];

const EFFECTIVENESS = {};
DEFENCES.forEach(d => { EFFECTIVENESS[d.id] = d.counters; });

const PRIORITY_MAP = {
  'Money': ['ransomware', 'insider', 'social_eng'],
  'Data': ['phishing', 'sql_injection', 'mitm', 'data_exfil'],
  'Maintain Services': ['malware', 'ddos', 'zero_day']
};
const PRIORITY_EMOJIS = {'Money':'💰','Data':'💾','Maintain Services':'⚙️'};

const ATTACK_COST = 100000;
const START_BUDGET = 300000;
const MAX_ROUNDS = 3;
const SPIN_DURATION = 10000;

const game = {
  phase: 'lobby',
  round: 0,
  timerDuration: 120,
  timerRemaining: 120,
  timerInterval: null,
  currentAttack: null,
  usedAttacks: [],
  sessionCode: genCode(),
};
const players = {};

function genCode(){
  return String(Math.floor(100 + Math.random() * 900));
}

function sanitise(name) {
  return name.trim().slice(0, 20) || 'Anonymous';
}

function getAttack(id) {
  return ATTACKS.find(a => a.id === id);
}

function defName(id) {
  const d = DEFENCES.find(x => x.id === id);
  return d ? d.name : id;
}

function selectAttack() {
  const available = ATTACKS.filter(a => !game.usedAttacks.includes(a.id));
  if (available.length === 0) return ATTACKS[0];
  const pick = available[Math.floor(Math.random() * available.length)];
  game.usedAttacks.push(pick.id);
  return pick;
}

function getGameState() {
  return {
    phase: game.phase,
    round: game.round,
    timerRemaining: game.timerRemaining,
    timerDuration: game.timerDuration,
    currentAttack: game.currentAttack,
    usedAttacks: game.usedAttacks,
    sessionCode: game.sessionCode,
  };
}

function calculateAward(player) {
  const topPriority = (player.priority || ['Money'])[0];
  const priorityAttacks = PRIORITY_MAP[topPriority] || [];
  const history = player.roundHistory || [];
  const faced = history.filter(r => priorityAttacks.includes(r.attackId));
  const blocked = faced.filter(r => r.blocked).length;
  const tot = faced.length;
  const pct = tot === 0 ? 1 : blocked / tot;
  const award = pct >= 2/3 ? 'Gold' : pct >= 1/3 ? 'Silver' : 'Bronze';
  const score = Math.round((pct * 50) + ((player.budget / START_BUDGET) * 50));
  return { award, score, priorityPct: Math.round(pct * 100) };
}

function getPlayersData() {
  return Object.values(players).map(p => {
    const awardInfo = game.phase === 'gameover' ? calculateAward(p) : { award: null, score: 0, priorityPct: 0 };
    return {
      id: p.id,
      name: p.name,
      connected: p.connected,
      budget: p.budget,
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
      priorityPct: awardInfo.priorityPct,
    };
  });
}

function broadcast() {
  io.emit('game-state', getGameState());
  io.emit('players-update', getPlayersData());
}

function startTimer() {
  clearInterval(game.timerInterval);
  game.timerInterval = setInterval(() => {
    game.timerRemaining--;
    io.emit('timer-update', game.timerRemaining);
    if (game.timerRemaining <= 0) {
      endRound();
    }
  }, 1000);
}

function endRound() {
  clearInterval(game.timerInterval);
  if (game.phase !== 'selecting') return;
  game.phase = 'spinning';
  const attack = selectAttack();
  game.currentAttack = attack;

  Object.values(players).forEach(p => {
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
      p.budget -= ATTACK_COST;
      p.lastResult = 'breached';
      const preventers = Object.entries(EFFECTIVENESS)
        .filter(([, attacks]) => attacks.includes(attack.id))
        .map(([defId]) => defName(defId));
      p.lastAttack = { id: attack.id, name: attack.name, icon: attack.icon, desc: attack.desc, example: attack.example, preventers };
      p.preventInfo = `Could have been prevented by: ${preventers.join(', ')}`;
    }
    if (!p.roundHistory) p.roundHistory = [];
    p.roundHistory.push({ attackId: attack.id, blocked });
  });

  broadcast();

  setTimeout(() => {
    if (game.phase === 'spinning') {
      game.phase = 'reveal';
      broadcast();
    }
  }, SPIN_DURATION);
}

function startRound() {
  game.round++;
  if (game.round > MAX_ROUNDS) {
    game.phase = 'gameover';
    broadcast();
    return;
  }
  game.phase = 'selecting';
  game.timerRemaining = game.timerDuration;
  game.currentAttack = null;

  Object.values(players).forEach(p => {
    p.carriedOver = [...p.carriedOver, ...p.selected];
    p.selected = [];
    p.maxSelect = game.round === 1 ? 3 : game.round === 2 ? 2 : 1;
    p.lastAttack = null;
    p.lastResult = null;
    p.preventInfo = null;
  });

  broadcast();
  startTimer();
}

function startGame() {
  game.phase = 'lobby';
  game.round = 0;
  game.usedAttacks = [];
  game.currentAttack = null;
  Object.values(players).forEach(p => {
    p.selected = [];
    p.carriedOver = [];
    p.budget = START_BUDGET;
    p.blocked = 0;
    p.breaches = 0;
    p.lastAttack = null;
    p.lastResult = null;
    p.preventInfo = null;
    p.maxSelect = 3;
    p.roundHistory = [];
    p.priority = [];
  });
  startRound();
}

function resetGame() {
  clearInterval(game.timerInterval);
  game.phase = 'lobby';
  game.round = 0;
  game.timerRemaining = game.timerDuration;
  game.currentAttack = null;
  game.usedAttacks = [];
  game.sessionCode = genCode();
  Object.values(players).forEach(p => {
    p.selected = [];
    p.carriedOver = [];
    p.budget = START_BUDGET;
    p.blocked = 0;
    p.breaches = 0;
    p.lastAttack = null;
    p.lastResult = null;
    p.preventInfo = null;
    p.maxSelect = 3;
    p.roundHistory = [];
    p.priority = [];
  });
  broadcast();
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.emit('game-state', getGameState());

  socket.on('join', (code, name) => {
    if (code !== game.sessionCode) {
      socket.emit('joined', { id: socket.id, error: 'Invalid session code' });
      return;
    }
    const cleanName = sanitise(name);
    const existing = Object.values(players).find(p => p.name === cleanName);
    if (existing) {
      delete players[existing.id];
      existing.id = socket.id;
      existing.connected = true;
      players[socket.id] = existing;
      socket.emit('joined', { id: socket.id });
      broadcast();
      return;
    }
    if (game.phase !== 'lobby') {
      socket.emit('joined', { id: socket.id, error: 'Game already in progress' });
      return;
    }
    players[socket.id] = {
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
      maxSelect: 3,
      roundHistory: [],
      priority: [],
    };
    socket.emit('joined', { id: socket.id });
    broadcast();
    console.log(`${players[socket.id].name} joined`);
  });

  socket.on('start-game', () => {
    if (Object.keys(players).length === 0) return;
    startGame();
  });

  socket.on('adjust-timer', (amount) => {
    if (game.phase === 'selecting') {
      game.timerRemaining = Math.max(1, Math.min(600, game.timerRemaining + amount));
      io.emit('timer-update', game.timerRemaining);
    }
  });

  socket.on('start-next-round', () => {
    if (game.phase === 'reveal') {
      startRound();
    }
  });

  socket.on('reset-game', () => {
    resetGame();
  });

  socket.on('flush-players', () => {
    Object.keys(players).forEach(key => {
      const p = players[key];
      if (p) io.to(key).emit('flushed');
      delete players[key];
    });
    game.sessionCode = genCode();
    broadcast();
  });

  socket.on('remove-player', (playerId) => {
    const p = players[playerId];
    if (p) {
      io.to(playerId).emit('flushed');
      delete players[playerId];
      broadcast();
    }
  });

  socket.on('select-defence', (defenceId) => {
    const p = players[socket.id];
    if (!p || game.phase !== 'selecting') return;
    if (p.selected.includes(defenceId)) return;
    if (p.selected.length >= p.maxSelect) return;
    if (p.carriedOver.includes(defenceId)) return;
    p.selected.push(defenceId);
    broadcast();
  });

  socket.on('set-priority', (priority) => {
    const p = players[socket.id];
    if (!p || priority.length !== 3) return;
    p.priority = priority;
    broadcast();
  });

  socket.on('deselect-defence', (defenceId) => {
    const p = players[socket.id];
    if (!p || game.phase !== 'selecting') return;
    const idx = p.selected.indexOf(defenceId);
    if (idx >= 0) p.selected.splice(idx, 1);
    broadcast();
  });

  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (p) {
      console.log(`${p.name} disconnected`);
      p.connected = false;
    }
    broadcast();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Day Zero Live running on http://localhost:${PORT}`);
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
