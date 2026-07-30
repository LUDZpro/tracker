# New tracker UI/UX specification

Copy this file into feature planning and replace every bracketed prompt. A new
tracker is not ready for implementation while a required answer is unknown.

Normative terms:

- **MUST** is release-blocking.
- **SHOULD** is the default; record why a feature deviates.
- **MAY** is optional and cannot become the only usable path.

## 1. Tracker identity

| Field | Decision |
|---|---|
| Working name | [Name] |
| Canonical user-facing name | [One label used in navigation, headings, forms, records, and messages] |
| Purpose | [Record / learn / change / maintain] |
| User question | [What should this tracker help answer?] |
| Non-goal | [What will it explicitly not diagnose, infer, or optimize?] |
| Domain | [Today / Sleep / Nutrition / Gym / Mind / proposed new domain] |
| Owner | [Feature owner] |
| Contract version | [Version/date] |

### User intent

Complete this sentence:

> When [situation], I want to [record/review/understand] [life event], so I can
> [personal outcome] without [burden or risk].

Document whether the tracker remains useful without a behavior-change goal.
Curiosity, memory, and record-keeping are valid purposes.

## 2. Tracker shape and record

Choose one primary shape. Compose shapes only when one cannot truthfully model
the record.

| Shape | Use when | Examples |
|---|---|---|
| Instant event | Something occurred at a point in time | Coffee, medication, symptom |
| Scalar check-in | A labeled value is observed | Mood, energy, pain |
| Start/stop interval | A state has two boundaries | Sleep, fast, focus |
| Duration session | A completed activity has elapsed time | Nap, gym, meditation |
| Composed record | Items or domain fields give the record meaning | Meal, workout, expense |
| Composed session | A timed parent owns ordered child records | Snooker training, structured practice |
| Narrative workflow | Reflection needs saveable steps | CBT thought, journal |

### Minimum record

| Field | Type | Required | Default | Validation | Display unit |
|---|---|---:|---|---|---|
| `id` | stable identifier | yes | generated | unique | — |
| `type` | event type | yes | none | registered value | canonical label |
| `temporalShape` | instant / interval / duration / wall date | yes | none | declared shape | normally hidden |
| `occurredAt` / `precision` | resolved instant plus exact/about uncertainty | for clock-precision instant | live-now only when truthful | valid zoned instant; permitted precision | local wall time plus uncertainty |
| `occurredPeriod.part` / `precision` | named local period; no representative minute | for part-of-day instant | none | allowed named period; current periods capped at record time | named period plus wall date |
| `start.at` / `start.precision` | first interval boundary | for interval shape | none | valid zoned boundary | local date, time, uncertainty |
| `end.at` / `end.precision` | second interval boundary | for interval shape | none | after start; allowed duration | local date, time, uncertainty |
| `anchorAt` / `anchor` / `durationMinutes` / `precision` | resolved boundary plus elapsed duration | for duration shape | none | domain range; explicit start/end anchor; exact/about precision | duration and derived range |
| `wallDate` | local calendar date | yes | derived with shared helper | valid date | locale date |
| `timeZone` | IANA timezone | yes | tracker/app policy | valid zone for selected wall time | visible in editor/detail |
| `recordedAt` | server/client timestamp | yes | creation time | valid instant | normally hidden |
| `payload` | versioned domain data | yes | see fields below | schema validation | domain-specific |
| `source` | provenance | yes | manual | manual/imported/inferred | visible when relevant |
| `syncState` | client state | yes | local | local/queued/syncing/synced/failed | status text |

The temporal rows are a discriminated union, not one flat record with nullable
date fields. Pick exactly one shape. Interval start and end precision are
independent; a duration declares whether `anchorAt` is its start or end. An
instant with part-of-day precision stores `occurredPeriod` and no
`occurredAt`; “Last night” and “Tonight” are separate period keys.

### Domain fields

List every field, including optional fields. No field is collected “for later”
without a current purpose.

| Field | Why it exists | Required? | Safe default? | Sensitive? | Editable? |
|---|---|---:|---:|---:|---:|
| [Field] | [Purpose] | [yes/no] | [value/no] | [yes/no] | [yes/no] |

### Data-quality states

Specify how the UI and storage distinguish:

- Observed/manual
- Imported
- Inferred or estimated
- Approximate retrospective entry
- Missing
- Zero
- Not tracked
- Not applicable

Missing MUST NOT be stored or rendered as zero. Estimated or approximate data
MUST NOT look identical to directly observed data.

## 3. Time semantics

Follow [`DATETIME_INPUTS.md`](DATETIME_INPUTS.md). Do not copy the legacy
looping wheel into a new tracker.

Answer every item:

- [ ] The record is an instant, interval, duration, or wall-date fact.
- [ ] The timestamp meaning is named: occurred, started, ended, or observed.
- [ ] Midnight grouping behavior is defined.
- [ ] Sleep/night-boundary behavior is defined if relevant.
- [ ] The IANA timezone and device-zone mismatch behavior are defined.
- [ ] Retrospective entry behavior is defined.
- [ ] The allowed date/time range and future-value policy are defined.
- [ ] Exact, About, and Part-of-day options are defined or deliberately excluded.
- [ ] Daylight-saving or offset-change behavior is defined where relevant.
- [ ] `occurredAt` and `recordedAt` remain distinct.
- [ ] Comparisons use like-for-like calendar periods.
- [ ] Zoned conversion and validation use tested domain helpers; no ad hoc date math is introduced.

Time decision:

> [Write the exact rule in plain language, then name the shared helper that
> implements it.]

### Date/time input decision

| Decision | Answer |
|---|---|
| Field question | [When did this occur/start/end/become noticeable?] |
| Temporal component | [DateTimeField / DateTimeRangeField / DurationField / DateRangeField] |
| Default intent | [Live Now / fixed value / none] |
| Presets | [Now / 15 min ago / Earlier today / Yesterday / other] |
| Earliest value | [Date/time or product rule] |
| Latest value | [Now by default; explain any future state] |
| Arbitrary date choice | [Allowed range and any unavailable dates] |
| Precision options | [Exact / About with tolerance / Part of day] |
| Timezone | [IANA zone and disclosure copy] |
| Read-only rule | [When correction ends and visible reason] |
| Human summary | [Full example including date, time/period, and uncertainty] |

Required interaction acceptance:

- [ ] Date can be selected from the complete allowed range, not only
  Today/Yesterday.
- [ ] Date and time can be typed directly on desktop; the target segmented field
      enforces 24-hour entry, while a native fallback only guarantees an
      `HH:mm` stored value.
- [ ] Mobile uses a platform picker or an equally tested touch control.
- [ ] Input/calendar scrolling cannot dismiss the mobile sheet.
- [ ] Swipe-to-dismiss begins only on the handle or header.
- [ ] Live Now resolves when Save is pressed, not when the composer opens.
- [ ] Invalid input is preserved and never silently clamped.
- [ ] UI and API enforce the same past/future and correction range.
- [ ] Interval/duration previews show both boundaries and elapsed duration.
- [ ] Approximate values remain approximate through records and analysis.

## 4. Capture interaction matrix

The primary action is based on data certainty:

- If safe defaults make a truthful record, primary activation MAY log now.
- If meaningful data is missing, primary activation MUST open the shortest
  trustworthy composer.
- Long press, swipe, drag, shortcuts, and voice MAY accelerate a task but MUST
  have a visible ordinary-control equivalent.

| Action | Touch | Mouse | Keyboard | Accessible name | Outcome |
|---|---|---|---|---|---|
| Primary | [Tap] | [Click] | [Enter/Space] | [Verb + object + time] | [Log now/open composer] |
| Choose time | [Visible control] | [Visible control] | [Focusable control] | [Edit time] | [Open time UI] |
| Shortcut | [n/a] | [n/a] | [Key, if any] | [Visible hint] | [Same as primary] |
| Optional accelerator | [Hold/swipe/etc.] | [If any] | [Equivalent] | [Description] | [Outcome] |

### Safe defaults

List every default and why it is truthful:

| Default | Evidence it is safe | How the user corrects it |
|---|---|---|
| [Default] | [Reason] | [Visible path] |

### Capture response

- Pressed/progress feedback: [Behavior]
- Optimistic row summary: [Copy]
- Pending/queued indicator: [Text + visual cue]
- Success announcement: [Copy]
- Undo duration and later correction path: [Behavior]
- Duplicate-state protection: [Behavior]
- Offline behavior: [Behavior]
- Sync failure, retained data, and retry: [Behavior]

## 5. Composer, sheet, or dialog

### Form anatomy

| Order | Field/control | Required? | Initial value | Error copy |
|---:|---|---:|---|---|
| 1 | [Field] | [yes/no] | [Value] | [Specific correction] |

Rules:

- Persistent labels identify every field.
- Required fields precede optional detail where practical.
- Units, valid range, and format appear before input when ambiguous.
- Submitted values survive validation and network errors.
- The submit label names the outcome, for example “Save meal”.
- The same semantic form is used in the mobile sheet and desktop dialog.

### Modal behavior

- [ ] Visible title is referenced by `aria-labelledby`.
- [ ] `aria-modal="true"` is used only while the background is inert.
- [ ] Focus moves to the title or first meaningful field on open.
- [ ] Tab and Shift+Tab remain inside.
- [ ] Escape closes when safe.
- [ ] A visible Close or Cancel control exists.
- [ ] Focus returns to the invoker or a logical successor.
- [ ] Drag-to-dismiss is restricted to the handle.
- [ ] Unsaved meaningful input is retained or protected from accidental discard.

### Validation behavior

- [ ] Each error identifies the field and explains how to fix it.
- [ ] `aria-invalid` and the field/message association are implemented.
- [ ] Multiple errors produce linked summary behavior.
- [ ] Focus moves to the error summary or first invalid field.
- [ ] Copy contains no “Oops”, blame, or implementation jargon.

## 6. Record and history

Define the record row:

| Element | Copy/behavior |
|---|---|
| Icon and category cue | [SVG + redundant label/shape] |
| Primary label | [Canonical event name] |
| Human summary | [Time, duration, value, or composition] |
| Provenance | [When manual/imported/inferred is visible] |
| Sync state | [Queued/syncing/synced/failed] |
| Primary row action | [Inspect/edit] |
| Secondary actions | [Edit/archive/etc.] |

History requirements:

- Default grouping: [Today/wall date/week/etc.]
- Sort order: [Rule]
- Pagination or range: [Rule]
- Empty copy and action: [Copy]
- Loading representation: [Behavior]
- Partial-data representation: [Behavior]
- Offline representation: [Behavior]
- Error representation and retry: [Behavior]

Correction requirements:

- [ ] Edit reuses the composer with current values.
- [ ] Archive has immediate Undo and a later user-visible Restore path; operator/database access does not count.
- [ ] Pending delete remains in context.
- [ ] Ghost/pending records cannot be edited before stable identity exists.
- [ ] Goal, category, unit, and schema changes do not silently reinterpret history.

## 7. Reflection specification

Choose two depths when the domain needs both:

- **Status mode:** current value, coverage/progress, discrepancy, and at most one
  relevant next action.
- **Explore mode:** history, filters, context, goals, anomalies, annotations, and
  source records.

### Reflection question

Choose the user question before choosing a chart:

- [ ] Status — what is true now?
- [ ] History — what happened over time?
- [ ] Goal — what did I choose to work toward?
- [ ] Discrepancy — how does the observation compare with my chosen range?
- [ ] Context — what else happened near this event?
- [ ] Factors — what relationships are worth exploring?

### Calculation contract

| Decision | Answer |
|---|---|
| Metric and unit | [Metric] |
| Date range | [Range] |
| Timezone | [Zone/rule] |
| Inclusion/exclusion | [Exact rule] |
| Denominator | [Logged days/events/other] |
| Missing-data behavior | [Rule] |
| Minimum evidence | [Threshold or “not enough data” rule] |
| Comparison baseline | [Like-for-like period] |
| Source-event drill-down | [Path] |

### Chart contract

- [ ] Visible title states the question or metric.
- [ ] A factual summary includes period, direction, coverage, and anomaly.
- [ ] Critical information is visible without hover.
- [ ] Hover information is also available to keyboard focus and tap.
- [ ] Color is not the only series/status cue.
- [ ] Missing periods are not connected or rendered as zero.
- [ ] A semantic data table or equivalent structured view is available.
- [ ] Interactive points have useful accessible names.
- [ ] Partial, insufficient, queued, and offline data are labeled.
- [ ] Aggregates can be traced to source events.

Insight wording:

> “[Observation] on [n of total] logged [days/events] during [period].”

Use factual comparisons or “associated with”; never state that observational
tracking proves a cause, diagnosis, or treatment effect.

## 8. Goals and language

Goals are optional and must not block logging or reflection.

| Decision | Answer |
|---|---|
| Goal type | [Learn/change/maintain] |
| Source | [Self-set/guided/external reference] |
| Metric | [Metric] |
| Target or range | [Value] |
| Cadence and timeframe | [Rule] |
| Why it matters | [User-authored reason] |
| Exceptions | [Rest/travel/illness/etc.] |
| Revise/pause behavior | [Rule] |
| Goal history | [How old goals remain interpretable] |

Neutral-copy examples:

- “2 gym sessions this week,” not “Only 2 of 4.”
- “No entries recorded Tuesday–Thursday,” not “You broke your streak.”
- “This view includes 4 of 7 days,” not “Incomplete week.”
- “Your average was 6 h 42 min,” not “Poor sleep.”
- “Resume logging” with “Keep paused,” not “Get back on track.”

Do not use good/bad, clean/dirty, cheat, failure, lazy, or identity labels for
behavior or missing data.

## 9. Pause, resume, and lifecycle

- Pause tracker: [Where and what changes]
- Pause reminders only: [Where and what changes]
- Resume now: [One-step path]
- Optional backfill: [Path and approximate-data treatment]
- Archive tracker: [Behavior and history preservation]
- Return message: [Neutral copy]

A returning user MUST be able to log the present immediately without repairing
past gaps. Historical data survives pause, migration, and tracker redesign.

### Reminder contract

| Decision | Answer |
|---|---|
| Why a reminder helps | [Purpose] |
| Opt-in moment | [Contextual setup point] |
| Default/cadence | [No default unless justified] |
| Quiet hours | [Rule] |
| Snooze/dismiss | [Actions] |
| Pause/disable | [Path] |
| Lock-screen privacy | [Generic/detail choice] |
| Missed reminder behavior | [Neutral behavior; no escalating guilt] |

Reminders are configurable and dismissible. They prompt near a useful moment
where feasible; they never treat absence of a log as failure.

## 10. Cross-tracker behavior

If the feature relates multiple domains:

| Decision | Answer |
|---|---|
| Included trackers | [List] |
| Join key | [Wall date/event window/etc.] |
| Time window | [Exact rule] |
| Coverage requirement | [Rule] |
| Confounders/missingness shown | [Rule] |
| Source-record drill-down | [Path] |
| Inclusion controls | [User control] |
| Sensitive combination risk | [Assessment] |

Do not combine data when timestamp meanings are incompatible, missingness is
likely to distort the view, the sample is inadequate, or the calculation cannot
be explained.

## 11. Privacy and trust

Complete this for the tracker and for every sensitive field:

| Field/data | Purpose | Required? | Sensitivity | Source | Storage | Retention | Glanceable visibility | Export/edit/archive |
|---|---|---:|---|---|---|---|---|---|
| [Data] | [Purpose] | [yes/no] | [level] | [source] | [destination] | [period] | [masked/shown] | [paths] |

- Request sensitive data at the moment it becomes useful.
- Explain what is stored in Postgres and any external system it reaches.
- Notifications and shared/glanceable surfaces hide sensitive detail by default.
- A new integration, sharing feature, or materially new use needs an in-context
  explanation and affirmative choice.

## 12. Accessibility acceptance

Formal target: WCAG 2.2 AA. Product standard: 48×48 CSS-pixel touch hit regions
for touch controls and a clearly visible two-pixel focus indicator.

- [ ] Normal text is at least 4.5:1 on every allowed surface.
- [ ] Large text, meaningful graphics, component boundaries, and focus cues meet 3:1.
- [ ] Meaning is never communicated by color alone.
- [ ] Every operation works with keyboard alone and without timed keystrokes.
- [ ] Focus order is logical and focus is not obscured.
- [ ] Touch hit regions meet the product target.
- [ ] Pointer actions complete on release or provide cancellation.
- [ ] Long press and drag have visible no-gesture alternatives.
- [ ] Status messages are programmatically announced without stealing focus.
- [ ] Reduced motion removes nonessential transform/scale animation.
- [ ] Content reflows at 320 CSS px without two-dimensional scrolling.
- [ ] Text remains usable at 200% and page zoom at 400%.
- [ ] Charts provide an accessible summary and structured data view.

## 13. Responsive contract

| Concern | Mobile <1024 px | Desktop ≥1024 px | Semantic invariant |
|---|---|---|---|
| Entry point | [Surface] | [Surface] | [Same destination/label] |
| Primary action | [Behavior] | [Behavior] | [Same outcome] |
| Composer | [Bottom sheet] | [Centered dialog] | [Same fields/validation] |
| Review | [Layout] | [Layout] | [Same record meaning] |
| Reflection | [Layout] | [Layout] | [Same calculation/coverage] |

If this tracker would create a sixth top-level destination, specify a domain/hub
information architecture. Do not append another mobile tab. Canonical current
order is Today, Sleep, Nutrition, Gym, Mind.

## 14. System-state matrix

| State | Visible UI | Announcement | Available action | Data retained? |
|---|---|---|---|---:|
| Initial loading | [UI] | [Copy/none] | [Action] | [yes/no] |
| Empty | [UI] | [Copy] | [Primary capture] | n/a |
| Optimistic | [UI] | [Copy] | [Undo/Edit] | yes |
| Queued offline | [UI] | [Copy] | [Continue/Retry] | yes |
| Syncing | [UI] | [Copy] | [Action] | yes |
| Synced | [UI] | [Copy] | [Edit] | yes |
| Partial data | [UI] | [Copy] | [Add detail] | yes |
| Validation error | [UI] | [Copy] | [Fix field] | yes |
| Network/server error | [UI] | [Copy] | [Retry/Edit] | yes |
| Unauthorized | [UI] | [Copy] | [Unlock] | [rule] |
| Pending archive | [UI] | [Copy] | [Undo] | yes |
| Archived | [Archived-records UI] | [Copy/none] | [Restore] | yes |

## 15. Technical integration checklist

- [ ] `lib/types.ts` event type, category, payload, and patch fields
- [ ] Validation plus pure-logic tests
- [ ] Storage mapping and schema/version behavior plus tests
- [ ] Read path and cache invalidation decision
- [ ] Create and edit composer
- [ ] Mobile and desktop capture entry
- [ ] Canonical icon, tone, label, and row summary registration
- [ ] History/review route and state handling
- [ ] Queue/offline behavior
- [ ] Reflection calculation plus tests
- [ ] Privacy/data-flow review
- [ ] Accessibility acceptance
- [ ] Responsive screenshots and keyboard walkthrough
- [ ] Component catalog and conformance register update
- [ ] `npm test`, `npx tsc --noEmit`, and `npm run build`

## 16. Release evidence

Link or attach:

- RFC/spec: [Link]
- Data/mapping tests: [Link]
- State matrix evidence: [Link]
- Mobile screenshot: [Link]
- Desktop screenshot: [Link]
- Keyboard/focus walkthrough: [Link]
- Accessible chart/table evidence: [Link]
- Conformance decision: [Link]
- Known follow-up debt with owner: [Link]
