// Turns the session log into the numbers shown on the hidden /insights page.

const { EFFECTIVENESS, DEFENCES, ATTACKS } = require('./public/shared');

const ACTIVE_BY_ROUND = [2, 4, 5]; // defences a player has in play in rounds 1, 2 and 3
const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

function compute(logger, rangeDays) {
  const since = rangeDays ? Date.now() - rangeDays * 86400000 : 0;

  const sessions = logger.query('SELECT * FROM sessions WHERE started_at>=? ORDER BY started_at DESC', [since]);
  const players = logger.query(
    'SELECT sp.* FROM session_players sp JOIN sessions s ON s.id=sp.session_id WHERE s.started_at>=?', [since]);
  const rounds = logger.query(
    'SELECT sr.* FROM session_rounds sr JOIN sessions s ON s.id=sr.session_id WHERE s.started_at>=?', [since]);
  const eventRows = logger.query('SELECT type,COUNT(*) n FROM events WHERE ts>=? GROUP BY type', [since]);
  const lastHealth = logger.query('SELECT * FROM health ORDER BY ts DESC LIMIT 1', [])[0] || null;

  const completed = sessions.filter(s => s.outcome === 'completed');
  const sessionPlayers = {};
  players.forEach(p => { (sessionPlayers[p.session_id] = sessionPlayers[p.session_id] || []).push(p); });

  // Per-session block rate, for the sessions table
  const faced = {}, blocked = {};
  rounds.forEach(r => {
    faced[r.session_id] = (faced[r.session_id] || 0) + r.faced;
    blocked[r.session_id] = (blocked[r.session_id] || 0) + r.blocked;
  });

  // Attacks: how often each was blocked
  const byAttack = {};
  rounds.forEach(r => {
    const a = (byAttack[r.attack_id] = byAttack[r.attack_id] || { faced: 0, blocked: 0, rounds: 0 });
    a.faced += r.faced; a.blocked += r.blocked; a.rounds++;
  });
  const attacks = Object.entries(byAttack).map(([id, a]) => {
    const def = ATTACKS.find(x => x.id === id);
    return { id, name: def ? def.name : id, icon: def ? def.icon : '', rounds: a.rounds, faced: a.faced, blockedPct: pct(a.blocked, a.faced) };
  }).sort((x, y) => x.blockedPct - y.blockedPct);

  // Defences: how often picked, and how often it was in play when it was needed
  const attackBySession = {};
  rounds.forEach(r => { (attackBySession[r.session_id] = attackBySession[r.session_id] || {})[r.round] = r.attack_id; });
  const dstat = {};
  DEFENCES.forEach(d => { dstat[d.id] = { picked: 0, relevant: 0, covered: 0 }; });
  players.forEach(p => {
    const defs = JSON.parse(p.defences || '[]');
    const results = JSON.parse(p.round_results || '[]');
    defs.forEach(d => { if (dstat[d]) dstat[d].picked++; });
    results.forEach((_, r) => {
      const attack = (attackBySession[p.session_id] || {})[r + 1];
      if (!attack) return;
      const active = defs.slice(0, ACTIVE_BY_ROUND[r] || 5);
      DEFENCES.forEach(d => {
        if ((EFFECTIVENESS[d.id] || []).includes(attack)) {
          dstat[d.id].relevant++;
          if (active.includes(d.id)) dstat[d.id].covered++;
        }
      });
    });
  });
  const defences = DEFENCES.map(d => ({
    id: d.id, name: d.name, icon: d.icon,
    pickedPct: pct(dstat[d.id].picked, players.length),
    relevantRounds: dstat[d.id].relevant,
    coveredPct: pct(dstat[d.id].covered, dstat[d.id].relevant),
  })).sort((a, b) => (b.pickedPct || 0) - (a.pickedPct || 0));

  // Priorities: what players put first
  const first = {};
  players.forEach(p => {
    const pr = JSON.parse(p.priority || '[]')[0];
    if (!pr) return;
    (first[pr] = first[pr] || { n: 0, match: [] }).n++;
    if (p.priority_pct != null) first[pr].match.push(p.priority_pct);
  });
  const priorities = Object.entries(first).map(([name, v]) => ({
    name, players: v.n, sharePct: pct(v.n, players.length), avgMatchPct: Math.round(avg(v.match) || 0),
  })).sort((a, b) => b.players - a.players);

  const bins = [{ label: '0 to 19', lo: 0, hi: 19 }, { label: '20 to 39', lo: 20, hi: 39 }, { label: '40 to 59', lo: 40, hi: 59 },
    { label: '60 to 79', lo: 60, hi: 79 }, { label: '80 to 100', lo: 80, hi: 100 }]
    .map(b => ({ label: b.label, players: players.filter(p => p.score >= b.lo && p.score <= b.hi).length }));

  const outcomes = {};
  sessions.forEach(s => { outcomes[s.outcome] = (outcomes[s.outcome] || 0) + 1; });
  const events = eventRows.reduce((o, r) => (o[r.type] = r.n, o), {});

  const totalFaced = rounds.reduce((n, r) => n + r.faced, 0);
  const totalBlocked = rounds.reduce((n, r) => n + r.blocked, 0);
  const kpis = {
    sessions: sessions.length,
    completed: completed.length,
    completionPct: pct(completed.length, sessions.length),
    players: players.length,
    avgPlayers: completed.length ? Math.round(avg(completed.map(s => s.player_count)) * 10) / 10 : null,
    avgScore: players.length ? Math.round(avg(players.map(p => p.score))) : null,
    avgMinutes: completed.length ? Math.round(avg(completed.map(s => s.duration_sec)) / 60 * 10) / 10 : null,
    blockedPct: pct(totalBlocked, totalFaced),
    round1BlockedPct: (() => {
      const r1 = rounds.filter(r => r.round === 1);
      return pct(r1.reduce((n, r) => n + r.blocked, 0), r1.reduce((n, r) => n + r.faced, 0));
    })(),
    eliminatedPct: pct(players.filter(p => p.eliminated_round > 0).length, players.length),
    latePriorityPct: pct(players.filter(p => p.late_priority).length, players.length),
    priorityTimerRanOutPct: pct(sessions.filter(s => s.priority_expired).length, sessions.length),
    disconnectsPerPlayer: players.length ? Math.round(avg(players.map(p => p.disconnects)) * 100) / 100 : null,
  };

  return {
    generatedAt: Date.now(),
    rangeDays: rangeDays || null,
    kpis,
    sessions: sessions.slice(0, 200).map(s => ({
      id: s.id.slice(0, 8), lobby: s.lobby, startedAt: s.started_at, durationSec: s.duration_sec,
      players: s.player_count, rounds: s.rounds_played, outcome: s.outcome,
      blockedPct: pct(blocked[s.id] || 0, faced[s.id] || 0),
      avgScore: sessionPlayers[s.id] ? Math.round(avg(sessionPlayers[s.id].map(p => p.score))) : null,
      priorityExpired: !!s.priority_expired,
    })),
    attacks, defences, priorities, scoreBins: bins, outcomes, events,
    health: lastHealth ? {
      at: lastHealth.ts, uptimeSec: lastHealth.uptime_sec, rssMb: lastHealth.rss_mb,
      sockets: lastHealth.sockets, activeLobbies: lastHealth.active_lobbies, players: lastHealth.players,
    } : null,
  };
}

module.exports = { compute };
