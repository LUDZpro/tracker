# Floor Logger v1

Self-hosted one-tap logging PWA writing to a Notion event-sourced personal tracking system.
Two screens (Home + Sleep), dark-only "instrument panel at night" UI, offline queue, PIN lock.

## Stack

Next.js 15 (App Router, TypeScript) — UI + API in one service · custom service worker
(offline shell + IndexedDB POST queue) · Docker Compose (app only, bound to
127.0.0.1:3000) · host nginx + certbot for TLS and edge rate limiting.

## Deploy (nginx + Docker)

On the server (`/opt/floor-logger`):

1. Copy `.env.example` → `.env` and fill in:
   - `NOTION_TOKEN` — internal integration token with access to the event-log data source
   - `SESSION_SECRET` — `openssl rand -hex 32`
   - `APP_PIN` — the unlock PIN
2. `docker compose up -d --build`
3. Install the nginx configs:
   - `deploy/nginx-ratelimit.conf` → `/etc/nginx/conf.d/floor-logger-ratelimit.conf`
   - `deploy/nginx-tracker.conf` → `/etc/nginx/sites-available/tracker.tachafine.solutions`
     (symlink into `sites-enabled`, then `nginx -t && systemctl reload nginx`)
4. `certbot --nginx -d tracker.tachafine.solutions` (needs the DNS A record in place)
5. Open the site, enter the PIN, use the browser's "Add to Home Screen".

The Notion data source (`59f692c3-e817-4893-ad70-0134b9bb1ff2`) must have these properties:
`Event` (title) · `Occurred at` (date) · `Precision`, `Category`, `Type`, `Scope` (select) ·
`Duration`, `Intensity` (number).

## Development

```bash
cd app
npm install
npm test          # domain-layer unit tests (vitest)
npm run dev       # needs NOTION_TOKEN / SESSION_SECRET / APP_PIN in the environment
npm run gen:icons # regenerate PWA icons (no image deps, pure node)
```

## Behavior notes

- **Precision is derived from entry method, never chosen**: now-tap → `exact`,
  offset chip / band drag / dial → `~5min`, fuzzy chip → `~hour`,
  "no idea" → `~part_of_day` (anchored at 23:00 of the evening).
- **Server validation on every write**: known types only, intensity 1–5, duration
  1–600 min, timestamps ISO-with-offset within ±48h, `sleep_start < wake_up`,
  span 20min–16h, no overlapping sleep pairs. Events older than 48h are locked.
- **Backfill exception**: `/api/sleep/backfill` accepts timestamps up to 4 days
  back so the missing-nights card (last 3 nights) is always actionable.
- **Offline**: taps are queued in IndexedDB by the service worker with their
  original tap-time timestamps and replayed on reconnect (202 → "queued" banner).
- **Undo**: 8-second window; undoes the Notion page (archive) or removes the
  queued item if it never left the device.

## Security

TLS + HSTS via nginx/certbot · nonce-based CSP (`default-src 'self'`, no third-party
origins, fonts self-hosted) · Notion token server-side only · PIN → HMAC-signed
httpOnly cookie (30d) · 5 PIN attempts/hr/IP + 30 req/min/IP at the edge ·
2KB body limit · `/api/today` exposes only the current wake-window.

## v1 hard boundary (do NOT build)

Notes fields · ABC chains · patterns relation · history/analytics beyond the
today strip · calendar integration · light theme · accounts · mid-night
awakening segments · reminders · auto-detection.
Standing rule: 7 days of real button presses before anything leaves this list.
