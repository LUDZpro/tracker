# Charts: goals, thresholds, and warnings

Companion to [`charts-lab.html`](charts-lab.html), which is the visual argument.
This file holds the reasoning and the source trail, in the style of
[`RESEARCH.md`](RESEARCH.md).

Status: **proposal**. Nothing here is implemented. `x-` classes exist only in
`styles/charts-lab.css`.

## The one-sentence problem

Every chart in the app answers *how much*, and none of them answers *compared to
what* — the goal is never drawn, only implied by a fill color one step away from
the neutral fill, on the same hue.

## Goal shapes

The taxonomy the rest of the proposal hangs from. A tracker declares one shape;
its chart treatment follows from it.

| Shape | Reads as | Metrics | Treatment |
|---|---|---|---|
| Floor | at least | protein, gym minutes | Reference rule; above it is a hit; overshoot stays visible |
| Ceiling | at most | caffeine count, kcal | Same rule, inverted; crossing is the breach |
| Band | between | sleep, weight, mood | Tinted zone; **both** directions are a miss |
| Cutoff | before a clock time | last caffeine, last meal | Clock axis with a vertical rule; lateness is a position |
| Presence | any / none | gym, CBT record | Blocks, not columns — no magnitude to encode |

The app currently implements only *floor*, and applies it to sleep, which is a
band. That single mismatch produces the "a 10h night draws taller than an 8h
night" defect.

## Proposed parts

| Part | Answers | Replaces |
|---|---|---|
| Reference rule | How far short? | A fill-color step |
| Target band | Am I inside the range? | Nothing — this shape has no current treatment |
| Missing mark | Was this logged? | A 4% bar in the "low" color |
| Overshoot cap | How far past? | A silent clamp to 100% |
| Breach scale | How bad, and is it a warning at all? | `--accent`, which also means *today* |
| Pace marker | Am I on track *at this hour*? | A sentence on one panel |
| Cutoff track | When, relative to the line? | Log-order dots with no time axis |
| Coverage foot | Over how many logged days? | Nothing |

And three new chart types on top of the existing five:

| Type | Answers | Where |
|---|---|---|
| Segmented hour bar | Exactly how many hours? | Sleep |
| Column tooltip | What made this day that number? | Every chart |
| Week matrix | How is my week going, across everything? | Both home surfaces |

## Why each one

### 1. Draw the goal, do not tint for it

Bar length judged against a shared baseline is the most accurate comparison a
chart can offer, and comparisons between adjacent bars are read more accurately
than between distant ones. A second aligned baseline at the goal turns every bar
into a distance, with no legend and no recall. Round goal values also act as
natural anchors, which is an argument for labeling the rule with the number
rather than the word "goal".

- [Few, *Bullet Graph Design Specification*, Perceptual Edge](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
- [Talbot et al., perception studies surveyed in *A Survey of Perception-Based Visualization Studies by Task*](https://arxiv.org/pdf/2107.07477)
- [*Improving Perception Accuracy in Bar Charts with Internal Contrast and Framing Enhancements*, IV 2018](https://www.cs.mun.ca/~omeruvia/research/publications/2018_0521_BarChartsPerception-IV18.pdf)

### 2. Missing is absent, not small

Replacing a missing value with a default stops readers noticing that anything is
missing; zero-filling produces the lowest perceived data quality of the tested
strategies. The technique that scored best on decision confidence was leaving
the space empty **and explaining it** — which is why the proposal pairs an empty
column with a coverage denominator rather than just deleting the bar.

This is the most consequential finding for a personal tracker, where gaps are
routine and the manual already frames lapses as normal rather than as failure.

- [Song and Szafir, *Where's My Data? Evaluating Visualizations with Missing Data*, IEEE VIS 2018](https://cmci.colorado.edu/visualab/papers/song_VIS_2018.pdf)
- [*Visualization of missing data: a state-of-the-art survey*, 2024](https://arxiv.org/pdf/2410.03712)

### 3. Two breach levels, each with a non-color partner

Color cannot be the only channel carrying meaning; roughly 8% of men have a
colour-vision deficiency, and a screen reader perceives no colour at all. Each
breach level therefore ships with a hatch and a text equivalent in the data
table.

Two levels, not three or five: bullet-graph practice caps qualitative ranges at
five and recommends three, on the grounds that more states cost more perceptual
reasoning than a glance affords. A personal tracker with self-set goals cannot
honestly distinguish more than "outside" and "well outside".

- [W3C, *Understanding Success Criterion 1.4.1: Use of Color*](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- [Few, *Bullet Graph Design Specification*](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)

### 4. Pace, because a daily goal is a function of the hour

"112 of 160 g" is ahead at 09:00 and behind at 21:00; the current card renders
both identically and resolves protein only to *done* or *open*. Goal-setting
research favours continuous, contextual progress over pass/fail, and the bullet
graph is the established compact form for *measure + comparative marker +
qualitative range* in one row.

The math already exists and is unit-tested (`paceMessage()` in
`lib/nutrition/stats.ts`); this is a rendering change, not a modelling one.

- [Consolvo et al., *Goal-Setting Considerations for Persuasive Technologies*, Persuasive 2009](https://www.cs.washington.edu/research/projects/aiweb/media/papers/Persuasive09-consolvoEtAl.pdf)
- [Few, *Bullet Graph Design Specification*](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)

### 5. Cutoff goals belong on a clock axis

Encoding lateness as a colour swap on log-ordered dots throws away the only
variable that matters. On a clock axis, a late intake is *right of the line* —
readable pre-attentively, before any hue is decoded, and still readable in
grayscale. The tinted zone past the rule renders on clean days too, so the rule
is visible before any intake is.

### 6. Every chart states its denominator

Short self-tracking periods, gaps, and unrecorded context make apparent patterns
misleading; a summary without its sample size is an unqualified claim. Below two
logged days in the period the summary is suppressed rather than computed.

- [Choe et al., *SleepTight*, UbiComp 2015](https://faculty.washington.edu/jkientz/papers/Choe-SleepTight-UbiComp2015.pdf)

### 7. Countable units beat estimated heights

A continuous bar makes the reader estimate; discrete blocks let them count. The
app already proves this internally — the mood grid uses one block per point
precisely so counts stay countable — and sleep is the metric where the exact
number is what the user says out loud ("I got six hours"). Segmenting also puts
the goal line on a block boundary, so the count and the rule agree instead of
competing.

The constraint is that the unit must be one the user actually thinks in. Sleep
hours, sets, meals and cups qualify; protein grams do not, which is why the
floor charts keep a plain bar.

### 8. Answer the follow-up question in the chart

Seeing that Sunday was short currently means leaving the chart and opening the
ledger. Personal informatics research separates a glanceable *status* depth from
an *explore* depth, and notes that the raw record should stay reachable beneath
every aggregate — a tooltip carrying value, verdict and composition is the
cheapest bridge between the two, and it is what keeps a week review inside one
screen.

Critical values must not require a hover, so the tooltip is supplementary by
contract: it opens on hover, keyboard focus **and** tap, its trigger carries the
whole sentence as its accessible name, and everything in it also appears in the
chart's data view.

- [Li, *Personal Informatics and Context*, 2011](https://www.ianli.com/publications/2011-ianli-dissertation.pdf)
- [Apple Human Interface Guidelines: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)

### 9. The week needs one picture, not four

Four charts each answering one metric never compose into "how is my week
going". The matrix puts every tracker on its own row and every day in its own
column, so the *vertical* read — the one no current screen offers — becomes
available: a hole across four trackers on Saturday, a short night sitting under
a second late coffee on Sunday.

Two guards keep it honest. Every cell carries a **shape** as well as a fill, so
the grid survives grayscale and colour-vision deficiency. And the column-wise
juxtaposition is presented as an aligned observation with no arrow drawn between
rows — the same constraint §5 puts on every cross-tracker summary.

It is also the mobile answer: mobile has no week view of any kind today, and the
matrix is the only one of these charts compact enough for a 28rem column.

### 10. The structured view is not optional

Required by the manual's chart release contract and by
[`RESEARCH.md` §12](RESEARCH.md); implemented by no chart. The proposal renders a
real table per chart, whose caption carries period, timezone, units and goal.

- [WAI, *Complex Images Tutorial*](https://www.w3.org/WAI/tutorials/images/complex/)
- [Apple Human Interface Guidelines: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)

## Tone guard

`--warn` and `--bad` enter the chart language carrying connotations that
[`RESEARCH.md` §7](RESEARCH.md) pushes back on. Three constraints keep them
honest:

1. They describe the **measurement's** distance from a goal, never the person.
   Copy stays factual: "1h 25m below your range", not "bad night".
2. A tracker with no user-set goal gets **no breach colour at all** — the
   neutral fill is the whole vocabulary.
3. Every breach appears alongside a denominator, so a single flagged day cannot
   read as a verdict on the week.

One existing production string fails this today: `WeekPanel.tsx` renders
"Streak at target", and streak-restoration framing is exactly what the manual's
goal-language table lists as the thing to avoid. It becomes "Days at target".

## Relationship to the other documents

- Behaviour contract, and the chart release checklist this proposal satisfies:
  [`index.html` §U-01](index.html)
- Current gaps, including the open charts row this proposal closes:
  [`CONFORMANCE.md` §9](CONFORMANCE.md)
- Required planning fields — a **Goal shape** line is proposed for
  [`NEW_TRACKER_SPEC.md`](NEW_TRACKER_SPEC.md)
- Current, shipped chart specimens: [`components.html` §16](components.html)

## Research limitations

The perception results cited are from general-purpose visualization studies with
recruited participants, not from single-user personal-tracking tools. The
missing-data findings are the closest fit and the strongest evidence here. Where
the sources are silent — the exact tint of the band, the hatch angle, the 64px
plot height — the choice is a house-style judgment, not a finding.
