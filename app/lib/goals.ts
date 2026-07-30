/**
 * One source for every threshold in the app.
 *
 * Before this existed, "on target" for sleep was 7h in `WeekStats` and 8h in
 * `GoalCards`, so the same night read two ways on one screen. Charts and goal
 * cards now both ask this module.
 *
 * The shapes come from the design system's goal taxonomy
 * (`design-system/charts-lab.html` §C2). A tracker declares one shape; its
 * chart treatment follows from it rather than being improvised per surface.
 */

export type GoalShape = 'floor' | 'ceiling' | 'band' | 'cutoff' | 'presence';

/**
 * How one day scored against its goal. `partial` is today's accumulating goal
 * before the day is over — never a verdict. `none` is "not logged", which is
 * deliberately distinct from a zero so charts can leave a gap instead of
 * drawing a very bad day.
 */
export type GoalState = 'goal' | 'neutral' | 'over' | 'under' | 'bad' | 'none' | 'partial';

interface Base {
  /** Short factual noun for summaries: "In range", "Reached the floor". */
  readonly label: string;
}

export interface FloorGoal extends Base {
  readonly shape: 'floor';
  /** At least this much counts as met. */
  readonly min: number;
  /** Below this the miss is material, not incidental. */
  readonly hardBelow: number;
  /** Chart ceiling before observed values are considered. */
  readonly scaleMax: number;
}

export interface CeilingGoal extends Base {
  readonly shape: 'ceiling';
  /** At most this much counts as met. */
  readonly max: number;
  readonly hardAbove: number;
  readonly scaleMax: number;
}

export interface BandGoal extends Base {
  readonly shape: 'band';
  readonly min: number;
  readonly max: number;
  readonly hardBelow: number;
  readonly hardAbove: number;
  readonly scaleMax: number;
}

export interface CutoffGoal extends Base {
  readonly shape: 'cutoff';
  /** Wall minutes after which an entry is late. */
  readonly cutoffMin: number;
  /** Wall minutes after which lateness is material. */
  readonly hardAfterMin: number;
  /** Clock axis bounds — nothing is ever logged at 02:00, so don't draw it. */
  readonly axisStartMin: number;
  readonly axisEndMin: number;
}

export interface PresenceGoal extends Base {
  readonly shape: 'presence';
}

export type Goal = FloorGoal | CeilingGoal | BandGoal | CutoffGoal | PresenceGoal;

/** Sleep is a range, not a floor: a 10h night is a deviation, not a win. */
export const SLEEP_GOAL: BandGoal = {
  shape: 'band',
  label: 'In range',
  min: 7 * 60,
  max: 9 * 60,
  hardBelow: 6 * 60,
  hardAbove: 10 * 60,
  scaleMax: 10 * 60,
};

export const PROTEIN_GOAL: FloorGoal = {
  shape: 'floor',
  label: 'Reached the floor',
  min: 160,
  hardBelow: 80,
  scaleMax: 200,
};

/** Caffeine carries two goals at once: when, and how many. */
export const CAFFEINE_TIME_GOAL: CutoffGoal = {
  shape: 'cutoff',
  label: 'Before cutoff',
  cutoffMin: 16 * 60,
  hardAfterMin: 18 * 60,
  axisStartMin: 4 * 60,
  axisEndMin: 24 * 60,
};

export const CAFFEINE_COUNT_GOAL: CeilingGoal = {
  shape: 'ceiling',
  label: 'At or under',
  max: 3,
  hardAbove: 5,
  scaleMax: 6,
};

export const GYM_GOAL: PresenceGoal = {
  shape: 'presence',
  label: 'Logged',
};

/** Legacy names kept so existing imports keep resolving. */
export const PROTEIN_TARGET_G = PROTEIN_GOAL.min;
export const CAFFEINE_CUTOFF_MIN = CAFFEINE_TIME_GOAL.cutoffMin;

/**
 * Score one day's value. `null` means the day was never logged, which is a
 * different fact from a zero and must not be scored as a miss.
 */
export function evaluate(goal: Goal, value: number | null): GoalState {
  if (value === null) return 'none';

  switch (goal.shape) {
    case 'floor':
      if (value >= goal.min) return 'goal';
      return value < goal.hardBelow ? 'bad' : 'under';

    case 'ceiling':
      if (value <= goal.max) return 'goal';
      return value > goal.hardAbove ? 'bad' : 'over';

    case 'band':
      if (value >= goal.min && value <= goal.max) return 'goal';
      if (value < goal.min) return value < goal.hardBelow ? 'bad' : 'under';
      return value > goal.hardAbove ? 'bad' : 'over';

    case 'cutoff':
      if (value <= goal.cutoffMin) return 'goal';
      return value > goal.hardAfterMin ? 'bad' : 'over';

    case 'presence':
      return value > 0 ? 'goal' : 'none';
  }
}

/** True when the state is a breach the user may want to act on. */
export function isBreach(state: GoalState): boolean {
  return state === 'over' || state === 'under' || state === 'bad';
}

/**
 * Chart ceiling. Never clip: a day past the declared scale raises it, so an
 * unusually big value stays visible instead of pinning at 100%.
 */
export function scaleFor(goal: Goal, values: readonly (number | null)[]): number {
  const declared =
    'scaleMax' in goal ? goal.scaleMax : Math.max(...values.map((v) => v ?? 0), 1);
  const observed = Math.max(0, ...values.map((v) => v ?? 0));
  return Math.max(declared, observed);
}

/** Bar height as a percentage of the scale, clamped to a visible minimum. */
export function heightPct(value: number, scaleMax: number): number {
  if (scaleMax <= 0) return 0;
  return Math.max(3, Math.min(100, (value / scaleMax) * 100));
}

/** Where a reference rule or band edge sits, as a percentage from the baseline. */
export function rulePct(bound: number, scaleMax: number): number {
  if (scaleMax <= 0) return 0;
  return Math.max(0, Math.min(100, (bound / scaleMax) * 100));
}

export interface Coverage {
  /** Days with a value. */
  logged: number;
  /** Days in the period. */
  total: number;
  /** Fewer than half the period logged — the summary qualifies itself. */
  thin: boolean;
  /** Too little to summarise at all; show bars, suppress the claim. */
  insufficient: boolean;
}

export function coverage(values: readonly (number | null)[]): Coverage {
  const logged = values.filter((v) => v !== null).length;
  const total = values.length;
  return {
    logged,
    total,
    thin: total > 0 && logged * 2 < total,
    insufficient: logged < 2,
  };
}

/** How many logged days met the goal, and out of how many. */
export function hitCount(goal: Goal, values: readonly (number | null)[]): {
  hits: number;
  logged: number;
} {
  let hits = 0;
  let logged = 0;
  for (const v of values) {
    if (v === null) continue;
    logged++;
    if (evaluate(goal, v) === 'goal') hits++;
  }
  return { hits, logged };
}

/**
 * Expected progress for an accumulating daily goal at this hour, and how far
 * ahead or behind that puts you. Eating/activity window ~06:00–22:00, clamped
 * so pre-dawn and late-night stay sane.
 */
export function paceAt(hourOfDay: number, goalValue: number): number {
  const frac = Math.min(1, Math.max(0.05, (hourOfDay - 6) / 16));
  return Math.round(goalValue * frac);
}
