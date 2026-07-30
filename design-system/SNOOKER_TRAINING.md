# Snooker training tracker contract

Status: proposed technical contract  
Reviewed: 2026-07-29  
Applies to: Snooker first; reusable by future skill-practice trackers

This tracker records a practice session, the exercises performed inside it,
their scored runs, and comparable personal records. It is not match scoring,
coaching diagnosis, or an opaque global ability rating.

## 1. Product decision

The primary question is:

> What did I practise, how did each comparable run go, and where is performance
> changing over time?

Use a **composed session with an interval temporal shape**, not one unrelated
event per score:

```text
Training session
└── ordered exercise run
    └── optional shot/rep results
        └── metric values

Comparable completed runs
└── derived personal records and trends
```

The first release SHOULD support:

- Start training now and log a past session.
- Choose a saved exercise or create a simple custom exercise.
- Repeat an exercise for multiple scored runs in one session.
- Record the metric appropriate to that exercise.
- Undo the latest result without leaving table mode.
- Review and correct the session, runs, and raw results.
- See exercise-specific history, recent average, and personal best.
- Resume an active local/offline draft after reload or connection loss.

It MUST NOT require shot-by-shot logging when a final run score is sufficient.
Capture detail is selected by the exercise protocol, not imposed globally.

## 2. Information architecture

Snooker belongs logically to a **Training** domain. For the first production
slice it may live at `/gym/snooker` as an explicit transitional child so the
existing Gym destination stays active and no sixth mobile tab is added.

Initial production routes:

```text
/gym/snooker              snooker status, recent sessions, exercise library
/gym/snooker/live         active table-mode session
/gym/snooker/history      completed sessions and filters
/gym/snooker/drills/:id
```

Add **Gym sessions / Snooker training** as explicit in-Gym choices and keep
`/gym/*` parent-active in the shared navigation registry. When a second
non-gym training tracker exists, evaluate intentionally replacing Gym with a
Training hub and redirect the old route. A sixth mobile tab is not appended
automatically.

## 3. Domain model

The UI and service own this model. Persistence adapters must not leak database
row or transport shapes into components.

```ts
type TrainingBoundary = {
  at: string;
  wallDate: string;
  precision:
    | { kind: 'exact' }
    | { kind: 'about'; toleranceMinutes: number };
};

type TrainingSession = {
  id: string;
  clientTag: string;
  domain: 'snooker';
  status: 'active' | 'completed' | 'abandoned';
  start: TrainingBoundary;
  end?: TrainingBoundary;
  recordedAt: string;
  timeZone: string;
  venue?: string;
  table?: {
    label?: string;
    sizeFeet?: number;
    difficultyNote?: string;
  };
  focus?: string;
  review?: string;
  runs: DrillRun[];
  revision: number;
  syncState: 'local' | 'queued' | 'syncing' | 'synced' | 'failed';
};

type SetupFieldBase = {
  id: string;
  label: string;
  affectsComparison: boolean;
};

type DrillSetupField =
  | (SetupFieldBase & {
      kind: 'number';
      unit?: string;
      min: number;
      max: number;
      step: number;
    })
  | (SetupFieldBase & {
      kind: 'choice';
      options: Array<{ id: string; label: string }>;
    })
  | (SetupFieldBase & { kind: 'boolean' })
  | (SetupFieldBase & {
      kind: 'text';
      maxLength: number;
      affectsComparison: false;
    });

type ScoringDefinition =
  | { kind: 'points'; version: number; min: number; max: number }
  | { kind: 'fixed-success'; version: number; resultCount: number }
  | { kind: 'count'; version: number; min: number; max: number }
  | { kind: 'streak'; version: number; maxResults?: number }
  | { kind: 'completion'; version: number }
  | { kind: 'efficiency'; version: number; maxResults: number }
  | {
      kind: 'timed-completion';
      version: number;
      maxMilliseconds: number;
    }
  | {
      kind: 'category';
      version: number;
      options: Array<{ id: string; label: string }>;
    }
  | { kind: 'qualitative-note'; version: number; maxLength: number };

type PersonalRecordRule =
  | {
      id: string;
      kind: 'maximum';
      metric: 'points' | 'count' | 'streak';
      minimumResults?: number;
    }
  | {
      id: string;
      kind: 'fixed-block-rate';
      resultCount: number;
    }
  | {
      id: string;
      kind: 'minimum-completed-duration';
    }
  | {
      id: string;
      kind: 'ordered';
      comparators: Array<
        'completion-desc' | 'points-desc' | 'count-desc' | 'results-asc'
      >;
    };

type DrillDefinition = {
  id: string;
  version: number;
  name: string;
  category:
    | 'fundamentals'
    | 'potting'
    | 'break-building'
    | 'cue-ball-control'
    | 'safety'
    | 'escape'
    | 'clearance';
  instructions?: string;
  setupDiagram?: string;
  setupFields: DrillSetupField[];
  attemptUnit: 'shot' | 'visit' | 'round' | 'frame';
  scoring: ScoringDefinition;
  recordRules: PersonalRecordRule[];
  source: 'built-in' | 'custom';
  archivedAt?: string;
};

type DrillRun = {
  id: string;
  clientTag: string;
  sessionId: string;
  drillId: string;
  drillVersion: number;
  scoringVersion: number;
  scoringSnapshot: ScoringDefinition;
  order: number;
  status: 'active' | 'completed' | 'partial' | 'abandoned';
  start?: TrainingBoundary;
  end?: TrainingBoundary;
  configuration: Record<string, string | number | boolean>;
  configurationFingerprint: string;
  results: RunResult[];
  note?: string;
  recordEligible: boolean;
  revision: number;
};

type ResultIdentity = {
  id: string;
  index: number;
  clientTag: string;
  recordedAt: string;
};

type RunResult = ResultIdentity &
  (
    | { kind: 'outcome'; outcome: 'success' | 'miss' | 'foul' }
    | { kind: 'points'; points: number }
    | { kind: 'count'; value: number }
    | { kind: 'completion'; completed: boolean; resultCount?: number }
    | { kind: 'duration'; milliseconds: number; completed: boolean }
    | { kind: 'category'; optionId: string }
    | { kind: 'note'; value: string }
  );
```

Use **run** for one scored execution of an exercise and **shot/rep** for a
result within that run. Do not call both levels “attempt.”

Completed sessions retain the drill version, configuration, and scoring
snapshot that existed at capture time. Editing a drill definition never rewrites
history.

## 4. Scoring definitions

One universal score cannot represent snooker practice truthfully. WPBSA
coaching materials use fixed attempts, success counts, consecutive-pot goals,
clearance completion, and break thresholds. The component changes with the
declared scoring definition.

| Definition | Example | Capture | Progress and record rule |
|---|---|---|---|
| Points | Line-up break | Numeric score or ball-value pad | Highest completed run |
| Fixed success block | 20 long pots | Potted / Missed / Foul | Best count or rate with the same denominator |
| Count | Balls potted in a visit | Stepper or numeric entry | Highest completed count |
| Streak | Consecutive blacks | Potted / Missed | Longest completed streak |
| Completion | Colours clearance | Complete / Not complete | First completion, completion rate |
| Efficiency | Clear in a shot limit | Outcome buttons | Completion first, then fewer shots |
| Timed completion | Timed clearance | Start / Finish / Abandon | Lowest duration after valid completion |
| Category | Safety quality or miss side | Named options | Distribution only by default |
| Qualitative note | Cue action felt smooth | Labeled note/rating | Reflection only; no personal record |

Rules:

- A foul is distinct from a miss and from a legal pot.
- `breakPoints`, `pots`, and `fouls` are separate facts.
- A one-shot `1/1` result is not a meaningful 100% record.
- Rate records require a fixed attempt count or declared minimum sample.
- Partial and abandoned runs remain visible but are not record-eligible.
- Compound comparisons declare an order, for example completion → points →
  fewer shots.
- Practice high break, drill-specific high break, and match high break remain
  separate record families.

## 5. Personal-record contract

A personal record is a server-derived projection. The client never submits
`isPersonalRecord: true`.

The comparison key is:

```text
drill id + drill version + scoring version + configuration fingerprint
```

The fingerprint includes every setup field that changes difficulty or meaning,
such as ball count, layout, distance, table size, shot limit, and difficulty
variant. Venue may be displayed as context without splitting records unless the
exercise definition explicitly requires it.

Record states:

- **New best** — strictly exceeds the previous comparable record.
- **Matched best** — equals it.
- **First baseline** — first eligible comparable result.
- **Not comparable** — setup or protocol differs.
- **Not eligible** — partial, abandoned, subjective, or below minimum sample.

Edits and reversible archives recompute affected records. A record detail links
back to its session, exercise setup, raw result, previous best, and achieved
date.

## 6. Date and time

Follow [`DATETIME_INPUTS.md`](DATETIME_INPUTS.md).

- A session is an interval with start and optional end.
- **Start training** resolves live-now when activated.
- **Log past session** exposes complete, typable start and end dates/times.
- Future boundaries are blocked; end must follow start.
- Cross-midnight practice remains one session and shows both dates.
- History groups by the start wall date in the explicit app timezone.
- Exercise times are optional and, when present, stay inside the session.
- Per-shot timestamps are optional. Ordered sequence is canonical because
  requiring a timestamp for every shot would interrupt practice.
- `recordedAt` remains present for audit and offline replay.
- Approximate retrospective session boundaries remain visibly approximate.

Example:

```text
Tue 28 Jul, 22:40 → Wed 29 Jul, 00:15 · about 1 h 35 min
```

## 7. Capture UX

### Start surface

Expose ordinary controls:

1. **Start snooker training**
2. **Log past session**
3. **Resume training** when exactly one active local session exists

Then offer Recent, Favourites, Plans, and All exercises. Search supplements
these lists; it is not the only discovery path.

### Exercise briefing

Before the first run show:

- Exercise name and category.
- Table/setup diagram when available.
- Short setup and scoring instructions.
- Editable configuration that affects comparability.
- Previous comparable best and recent typical result.
- **Start run**.

### Mobile table mode

The live screen removes analytics and secondary navigation:

```text
SNOOKER TRAINING                              34:18
Line-up · Run 2

12 / 15 potted        Current streak 4        Best today 7

[ Record miss ]                         [ Record pot ]
[ Foul ]          [ Undo last ]         [ Finish run ]
```

- Context-specific actions remain at least 48px high.
- The two most frequent opposite outcomes receive the largest targets.
- Every result appears optimistically with queued/synced/failed text.
- **Undo last** is always visible while a result can be reversed.
- Screen wake lock MAY be requested with visible explanation and safe fallback.
- No interaction depends on swipe, hold, color, hover, or a keyboard shortcut.

Desktop adds a compact result ledger and visible shortcuts, for example `P`
Potted, `M` Missed, `F` Foul, and `Cmd/Ctrl+Z` Undo. The ordinary controls
remain.

### End run and session

End-run review shows result, target, record comparison, note, **Repeat**, and
**Next exercise**. Ending the session opens one final review with:

- Start/end and duration.
- Ordered exercises and run totals.
- Total shots/reps where available.
- New/matched records.
- Optional one-line session review.
- **Finish session**.

An unfinished draft survives route changes, reload, offline state, and app
restart. **Abandon session** is reversible and never the primary action.

## 8. History and progress

Session row:

```text
29 Jul · 18:10–19:32 · 1 h 22 min
Line-up, long pots +1
72 recorded results · long pots 14/20 · New line-up best 43
```

Filters:

- Date range
- Exercise
- Skill category
- Venue/table context
- Completed/partial/abandoned

Exercise detail shows:

1. Current personal best and provenance.
2. Latest result.
3. Recent average or median with sample size.
4. Consistency/range.
5. Target progress when the user chose a target.
6. Comparable raw run history.

Charts select one exercise, setup, and metric. Always show numerator and
denominator beside a percentage. A personal-best step line and recent-average
line may appear together. Do not blend unrelated exercises into a universal
“Snooker Score.”

Factual comparison copy:

> Long-pot success was 68% over 60 shots, compared with 61% over the previous
> 60 comparable shots.

This describes change; it does not claim that a drill, venue, mood, or another
life event caused it.

## 9. Validation and recovery

- A completed session requires start < end and at least one completed, partial,
  or explicitly skipped exercise.
- Active sessions may omit end.
- Run order and result indexes are unique within their parent.
- Values match the saved scoring-definition version.
- Counts and points are finite, non-negative, and inside drill-specific bounds.
- Made ≤ attempted and attempted > 0.
- A completed duration is positive and within the configured maximum.
- Timestamped child records fall inside the session.
- Every queued mutation has an idempotency key so replay cannot duplicate a
  shot or run.
- Invalid input remains in the form with field-specific correction copy.
- Attempt/run archives use immediate Undo and a later Restore path.
- A sync failure keeps the local result visible and offers Retry.

## 10. Persistence boundary

Postgres is the production source of truth. Snooker uses a dedicated relational
domain rather than extending `gym-session.exercises` or the generic event
payload:

```text
snooker_exercises
  id, name, instructions, category, scoring jsonb, version,
  archived_at, created_at, updated_at

snooker_sessions
  id, status, started_at text, started_ts timestamptz, ended_at text,
  ended_ts timestamptz, start_precision jsonb, end_precision jsonb,
  time_zone, venue/table context, review,
  client_tag unique, revision, archived_at, created_at, updated_at

snooker_runs
  id, session_id FK, exercise_id FK, exercise_version, run_order,
  scoring_version, scoring_snapshot jsonb, status, configuration jsonb,
  configuration_fingerprint, record_eligible, client_tag unique, revision,
  archived_at, created_at, updated_at

snooker_results
  id, run_id FK, result_index, result jsonb, recorded_at,
  client_tag unique,
  archived_at, created_at, updated_at
```

`snooker_runs.revision` is also the concurrency token for its child-result
aggregate. Result rows do not carry independent revisions: an edit, archive, or
restore of any result compares and advances the parent run revision in the same
transaction.

The versioned scoring schema validates every JSON result before persistence.
Store the exercise/scoring snapshot needed to preserve historical meaning.
Personal records are derived with a query or projection over live eligible
results; do not persist a stale `is_pr` flag.

Implementation requirements:

- Add a transaction helper around the shared pool. Creating a session and its
  initial results is atomic.
- Paginate by `(started_ts, id)`, not an ISO timestamp alone.
- Store exact offset-bearing wall-time text and sortable timestamps together.
- Keep ordinary reads filtered by `archived_at IS NULL`, and ship archived
  history plus Restore.
- Persist a unique client tag for session/run/result idempotency.
- Either add Snooker mutations to the service-worker queue with retained
  rejection/retry behavior, or state that the recovered local draft requires a
  connection to finish.
- Measure realistic request bodies. Production nginx currently caps them at
  2 KB, so raise the Snooker endpoint limit narrowly or save bounded results
  incrementally.

Notion-era unknown event types, including possible Snooker rows, remain in
`legacy_events`. Inventory their raw property shapes before migration. Backfill
only recognized values through an idempotent import that retains source
identity; never coerce or delete an unknown legacy row.

## 11. Production code map

```text
db/migrations/003_snooker_training.sql

lib/snooker/
  types.ts
  validation.ts
  validation.test.ts
  store.ts
  store.test.ts
  records.ts
  records.test.ts

lib/client/snooker.ts
hooks/useSnookerSessions.ts

components/snooker/
  SnookerHome.tsx
  SnookerSessionComposer.tsx
  ExerciseBriefing.tsx
  TableMode.tsx
  RunResultEditor.tsx
  SessionReview.tsx
  SnookerHistory.tsx
  ExerciseProgress.tsx

app/(ui)/gym/snooker/
  page.tsx
  live/page.tsx
  history/page.tsx
  drills/[id]/page.tsx
```

Service boundary:

```text
GET  /api/snooker/exercises
POST /api/snooker/exercises

GET  /api/snooker/sessions?beforeTs=&beforeId=&exercise=&from=&to=
POST /api/snooker/sessions
GET  /api/snooker/sessions/:id
PATCH /api/snooker/sessions/:id
DELETE /api/snooker/sessions/:id
POST /api/snooker/sessions/:id/restore

POST /api/snooker/sessions/:id/runs
PATCH /api/snooker/runs/:id
DELETE /api/snooker/runs/:id
POST /api/snooker/runs/:id/restore

POST /api/snooker/runs/:id/results
PATCH /api/snooker/results/:id
DELETE /api/snooker/results/:id
POST /api/snooker/results/:id/restore

GET  /api/snooker/records?exercise=&configuration=
```

Nested session/result creation is one transaction. All mutations validate the
same domain contract, persist client tags, invalidate Snooker
history/progress caches, and return the updated aggregate revision.
`DELETE` is the existing HTTP surface for a reversible archive; it never hard
deletes a session.

Concurrency and replay protocol:

- Every create/append sends its stable `clientTag`. Retrying the same tag
  returns the existing resource and does not append again.
- Every session/run edit, archive, or restore sends
  `If-Match: <revision>`.
- Every result edit, archive, or restore sends
  `If-Match: <runRevision>` from its containing run.
- The result service resolves the parent run and locks it with
  `SELECT … FOR UPDATE`; it compares the run revision, mutates the child, and
  increments the run revision in one transaction. The response includes the
  updated `runRevision`.
- An append-only result is merged by stable ID, locks and increments the parent
  run revision atomically, and returns that revision. It does not overwrite an
  existing result with a different payload.
- Every other matching write updates atomically and increments its aggregate
  revision.
- A mismatch returns `409` with `currentRevision` and the current server
  aggregate. The UI preserves the local draft and offers **Review changes**;
  it never silently overwrites either version.
- An append-only result with a new stable ID may retry after reloading the
  aggregate. Edits to the same result require the latest run revision and
  explicit conflict review.
- The offline queue removes only acknowledged `2xx` mutations. Validation,
  conflict, network, and server failures retain an editable local item with
  Retry or Discard.

Do not add `snooker-session` to the generic `EventType` initially. If Today or
Week later needs a lightweight marker, link it to the domain session and create
both atomically or with an idempotent retry. Do not copy CBT's best-effort dual
write.

The shared navigation registry must use parent-prefix matching so `/gym/*`
keeps Gym selected. `useSnookerSessions` memoizes flattened pages. If offline
save ships, update the service worker deliberately; it currently queues only
specific generic mutation routes.

## 12. Initial exercise library

Use a small useful set plus a constrained custom exercise:

| Exercise | Category | Default scoring |
|---|---|---|
| Line-up | Break-building | Points / highest break |
| Long potting block | Potting | Fixed 20-shot success block |
| Cue-ball target zones | Cue-ball control | Fixed success block |
| Colours clearance | Clearance | Completion + points/shot count |
| Safety outcomes | Safety | Success / fail / foul distribution |
| Escape practice | Escape | Escaped / failed / foul distribution |

A custom exercise chooses one predefined scoring definition, setup fields, and
record rule. Arbitrary formulas are deferred until real use proves they are
needed.

## 13. Research basis

- [WPBSA official rules](https://www.wpbsa.com/rules/) distinguish pots,
  breaks, points, and fouls.
- [WPBSA coaching qualifications](https://www.wpbsa.com/participation/coaching/qualifications-and-levels/)
  emphasize planning, delivery, review, and progressive sessions.
- [WPBSA’s Play Snooker announcement](https://www.wpbsa.com/play-snooker-app-powered-by-the-wpbsa/)
  confirms practice logging and meaningful progress statistics as current
  participation goals.
- Existing specialist tools commonly combine drill libraries, custom routines,
  session grouping, result capture, personal bests, and trends. These are
  product references, not normative authorities.

## 14. Release acceptance

- [ ] Start, resume, log-past, finish, and abandon flows recover safely.
- [ ] Mobile table mode records the common result in one ordinary tap.
- [ ] A result can be undone without leaving the active exercise.
- [ ] Every built-in exercise declares protocol, metric, bounds, and record rule.
- [ ] Custom exercises cannot create an unversioned or ambiguous metric.
- [ ] Record eligibility and comparability are explained in the UI.
- [ ] Editing or archiving recomputes affected records.
- [ ] Partial and missing results never render as zero.
- [ ] Session dates/times pass the shared temporal acceptance suite.
- [ ] Offline replay cannot duplicate a result.
- [ ] A realistic maximum session passes persistence size and conflict tests.
- [ ] Session/result creation rolls back completely after an injected child
      write failure.
- [ ] Same-timestamp sessions paginate without duplicates or omissions.
- [ ] Requests at the documented maximum pass the deployed proxy limit.
- [ ] Recognized legacy rows import idempotently and unknown rows remain intact.
- [ ] Progress views show sample size and compare like-for-like setups.
- [ ] The design works with touch, mouse, keyboard, and assistive technology.
