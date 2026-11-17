// Backs up logged sessions to a PRIVATE GitHub repo and restores them if the
// volume is ever empty.
//
// Needs two Railway variables:
//   BACKUP_REPO   owner/name of a private repo, e.g. wizzardchimp/dayzero-data
//   BACKUP_TOKEN  a fine-grained token with "Contents: read and write" on that repo only
// Optional: BACKUP_BRANCH (default main), BACKUP_API_URL (for tests).
//
// The data goes to a different repo from the app on purpose: pushing to the app's
// repo would make Railway redeploy and end live games, and the app repo is public.

const logger = require('./logger');

const REPO = process.env.BACKUP_REPO || '';
const TOKEN = process.env.BACKUP_TOKEN || '';
const BRANCH = process.env.BACKUP_BRANCH || 'main';
const API = (process.env.BACKUP_API_URL || 'https://api.github.com').replace(/\/$/, '');

const state = { configured: !!(REPO && TOKEN), lastSuccess: null, lastError: null, pending: 0, restored: 0 };
let flushing = false;
let eventsUploaded = new Map(); // day -> event count last uploaded
let lastEventsUpload = 0;
const EVENTS_EVERY_MS = 30 * 60 * 1000; // keep the data repo's history quiet: events at most every 30 min

function status() { return { ...state, pending: logger.pendingExportIds().length }; }

async function gh(method, urlPath, body) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'dayzero-live-backup',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function putFile(repoPath, content, message) {
  const base = `/repos/${REPO}/contents/${repoPath.split('/').map(encodeURIComponent).join('/')}`;
  let sha;
  const existing = await gh('GET', `${base}?ref=${encodeURIComponent(BRANCH)}`);
  if (existing.ok) sha = (await existing.json()).sha;
  else if (existing.status !== 404) throw new Error(`GET ${repoPath} -> ${existing.status}`);
  const res = await gh('PUT', base, {
    message, branch: BRANCH, sha,
    content: Buffer.from(content, 'utf8').toString('base64'),
  });
  if (!res.ok) throw new Error(`PUT ${repoPath} -> ${res.status}`);
}

const pad = (n) => String(n).padStart(2, '0');
const monthOf = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; };
const dayOf = (ms) => { const d = new Date(ms); return `${monthOf(ms)}-${pad(d.getUTCDate())}`; };
const dayStart = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };

// Upload every session that hasn't been backed up yet, then today's event log.
async function flush() {
  if (!state.configured || !logger.enabled() || flushing) return;
  flushing = true;
  try {
    for (const id of logger.pendingExportIds()) {
      const s = logger.exportSession(id);
      if (!s) continue;
      await putFile(`sessions/${monthOf(s.startedAt)}/${id}.json`, JSON.stringify(s, null, 2), `Session ${id.slice(0, 8)} (${s.outcome})`);
      logger.markExported(id);
    }
    for (const ms of (Date.now() - lastEventsUpload < EVENTS_EVERY_MS ? [] : [Date.now() - 86400000, Date.now()])) {
      const start = dayStart(ms);
      const events = logger.eventsForDay(start);
      const key = dayOf(start);
      if (events.length && eventsUploaded.get(key) !== events.length) {
        const lines = events.map(e => JSON.stringify({ ts: e.ts, type: e.type, lobby: e.lobby, data: e.data ? JSON.parse(e.data) : null })).join('\n') + '\n';
        await putFile(`events/${key}.ndjson`, lines, `Events ${key}`);
        eventsUploaded.set(key, events.length);
        lastEventsUpload = Date.now();
      }
    }
    state.lastSuccess = Date.now();
    state.lastError = null;
  } catch (err) {
    state.lastError = err.message;
    console.error('Backup failed (will retry):', err.message);
  } finally {
    flushing = false;
  }
}

// If this server has no data (new or wiped volume), pull the sessions back from the repo.
async function restoreIfEmpty() {
  if (!state.configured || !logger.enabled() || logger.sessionCount() > 0) return;
  try {
    const tree = await gh('GET', `/repos/${REPO}/git/trees/${encodeURIComponent(BRANCH)}?recursive=1`);
    if (!tree.ok) throw new Error(`tree -> ${tree.status}`);
    const files = ((await tree.json()).tree || []).filter(f => f.type === 'blob' && /^sessions\/.+\.json$/.test(f.path));
    for (const f of files) {
      const res = await gh('GET', `/repos/${REPO}/contents/${f.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(BRANCH)}`);
      if (!res.ok) continue;
      const json = await res.json();
      try {
        const session = JSON.parse(Buffer.from(json.content, 'base64').toString('utf8'));
        if (session && session.id && !logger.hasSession(session.id)) { logger.importSession(session); state.restored++; }
      } catch (e) { /* skip a bad file */ }
    }
    console.log(`Backup restore: ${state.restored} session(s) restored from ${REPO}`);
  } catch (err) {
    state.lastError = 'restore: ' + err.message;
    console.error('Backup restore failed:', err.message);
  }
}

function start() {
  if (!state.configured) {
    console.log('Backup: not configured (set BACKUP_REPO and BACKUP_TOKEN to enable). Data stays on the volume only.');
    return;
  }
  console.log(`Backup: sessions will be copied to ${REPO} (${BRANCH})`);
  restoreIfEmpty().then(flush);
  setInterval(flush, Number(process.env.BACKUP_INTERVAL_MS) || 2 * 60 * 1000);
}

module.exports = { start, flush, status, restoreIfEmpty };
