# Oil Imperium Online

A browser remake of the 1989 Commodore Amiga game *Oil Imperium* (also known as
*Black Gold*), with online multiplayer for 2 to 4 players. It stays close to the
original rules and look: a 320x256 screen, an Amiga-style palette and month-by-month
oil business strategy.

See [docs/design.md](docs/design.md) for the full design and milestones.

> **Status:** milestone 4. Play single player against the computer, or host an
> online game for 2 to 4 players: share the 4-letter code (or the invite link), pick
> companies in the lobby, and everyone plays the same month at once. Empty seats are
> played by the computer. Games are saved on the server and can be resumed.
>
> Oil has to be shipped out (by road, pipeline or tanker) before it can be sold.
> Buyers phone with supply contracts, the newspaper reports world events that move
> the price, and a shady agent will set rivals' wells on fire, sink their tankers or
> cook their books, unless they have hired guards.

## Project layout

| Folder | What it holds |
|---|---|
| `shared/` | Rules engine (`src/game/`), constants and the network protocol, used by both server and client |
| `server/` | Node.js HTTP + WebSocket server; serves the built client |
| `client/` | Browser game: TypeScript drawing on an HTML canvas, built with Vite |
| `deploy/` | systemd unit and Proxmox LXC setup guide |
| `docs/` | Design document |

## Development

Requires Node.js 22 or newer.

```sh
npm install
npm run dev        # server on :3000, client with live reload on http://localhost:5173
npm test           # unit tests
npm run typecheck  # TypeScript checks for all packages
```

## Production build

```sh
npm run build
npm start          # serves the game on http://localhost:3000
```

Environment variables: `PORT` (default 3000), `HOST` (default 0.0.0.0),
`STATIC_DIR` (default `client/dist`) and `DB_PATH` for saved online games (default
`data/oil-imperium.db`, using Node's built-in SQLite, so there is nothing extra to install).

To run it on a Proxmox host, follow [deploy/proxmox-lxc.md](deploy/proxmox-lxc.md).
A `Dockerfile` is included as an alternative.

## Graphics and copyright

The original game's graphics, music and name belong to their rights holders, so this
repository contains only newly made art in the same style. Never commit files
extracted from the original disks. The `assets/classic/` folder is git-ignored for
private use, see section 4 of the design doc.

All artwork is drawn by code in `client/src/art/`: a hand-made 5x7 pixel font,
dithered scenes in a 1980s Amiga style, and a world map generated from
[Natural Earth](https://www.naturalearthdata.com/) coastlines, which are in the public domain.
