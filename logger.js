// Session logging for Day Zero Live.
//
// Stores one row per session, per anonymised player and per round, plus a small
// event log and server-health samples, in SQLite on a persistent volume
// (DATA_DIR, or Railway's RAILWAY_VOLUME_MOUNT_PATH). No player names are stored.
// If SQLite or the folder isn't available the game carries on without logging.

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const RETENTION_DAYS = Number(process.env.DATA_RETENTION_DAYS) || 365;

let db = null;
let stmt = {};

function init() {
  try {
    const Database = require('better-sqlite3');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(path.join(DATA_DIR, 'dayzero.db'));
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        lobby TEXT,
        started_at INTEGER,
        ended_at INTEGER,
        outcome TEXT,
        player_count INTEGER,
        rounds_played INTEGER,
        duration_sec INTEGER,
        priority_expired INTEGER,
        priority_duration_sec INTEGER,
        exported_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS session_players (
        session_id TEXT,
        idx INTEGER,
        score INTEGER,
        award TEXT,
        budget INTEGER,
        breaches INTEGER,
        eliminated_round INTEGER,
        priority TEXT,
        priority_pct INTEGER,
        speed_pct INTEGER,
        late_priority INTEGER,
        disconnects INTEGER,
        defences TEXT,
        round_results TEXT,
        select_secs TEXT,
        PRIMARY KEY (session_id, idx)
      );
      CREATE TABLE IF NOT EXISTS session_rounds (
        session_id TEXT,
        round INTEGER,
        attack_id TEXT,
        faced INTEGER,
        blocked INTEGER,
        PRIMARY KEY (session_id, round)
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER,
        type TEXT,
        lobby TEXT,
        data TEXT
      );
      CREATE TABLE IF NOT EXISTS health (
        ts INTEGER,
        uptime_sec INTEGER,
        rss_mb INTEGER,
        sockets INTEGER,
        active_lobbies INTEGER,
        players INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
    `);
    stmt.session = db.prepare(`INSERT OR REPLACE INTO sessions
      (id,lobby,started_at,ended_at,outcome,player_count,rounds_played,duration_sec,priority_expired,priority_duration_sec,exported_at)
      VALUES (@id,@lobby,@startedAt,@endedAt,@outcome,@playerCount,@roundsPlayed,@durationSec,@priorityExpired,@priorityDurationSec,@exportedAt)`);
    stmt.player = db.prepare(`INSERT OR REPLACE INTO session_players
      (session_id,idx,score,award,budget,breaches,eliminated_round,priority,priority_pct,speed_pct,late_priority,disconnects,defences,round_results,select_secs)
      VALUES (@sessionId,@idx,@score,@award,@budget,@breaches,@eliminatedRound,@priority,@priorityPct,@speedPct,@latePriority,@disconnects,@defences,@roundResults,@selectSecs)`);
    stmt.round = db.prepare(`INSERT OR REPLACE INTO session_rounds (session_id,round,attack_id,faced,blocked)
      VALUES (@sessionId,@round,@attackId,@faced,@blocked)`);
    stmt.event = db.prepare('INSERT INTO events (ts,type,lobby,data) VALUES (?,?,?,?)');
    stmt.health = db.prepare('INSERT INTO health (ts,uptime_sec,rss_mb,sockets,active_lobbies,players) VALUES (?,?,?,?,?,?)');
    console.log(`Logging to ${path.join(DATA_DIR, 'dayzero.db')}`);
    if (process.env.RAILWAY_ENVIRONMENT && !process.env.DATA_DIR && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
      console.warn('WARNING: no Railway volume is attached, so the log is lost on every redeploy. Attach a volume (see DATA.md).');
    }
    prune();
    return true;
  } catch (err) {
    db = null;
    console.warn('Logging disabled:', err.message);
    return false;
  }
}

const enabled = () => !!db;

// Wraps every write so a logging problem can never break a game.
function safe(fn, fallback) {
  if (!db) return fallback;
  try { return fn(); } catch (err) { console.error('Log error:', err.message); return fallback; }
}

function recordSession(s) {
  return safe(() => {
    const tx = db.transaction(() => {
      stmt.session.run({
        id: s.id, lobby: s.lobby, startedAt: s.startedAt, endedAt: s.endedAt, outcome: s.outcome,
        playerCount: s.playerCount, roundsPlayed: s.roundsPlayed, durationSec: s.durationSec,
        priorityExpired: s.priorityExpired ? 1 : 0, priorityDurationSec: s.priorityDurationSec || 0,
        exportedAt: s.exportedAt || null,
      });
      (s.players || []).forEach(p => stmt.player.run({
        sessionId: s.id, idx: p.idx, score: p.score, award: p.award, budget: p.budget, breaches: p.breaches,
        eliminatedRound: p.eliminatedRound || 0, priority: JSON.stringify(p.priority || []),
        priorityPct: p.priorityPct, speedPct: p.speedPct, latePriority: p.latePriority ? 1 : 0,
        disconnects: p.disconnects || 0, defences: JSON.stringify(p.defences || []),
        roundResults: JSON.stringify(p.roundResults || []), selectSecs: JSON.stringify(p.selectSecs || []),
      }));
      (s.rounds || []).forEach(r => stmt.round.run({
        sessionId: s.id, round: r.round, attackId: r.attackId, faced: r.faced, blocked: r.blocked,
      }));
    });
    tx();
    return true;
  }, false);
}

function event(type, lobby, data) {
  safe(() => stmt.event.run(Date.now(), type, lobby || null, data ? JSON.stringify(data) : null));
}

function healthSample(h) {
  safe(() => stmt.health.run(Date.now(), h.uptimeSec, h.rssMb, h.sockets, h.activeLobbies, h.players));
}

// A session in the shape that is backed up to the private repo.
function exportSession(id) {
  return safe(() => {
    const s = db.prepare('SELECT * FROM sessions WHERE id=?').get(id);
    if (!s) return null;
    const players = db.prepare('SELECT * FROM session_players WHERE session_id=? ORDER BY idx').all(id).map(p => ({
      idx: p.idx, score: p.score, award: p.award, budget: p.budget, breaches: p.breaches,
      eliminatedRound: p.eliminated_round, priority: JSON.parse(p.priority || '[]'),
      priorityPct: p.priority_pct, speedPct: p.speed_pct, latePriority: !!p.late_priority,
      disconnects: p.disconnects, defences: JSON.parse(p.defences || '[]'),
      roundResults: JSON.parse(p.round_results || '[]'), selectSecs: JSON.parse(p.select_secs || '[]'),
    }));
    const rounds = db.prepare('SELECT round,attack_id,faced,blocked FROM session_rounds WHERE session_id=? ORDER BY round').all(id)
      .map(r => ({ round: r.round, attackId: r.attack_id, faced: r.faced, blocked: r.blocked }));
    return {
      schema: 1, id: s.id, lobby: s.lobby, startedAt: s.started_at, endedAt: s.ended_at, outcome: s.outcome,
      playerCount: s.player_count, roundsPlayed: s.rounds_played, durationSec: s.duration_sec,
      priorityExpired: !!s.priority_expired, priorityDurationSec: s.priority_duration_sec, players, rounds,
    };
  }, null);
}

const pendingExportIds = () => safe(() => db.prepare('SELECT id FROM sessions WHERE exported_at IS NULL ORDER BY started_at').all().map(r => r.id), []);
const markExported = (id) => safe(() => db.prepare('UPDATE sessions SET exported_at=? WHERE id=?').run(Date.now(), id));
const sessionCount = () => safe(() => db.prepare('SELECT COUNT(*) n FROM sessions').get().n, 0);
const hasSession = (id) => safe(() => !!db.prepare('SELECT 1 FROM sessions WHERE id=?').get(id), false);

// Used when restoring from the backup repo: stored as already exported.
function importSession(s) {
  return recordSession({ ...s, exportedAt: Date.now() });
}

function eventsForDay(dayStartMs) {
  return safe(() => db.prepare('SELECT ts,type,lobby,data FROM events WHERE ts>=? AND ts<? ORDER BY id')
    .all(dayStartMs, dayStartMs + 86400000), []);
}

// After the retention period, drop the per-player and per-round detail and keep the session totals.
function prune() {
  safe(() => {
    const cutoff = Date.now() - RETENTION_DAYS * 86400000;
    db.prepare('DELETE FROM session_players WHERE session_id IN (SELECT id FROM sessions WHERE started_at<?)').run(cutoff);
    db.prepare('DELETE FROM session_rounds WHERE session_id IN (SELECT id FROM sessions WHERE started_at<?)').run(cutoff);
    db.prepare('DELETE FROM events WHERE ts<?').run(cutoff);
    db.prepare('DELETE FROM health WHERE ts<?').run(Date.now() - 30 * 86400000);
  });
}

function close() { try { if (db) db.close(); } catch (e) { /* ignore */ } db = null; }

module.exports = {
  init, enabled, recordSession, event, healthSample, exportSession, pendingExportIds, markExported,
  sessionCount, hasSession, importSession, eventsForDay, prune, close, DATA_DIR,
};
