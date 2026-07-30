# Research basis for the Tracker UI/UX contract

Reviewed: 2026-07-29

This document records the primary research and official guidance behind the
technical rules in `index.html` and `NEW_TRACKER_SPEC.md`. It is not a general
reading list: each source is connected to an implemented design-system decision.

## 1. Personal tracking is a lifecycle

The stage-based model of personal informatics identifies preparation,
collection, integration, reflection, and action. Barriers in an earlier stage
reduce the value of later stages, and people may move between stages rather than
following a one-time linear funnel.

Design-system implications:

- A tracker specification covers purpose, capture, integration, reflection, and
  action together.
- Data formatting, provenance, time semantics, and longitudinal compatibility
  are part of UX, not only storage.
- Fast collection is not sufficient if the record cannot be understood,
  corrected, or used later.
- Cross-domain views preserve source records and explain how data was aligned.

Source: [Li, Dey, and Forlizzi, “A Stage-Based Model of Personal Informatics Systems,” CHI 2010](https://www.cs.cmu.edu/~jhm/Readings/2010-ianli-chi-stage-based-model.pdf).

## 2. Lapses, suspension, and resumption are normal

The lived-informatics model extends the original stage model by describing
tracking in everyday life: people forget, intentionally skip, suspend tracking,
resume, or decide that tracking has served its purpose.

Design-system implications:

- Zero, missing, not tracked, and not applicable are separate states.
- No log is never interpreted as “the event did not happen.”
- A returning user can resume with the present event without repairing history.
- Backfill is optional, and approximate/estimated entries remain distinguishable.
- Trackers and reminders can be paused independently.
- Pausing or stopping never produces a broken-streak or failure message.

Sources:

- [Epstein et al., “A Lived Informatics Model of Personal Informatics,” UbiComp 2015](https://www.smunson.com/portfolio/projects/lifelogs/livedinformaticsmodel_ubicomp15.pdf)
- [Epstein et al., “Reconsidering the Device in the Drawer,” UbiComp 2016](https://smunson.com/portfolio/projects/lifelogs/deviceinthedrawer_ubi16.pdf)

## 3. Reduce capture burden without hiding the record

Personal-informatics studies repeatedly find that access effort, repetitive
entry, and excessive detail reduce logging. Lightweight, glanceable entry can
improve adherence, while automated or simplified capture still needs user
awareness and correction.

Design-system implications:

- Frequent, safe events get a one-action “log now” path.
- Complex events open the shortest form that creates a truthful record.
- Notes and context stay optional unless they define the event.
- Recent values, presets, and safe defaults reduce repeated entry.
- Retrospective time entry and later correction remain visible.
- Manual, imported, and inferred data expose provenance.

Sources:

- [Choe et al., “SleepTight,” UbiComp 2015](https://faculty.washington.edu/jkientz/papers/Choe-SleepTight-UbiComp2015.pdf)
- [Cordeiro et al., “Rethinking the Mobile Food Journal,” CHI 2015](https://homes.cs.washington.edu/~jfogarty/publications/chi2015-decaf.pdf)

The research does not establish one universal reminder time, gesture, or field
set. Those choices remain configurable and must be tested in this app.

## 4. Support glanceable status and deeper exploration

Personal informatics serves both maintenance and discovery. Maintenance benefits
from concise status, while discovery benefits from histories, timelines,
context, and flexible comparisons.

Design-system implications:

- Reflection has two optional depths: Status and Explore.
- Each tracker considers status, history, goal, discrepancy, context, and
  factors.
- The raw ledger remains available beneath every aggregate.
- Timelines support recall; charts and tables support comparison.
- Anomalies and user-authored context can be more useful than a smooth average.

Sources:

- [Li, “Personal Informatics and Context,” doctoral dissertation, 2011](https://www.ianli.com/publications/2011-ianli-dissertation.pdf)
- [Li et al., “Taming Data Complexity in Lifelogs,” DIS 2014](https://homes.cs.washington.edu/~jfogarty/publications/dis2014.pdf)
- [Chung et al., “Exploring Personal Informatics Analysis Gaps,” JAMIA 2021](https://pubmed.ncbi.nlm.nih.gov/34609943/)

## 5. Insights are observations, not causal or medical claims

Short self-tracking periods, missing data, and unrecorded context can make
apparent relationships misleading. Self-tracking is useful for generating a
hypothesis, not automatically proving one.

Design-system implications:

- Insights state period, sample size, denominator, coverage, and missingness.
- The system uses factual comparisons or “associated with,” not “caused by.”
- Insufficient evidence suppresses or clearly qualifies an insight.
- Like-for-like calendar periods are compared.
- Cross-tracker summaries link back to contributing events.

Source: [Choe et al., “SleepTight,” discussion and design implications, UbiComp 2015](https://faculty.washington.edu/jkientz/papers/Choe-SleepTight-UbiComp2015.pdf).

## 6. Goals are optional, personal, and revisable

Goal-setting studies find that self-set and guided goals can be more acceptable
than generic assigned goals. Daily perfection can conflict with rest, travel,
illness, and changing circumstances. Self-determination research emphasizes
autonomy, competence, and choice rather than pressure.

Design-system implications:

- Logging and reflection work without a goal.
- A goal records its source, metric, range/target, cadence, timeframe, and
  personal reason.
- External recommendations are labeled references, not silent defaults.
- Goals can be revised or paused without rewriting historical meaning.
- Progress is continuous/contextual rather than only pass/fail.
- Sharing and competition require explicit opt-in.

Sources:

- [Consolvo et al., “Goal-Setting Considerations for Persuasive Technologies,” Persuasive 2009](https://www.cs.washington.edu/research/projects/aiweb/media/papers/Persuasive09-consolvoEtAl.pdf)
- [Ryan and Deci, “Self-Determination Theory and the Facilitation of Intrinsic Motivation,” American Psychologist 2000](https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf)
- [Ekhtiar et al., “Goals for Goal Setting,” DIS 2023](https://www.rubengouveia.com/papers/Ekhtiar_DIS23.pdf)

## 7. Feedback should not judge the person

Tracking interfaces can embed judgment even when they present themselves as
neutral. Judgment can be harmful when a person is reflecting, has a
non-normative goal, or is not trying to change behavior. Food-journaling
research also found that guilt and negative nudges can cause omissions or
abandonment.

Design-system implications:

- The factual observation is visually and semantically separate from the goal.
- Missing data is described as coverage, not failure.
- Copy is factual, invitational, person-centered, and strengths-based.
- The system avoids good/bad, clean/dirty, cheat, failure, lazy, and identity
  labels.
- Goal feedback is based on a goal the user chose or accepted.

Sources:

- [“Non-judgmental Interfaces,” DIS 2024](https://orbilu.uni.lu/bitstream/10993/63699/1/3656156.3663706.pdf)
- [Cordeiro et al., “Barriers and Negative Nudges,” AMIA 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4755274/)
- [NIDDK, “Words Have Power”](https://www.niddk.nih.gov/health-information/professionals/diabetes-discoveries-practice/words-have-power)
- [NIH Style Guide, person-first and destigmatizing language](https://www.nih.gov/nih-style-guide/person-first-destigmatizing-language)

## 8. Accessibility baseline

The formal product target is WCAG 2.2 AA. Tracker adopts some stronger internal
standards where a high-frequency touch interface benefits:

- Normal text: at least 4.5:1.
- Large text and required non-text graphics: at least 3:1.
- Meaning is not communicated by color alone.
- Product touch hit-region target: 48×48 CSS pixels; WCAG’s AA floor remains
  24×24 CSS pixels.
- Visible focus: a two-pixel indicator with sufficient contrast.
- Content reflows at 320 CSS pixels and remains usable when zoomed.

Sources:

- [W3C, WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C, Understanding Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [W3C, Understanding Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [W3C, Understanding Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- [W3C, Understanding Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [W3C, Understanding Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
- [W3C, Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [Android accessibility defaults and 48dp touch guidance](https://developer.android.com/develop/ui/compose/accessibility/api-defaults?hl=en)
- [Apple Human Interface Guidelines: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

## 9. Gestures cannot be the only path

WCAG 2.2 requires a single-pointer alternative to path-based or drag movement
unless dragging is essential. Keyboard operation cannot depend on timed
keystrokes. Platform guidance also favors familiar, discoverable gestures.

Design-system implications:

- Tap/click is the discoverable primary interaction.
- Long press, swipe, and drag are optional accelerators.
- Sleep-band drag has explicit start/end controls and keyboard adjustment.
- Drag-to-dismiss has visible Close/Cancel and Escape.
- Pointer actions complete on release where practical, allowing cancellation.
- Reduced-motion preferences remove nonessential movement.

Sources:

- [W3C, Understanding Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
- [W3C, Understanding Pointer Cancellation](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html)
- [W3C, Understanding Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)
- [W3C, Understanding Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
- [Apple Human Interface Guidelines: Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures/)

## 10. Modal sheets use one accessible dialog pattern

The WAI-ARIA Authoring Practices dialog pattern requires focus to enter a modal,
remain within it, close with Escape, and return logically after close. A visible
close control is strongly recommended.

Design-system implications:

- Mobile sheets and desktop dialogs share semantics and focus behavior.
- `aria-modal` is used only when background content is genuinely inert.
- Initial focus depends on form length and content.
- Tab/Shift+Tab remain inside; Escape closes when safe.
- Focus returns to the invoker or a logical successor.
- Destructive confirmation initially focuses the least destructive choice.

Source: [WAI-ARIA Authoring Practices, Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## 11. Status, errors, undo, and authentication

WCAG defines requirements for labels/instructions, error identification,
suggestions, status messages, preventing serious data errors, and accessible
authentication.

Design-system implications:

- Routine save/queue/sync messages use a pre-existing polite status region.
- Urgent alerts are reserved for blocking errors.
- Errors identify the affected field, describe the issue, and give a correction.
- Submitted values survive failure.
- Destructive data actions are reversible, checked, or confirmed.
- A timed Undo is supplemental when later edit/archive recovery remains.
- PIN login permits paste, password-manager/autofill assistance, and a
  non-memory alternative when feasible.

Sources:

- [W3C, Understanding Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html)
- [W3C, Understanding Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html)
- [W3C, Understanding Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html)
- [W3C, Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [W3C, Understanding Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html)
- [W3C, Understanding Accessible Authentication](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html)
- [WHATWG HTML, autofill tokens](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill-detail-tokens)
- [GOV.UK Design System, validation pattern](https://design-system.service.gov.uk/patterns/validation/)
- [GOV.UK Design System, error message](https://design-system.service.gov.uk/components/error-message/)

## 12. Charts require an equivalent way to understand the data

Official accessibility and platform guidance emphasizes a clear task,
non-color-only encoding, access to critical values without hover, keyboard
interaction where charts are interactive, and equivalent descriptions or
structured data for complex images.

Design-system implications:

- Every chart has a visible title/question and factual summary.
- Critical values do not require hover; tooltips also work on focus and tap.
- Series use labels, shapes, dashes, or patterns in addition to hue.
- A semantic table or equivalent structured data view is available.
- Decorative SVG internals are hidden from assistive technology.
- Interactive points have useful event/date/value names.
- Missing values differ from zero and are not connected through unknown periods.

Sources:

- [Apple Human Interface Guidelines: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)
- [WAI, Complex Images Tutorial](https://www.w3.org/WAI/tutorials/images/complex/)
- [WAI, Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/)
- [WAI-ARIA Graphics Module](https://www.w3.org/TR/graphics-aria-1.0/)

## 13. Navigation remains stable as the product grows

WCAG requires repeated navigation mechanisms to occur in the same relative
order unless the user changes them. Platform guidance recommends a small,
stable set of tab-bar destinations and warns that overflow navigation makes
destinations harder to reach.

Design-system implications:

- Today, Sleep, Nutrition, Gym, Mind use the same labels and order on mobile and
  desktop.
- Navigation contains destinations, not logging actions.
- A proposed sixth destination triggers an information-architecture decision
  rather than an appended tab.
- Nested routes keep their parent destination visibly active.

Sources:

- [W3C, Understanding Consistent Navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html)
- [Apple Human Interface Guidelines: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)

## 14. Privacy is specified per tracker and field

Official privacy guidance emphasizes data minimization, predictable use,
granular control, protective defaults, and explanations at the moment sensitive
data becomes relevant.

Design-system implications:

- Every tracker/field documents purpose, requirement, sensitivity, source,
  storage, retention, glanceable visibility, export, correction, and deletion.
- Sensitive notifications and shared-display treatments are masked by default.
- A new integration, sharing feature, or materially new data use requires
  in-context explanation and affirmative choice.
- Cross-domain insight work includes a privacy review because combinations can
  reveal more than their individual fields.

Sources:

- [Apple Human Interface Guidelines: Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy)
- [Apple Human Interface Guidelines: HealthKit](https://developer.apple.com/design/human-interface-guidelines/healthkit)
- [NIST Privacy Framework objectives](https://www.nccoe.nist.gov/publication/1800-28/VolB/index.html)
- [FTC, Mobile Health App Developers: Best Practices](https://www.ftc.gov/business-guidance/resources/mobile-health-app-developers-ftc-best-practices)
- [FTC, Collecting, Using, or Sharing Consumer Health Information](https://www.ftc.gov/business-guidance/resources/collecting-using-or-sharing-consumer-health-information-look-hipaa-ftc-act-health-breach)

## 15. Date and time starts with editable semantics

Mature date/time systems separate an editable field from an optional visual
picker. React Aria's `DateField` and `TimeField` expose keyboard-editable
segments, while `DatePicker` composes the field with a calendar and supports
minute granularity, min/max validation, 24-hour display, and zoned values.
Native HTML controls provide a zero-dependency, platform-familiar mobile path,
but `datetime-local` deliberately contains no timezone.

The WAI-ARIA date picker example reinforces that the calendar is a dialog/grid
attached to an editable date field, with focus management, one tabbable date,
arrow-key navigation, explicit selection, and focus return. The example also
warns that illustrative ARIA code is not automatically production-ready and
must be tested with actual assistive technologies.

Library evaluation:

- **React Aria Components + `@internationalized/date`** is the preferred
  production spike. It is style-free, actively maintained, designed for custom
  design systems, supports keyboard/touch/screen-reader input, and has an
  explicit IANA-zone-aware value model.
- **Native date and time inputs** are the immediate baseline and mobile
  fallback. They avoid an inner web wheel and use familiar platform controls.
- **React DayPicker** is a strong calendar-only alternative, but it still
  requires a separate time field, overlay, parsing, and temporal domain model.
- **MUI X** is complete but requires the MUI/styling stack and a date adapter,
  which conflicts with this dependency-light custom interface.
- **flatpickr** itself recommends native controls on mobile, but its older
  release cadence and smaller accessibility/timezone model make it a weaker
  foundation than React Aria.

Design-system implications:

- Date and time remain directly editable on desktop. React Aria can enforce
  24-hour segments; a native control guarantees an `HH:mm` value but may render
  a 12-hour interface under the browser or device locale.
- The calendar or operating-system picker supplements direct entry; it never
  replaces it.
- Now, Today, Yesterday, and relative choices are accelerators, not the full
  permitted date range.
- Mobile form scrolling and picker gestures cannot initiate sheet dismissal.
  Swipe-to-dismiss is restricted to the handle/header.
- Future occurrence is blocked by default with the same bounds in UI and API.
- Timezone and precision are visible domain states. Approximate periods are not
  converted into invented exact minutes.
- Instants, intervals, duration anchors, and wall-date ranges use different
  value shapes and summaries.

Sources:

- [React Aria DatePicker](https://react-aria.adobe.com/DatePicker)
- [React Aria DateField](https://react-aria.adobe.com/DateField)
- [React Aria TimeField](https://react-aria.adobe.com/TimeField)
- [React Aria internationalized date model](https://react-aria.adobe.com/internationalized/date/index.html)
- [React Aria Components package](https://www.npmjs.com/package/react-aria-components)
- [WAI-ARIA Authoring Practices date picker dialog example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)
- [MDN `datetime-local`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/datetime-local)
- [React DayPicker accessibility](https://daypicker.dev/guides/accessibility)
- [React DayPicker date/time guide](https://daypicker.dev/guides/timepicker)
- [MUI X Date Picker composition and responsive variants](https://mui.com/x/react-date-pickers/date-picker/)
- [MUI X Date and Time Picker accessibility](https://mui.com/x/react-date-pickers/accessibility/)
- [flatpickr mobile support](https://flatpickr.js.org/mobile-support/)

## 16. Training records require versioned protocols

Snooker practice is not one score type. Official rules distinguish legal pots,
fouls, points, and a break; coaching programs organize linked, progressive
sessions with review. Standardized practice systems use fixed shot counts,
success blocks, thresholds, clearances, and versioned exercises. Current
practice products commonly add drill libraries, custom routines, session
grouping, personal bests, and progress history.

Design-system implications:

- Model a session containing ordered exercise runs, not unrelated score events.
- A drill definition declares setup, attempt unit, scoring, bounds, and record
  rules.
- Retain the definition version and setup snapshot with every completed run.
- Derive personal records from comparable eligible results; never accept a
  client-authored record flag.
- Compare accuracy only under the same protocol and sufficient sample. `1/1`
  must not outrank `19/20`.
- Keep practice high breaks, drill-specific results, and match records separate.
- Table mode minimizes interruption with large context-specific controls and a
  visible Undo.
- Progress stays exercise-specific and exposes sample size; do not invent an
  unexplained overall ability score.
- The current generic event/gym shape does not provide stable drill identity,
  child results, or derived record queries; use a versioned relational domain.

Sources:

- [WPBSA official rules](https://www.wpbsa.com/rules/)
- [WPBSA coaching qualifications and levels](https://www.wpbsa.com/participation/coaching/qualifications-and-levels/)
- [WPBSA Play Snooker app announcement](https://www.wpbsa.com/play-snooker-app-powered-by-the-wpbsa/)
- [WPBSA Snooker Quotient coaching offer](https://www.wpbsa.com/sq-offer-for-wpbsa-snooker-coaches/)
- [Billiard University exams](https://billiarduniversity.org/testing/exams/)
- [Snooker Coach 147 practice product](https://snookercoaches.com/)

## Research limitations

Many seminal personal-informatics studies are small, domain-specific, and
predominantly U.S.-based. They provide strong patterns for burden, reflection,
goals, lapses, and trust, but do not establish universal reminder timing, goal
cadence, insight thresholds, or language preferences. Those remain configurable
and should be validated against the actual Tracker user and longitudinal data.
