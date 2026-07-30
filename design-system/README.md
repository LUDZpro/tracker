# Tracker design system

A technical UI/UX contract for a personal life-tracking product that will grow
across many domains. It governs capture, correction, system states, reflection,
goals, accessibility, privacy, navigation, and delivery—not only colors and
components.

## Open it

The pages work as static files. For reliable local links and the Codex/Claude
browser pane, use the dependency-free server:

```bash
node design-system/server.mjs
```

Then open `http://localhost:4319/`.

The repository launch configuration includes the same `design-system` server.

## Start here

| File | Role | Authority |
|---|---|---|
| [`index.html`](index.html) | Technical UI/UX engineering manual | Normative interaction contract |
| [`components.html`](components.html) | Visual foundations and component specimens | Visual reference and current/target examples |
| [`charts-lab.html`](charts-lab.html) | Goal/threshold/warning chart proposal | Proposal — not yet contract, not yet built |
| [`CHARTS.md`](CHARTS.md) | Reasoning and sources behind the chart proposal | Rationale for `charts-lab.html` |
| [`DATETIME_INPUTS.md`](DATETIME_INPUTS.md) | Shared date/time field, temporal values, responsive behavior, and tests | Normative date/time contract |
| [`SNOOKER_TRAINING.md`](SNOOKER_TRAINING.md) | Session, exercise/run, scoring, records, and table-mode UX | Proposed Training-domain contract |
| [`NEW_TRACKER_SPEC.md`](NEW_TRACKER_SPEC.md) | Copyable RFC for every new life tracker | Required planning and acceptance template |
| [`CONFORMANCE.md`](CONFORMANCE.md) | Current app gaps versus the target | Migration register; debt is not precedent |
| [`RESEARCH.md`](RESEARCH.md) | Primary research and official guidance | Rationale and source trail |

## Source-of-truth model

The design-system folder does not ship with the app.

```text
UI/UX manual       defines behavior and acceptance
Component catalog  demonstrates the visual language
app/                implements behavior and remains the code/data authority
```

Specific ownership:

- Product behavior and quality contract → `design-system/index.html`
- New feature decisions → a completed copy of `NEW_TRACKER_SPEC.md`
- Tokens → `app/styles/tokens.css`
- Event/data semantics → domain types/validation, Postgres migrations/stores,
  and tests
- Rendered behavior → production components and CSS Modules
- Known divergence → `CONFORMANCE.md`

`design-system/styles/tokens.css` is an exact mirror of the application token
file so the catalog renders faithfully. Documentation-only variables live in
`styles/docs.css`.

## Files

| File | Contains |
|---|---|
| `styles/tokens.css` | Exact mirror of application tokens |
| `styles/components.css` | Catalog-only transcriptions of application visuals |
| `styles/charts-lab.css` | Proposed chart primitives, not yet in the app |
| `styles/docs.css` | Shared documentation shell |
| `styles/handbook.css` | Technical handbook layouts and responsive behavior |
| `styles/datetime.css` | Target-only date/time input specimens; does not ship to the app |
| `app.js` | Scroll spy, compact mobile contents, copy feedback, and catalog demos |
| `datetime-demo.js` | Dependency-free field, overlay, validation, and duration specimen behavior |
| `datetime-model.mjs` | Tested IANA-zone resolution, transition-safe arithmetic, and temporal validation reference |
| `server.mjs` | Static local server with no runtime dependency |
| `scripts/check-design-system.mjs` | Token, navigation, links, and document-integrity checks |
| `scripts/check-datetime-model.mjs` | Casablanca DST, interval arithmetic, validation-target, and duration checks |

Catalog classes use `t-` for transcribed app components and `ds-` for
documentation chrome so they do not collide. A third prefix, `x-`, marks a
*proposed* component that exists in neither the app nor the catalog yet.

## Adding a tracker

1. Copy `NEW_TRACKER_SPEC.md` into feature planning.
2. Define purpose, tracker shape, time semantics, data-quality states, and
   privacy before choosing UI.
3. Complete `DATETIME_INPUTS.md` decisions when the tracker contains calendar
   or clock data.
4. Specify capture, correction, state, history, reflection, and pause/resume.
5. Validate mobile and desktop against the same semantic contract.
6. Implement the project’s event-type checklist.
7. Update the component catalog and conformance register.
8. Run the design-system check and application verification.

Canonical current navigation is **Today, Sleep, Nutrition, Gym, Mind**. A sixth
top-level destination requires a domain/hub information-architecture decision;
it is not automatically another mobile tab.

## Keeping it honest

Run:

```bash
node design-system/scripts/check-design-system.mjs
```

The check fails when:

- The temporal model fails IANA-zone, Casablanca clock-change, uncertainty, or
  validation-target assertions
- The token mirror differs from `app/styles/tokens.css`
- Primary/secondary text tokens fall below 4.5:1 on an application surface
- Documentation chrome or inline annotations use low-contrast text roles
- Scripted demos or either documentation page omit the reduced-motion path
- The canonical five navigation labels disappear or change order in the manual
- Interactive timeline specimens omit an accessible name or focus tooltip
- A local design-system link points to a missing file
- A navigation anchor points to a missing section
- An HTML document has unbalanced tags or duplicate IDs
- Required technical documents are absent

When behavior changes, update contract → production → specimen in the same
change. When existing behavior cannot conform immediately, describe current and
target behavior separately in `CONFORMANCE.md`; never rewrite debt as a new
pattern.
