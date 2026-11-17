# Session logging and backup

The server keeps a small, anonymous record of every game so you can see how it is
being played. Nothing here changes how the game behaves, and if logging is
unavailable the game simply carries on.

## What is recorded

- **Sessions:** lobby, start and end time, number of players, rounds played, how it
  ended (`completed`, `ended-by-host`, `returned-to-lobby`, `host-left`,
  `taken-over`, `idle-timeout`, `host-released`, `server-restart`), and whether the
  priority timer ran out.
- **Players, numbered by final rank, never by name:** score, award, budget, breaches,
  the round they were eliminated, priority order, defences picked, blocked or
  breached per round, seconds to lock in each round, whether priorities were set
  late, and how many times they disconnected.
- **Rounds:** the attack, how many players faced it and how many blocked it.
- **Events:** host claimed, away or back, lobby taken over or released, bad join
  codes, late joins refused, server start and stop.
- **Server health:** uptime, memory, connected sockets and active lobbies every 5
  minutes (kept for 30 days).

Player names are not stored anywhere. Per-player and per-round detail is deleted
after `DATA_RETENTION_DAYS` (default 365); the session totals are kept.

## Setup on Railway (one-off)

### 1. Attach a volume (keeps the log across redeploys)

In the Railway project: **+ New → Volume**, attach it to the app service and mount
it at `/data`. Railway then sets `RAILWAY_VOLUME_MOUNT_PATH` and the app stores
`dayzero.db` there. (Set `DATA_DIR` to override.)

### 2. Back up to a private repo (optional, recommended)

The backup goes to a **different, private** repo. It must not be this one: this repo
is public, and pushing to it would make Railway redeploy and end live games.

1. Create a private GitHub repo, for example `dayzero-data`, and add any file
   (a README) so the `main` branch exists.
2. Create a fine-grained personal access token: *Settings → Developer settings →
   Fine-grained tokens*. Repository access: only `dayzero-data`. Permission:
   **Contents: Read and write**.
3. In Railway, add two variables to the app service:
   - `BACKUP_REPO` = `your-username/dayzero-data`
   - `BACKUP_TOKEN` = the token

When a session ends it is copied to `sessions/YYYY-MM/<id>.json`, and the event log to
`events/YYYY-MM-DD.ndjson` (at most every 30 minutes). Failed uploads are retried
every 2 minutes. If the app starts with an empty volume it restores every session
from the repo.

Optional: `BACKUP_BRANCH` (default `main`), `BACKUP_INTERVAL_MS`.

## Reading the data

The database is SQLite: `dayzero.db` on the volume, or clone the data repo and read
the JSON files. Tables: `sessions`, `session_players`, `session_rounds`, `events`,
`health`.
