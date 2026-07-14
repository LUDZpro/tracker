# Tracker (Floor Logger)

Single-user, PIN-gated PWA that one-tap-logs personal events (sleep, caffeine, mood/energy, naps, meals, gym) into one Notion database. Next.js 15 App Router + React 19, TypeScript, CSS Modules, vitest. **Only other runtime deps: `@simplewebauthn/server` + `@simplewebauthn/browser` (passkey auth) — add nothing else without a strong reason.**

All app code is in `app/`. Root holds `Dockerfile`, `compose.yml`, `preview.env`, this file.

## Commands (run from `app/`)

```bash
npm run dev          # dev server (rarely needed — see Preview below)
npm test             # vitest, all colocated lib/*.test.ts
npx tsc --noEmit     # typecheck
npm run build        # production build (output: standalone)
npm run gen:icons    # regenerate public/icons PNGs from scripts/gen-icons.mjs
```

## Preview (Claude Code)

- `.claude/launch.json` runs the **standalone build** on port 3199 — after every `npm run build` you must re-copy assets or pages 404:
  `cp -r public .next/standalone/public && cp -r .next/static .next/standalone/.next/static`
- Login PIN is **1234** locally (`preview.env`); production uses a different PIN.
- CSS/JS changes need rebuild + server restart (it's a prod build, no HMR).
- Harness quirk: clicking Next `<Link>` via synthetic events sometimes doesn't navigate; use `location.href = '...'` in preview_eval instead.

## Architecture: one route, two surfaces

- `app/(ui)/page.tsx` is only a `useMediaQuery('(min-width: 1024px)')` switch:
  - **≥1024px** → `components/desktop/DesktopHome.tsx` — console UI: Rail nav, clock + 24h timeline (`Topbar`), capture column (hold = log now, click = open sheet, keyboard W/S/C/T/E/N/M/G), `GoalCards`, `Ledger` (today + yesterday + night row), `WeekStats`. Icons/tones/row copy live in `components/desktop/presentation.tsx`.
  - **<1024px** → `components/home/MobileHome.tsx` — the one-thumb logger (strip, list, big sleep CTA, action grid).
- Both surfaces share **all sheets** (`components/sheets/`): bottom sheet on mobile, centered 540px dialog on desktop (media query at the end of `sheets.module.css`). One sheet per event type; `EditEventSheet` edits every type.
- Nav: `components/nav/Rail.tsx` (desktop) + `TabBar.tsx` (mobile); each hides itself at the other breakpoint. **The `display:none` media queries must stay LAST in their CSS files** — equal specificity means source order decides.
- Other routes (`nutrition/`, `gym/`, `sleep/`, `login/`) are mobile-styled (max-width 28rem) on both surfaces; `home.module.css .page` offsets them right of the rail on desktop.
- **CBT section (`cbt/`, "Mind" tab) is its own domain, NOT an event type.** Guided 7-step thought-record wizard (`components/cbt/ThoughtRecordFlow.tsx`: trigger → thought → emotion + 0–100 SUDS dial → distortion grid → evidence balance scale → reframe → re-rate) writes to a **separate Notion database** via `lib/cbt/` (types/validation/mapping/notion + colocated tests; CBT data source id is in `lib/cbt/notion.ts`). Own responsive CSS (`cbt.module.css`: 42rem desktop column, flow becomes a centered dialog ≥1024px); emotion faces + distortion icons live in `components/cbt/presentation.tsx`. Routes: `GET/POST /api/cbt` (ISO-cursor paged list / create), `DELETE /api/cbt/[id]` (archive). `POST /api/cbt` also best-effort logs a bare `trigger` event into the main event log so the floor feed shows *when* it happened — the record's content never enters the event log.

## Data flow

- **Notion is the only store.** `lib/notion.ts` (API calls) → `lib/mapping.ts` (Notion ↔ `AppEvent`; meal/gym extras travel in a `{v:1,...}` JSON envelope in the `Notes` rich_text property). Schema quirks: `Type` is rich_text (not select); duration column is `Duration (min)` and is shared by nap and gym (`sessionDuration` app-side).
- **Read routes:** `/api/today` (floor only — meals/gym deliberately filtered out), `/api/history?type=meal|gym-session` (ISO-cursor paged), `/api/week` (all types, last 8 calendar days — feeds desktop goal cards + 7-day stats), `/api/session`, `/api/sleep/backfill`.
- **Write routes** (`/api/event`, `[id]`, `[id]/undo`, `[id]/convert-nap`) must invalidate caches: `lib/cache.ts` in-memory slots; **`invalidateToday()` also clears the week slot by design** — never add a write path that skips it.
- Client: `lib/client/api.ts` fetch wrappers (401 → redirect to /login), `queue.ts` offline queue via service worker, `historyCache.ts` module-level tab-switch cache.
- Hooks: `useToday`, `useWeek`, `useHistory` (poll 60s + refocus), `useLogger` (log + 12s undo window), `useLongPress` (500ms hold), `useMediaQuery`.
- Pure logic lives in `lib/` and is tested: `sleep.ts` (pairing, wake windows), `weekStats.ts` (7-day aggregations), `time.ts` (wall-clock helpers — always use these, never hand-roll date math; timestamps are local ISO with offset, days are wall dates, TZ in prod is Africa/Casablanca).

## Adding a new event type (checklist)

1. `lib/types.ts` — `EventType`, `CATEGORY_BY_TYPE`, payload/patch fields.
2. `lib/validation.ts` + test — field ranges.
3. `lib/mapping.ts` + test — Notion title/properties (Notes envelope if it has extra fields).
4. A sheet in `components/sheets/` + wire into `EditEventSheet`.
5. Both surfaces: `components/desktop/presentation.tsx` (icon, tone, rowText) and `components/home/eventPresentation.ts` (icon, summary).
6. Capture entry: `CAPTURES` in `desktop/CaptureColumn.tsx` and/or mobile `ActionGrid`.
7. Decide the read path: floor event (shows in `/api/today`) or tracker (filtered out of today, gets `/api/history` support).

Note: `trigger` is a floor event with no sheet and no capture entry — it's only ever created server-side by `POST /api/cbt` (`EditEventSheet` still opens it for time-edit/delete via its default rendering).

## Conventions & gotchas

- **Theme:** all colors/spacing come from `styles/tokens.css`. New palette uses prototype names (`--accent`, `--t1`…`--t5`, `--ok/--warn/--bad`); legacy aliases (`--sleep`, `--intake`, `--state`, `--danger`, `--bg`, `--ink`, `--dim`) are what pre-redesign components read. Never hardcode hex in components.
- Font is Inter via `next/font` (`--font-sans`). Numbers use tabular-nums.
- **The user's PostToolUse hook blocks any file containing `.` + `exec` + `(`** (assumes child-process). Use `String.prototype.match` instead of regex `.exe` + `c()`, and avoid that letter sequence even in comments.
- **Never let a `useEffect` depend on an array/object rebuilt every render** (e.g. `pages.flatMap(...)` from a hook). One such effect (`setGhosts([])` on `[events]`) created an infinite render loop that silently starved ALL router navigation app-wide (taps on nav did nothing, no errors) — hooks that return derived arrays must `useMemo` them (`useHistory`, `useCbtRecords`).
- Nav links use `components/nav/NavLink.tsx` (`router.push` in a `setTimeout`, plain `<a>`), not `next/link` — Link-click transitions stalled on next 15.5 in this app even after the loop fix; NavLink is the mechanism verified working on prod. Test nav clicks in **real Chrome via claude-in-chrome against localhost:3199**, not the preview harness (SPA navigation is unreliable inside the harness).
- **Auth:** PIN + WebAuthn passkeys (`lib/webauthn/`, `/api/webauthn/*`; login/options+verify+status are public in middleware). Session = rolling 7-min idle timeout — middleware re-signs the cookie on every authed request. Passkeys persist in `data/webauthn.json` (Docker volume `webauthn-data:/app/data`); RP id/origin derive from request headers, so localhost and prod both work unconfigured. Enrollment is offered on the login page right after a PIN unlock.
- Deletes are always Notion archive (reversible), never hard delete; UI pattern is 5s pending-delete with undo.
- Duplicate-sleep protection: logging wake/sleep that repeats current state must open `DuplicateCard`, never silently double-log (logic in both Home components' `log()`).
- Optimistic "ghost" rows (`ghost-` id prefix) render until the next refresh; never editable/deletable.
- Tests: vitest, colocated `lib/*.test.ts`. Test pure lib logic; UI is verified via preview screenshots. Run `npm test` + `tsc` + `build` before calling work done.
- CSP is nonce-based (`middleware.ts`) → everything renders dynamic; no inline scripts.

## Cost savers

- Trust this file + `git log` before re-exploring; the structure above is current as of 2026-07-12.
- Scoped test runs: `npx vitest run lib/weekStats.test.ts`.
- `/api/today` and `/api/week` responses are cached 60s server-side — "stale" data during manual testing is usually the cache, not a bug; any write invalidates.
- Icons: edit `scripts/gen-icons.mjs` + `app/icon.svg` together (same mark), then `npm run gen:icons`.

## Deploy

VPS at `/opt/floor-logger` (Docker, bound 127.0.0.1:3000, host nginx + certbot, Cloudflare DNS). Redeploy = rsync repo to `/opt/floor-logger`, then `docker compose up -d --build`. Container TZ must stay Africa/Casablanca (sleep-day boundaries).
