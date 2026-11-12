# Production deployment · Netlify + Colyseus

Netlify serves `apps/web/dist`. Multiplayer rooms and bot simulation run in a separate, continuously running Node 22 process. Deploying the static frontend alone does not deploy Colyseus.

## Backend

Deploy this repository to a Node web-service host. Keep the service working directory at the repository root:

- Install/build: `npm ci --include=dev`
- Start: `npm start --workspace apps/server`
- Health check: `GET /health` → `{"ok":true,"service":"broom-league","protocol":1}`
- Port: host-provided `PORT` (default 2567); bind address `0.0.0.0`.
- Public ingress: HTTPS and WebSocket upgrades on the same hostname/443. TLS terminates at the host; do not expose a guessed `:2567` port in production.
- Instances: **one**. Room state is in memory; restarting ends active matches. Multiple instances need shared presence/driver and routing first.

`render.yaml` is an optional Render blueprint, not evidence of an existing deployment. Its free plan can sleep; a cold start may exceed the 15-second client connection limit and require retry. For predictable fast startup, use an always-running service chosen by the owner. No account, paid plan, backend service, or DNS record has been created by the code fix.

## Netlify

`netlify.toml` sets the root build command `npm run build`, Node 22 and publish directory `apps/web/dist`. Set **VITE_SERVER_URL** in the Netlify build environment to the real public backend URL, for example `https://<actual-backend-host>`, then create a new production deploy. Vite embeds this value at build time; changing a variable without rebuilding does not update existing JavaScript. This is a public endpoint, not a secret.

Do not set this variable to the static frontend's hostname unless that host explicitly reverse-proxies the Colyseus backend with WebSocket support. Do not add an SPA fallback that serves `index.html` for missing GLB, WASM or texture assets.

Without a configured production backend, match actions show a persistent configuration error before downloading the heavy arena. Quick practice still runs on static hosting. Localhost/127.0.0.1/IPv6 loopback preview and Vite development LAN retain the local port-2567 default. HTTPS pages reject insecure backend URLs.

Startup displays connection versus arena/character/physics stages. Matchmaking + WebSocket join has a 15-second deadline with HTTP abort and socket cleanup. Arena preparation has a 90-second deadline; an unsuccessful arena load requires page reload. Backend connection is attempted before arena loading so unreachable servers do not hide behind a large download.

## Verify before declaring production fixed

1. Backend `/health` returns the expected JSON over HTTPS.
2. Rebuild Netlify with the actual `VITE_SERVER_URL`.
3. Inspect browser Network: matchmaking POST and WebSocket connect go to that backend; no request targets `saputerbang.numanarif.dev:2567`.
4. Open two browser contexts at the production URL; create/join an invite, ready/start, observe consistent scores, finish and rematch.
5. Confirm Quick practice works independently of backend availability.

Local checks:

```sh
npm run check
# Production preview and local backend running:
node tests/startup-browser.mjs
BASE_URL=http://localhost:4173 npm run test:match
```

The startup browser fixture serves the exact production bundle under a non-local test hostname. It verifies missing-backend failure without port guesses or heavy asset requests, repeat attempt, and practice recovery. It is not a verification of a deployed public backend.

References: [Vite environment variables](https://vite.dev/guide/env-and-mode), [Netlify Vite setup](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/), [Render WebSockets](https://render.com/docs/websocket).
