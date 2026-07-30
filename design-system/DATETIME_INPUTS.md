# Date and time input contract

Status: normative target  
Reviewed: 2026-07-29  
Applies to: every tracker that captures, displays, edits, groups, or analyses
calendar or clock information

This contract replaces the looping wheel as the recommended date/time pattern.
The current production wheel remains migration debt; it is not a component to
copy into new trackers.

## 1. Decision

Tracker adopts the interaction and data model of React Aria's date/time
components, adapted to Tracker's visual language and temporal domain:

- A visible, keyboard-editable date and time field is the foundation.
- A calendar or platform picker is an additional selection path, not the only
  way to enter a value.
- The same semantic form is rendered as a mobile sheet or desktop popover.
- Mobile uses native/platform date and time controls until a tested accessible
  component provides a clearly better result.
- The sheet can only begin swipe-to-dismiss from its handle or header. A scroll
  or drag inside the form body never dismisses it.
- Date presets accelerate common choices, but an explicit date field remains
  available whenever the tracker permits backdating.
- Timezone, precision, validation range, and the meaning of the timestamp are
  component inputs rather than undocumented per-screen behavior.

Reference implementation candidates are evaluated in section 12. Adding a
runtime package to the production app still requires a dependency, bundle,
accessibility, and timezone spike. The static examples intentionally use native
HTML controls and no runtime dependency.

## 2. Temporal shapes

A tracker chooses one shape before choosing a visual control.

```ts
type ClockPrecision =
  | { kind: 'exact' }
  | { kind: 'about'; toleranceMinutes: number };

type PartOfDayKey =
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night-end'   // “Last night”; ends on wallDate
  | 'night-start'; // “Tonight”; starts on wallDate

type ClockBoundary = {
  at: string;
  wallDate: string;
  precision: ClockPrecision;
};

type TemporalValue =
  | {
      kind: 'instant';
      occurredAt: string;
      recordedAt: string;
      wallDate: string;
      timeZone: string;
      precision: ClockPrecision;
    }
  | {
      kind: 'instant';
      occurredPeriod: { part: PartOfDayKey };
      recordedAt: string;
      wallDate: string;
      timeZone: string;
      precision: { kind: 'part-of-day' };
    }
  | {
      kind: 'interval';
      start: ClockBoundary;
      end: ClockBoundary;
      recordedAt: string;
      wallDate: string;
      timeZone: string;
    }
  | {
      kind: 'duration';
      anchor: 'start' | 'end';
      anchorAt: string;
      durationMinutes: number;
      recordedAt: string;
      wallDate: string;
      timeZone: string;
      precision: ClockPrecision;
    }
  | {
      kind: 'wall-date';
      wallDate: string;
      recordedAt: string;
      timeZone: string;
      precision: { kind: 'exact' };
    };
```

Rules:

- `occurredAt`, `start.at`, `end.at`, or `anchorAt` describes when the event
  happened. `recordedAt` describes when Tracker received the record. They are
  never interchangeable.
- A part-of-day instant stores `occurredPeriod`, not `occurredAt`. Its
  `wallDate`, named period, timezone, and recorded time define a possible range;
  there is no fabricated representative minute.
- An interval is not stored as two unrelated instant records.
- Interval boundaries carry independent precision. “Started about 23:40 and
  ended exactly at 07:18” must survive storage, display, edit, and analysis.
- A duration declares whether its timestamp is the start or the end.
- A wall date is used for facts that do not have a truthful clock time.
- Approximate values remain ranges or named periods. They are never converted
  into an invented exact minute for display or analysis.
- Every absolute timestamp is resolved with an IANA timezone. An offset alone
  is not enough to edit civil time safely.

## 3. Shared component API

The production component should expose a controlled domain API similar to:

```ts
type DateTimeFieldProps = {
  label: string;
  value: TemporalDraft;
  onChange: (next: TemporalDraft) => void;
  shape: 'instant' | 'interval' | 'duration' | 'wall-date';
  timeMeaning: 'occurred' | 'started' | 'ended' | 'observed';
  timeZone: string;
  hourCycle: 24;
  precisionOptions: Array<'exact' | 'about' | 'part-of-day'>;
  presets: Array<'now' | '15-minutes-ago' | 'earlier-today' | 'yesterday'>;
  minValue?: string;
  maxValue?: string;
  allowFuture?: boolean;
  allowedDateKeys?: string[];
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
};
```

The component receives its allowed dates and bounds. It does not guess them
from “today,” the current value, or a previous screen.

## 4. Field anatomy

Every editable exact or approximate instant contains:

1. A persistent question label, such as “When did you have this?”
2. Optional presets: Now, 15 min ago, Earlier today, Yesterday.
3. A visible date input.
4. A visible time input when precision uses a clock time.
5. A precision choice when uncertainty is valid for the tracker.
6. A human summary that includes the full date when it is not today.
7. Timezone disclosure.
8. A local validation message and an announced error state.
9. Explicit Cancel and outcome-specific commit actions in an overlay.

“Choose date” and calendar icons supplement the editable field. They never
replace it.

## 5. Responsive behavior

### Mobile sheet

- The editor is a bottom sheet with a fixed header and footer and a vertically
  scrollable body.
- Swipe-to-dismiss starts only on the visible handle or header drag region.
- Touches inside inputs, calendars, selects, steppers, and the scroll body are
  never treated as sheet dismissal gestures.
- The body uses contained overscroll. Reaching the end of a field or list does
  not move or close the sheet.
- Date and time controls use the operating-system picker when available.
- Direct editing remains possible when a hardware keyboard is connected.
- Save is never pushed below the viewport; the body scrolls independently.
- A visible Close or Cancel control and safe Escape behavior remain available.

### Desktop popover

- Date and time are visible, focusable inputs and can be typed immediately.
- A calendar button opens an anchored popover for pointer selection.
- The popover does not auto-commit a date-time value. Apply commits; Cancel
  restores the opening value.
- Focus enters the first useful field, stays within a modal variant, and returns
  to the invoker on close.
- The field summary remains visible after the popover closes.

Breakpoint changes affect layout only. Labels, value meaning, validation,
precision, and commit behavior do not change.

## 6. Date availability

Backdating is a policy, not a separate component:

- Past occurrence logging defaults to `maxValue = appNow`.
- Future values are blocked unless the tracker explicitly represents a plan,
  appointment, or reminder.
- Today and Yesterday are accelerators, not the complete date range.
- “Choose date” exposes every date permitted by `minValue`, `maxValue`, and
  `allowedDateKeys`.
- Editing may move an event across a date while it remains inside its correction
  window.
- When a record is read-only, the date and time remain selectable text and the
  reason is visible before the user attempts to save.
- A date selected at the range boundary also receives the correct time bound.

The UI and API enforce the same range. Server rejection must not be the first
time the user learns that a value is unavailable.

## 7. Precision

Use the smallest truthful precision:

| Choice | Stored meaning | Display example | Analysis |
|---|---|---|---|
| Exact | One zoned instant | `14:45` | May use the instant |
| About | Bounded range around a stated time | `about 14:45` | Use range or uncertainty-aware logic |
| Part of day | Named local period, no minute | `afternoon` | Bucket only; never substitute a minute |

Changing an approximate record does not silently make it exact. The person
chooses the precision, or the edit flow preserves the existing precision.

Default tolerance for “About” is a tracker decision. The UI shows it in plain
language, for example “within about 15 minutes.”

Interval duration inherits boundary uncertainty. If the start has tolerance
`S` and the end has tolerance `E`, the nominal duration's conservative range is
`nominal − (S + E)` through `nominal + (S + E)`, clamped at zero. History may
say “about 7 h 38 min”; analytics must use the range rather than the nominal
value alone.

Part-of-day periods use one documented wall-time policy:

- Morning: 05:00–11:59
- Afternoon: 12:00–16:59
- Evening: 17:00–20:59
- Last night (`night-end`): 21:00 on the previous wall date through 04:59 on
  the selected wall date
- Tonight (`night-start`): 21:00 on the selected wall date through 04:59 on
  the next wall date

For a past-only tracker, a period on today is unavailable until at least one
part of that period has elapsed. This lets “last night” remain truthful after
midnight without allowing “this evening” in the morning. While the selected
period is still in progress, its possible end is capped at `recordedAt` (or the
injected app clock before Save), never at a future period boundary.

## 8. Use-case mapping

| Tracker event | Shape | Timestamp question | Default | Alternate date | Precision |
|---|---|---|---|---|---|
| Caffeine | Instant | When did you have this? | Now, resolved on Save | Allowed correction/backfill range | Exact, About |
| Mood / energy | Instant | When did you notice this? | Now, resolved on Save | Allowed correction/backfill range | Exact, About, Part of day |
| Meal | Instant | When did you finish eating? | Now, resolved on Save | Allowed correction/backfill range | Exact, About |
| Sleep | Interval | When did sleep start and end? | Known marker/current time | Explicit start and end dates | Exact, About |
| Nap | Duration anchored at end | When did the nap end? | Now plus chosen duration | Allowed correction/backfill range | Exact, About |
| Gym | Duration anchored at start | When did the workout start? | Now or user choice | Allowed correction/backfill range | Exact, About |
| CBT trigger | Instant | When did this situation start? | Flow-open time, editable before Save | Allowed reflection/backfill range | Exact, About, Part of day |

If a tracker cannot answer what its timestamp means in one sentence, it is not
ready to implement.

## 9. Validation and errors

- Never silently clamp or rewrite an invalid date or time.
- Preserve the typed value after validation fails.
- Validate on Apply/Save and earlier only when a complete value becomes invalid.
- Put one specific message beside the relevant field.
- Set `aria-invalid="true"` and associate the message with
  `aria-describedby`.
- Announce blocking errors through the form's alert region.
- Move focus to the first invalid field or an error summary when multiple fields
  fail.
- A nonexistent local time is rejected without changing the typed wall fields.
  Use: “That local time did not occur in Casablanca because the clock changed.”
- An ambiguous local time is never resolved silently. Present two choices named
  by offset and order, for example “Earlier · UTC+1” and “Later · UTC+0,” and
  store the selected resolved instant.

Examples:

- “Choose a time that is not in the future.”
- “Sleep end must be after sleep start.”
- “This record can be corrected until Thursday at 14:45.”
- “Enter a complete time, for example 14:45.”

## 10. Accessibility contract

- Use native inputs or a tested date-field implementation. Do not create a
  listbox from clickable `div` elements.
- Labels stay visible and are programmatically associated.
- All actions and input hit regions are at least 48×48 CSS pixels.
- Keyboard users can type, use arrow-key segment editing, open the calendar,
  select a date, apply, cancel, and close.
- Calendar grids follow the WAI-ARIA date picker keyboard model.
- Exactly one calendar date is in the tab sequence at a time.
- Selected, focused, current, unavailable, invalid, disabled, and read-only are
  distinct states.
- The full date, time, timezone, and approximation are available to assistive
  technology; a row never exposes an ambiguous time alone.
- Motion is not required to understand or operate the component.
- The library name is not an accessibility guarantee. Test supported
  browser/screen-reader combinations.

## 11. Engineering boundaries

- One app clock owns `now`, wall date, and the canonical timezone.
- Client and server use the same temporal policy.
- Date parsing, timezone conversion, daylight-saving transitions, bounds, and
  interval maths live in tested domain helpers, not in the visual component.
- The UI passes a temporal draft and receives validation results; it does not
  construct database rows.
- Use stable record IDs. A timestamp is neither a row identity nor a complete
  pagination cursor.
- Queued records retain the original occurrence value, idempotency key, and
  visible retry/error state.
- A component test suite covers typing, presets, custom dates, invalid/future
  values, precision, interval ordering, keyboard operation, read-only behavior,
  and sheet scrolling.

## 12. Library decision

| Candidate | Strength | Cost / gap | Decision |
|---|---|---|---|
| React Aria Components + `@internationalized/date` | Style-free, keyboard segment editing, calendar composition, validation, localization, IANA-zone aware values, active maintenance | Adds a small package family and requires Tracker styling plus a focused integration test matrix | Reference architecture; preferred production spike |
| Native `date` / `time` / `datetime-local` | Zero dependency, direct entry, familiar platform mobile UI, built-in min/max/required validation; value serializes as `HH:mm` | Browser styling and time presentation follow browser/OS locale; `datetime-local` contains no timezone; advanced unavailable-date rules are limited | Foundation and fallback; used by the design-system demos, without promising a forced 24-hour display |
| React DayPicker | Strong customizable accessible calendar and date-range selection | Date calendar only; still needs time, timezone, overlay, and parsing decisions; uses date utilities | Consider only if calendar selection is needed without React Aria |
| MUI X Date and Time Pickers | Complete desktop/mobile variants, fields, validation, localization, and timezone adapters | Pulls MUI styling/runtime plus an adapter into a dependency-free custom UI | Do not adopt for Tracker |
| flatpickr | Small, familiar, and uses native mobile controls by default | Older release line, custom desktop accessibility burden, separate timezone/domain model still required | Do not adopt |
| Custom looping wheel | Visually compact | Gesture conflict, poor direct entry, duplicated list semantics, timezone and date gaps | Retire as the recommended pattern |

The design system borrows behavior and semantics, not another product's visual
skin.

## 13. Acceptance checklist

- [ ] The timestamp meaning is named: occurred, started, ended, or observed.
- [ ] The temporal shape is instant, interval, duration, or wall date.
- [ ] A date can be entered directly whenever backdating is allowed.
- [ ] A time can be typed directly on desktop.
- [ ] Mobile uses a platform control or an equally tested touch alternative.
- [ ] Scrolling or adjusting a field cannot dismiss the sheet.
- [ ] The allowed date/time range is visible and matches server validation.
- [ ] Future values are blocked by default.
- [ ] Timezone and 24-hour behavior are explicit.
- [ ] Exact and approximate values remain distinguishable through analytics.
- [ ] Invalid values are not silently changed.
- [ ] Edit and read-only behavior is known before Save.
- [ ] Interval and duration summaries show their computed meaning before Save.
- [ ] Keyboard, screen-reader, zoom, reduced-motion, and 320px reflow checks pass.
- [ ] Timezone transition and midnight boundary tests pass.

## Sources

- [React Aria DatePicker](https://react-aria.adobe.com/DatePicker)
- [React Aria DateField](https://react-aria.adobe.com/DateField)
- [React Aria TimeField](https://react-aria.adobe.com/TimeField)
- [React Aria internationalized date model](https://react-aria.adobe.com/internationalized/date/index.html)
- [WAI-ARIA Authoring Practices date picker dialog example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)
- [MDN `datetime-local`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/datetime-local)
- [MUI X date picker composition](https://mui.com/x/react-date-pickers/date-picker/)
- [MUI X date/time validation](https://mui.com/x/react-date-pickers/validation/)
- [React DayPicker](https://daypicker.dev/)
- [flatpickr mobile support](https://flatpickr.js.org/mobile-support/)
