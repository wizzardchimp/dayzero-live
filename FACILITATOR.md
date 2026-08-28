# Day Zero Live — Facilitator Guide

> **Cyber Defence Multiplayer Game**
> Run on a big screen with players on phones

---

## 1. Setup

1. Open `dashboard.html` on the big screen projector/laptop
2. A QR code and session code appear — players scan to join on their phones
3. Wait for all players to join (they appear as cards on the dashboard)
4. Click **Start Game** when ready

> Each player starts with **£200,000** budget. Each breach costs £100,000. Go to £0 = **eliminated**.

---

## 2. Game Flow (per round)

1. **Priority Phase** — Players rank 3 priorities (Money, Data, Maintain Services). Faster = bonus points.
2. **Selecting Phase** — 120s timer. Players pick defences to deploy this round. Defences carry over.
3. **Spinning** — Wheel spin animation (7s). A random attack is selected.
4. **Reveal** — Each player sees if they blocked or were breached. Budget deducted on breach.
5. Repeat for 3 rounds. Game over → winner announced.

---

## 3. Round Structure & Logic

| Phase | What Happens | Player Action | Key Rules |
|-------|-------------|---------------|-----------|
| **Priority** | Players rank 3 priorities: 💰 Money, 💾 Data, ⚙️ Maintain Services | Drag to reorder, tap to confirm | 60% of score. Faster submit = more bonus. Each priority covers 3 attacks. |
| **Select R1** | Choose **3 defences** to deploy | Tap cards to select | Carry over — all 3 carry into Round 2 |
| **Select R2** | Choose **2 more defences** (3 carried from R1 = 5 active) | Tap cards to select | Carry over — all 5 carry into Round 3 |
| **Select R3** | Choose **1 more defence** (5 carried = 6 active) | Tap cards to select | Final round. Eliminated players see red screen. |
| **Attack** | Random attack selected from 9 available (weighted by priority bucket) | Watch the spin | One attack per round. Not repeated within a game. |
| **Result** | Compare active defences vs attack. If a defence counters the attack → blocked. | See blocked/breached result | Blocked = no damage. Breached = -£100k and Eliminated at £0 |

---

## 4. Defence → Attack Effectiveness

| Defence | 🎣 Phish | 🦠 Mal | 🔒 Ransom | 🌊 DDoS | 💉 SQL | ⚡ 0-Day | 🏢 Insider | 📤 Exfil | 🎭 Social |
|---------|---------|--------|----------|---------|--------|---------|-----------|---------|----------|
| 🛡️ Firewall | ✅ | — | — | ✅ | — | — | — | — | — |
| 💻 Endpoint | — | ✅ | ✅ | — | — | — | — | — | — |
| 🔐 MFA | — | — | — | — | — | — | ✅ | — | ✅ |
| 🔒 Encryption | — | — | ✅ | — | — | — | — | ✅ | — |
| 🔀 Segmentation | — | — | — | — | ✅ | — | ✅ | — | — |
| 💾 Backup | — | — | ✅ | ✅ | — | — | — | — | — |
| 👁️ Threat Det. | ✅ | — | — | — | — | ✅ | — | — | — |
| 🔑 Passwords | — | — | — | — | ✅ | — | — | — | ✅ |
| 📚 Training | — | ✅ | — | — | — | — | — | — | ✅ |
| 📊 Monitoring | — | — | — | — | — | ✅ | — | ✅ | — |
| 🔑 Passkeys | ✅ | — | — | — | — | — | — | — | ✅ |

> Each defence counters **2 attacks**. Each attack is countered by **2–4 defences**. Social Engineering has the most counters (4).

---

## 5. Priority → Attack Buckets

| Priority | Covers These Attacks |
|----------|---------------------|
| 💰 **Money** | Ransomware, Insider Threat, Social Engineering |
| 💾 **Data** | Phishing, SQL Injection, Data Exfiltration |
| ⚙️ **Maintain Services** | Malware, DDoS, Zero-Day Exploit |

### Scoring Formula

| Component | Weight | How It Works |
|-----------|--------|--------------|
| Priority Match | **75%** | Rank 1 = 3pts, Rank 2 = 2pts, Rank 3 = 1pt per matching attack |
| Speed | **25%** | Faster priority submit + faster defence selection = more points |
| Budget | ~~0%~~ | Removed — budget is now an elimination mechanic only |

**Awards:** Gold (≥78) · Silver (≥58) · Bronze (<58)
**Tiebreaker:** Most breaches survived.

---

## 6. Budget & Elimination

| Starting Budget | Cost per Breach | After 1 Breach | After 2 Breaches | Effect |
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
|---------|------|------|--------|
| Body | system-ui, -apple-system, Segoe UI, Roboto, sans-serif | 13–14px | 400 |
| Dashboard title | Same | 28–36px | 900 |
| Card name | Same | 16–18px | 700 |
| Card stat value | Same | 20–24px | 800 |
| Stat label | Same | 11–12px | 500 |
| Button | Same | 14–16px | 700 |
| Eliminated title | Same | 36px | 900, letter-spacing 4px, uppercase |

### Key Layout Values

| Element | Property | Value |
|---------|----------|-------|
| Card border-radius | `border-radius` | 12px |
| Button border-radius | `border-radius` | 8px |
| Badge border-radius | `border-radius` | 6px |
| Overlay transition | `transition` | 0.3s ease |
| Card grid min-width | `--card-min` | 300px (auto-scales to 145px for 12+ players) |
| Ranking table font | `font-size` | 14px, monospace for numbers |
| Budget bar height | `height` | 8px |

### Overlay Z-Index Stack

| Overlay | z-index |
|---------|---------|
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
| Success chime | Defence blocked |
| Error buzz | Breach |
| Click | Defence selection |
| Priority chime | Priority selection |
| Warning chime (15s) | Timer low warning |
| Drumroll | Wheel spin |
| Win fanfare | Game over |
| Music (loop) | During game phases |

---

*Generated from `shared.js` — the single source of truth for all game data.*
