# Oil Imperium Remake: Design Doc

Working title: **Oil Imperium Online** (rename before any public release, see Assets and legal).
Status: draft v0.1, 2026-10-13.

## 1. Goal

A browser-playable remake of reLINE's *Oil Imperium* (1989, Amiga; released in some markets as *Black Gold*) that:

- stays close to the original rules, screens and pacing;
- looks like the original (low-res 320x256-style pixel art, Amiga palette, chunky UI);
- supports 1 to 4 players over the internet, with computer opponents filling empty seats;
- runs as one small service on an old laptop under Proxmox (an LXC container with roughly 256 MB RAM and 1 vCPU should be plenty).

## 2. The original game (what we are recreating)

Sources: [Wikipedia: Black Gold](https://en.wikipedia.org/wiki/Black_Gold_(video_game)), [Dazeland review](https://dazeland.com/en/Amiga/Oil_Imperium.html), plus recollection of the Amiga version. Items marked *(verify)* should be checked against the original manual or by playing it in an emulator (FS-UAE / WinUAE) before we lock numbers.

### 2.1 Setup
- Up to 4 companies: **Interoil, All American, Transoil, Explora Inc.** Each is human or computer controlled. The original is hot-seat; we make it online.
- Each company starts with **$5 million**.
- Players pick one of four victory goals at game start:
  1. **Time limit:** play 3 years, richest company wins.
  2. **Survival:** last company not bankrupt wins.
  3. **Market share:** first to 80% market share.
  4. **Money:** first to $60 million (this mode also makes drilling slower).

### 2.2 Time and turns
- One turn = one **month**. Each action costs one or more **days**, so a player's month is a budget of days spent on actions.
- Players take turns in sequence each month; events (fires, price swings, sabotage results, news) resolve between turns.

### 2.3 World map and regions
Eight oil regions: **Alaska, North America, Central America, South America, Europe, USSR, Gulf region, Indochina.**
Each region has its own costs and its own grid of potential fields with hidden oil reserves. Good fields tend to sit in the same places every game in the original; we should keep a fixed-seed "classic" layout plus a randomized option.

### 2.4 Economy loop
1. **Licences:** buy a drilling licence for a region.
2. **Survey:** optionally pay an expert for an opinion on a field's likely yield (noisy estimate).
3. **Buy field and drill:** drill manually (mini-game) or pay for automatic drilling. A dry hole is a real outcome.
4. **Production:** a producing well fills **storage tanks** that you buy. Overflow is wasted. *(verify capacities)*
5. **Transport:** oil leaves by **pipeline** (pipe-laying mini-game when a connection is needed) and **tankers** purchased per region.
6. **Sales:** sell on the fluctuating **market** or deliver on **supply contracts** (fixed amount per month at a fixed price, with penalties for missed deliveries) *(verify contract rules)*.
7. **Finance:** bank loans with interest, monthly running costs, a balance sheet; bankruptcy ends a company.

Oil price moves monthly with random drift plus world events reported in a **newspaper** screen (wars, embargoes, discoveries) *(verify event list)*.

### 2.5 Sabotage and security
Players can spend money to hurt rivals:
- set a rival's oil well on fire;
- destroy a rival's tanker;
- manipulate a rival's balance sheet.

Defence: hire a **security company**. Sabotage can fail or be traced *(verify odds and consequences)*.

### 2.6 Action mini-games
1. **Drilling:** steer the drill head to correct deviation as it goes down.
2. **Pipe laying:** a *Pipe Mania*-style puzzle connecting a well to the pipeline under a timer.
3. **Fire fighting:** place dynamite to blow out a burning well. Alternatively pay specialist "Ted Redhair" to do it for you.

Every mini-game has a "pay to skip" automatic option, which matters for online play (see 3.4).

### 2.7 Screens to recreate
Office (hub with clickable objects: phone, newspaper, map, files/balance sheet), world map, region field map, drilling view, pipe-laying board, fire scene, market/contracts, bank, sabotage agent, end-of-month report, game-over/ranking.

## 3. Architecture

### 3.1 Stack (chosen for low resource use and one-person maintainability)
| Part | Choice | Why |
|---|---|---|
| Server | **Node.js 22 LTS + TypeScript** | One language on both sides; tiny footprint |
| Realtime | **WebSockets** via the `ws` library | No framework overhead; turn-based traffic is tiny |
| Client | **Plain TypeScript + HTML `<canvas>`**, bundled with **Vite** | Pixel-perfect low-res rendering, no game engine needed |
| Shared code | `shared/` package with the rules engine | Same rules on server and client, server stays authoritative |
| Storage | **SQLite** (`better-sqlite3`) | Single file, saves games and accounts, trivial backups |
| Deploy | One Node process serving static client + WebSocket on one port, run in a **Proxmox LXC** (Debian 12) under systemd; a Dockerfile is also provided | Matches the old-laptop setup |

Alternatives considered: Go server (lighter still, but two languages), Phaser/PixiJS client (unnecessary for static screens and simple mini-games). Can revisit if needed.

### 3.2 Repo layout
```
/shared   rules engine: pure functions, seeded RNG, game state types, action validation
/server   HTTP static hosting, WebSocket lobby + game rooms, SQLite persistence, AI players
/client   canvas renderer, screen state machine, input, sound, mini-games
/assets   sprites, fonts, palettes, sounds (see section 4)
/deploy   Dockerfile, systemd unit, LXC setup notes
```

### 3.3 Game state and networking
- **Server-authoritative, deterministic rules.** `applyAction(state, action, rng) -> state` lives in `shared/`. Clients send intents (`buyField`, `sellOil`, `sabotage`...), the server validates and broadcasts the result. Hidden info (true reserves, sabotage plans, rivals' contracts) is never sent to other clients.
- **Seeded RNG** stored in the game so a game can be replayed and debugged from its action log.
- **Persistence:** every accepted action is appended to SQLite; a game can be resumed after a server restart or reconnect.
- **Lobby:** create/join room with a short code, pick company, set goal, fill empty seats with AI. Simple nickname + room code to start; accounts later if wanted.

### 3.4 Turn model online
The original is hot-seat, so other players wait during your turn. Online options:
- **Simultaneous (default, decided 2026-10-14):** all players act during the same month at once, each spending their own day budget. Actions that touch shared things (buying the same field, market sales, sabotage) queue up and resolve in a fixed order at month end: sabotage first, then purchases (ties broken by who submitted first), then sales against the month's price. The month ends when everyone presses "End month" or a configurable timer runs out. AI players submit instantly.
- **Classic (option):** strict sequential turns like the original hot-seat game, for anyone who wants the authentic pace.
- **Async:** because state is persisted, a game can also be played play-by-mail style over days.

Mini-games are played locally by the active player; the client reports the outcome (with input log for basic sanity checks). Since this is a friends-and-family game, heavy anti-cheat is out of scope.

### 3.5 AI opponents
Rule-based bots from the start (buy cheap promising fields, keep tanks from overflowing, sell above a moving average, occasional sabotage when cash rich). Needed for single player and empty seats.

### 3.6 Hosting on the Proxmox laptop
- Debian 12 LXC (unprivileged), 1 vCPU, 512 MB RAM, 4 GB disk to be safe.
- Node 22 via NodeSource or a static binary, app under systemd.
- Internet access: easiest is a **Cloudflare Tunnel** or **Tailscale Funnel** (no port forwarding, free TLS). Otherwise port-forward 443 to a Caddy reverse proxy for automatic HTTPS.
- Backups: the SQLite file, included in Proxmox's normal vzdump of the container.

## 4. Assets and legal

The original graphics, music, names and the "Oil Imperium" title belong to the original rights holders (reLINE Software / Rainbow Arts, now owned by others). Extracting and redistributing them from the Amiga disks on a public server would be copyright infringement, even for an abandonware title.

Options:
1. **Recreated pixel art (recommended for anything public):** new art drawn in the same style: 320x256 logical resolution, 32-colour Amiga-style palette, same screen layouts. Gives the original look without copying files. Company names, the "Ted Redhair" character and the title should also get our own versions.
2. **User-supplied original assets (private use):** the client can load an optional "classic asset pack" that the owner extracts from their own copy of the game and places on their own server. The repo never contains original files, only an extraction/mapping script and placeholder art. Fine for a private game among friends; do not host it publicly.
3. **Both:** ship option 1 by default, support option 2 as a local override. This is the suggested plan.

Game mechanics themselves are not copyrightable, so recreating the rules is fine.

## 5. Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | **Repo skeleton** | Monorepo with shared/server/client, Vite dev server, WebSocket echo, CI lint+test, Dockerfile, runs in an LXC |
| M1 | **Rules engine, no UI** | Months, days, money, licences, fields, drilling (auto), tanks, market price, sales, loans, bankruptcy, all four victory goals, unit tests, seeded RNG |
| M2 | **Playable single player** | Canvas office hub, world map, region map, market, bank, monthly report with placeholder pixel art; one human vs 3 basic AI |
| M3 | **Online multiplayer** | Lobby with room codes, 2 to 4 humans + AI, simultaneous months with end-of-month resolution, reconnect/resume from SQLite |
| M4 | **Transport, contracts, sabotage** | Tankers, pipelines, supply contracts, sabotage + security, newspaper events |
| M5 | **Mini-games** | Drilling, pipe laying, fire fighting, each with pay-to-skip |
| M6 | **Art and sound pass** | Full recreated pixel art and chiptune-style audio, optional classic asset pack loader |
| M7 | **Self-host release** | Install guide for Proxmox LXC, tunnel/HTTPS setup, backups |

## 6. Open questions
- Exact numbers (field costs per region, tank capacity, tanker prices, interest rate, price model). Best source: the original manual plus playing in an emulator and noting values.
- Repo name and whether the game will ever be public (decides how strictly to avoid original assets and names).
