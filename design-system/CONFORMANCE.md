# Tracker UI/UX conformance register

Snapshot: 2026-07-29

This register separates the **target contract** from **current production
behavior**. A known mismatch is debt, not precedent. New trackers follow
`index.html` and `NEW_TRACKER_SPEC.md`; they do not copy a mismatched component.

Status terms:

- **Blocker** — prevents the component from meeting the accessibility or data
  integrity contract.
- **High** — creates inconsistent outcomes or weakens recovery/trust.
- **Medium** — creates design drift, ambiguity, or future scaling cost.
- **Planned** — the target is defined but no production surface or data path
  exists yet.
- **Conformant** — current behavior establishes a pattern worth preserving.

## Summary

| Area | Status | Target |
|---|---|---|
| Navigation labels/order | High | One five-item registry and stable canonical order |
| Capture semantics | High | One data-certainty contract across inputs and breakpoints |
| Sheets/dialogs | Blocker | Shared focus-managed modal primitive |
| Drag/keyboard access | Blocker | No gesture-only operation |
| App clock and timezone | Blocker | One explicit IANA-zone clock on client and server |
| Date/time input | Blocker | Typable shared field, complete allowed date range, no sheet-scroll conflict |
| Timestamp meaning and precision | High | Explicit instant/interval/duration semantics and honest uncertainty |
| Duplicate sleep protection | Partly conformant | Preserve the guard while separating naps and night sleep |
| Text contrast | Blocker | WCAG 2.2 AA token pairings |
| Event presentation | High | One SVG/icon/tone/copy registry |
| Mutation feedback | High | Shared, announced, recoverable write states |
| Archive recovery | Blocker | Immediate Undo plus later user-visible Restore |
| Empty/loading/error states | High | State matrix on every route |
| Authentication | Blocker | One semantic, assistive PIN input or non-memory alternative |
| Offline queue and undo | Blocker | Retain rejected writes, persist idempotency, and expose recovery |
| Snooker training | Planned | Versioned relational session/exercise/run model and derived records |

## 1. Navigation

### Current

- Mobile has five destinations in this order: **Today, Sleep, Nutrition, Gym,
  Mind**.
- Desktop has the same five in a different order: **Today, Nutrition, Gym,
  Sleep, Mind**.
- The previous design-system page incorrectly documented four destinations and
  used “Floor / Food / Mind / Gym”. The catalog and technical contract now use
  the five canonical labels.
- Mobile and desktop maintain separate arrays and exact-path active matching.
- Rail links rely on tooltip text rather than an explicit accessible name.
- The desktop rail hide media query is not last in its stylesheet, despite the
  project’s equal-specificity ordering requirement.

### Target

Create a typed `NAV_ITEMS` registry with:

- Canonical label
- Icon
- Route
- Relative order
- Parent/nested-route active match
- Accessible name
- Optional shortcut metadata

Both `TabBar` and `Rail` render from the same registry. Canonical order is:

1. Today
2. Sleep
3. Nutrition
4. Gym
5. Mind

When a sixth top-level destination is proposed, introduce a domain/hub
information architecture rather than appending a sixth mobile tab.

## 2. Capture semantics

### Current

- Mobile generic captures use tap to log and hold to open detail/time.
- Desktop generic captures use click to open and hold to log.
- Desktop wake/sleep retains tap-to-log and hold-to-time even under the opposite
  desktop instruction.
- Meal and Gym open a composer on both click and hold despite the desktop hint.
- Long press is pointer-only and has no programmatic explanation.
- Keyboard shortcut coverage and displayed hints have drifted.

### Target

Use one per-action interaction registry:

```text
event → primary outcome → safe defaults → visible secondary action
      → optional accelerator → keyboard shortcut → accessible description
```

- Primary activation logs now only when safe defaults make a truthful record.
- Composed events open their shortest trustworthy form.
- “Choose time” or “Edit details” is always visible.
- Long press is optional acceleration, never required knowledge.
- Tap/click/Enter/Space keep the same outcome across breakpoints.

## 3. Sheets and dialogs

### Current

The shared sheet exposes dialog role, modal state, and a name, but it does not
own:

- Initial focus
- Tab/Shift+Tab containment
- Escape behavior on every route
- Focus restoration
- A visible close button
- Background inertness

Touch drag handlers are attached to the entire dialog rather than only its
handle. The CBT workflow has a separate modal implementation with similar gaps.

### Target

One shared dialog/sheet controller owns:

- Labelled title ID and optional description
- `aria-modal` only with a genuinely inert background
- Initial focus policy
- Focus containment and return
- Escape and visible Close/Cancel
- Portal/layering behavior
- Safe unsaved-draft behavior
- Drag dismissal restricted to the handle

Mobile bottom sheet and desktop centered dialog are layouts of this one
semantic component.

## 4. Drag, keyboard, and pointer access

### Current

- Sleep-band handles are pointer-only SVG groups with no role, focus, current
  value, or arrow-key adjustment.
- Swipe-to-delete is undiscoverable; edit sheets provide a partial alternate
  route.
- Desktop global shortcuts can run while some interactive elements have focus.
- Ledger rows use a button role around nested Edit/Delete buttons.
- Some desktop nutrition rows are clickable non-interactive elements.
- Wheel time controls expose arrow buttons, which is a useful alternate path,
  but the wheel itself is not a clear keyboard control.

### Target

- Sleep start/end have explicit time fields or increment/decrement controls.
- Focusable handles, if retained, expose slider semantics and five-minute arrow
  steps.
- Every drag/swipe has a visible click/tap and keyboard alternative.
- Global shortcuts ignore every interactive/editable target and modal context.
- Rows and row actions use valid native interactive structure.
- Ordinary pointer actions complete on release so users can cancel by moving away.

## 5. Date, time, and temporal integrity

### Current

**Blocker.** The current date/time system has useful centralized helpers and
explicit offset-bearing strings, but it is not conformant:

- Browser capture and visible clocks use the device zone while server grouping
  uses the process zone. Docker currently defaults to UTC even though the
  product policy is `Africa/Casablanca`.
- General validation accepts values up to 48 hours in the future. A future
  sleep marker can become the current awake/asleep state.
- The looping wheel duplicates options, is not a valid keyboard listbox, hides
  direct typing, and only offers a narrow Today/Yesterday model.
- The sheet listens for vertical drag across its whole dialog. Scrolling the
  wheel or form body can move or close the mobile popup.
- Date correction is absent for most event types. Some old history rows appear
  editable and fail only after Save.
- “Now” resolves at submit in some composers but freezes when a meal or gym
  sheet opens. CBT records completion time as though it were trigger time, and
  Gym does not declare whether its time means start or end.
- Approximate choices are persisted as invented exact minutes and then used in
  timelines, durations, and analytics.
- Nap writes become ordinary sleep/wake markers, allowing a daytime nap to be
  treated as a covered night or “last night’s sleep.”
- Editing a wall date or time preserves the original numeric offset, which can
  resolve the wrong instant across a Casablanca offset transition.
- Sleep backfill accepts four days while general correction locks after 48
  hours, so an older repair can be uneditable immediately after Save.
- Minute-only timestamps are used as history cursors and UI deduplication keys,
  which can skip or hide legitimate same-minute events.
- Offline queue items are removed after any HTTP response and do not persist a
  usable idempotency key, so delayed records can be lost or duplicated.

Existing strengths worth preserving:

- Pure wall-date helpers centralize much of the calendar logic.
- Stored timestamps retain an explicit offset.
- Sleep span and overlap rules have server validation and pure tests.
- Duplicate wake/sleep state opens a correction path instead of silently
  writing another marker.
- Precision already exists in storage and can be migrated to an honest range
  model.

### Target

Follow [`DATETIME_INPUTS.md`](DATETIME_INPUTS.md):

- One injected app clock and explicit IANA timezone own Now, Today, grouping,
  capture, editing, and analytics on both client and server.
- One app-owned temporal model distinguishes instants, independently precise
  interval boundaries, duration anchors, and wall dates; occurrence fields stay
  separate from `recordedAt`.
- A shared typable date/time field exposes every allowed date, direct entry,
  precision, timezone, bounds, and read-only state. The target segmented field
  enforces 24-hour entry; native fallback display follows the device locale.
- Mobile uses a platform picker or tested accessible field. Sheet dismissal can
  begin only on the handle/header; form scrolling never dismisses it.
- Future occurrence is rejected by default. UI and API use the same range.
- Approximate values remain ranges or named parts of day through history and
  analysis.
- Naps remain nap/session records. Interval summaries show both boundaries and
  duration before Save.
- Zoned conversion resolves the offset for the selected wall date. Nonexistent
  times are rejected and repeated times require an explicit earlier/later
  offset choice. Tests cover midnight and Casablanca offset transitions.
- History uses stable IDs and composite cursors. Queue replay retains failed
  items and uses persisted idempotency.

The preferred production spike is React Aria Components plus
`@internationalized/date`, wrapped behind app-owned values and styles. The
zero-dependency fallback is separate native date and time inputs. New trackers
MUST NOT copy `WheelTimePicker`.

## 6. Color and text contrast

### Current

The palette is visually coherent, but several text tokens cannot be used for
normal-size meaningful text:

- `--t3` is below 4.5:1 on most application surfaces and only approximately
  reaches the threshold on the darkest canvas.
- `--t4` and `--t5` are far below 4.5:1 and must not carry required text.
- Event colors and feedback colors overlap: meal/success, gym/error,
  caffeine/warning, and sleep/action.

### Target

Introduce explicit roles rather than inferring semantics from one color:

```text
color.interaction.*
color.feedback.success | warning | error | info
color.event.sleep | intake | meal | gym | state
color.text.primary | secondary | disabled/decorative
```

- Normal meaningful text, including hints and timestamps, is at least 4.5:1 on
  every allowed surface.
- Required graphics, focus, selected states, and component boundaries are at
  least 3:1.
- `--t4`/`--t5` are restricted to decorative or disabled treatment unless
  replaced by accessible values.
- Status and category always have a redundant text/icon/shape cue.

The token namespace change should be implemented as a migration with temporary
aliases; do not silently reinterpret existing tokens.

## 7. Event presentation

### Current

- Desktop has a strong reusable SVG icon registry.
- Mobile event, meal, and gym histories still use emoji/string presentation.
- Meal and Gym tones differ between modules.
- Read-only rows use a lock emoji.
- Icon, tone, canonical label, and row-copy rules are owned in multiple places.

### Target

One typed event-presentation registry supplies:

- SVG icon body/component
- Canonical event label
- Event-category tone
- Compact and expanded row summary
- Accessible name
- Read-only/locked state icon

Emoji presentation modules are migration debt. Emoji may appear in authored
user content, but not as the system icon set.

## 8. Mutation feedback and recovery

### Current strengths

- `useLogger` distinguishes created, queued, and failed writes.
- Logging provides Retry and a 12-second Undo.
- Mobile confirmation and queue banners use live status semantics.
- Pending deletes remain in place with Undo.
- Deletes are soft archives rather than hard deletion, so the underlying record
  survives.

### Current gaps

- Edit and CBT save can close with no announced confirmation.
- Some delete failures are not surfaced.
- Create composers can close before a server failure, losing the visible form
  context.
- Desktop nutrition toast lacks live status semantics.
- Persistent queue visibility is not consistent across Nutrition and Gym.
- Similar pending-delete state machines are duplicated.
- After the five-second Undo period, there is no user-facing archived-records
  view, Restore action, or restore endpoint. Recovery currently requires direct
  database/operator intervention; soft deletion alone is not user-reversible.

### Target

Create shared primitives or hooks for:

- `MutationFeedback`
- `PendingArchive`
- `AsyncViewState`
- Persistent `QueueStatus`
- `ArchivedRecords` with a Restore mutation

Every write defines local, queued, syncing, synced, failed, retry, edit, undo,
archive, and later restore behavior. Routine messages use a pre-existing polite
status region; urgent/blocking errors use alert behavior selectively.

## 9. Loading, empty, partial, and route errors

### Current

- Some initial breakpoint and history loads render a blank frame or `null`.
- There are no route-level loading, error, or not-found boundaries.
- State coverage differs across trackers.

### Target

Every route and data region documents:

- Initial loading
- Empty
- Optimistic
- Queued/offline
- Partial or insufficient data
- Complete
- Error/retry
- Unauthorized/session expired

Existing records stay visible during refresh and recoverable failure. A spinner
never stands alone without meaningful status text.

## 10. Charts and reflection

### Current

The component catalog contains useful visual specimens, but it does not yet
guarantee:

- A user question for each chart
- Coverage and missingness
- Keyboard-accessible points
- A semantic data table
- Factual insight wording
- Source-event drill-down

### Target

Every chart has a title/question, visible factual summary, period, timezone,
units, denominator, coverage, missing-data behavior, and structured value view.
Color is redundant. Critical information does not require hover. Cross-tracker
insights are framed as observations or hypotheses, not causes.

## 11. Authentication

### Current

**Blocker.** The visual keypad does not expose one semantic PIN input, so users
cannot paste into it or rely on ordinary autofill/password-manager behavior. A
failed attempt clears the entered PIN, increasing memory and re-entry demand.
Although passkey support can provide a non-memory alternative when enrolled, it
does not make the PIN control itself conformant.

### Target

- Do not block paste, autofill, or password-manager assistance.
- Use one semantic PIN input even if a keypad or segmented façade mirrors it
  visually.
- Use a visible label, numeric keyboard hint, Show/Hide control, and appropriate
  autocomplete metadata.
- Preserve input after failure, announce the error, and focus the field.
- Maintain a non-memory authentication alternative such as passkey and keep a
  usable fallback.

## 12. Planned Snooker training tracker

### Current

- Production has no Snooker event type, route, sheet, history query, drill
  model, or personal-record projection.
- Gym sessions cannot be reused directly: their exercise sets do not represent
  versioned drill protocols, shot outcomes, or comparable records.
- Existing Postgres event/gym rows do not provide stable drill definitions,
  child results, atomic aggregate writes, or record queries.
- Possible Notion-era Snooker rows remain preserved in `legacy_events` and have
  not been inventoried or backfilled.

### Target

Follow [`SNOOKER_TRAINING.md`](SNOOKER_TRAINING.md):

- A Training-domain session contains ordered exercise runs and optional
  shot/rep results.
- Metrics and personal-record rules come from versioned drill definitions.
- Mobile table mode keeps frequent result controls large and Undo visible.
- Records are derived from like-for-like completed runs.
- Production uses dedicated exercise/session/result tables, atomic writes,
  idempotency, composite cursors, archive/Restore, and a verified legacy import.
- The component specimen is a target, not evidence that the feature ships.

## Recommended migration order

1. Establish one app clock/timezone contract and typed temporal domain model.
2. Ship the shared typable date/time field and handle-only mobile sheet drag.
3. Fix future validation, history editability, nap identity, queue durability,
   and timestamp/cursor identity.
4. Shared accessible dialog/sheet and sleep drag alternatives.
5. Shared navigation and capture interaction registries.
6. Contrast-safe text/semantic token migration.
7. Shared event presentation registry using SVG.
8. Shared mutation, archive/Restore, async, and queue state primitives.
9. Route loading/error boundaries and accessible chart/data patterns.
10. Replace the keypad-only PIN flow with the semantic PIN façade and verify the
   passkey fallback.

Each migration updates production behavior, tests, the visual catalog, and this
register in the same change.
