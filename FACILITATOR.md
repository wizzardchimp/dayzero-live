# Day Zero Live — Facilitator Guide

> **Cyber Defence Multiplayer Game**
> Run on a big screen with players on phones

---

## 0. Two lobbies (A and B)

The home page shows **Lobby A** and **Lobby B**, each with a live status: 🟢 Free, 🟡 Open (waiting for players) or 🔴 In use (game running). Two facilitators can run separate games at the same time on the same site.

- Pick a **Free** lobby to host it. A busy lobby is locked so you can't interrupt a running game.
- If your laptop drops off or you refresh, you have **5 minutes** to come back and keep the game going (same browser tab). After that the lobby is freed.
- **← Lobbies** (top left of the dashboard) leaves and frees your lobby.
- "Take over" only appears once a lobby's host has been disconnected for 30 seconds (`TAKEOVER_AFTER_MS`). A lobby whose host is connected cannot be taken over, and a player's phone can never host.
- New players can join until Round 1 starts; after that only existing players can reconnect. Priorities are final once submitted.
- There is no facilitator PIN: whoever opens a free lobby's dashboard becomes its host, and player phones still cannot start, reset or flush a game. Don't share the dashboard link with players.
- `LOBBIES=A,B,C` adds more lobbies; `HOST_GRACE_MS` changes the 5-minute window.

---

## 1. Setup

1. Open the home page on the big screen projector/laptop and choose a free lobby. Player phones cannot start, reset, or flush the game.
2. The dashboard opens already unlocked for that lobby
3. A QR code and session code appear — players scan to join on their phones
4. Wait for all players to join (they appear as cards on the dashboard)
5. Click **Start Game** when ready

> Each player starts with **£200,000 ICO Budget**. Each breach incurs a **£100,000 fine**. Go to £0 = **eliminated**.

---

## 2. Game Flow (per round)

1. **Priority Phase** — Players rank 3 priorities (Money, Data, Maintain Services) against a **2 minute timer** shown on the dashboard and every phone. Round 1 starts automatically when it ends, or sooner if you press Start Round 1. Use − / + to adjust the time (`PRIORITY_TIMER` sets the default, in seconds). A player who hasn't chosen yet can still do it once Round 1 starts, and is then taken straight to the instructions before picking defences.
2. **Selecting Phase** — 120s timer. Players pick defences to deploy this round. Defences carry over.
3. **Spinning** — Wheel spins for about 5.5s (drumroll is ~6.5s). One attack is revealed, pre-drawn so each round is from a different priority bucket.
4. **Reveal** — Each player sees if they blocked or were breached. ICO fine of £100,000 imposed on breach.
5. Repeat for 3 rounds. Game over → winner announced.

---

## 3. Round Structure & Logic

| Phase | What Happens | Player Action | Key Rules |
|-------|-------------|---------------|-----------|
| **Priority** | Players rank 3 priorities: 💰 Money, 💾 Data, ⚙️ Maintain Services | Tap each item in order, then confirm | 75% of score. 2 minute timer; final once submitted. Each priority covers 3 attacks. |
| **Select R1** | Choose **2 defences** to deploy | Tap cards to select | Carry over — all 2 carry into Round 2 |
| **Select R2** | Choose **2 more defences** (2 carried from R1 = 4 active) | Tap cards to select | Carry over — all 4 carry into Round 3 |
| **Select R3** | Choose **1 more defence** (4 carried = 5 active) | Tap cards to select | Final round. Eliminated players see red screen. |
| **Attack** | One attack pre-drawn from each priority bucket, then shuffled | Watch the spin | One attack per round. Not repeated within a game. |
| **Result** | Compare active defences vs attack. If a defence counters the attack → blocked. | See blocked/breached result | Blocked = no damage. Breached = -£100k and Eliminated at £0 |

---

## 4. Defence → Attack Effectiveness

| Defence | Protects | 🎣 Phish | 🦠 Mal | 🔒 Ransom | 🌊 DDoS | 💉 SQL | ⚡ 0-Day | 🏢 Insider | 📤 Exfil | 🎭 Social |
|---------|----------|---------|--------|----------|---------|--------|---------|-----------|---------|----------|
| 🛡️ Firewall | 💾 ⚙️ | ✅ | — | — | ✅ | — | — | — | — | — |
| 💻 Endpoint | 💰 ⚙️ | — | ✅ | ✅ | — | — | — | — | — | — |
| 🔐 MFA | 💰 | — | — | — | — | — | — | — | — | ✅ |
| 🔒 Encryption | 💰 | — | — | ✅ | — | — | — | — | — | — |
| 🔀 Segmentation | 💰 💾 | — | — | — | — | ✅ | — | ✅ | — | — |
| 💾 Backup | 💰 ⚙️ | — | — | ✅ | ✅ | — | — | — | — | — |
| 👁️ Threat Det. | 💾 ⚙️ | ✅ | — | — | — | — | ✅ | — | — | — |
| 🔑 Passwords | 💰 💾 | — | — | — | — | ✅ | — | — | — | ✅ |
| 📚 Training | 💰 ⚙️ | — | ✅ | — | — | — | — | — | — | ✅ |
| 📊 Monitoring | 💾 ⚙️ | — | — | — | — | — | ✅ | — | ✅ | — |
| 🔑 Passkeys | 💰 💾 | ✅ | — | — | — | — | — | — | — | ✅ |
| 📋 Policy & Procedure | 💰 💾 | — | — | — | — | — | — | ✅ | ✅ | — |

> Each defence counters **2 attacks**. Each attack is countered by **2–4 defences**. Social Engineering has the most counters (4).

---

## 5. Priority → Attack Buckets

| Priority | Covers These Attacks |
|----------|---------------------|
| 💰 **Money** | Ransomware, Insider Threat, Social Engineering |
| 💾 **Data** | Phishing, SQL Injection, Data Exfiltration |
| ⚙️ **Maintain Services** | Malware, DDoS, Zero-Day Exploit |

### Defences by priority

Each defence counters two attacks, and those two usually sit in different priority buckets, so most defences protect **two** priorities. The phone shows this as tags on every defence card, and highlights the player's first priority.

| Priority | Defences that protect it | Count |
|----------|--------------------------|-------|
| 💰 **Money** | Endpoint Protection, Encryption, Backup & Recovery, Network Segmentation, Policy & Procedure, Multi-Factor Auth, Secure Passwords, Security Training, Passkeys | 9 |
| 💾 **Data** | Firewall, Threat Detection, Passkeys, Network Segmentation, Secure Passwords, Continuous Monitoring, Policy & Procedure | 7 |
| ⚙️ **Maintain Services** | Endpoint Protection, Security Training, Firewall, Backup & Recovery, Threat Detection, Continuous Monitoring | 6 |

| Spans | Defences | What they counter |
|-------|----------|-------------------|
| 💰 + 💾 | Network Segmentation | Insider Threat, SQL Injection |
| | Secure Passwords | Social Engineering, SQL Injection |
| | Passkeys | Social Engineering, Phishing |
| | Policy & Procedure | Insider Threat, Data Exfiltration |
| 💰 + ⚙️ | Endpoint Protection | Ransomware, Malware |
| | Backup & Recovery | Ransomware, DDoS |
| | Security Training | Social Engineering, Malware |
| 💾 + ⚙️ | Firewall | Phishing, DDoS |
| | Threat Detection | Phishing, Zero-Day |
| | Continuous Monitoring | Data Exfiltration, Zero-Day |
| 💰 only | Multi-Factor Auth | Social Engineering |
| | Encryption | Ransomware |

**What this means in play**

- **Dual-purpose defences are the strongest picks.** Ten of the twelve defences cover two attacks in two different priorities. MFA and Encryption cover one attack each, so they are the weakest picks.
- **Maintain Services is the hardest priority.** It has the fewest defences (6), and each of its attacks (Malware, DDoS, Zero-Day) is countered by only 2 defences. Money has 9 defences and Social Engineering alone has 4.
- **Money + Data pair up well.** Network Segmentation, Secure Passwords, Passkeys and Policy & Procedure protect both, so a player who ranks those two first can cover most of both with four picks.
- **Debrief prompt:** ask players which priority they ranked first, then which of their defences protected it. Players who picked only single-priority cover usually find they left the other two exposed.

### Scoring Formula

| Component | Weight | How It Works |
|-----------|--------|--------------|
| Priority Match | **75%** | Rank 1 = 3pts, Rank 2 = 2pts, Rank 3 = 1pt per matching attack |
| Speed | **25%** | Faster defence selection under the round timer = more points. A round with no completed selection scores 0 for speed. Priority time is not scored. |
| ICO Budget | ~~0%~~ | Removed — ICO Budget is now an elimination mechanic only |

**Awards:** Gold (≥78) · Silver (≥58) · Bronze (<58)
**Tiebreaker:** Fewest breaches.

---

## 6. ICO Budget & Elimination

| Starting ICO Budget | Fine per Breach | After 1 Breach | After 2 Breaches | Effect |
|----------------|-----------------|----------------|-------------------|--------|
| **£200,000** | £100,000 | £100,000 — still playing | **£0 — Eliminated** | Player sees red screen, cannot select in Round 3 |

---

## Design Reference

### Brand Colours

| Token | Hex | Usage |
|-------|-----|-------|
| `--accent` | `#2563eb` | Primary buttons, active states, bullet numbers |
| `--accent2` | `#e11d48` | Secondary accent, session code badge |
| `--accent-light` | `#1e3a5f` | Session code background, info-side bg |
| `--green` | `#059669` | Blocked result, success states |
| `--green-light` | `#064e3b` | Blocked badge background |
| `--red` | `#dc2626` | Breached result, eliminated screen, bankrupt |
| `--yellow` | `#f59e0b` | Timer warning (<15s) |
| `--text` | `#e2e8f0` | Primary text (light mode on dark) |
| `--text2` | `#94a3b8` | Secondary text, descriptions |
| `--text3` | `#64748b` | Tertiary text, labels |
| `--bg` | `#0f1117` | Page background |
| `--card` | `#1a1d28` | Card backgrounds, sections |
| `--border` | `#2d3142` | Borders, dividers |

### Typography

| Element | Font | Size | Weight |
|---------|----------|------|------|--------|
| Body | system-ui, -apple-system, Segoe UI, Roboto, sans-serif | 13–14px | 400 |
| Dashboard title | Same | 28–36px | 900 |
| Card name | Same | 16–18px | 700 |
| Card stat value | Same | 20–24px | 800 |
| Stat label | Same | 11–12px | 500 |
| Button | Same | 14–16px | 700 |
| Eliminated title | Same | 36px | 900, letter-spacing 4px, uppercase |

### Key Layout Values

| Element | Property | Value |
|---------|----------|----------|-------|
| Card border-radius | `border-radius` | 12px |
| Button border-radius | `border-radius` | 8px |
| Badge border-radius | `border-radius` | 6px |
| Overlay transition | `transition` | 0.3s ease |
| Card grid min-width | `--card-min` | 300px (auto-scales to 145px for 12+ players) |
| Ranking table font | `font-size` | 14px, monospace for numbers |
| Budget bar height | `height` | 8px |

### Overlay Z-Index Stack

| Overlay | z-index |
|---------|----------|---------|
| Name entry | 100 |
| Priority | 90 |
| Waiting | 80 |
| Wheel spin | 70 |
| Zoom reveal | 65 |
| Result | 60 |
| Eliminated | 200 |
| Game over | 100 |

### Audio (Web Audio API)

| Sound | Trigger |
|-------|---------|
| Click | Defence selection on the phone |
| Beep | Phone timer at 15s and 5s |
| Drumroll | Dashboard wheel spin |
| Reveal chime | Dashboard attack reveal |
| Win fanfare | Dashboard game over |
| Music (loop) | Dashboard during selection |

---

*Generated from `shared.js` — the single source of truth for all game data.*
