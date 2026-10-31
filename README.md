# [Bunker](https://bunker-top-eshkere.vercel.app/) — client

Browser client for **Bunker**, an online social deduction game set in the S.T.A.L.K.E.R. universe. Players see each other on camera, with their characteristics drawn over the video. The client also handles voice chat, action cards, animations and sounds.

Server: [bunker-server-nestjs](https://github.com/Gor7yo/bunker-server-nestjs).

## Features

- **Home page**
  - Lists public rooms, updated in real time.
  - You can search and filter by mode, free seats and sort order. Filters are kept in the page URL, so a filtered list can be shared.
  - You can join a private room by code.
  - Creating a room has its own page.
- **Lobby**
  - Shows everyone's camera and ready status.
  - The host sets the mode, player limit, timers and action card rules, assigns a moderator, kicks players and hands over host rights.
  - `/room/CODE` works as an invite link.
- **Game screen, built like a video call**
  - Camera tiles resize so every player fits on screen.
  - Characteristics appear as colour-coded chips on each camera: main ones bottom-left, the rest bottom-right. Unrevealed ones show only their name. Hover a chip to see its description.
  - A phase bar shows the steps of the round and a timer bar that shrinks as time runs out.
  - **My card** slides down from the top and opens by itself on your turn. Your action card is there too, with target selection.
  - Scenario, log, how-to-play and the moderator console open in slide-out drawers.
- **Media dock** in the bottom-right corner
  - Microphone and camera buttons: green means on, red means off.
  - Device picker and game sound toggle.
  - Hotkeys: **M** for the microphone, **V** for the camera.
- **Atmosphere**
  - A "ROUND N" sign that looks more worn every round: rust, soot and moss.
  - Procedural sound effects: Geiger counter, radio static, bunker doors, anomalies.
  - The finale shows the bunker door. It slams shut if you were left outside and swings open if you made it in. The whole UI turns red or green to match.

## Tech stack

React 19 · TypeScript · Vite · MobX · Socket.IO client · LiveKit (`livekit-client`, `@livekit/components-react`) · CSS Modules · lucide-react

## Getting started

Requires Node.js 22+, pnpm and a running [server](https://github.com/Gor7yo/bunker-server-nestjs).

```bash
pnpm install
cp .env.example .env     # set the server URL if it's not localhost:3000
pnpm dev                 # http://localhost:5173
```

| Variable | Description | Default |
|---|---|---|
| `VITE_SERVER_URL` | Server URL | `http://localhost:3000` |
| `VITE_SENTRY_DSN` | Sentry project DSN for error reports. Leave empty to turn reporting off. | — |

> Browsers only allow camera and microphone access on `localhost` or over **HTTPS**. To play with friends over the network, serve the client over HTTPS.

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server with hot reload |
| `pnpm build` | Type-check and build to `dist/` |
| `pnpm preview` | Preview the production build |
| `pnpm lint` | ESLint |

## Project structure

```
src/
├── api/                  # socket + ack requests, protocol types, GET /rooms
├── store/                # roomStore (room state, session), toastStore, localStorage
├── hooks/                # useAction, useCountdown, useFitGrid, usePublicRooms
├── styles/global.css     # design tokens, reset, animations, finale themes
├── components/
│   ├── ui/               # UI kit: Button, Panel, Field, Select, Switch, Badge, Alert,
│   │                     #   Drawer, Toaster, Spinner, Page, useTooltip
│   ├── CardView.tsx      # characteristics list (My card, moderator's player view)
│   ├── SettingsForm.tsx  # room settings
│   └── traits.ts         # characteristic icons and colours
├── pages/
│   ├── Home/             # room list and filters
│   ├── CreateRoom/       # create a room
│   ├── Room/             # /room/:code — lobby, game, or join-by-link form
│   ├── Lobby/
│   └── GameScreen/       # game: tiles, chips, phase bar, drawers, finale
├── voice/                # LiveKit: room, player video, media dock
└── sound/                # procedural sound effects (Web Audio) and their triggers
```

### How it works

- **The server holds the state.** The client sends commands with `request(event, payload)`, which resolves to `{ ok, data | error }`. Updated state arrives as `room:state` and goes into `roomStore`.
- **Sessions survive reloads.** The session token is kept in `localStorage`, and the client restores the session after a page reload or a dropped connection.
- **Accurate timers.** Countdowns use `serverNow` to correct for clock drift between client and server.
- **Small home page bundle.** The room page is a separate lazy-loaded chunk (`React.lazy`), so LiveKit isn't downloaded on the home page.

## Design system

All colours, spacing, fonts, radii and animations are tokens in [`src/styles/global.css`](src/styles/global.css). Components use only these tokens, so the theme changes in one place:

| Token | Purpose |
|---|---|
| `--color-accent` and its variants | Accent colour: radiation amber, turning red or green in the finale |
| `--trait-*` | Colour of each characteristic's chips |
| `--hazard-stripes`, `--hazard-animation` | Moving black-and-yellow hazard stripes |

To stagger elements as they appear, use the `.enter`, `.enter-scale` and `.pop` classes with `style={{ "--i": index }}`.

If the system's reduced-motion setting is on, animations are turned off.
