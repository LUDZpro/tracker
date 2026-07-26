# Tracker (Floor Logger)

Single-user, PIN-gated PWA that one-tap-logs personal events (sleep, caffeine, mood/energy, naps, meals, gym) into Postgres. Next.js 15 App Router + React 19, TypeScript, CSS Modules, vitest. **Only other runtime deps: `@simplewebauthn/server` + `@simplewebauthn/browser` (passkey auth) and `pg` (the store) — add nothing else without a strong reason.**

**Notion was the original store; it was migrated out on 2026-07-26 and is no longer read or written.** `NOTION_TOKEN` is gone from `compose.yml`; the one-time importer (`app/scripts/import-from-notion.mjs`) is kept for reference and is the only thing that still knows the old data source ids.

All app code is in `app/`. Root holds `Dockerfile`, `compose.yml`, `preview.env`, this file.

## Commands (run from `app/`)

```bash
npm run dev          # dev server (rarely needed — see Preview below)
npm test             # vitest, all colocated lib/*.test.ts
npx tsc --noEmit     # typecheck
npm run build        # production build (output: standalone)
npm run gen:icons    # regenerate public/icons PNGs from scripts/gen-icons.mjs
npm run db:migrate   # apply db/migrations/*.sql (also runs on container start)
```

**Postgres must be up before the app can serve anything:** `docker compose up -d db`
(host-mapped to `127.0.0.1:5433`; `DATABASE_URL` for local runs lives in `preview.env`).
Inspect it with `docker compose exec db psql -U floor -d floor`.

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
- Other routes (`gym/`, `sleep/`, `login/`) are mobile-styled (max-width 28rem) on both surfaces; `home.module.css .page` offsets them right of the rail on desktop.
- **Nutrition (`nutrition/`) is two-surface like home.** `page.tsx` is a `useMediaQuery` switch: ≥1024px → `components/nutrition/desktop/NutritionConsole.tsx` (3-col console: `RecipeList` | `DayLedger` | `WeekPanel`, CSS in `nutrition-console.module.css`, week math in `lib/nutrition/stats.ts` — tested); <1024px → `components/nutrition/MobileNutrition.tsx` (the original list + `RecipeQuickLog` chips). **Recipes are NOT an event type** — they live in their own `recipes` table (`lib/recipes/store.ts`) and logging one just posts a normal `meal` event. `GET /api/recipes` returns `{recipes, proteinTarget, calorieTarget}`; targets come from env `PROTEIN_TARGET`/`CALORIE_TARGET` (defaults: `PROTEIN_TARGET_G` from `lib/weekStats.ts` / 2200 — keep the protein default tied to that constant so the home goal card agrees). Recipe list is cached 5 min server-side (`lib/cache.ts`), no invalidation. **There is still no in-app recipe editor** — recipes used to be edited in Notion, so today they change only via SQL. Optimistic ghost rows are cleared per-row only when their real event lands (`clearLandedGhosts` in `components/nutrition/ghost.ts`); don't revert to blanket-clearing on refresh.
- **CBT section (`cbt/`, "Mind" tab) is its own domain, NOT an event type.** Guided 7-step thought-record wizard (`components/cbt/ThoughtRecordFlow.tsx`: trigger → thought → emotion + 0–100 SUDS dial → distortion grid → evidence balance scale → reframe → re-rate) writes to its own `cbt_records` table via `lib/cbt/` (types/validation/store + colocated validation test). Distortions and the two evidence lists are real `text[]` columns. Own responsive CSS (`cbt.module.css`: 42rem desktop column, flow becomes a centered dialog ≥1024px); emotion faces + distortion icons live in `components/cbt/presentation.tsx`. Routes: `GET/POST /api/cbt` (ISO-cursor paged list / create), `DELETE /api/cbt/[id]` (archive). `POST /api/cbt` also best-effort logs a bare `trigger` event into the main event log so the floor feed shows *when* it happened — the record's content never enters the event log.

## Data flow

- **Postgres is the only store.** `lib/db/pool.ts` (pooled `pg` client + `StoreError`) → `lib/db/rows.ts` (row ↔ `AppEvent`, tested) → `lib/store/events.ts`, `lib/cbt/store.ts`, `lib/recipes/store.ts`. Schema in `app/db/migrations/*.sql`, applied in filename order and tracked in `schema_migrations`.
- **`occurred_at` is `text`, not `timestamptz`** — it holds the exact ISO string with the offset of the moment it happened, because `lib/time.ts` groups days and nights off the wall-clock part of that string. `occurred_ts timestamptz` sits beside it purely for ordering, range filters and indexes. **Any write that sets one must set the other**, or the row sorts to the wrong place.
- Every field has its own column now: caffeine `kind` and `meal_name` no longer hide in the title, meal macros and gym `exercises` (jsonb) no longer ride in a `{v:1,...}` Notes envelope, and nap `duration` / gym `session_duration` are finally separate columns instead of sharing Notion's one `Duration (min)`.
- **Two tables preserve history the app doesn't render.** `events.notes` holds free text that existed on 139 wake/sleep/caffeine/mood/energy rows whose old reader ignored the field. `legacy_events` holds the 170 pre-app rows whose `Type` predates the current nine (`journal`, `snooker`, `work`, `travel`, `melatonin`, `legacy_note`…), each with its untouched Notion property blob in `properties jsonb`. Neither is read by any route — they exist so the migration lost nothing. Don't "clean them up".
- **Read routes:** `/api/today` (floor only — meals/gym deliberately filtered out), `/api/history?type=meal|gym-session` (ISO-cursor paged), `/api/week` (all types, last 8 calendar days — feeds desktop goal cards + 7-day stats), `/api/session`, `/api/sleep/backfill`.
- **Write routes** (`/api/event`, `[id]`, `[id]/undo`, `[id]/convert-nap`) must invalidate caches: `lib/cache.ts` in-memory slots; **`invalidateToday()` also clears the week slot by design** — never add a write path that skips it.
- Client: `lib/client/api.ts` fetch wrappers (401 → redirect to /login), `queue.ts` offline queue via service worker, `historyCache.ts` module-level tab-switch cache.
- Hooks: `useToday`, `useWeek`, `useHistory` (poll 60s + refocus), `useLogger` (log + 12s undo window), `useLongPress` (500ms hold), `useMediaQuery`.
- Pure logic lives in `lib/` and is tested: `sleep.ts` (pairing, wake windows), `weekStats.ts` (7-day aggregations), `time.ts` (wall-clock helpers — always use these, never hand-roll date math; timestamps are local ISO with offset, days are wall dates, TZ in prod is Africa/Casablanca).

## Adding a new event type (checklist)

1. `lib/types.ts` — `EventType`, `CATEGORY_BY_TYPE`, payload/patch fields.
2. `lib/validation.ts` + test — field ranges.
3. A new `db/migrations/NNN_*.sql` adding any columns it needs, plus `lib/db/rows.ts` + test to map them.
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
- Deletes are always a soft `archived_at` stamp (reversible), never `DELETE`; every read filters `archived_at IS NULL`. UI pattern is 5s pending-delete with undo.
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

VPS at `/opt/floor-logger` (Docker, bound 127.0.0.1:3000, host nginx + certbot, Cloudflare DNS).

**Redeploy is now `git pull` on the VPS, not rsync** (converted 2026-07-26):

```bash
ssh tachafine.srv 'cd /opt/floor-logger && git pull --ff-only && docker compose up -d --build'
```

`/opt/floor-logger` is a real checkout of `git@github.com:LUDZpro/tracker.git` tracking `origin/main`. **GitHub's port 22 is blocked outbound from this VPS** — `~/.ssh/config` there maps `github.com` to `ssh.github.com:443`, so plain URLs work; don't "fix" that Host block. `.env` is gitignored and lives only on the server (backup at `~/floor-logger-env.bak`). Note `ludz.pro` (the other remote name seen locally) does not resolve from the VPS at all.

Container TZ: CLAUDE.md long claimed Africa/Casablanca, but **prod actually runs `TZ=UTC`** — `.env` has no `TZ` and compose defaults to it. Unresolved; the Postgres schema is TZ-safe regardless (absolute `occurred_ts` + verbatim `occurred_at` text).

**The VPS `.env` needs `POSTGRES_PASSWORD` before the first Postgres deploy** — compose builds `DATABASE_URL` from it, and the app won't start without it. The `db` service brings its own `pgdata` volume and the app waits on its healthcheck; migrations run automatically on container start. The VPS database starts **empty** — the first deploy must also run the Notion import (or a `pg_dump`/`pg_restore` of the local one) or the app comes up with no history.
