/**
 * Turns a week of events into the exact shapes the chart components render.
 *
 * Lives in lib/ rather than in a component so both surfaces build the same
 * numbers from the same code — the desktop console and the mobile week view
 * cannot drift the way `SLEEP_ON_MIN` and `SLEEP_GOAL_MIN` once did.
 */
import {
  CAFFEINE_COUNT_GOAL,
  CAFFEINE_TIME_GOAL,
  GYM_GOAL,
  PROTEIN_GOAL,
  SLEEP_GOAL,
  evaluate,
  type GoalState,
} from './goals';
import {
  caffeineByDay,
  dayLabel,
  dayLetter,
  formatDuration,
  gymCountByDay,
  intensityAvgByDay,
  lastNDayKeys,
  mealCountByDay,
  proteinByDay,
  sleepNightsByDay,
} from './weekStats';
import type { AppEvent } from './types';

export interface WeekPoint {
  key: string;
  label: string;
  value: number | null;
  state: GoalState;
  isToday: boolean;
  tip: { day: string; value: string; verdict: string; rows?: { k: string; v: string }[] };
}

export interface CaffeineTrackDay {
  key: string;
  label: string;
  minutes: number[];
  last: string | null;
}

export interface WeekCharts {
  dayKeys: string[];
  dayLetters: string[];
  todayIndex: number;
  sleep: WeekPoint[];
  protein: WeekPoint[];
  caffeine: CaffeineTrackDay[];
  mood: WeekPoint[];
  gym: number[];
}

const DAYS = 7;

/** "45m below your range", "12g short of 160g" — factual, never a verdict on
 *  the person, and always naming the goal it is measured against. */
function sleepVerdict(mins: number, state: GoalState): string {
  if (state === 'goal') return 'In your range';
  if (mins < SLEEP_GOAL.min) return `${formatDuration(SLEEP_GOAL.min - mins)} below your range`;
  return `${formatDuration(mins - SLEEP_GOAL.max)} above your range`;
}

function proteinVerdict(grams: number, state: GoalState): string {
  if (state === 'goal') return `Reached ${PROTEIN_GOAL.min}g`;
  return `${PROTEIN_GOAL.min - grams}g short of ${PROTEIN_GOAL.min}g`;
}

export function buildWeekCharts(events: readonly AppEvent[], todayKey: string): WeekCharts {
  const dayKeys = lastNDayKeys(todayKey, DAYS);
  const todayIndex = dayKeys.indexOf(todayKey);
  const isToday = (i: number) => i === todayIndex;

  const nights = sleepNightsByDay(events, dayKeys);
  const protein = proteinByDay(events, dayKeys);
  const meals = mealCountByDay(events, dayKeys);
  const caffeine = caffeineByDay(events, dayKeys);
  const mood = intensityAvgByDay(events, dayKeys, 'mood');
  const gym = gymCountByDay(events, dayKeys);

  const sleepPoints: WeekPoint[] = dayKeys.map((key, i) => {
    const night = nights[i];
    const mins = night.minutes;
    const state = evaluate(SLEEP_GOAL, mins);
    const rows: { k: string; v: string }[] = [];
    if (night.from) rows.push({ k: 'Asleep', v: night.from });
    if (night.to) rows.push({ k: 'Woke', v: night.to });
    if (caffeine[i]?.last) rows.push({ k: 'Last caffeine', v: caffeine[i].last });

    return {
      key,
      label: dayLetter(key),
      value: mins,
      state,
      isToday: isToday(i),
      tip: {
        day: dayLabel(key),
        value: mins === null ? 'Not logged' : formatDuration(mins),
        verdict: mins === null ? 'No night recorded' : sleepVerdict(mins, state),
        rows: rows.length > 0 ? rows : undefined,
      },
    };
  });

  const proteinPoints: WeekPoint[] = dayKeys.map((key, i) => {
    // 0g with no meals logged is an absence; 0g with meals logged is a real 0.
    const grams = meals[i] === 0 && protein[i] === 0 ? null : protein[i];
    const state = evaluate(PROTEIN_GOAL, grams);

    return {
      key,
      label: dayLetter(key),
      value: grams,
      state,
      isToday: isToday(i),
      tip: {
        day: dayLabel(key),
        value: grams === null ? 'Not logged' : `${grams}g`,
        verdict: grams === null ? 'No meals recorded' : proteinVerdict(grams, state),
        rows: meals[i] > 0 ? [{ k: 'Meals', v: String(meals[i]) }] : undefined,
      },
    };
  });

  const moodPoints: WeekPoint[] = dayKeys.map((key, i) => ({
    key,
    label: dayLetter(key),
    value: mood[i],
    // Mood has no user-set goal, so it gets no verdict colour at all.
    state: mood[i] === null ? 'none' : 'neutral',
    isToday: isToday(i),
    tip: {
      day: dayLabel(key),
      value: mood[i] === null ? 'Not logged' : `${mood[i].toFixed(1)} / 5`,
      verdict: '',
    },
  }));

  const caffeineDays: CaffeineTrackDay[] = dayKeys.map((key, i) => ({
    key,
    label: new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
    minutes: caffeine[i].minutes,
    last: caffeine[i].last,
  }));

  return {
    dayKeys,
    dayLetters: dayKeys.map(dayLetter),
    todayIndex,
    sleep: sleepPoints,
    protein: proteinPoints,
    caffeine: caffeineDays,
    mood: moodPoints,
    gym,
  };
}

export interface MatrixRowData {
  label: string;
  states: GoalState[];
  titles: string[];
}

/**
 * The week matrix rows. Caffeine takes the worse of its two goals — being
 * over the daily count and being past the cutoff are both breaches, and the
 * cell shows whichever is worse rather than silently dropping one.
 */
export function buildMatrixRows(week: WeekCharts): MatrixRowData[] {
  const worse = (a: GoalState, b: GoalState): GoalState => {
    const rank: Record<GoalState, number> = {
      none: 0,
      partial: 1,
      goal: 2,
      neutral: 2,
      over: 3,
      under: 3,
      bad: 4,
    };
    return rank[a] >= rank[b] ? a : b;
  };

  const describe = (tracker: string, key: string, state: GoalState): string => {
    const day = dayLabel(key);
    const word =
      state === 'goal'
        ? 'in goal'
        : state === 'partial'
          ? 'in progress'
          : state === 'none'
            ? 'not logged'
            : state === 'bad'
              ? 'well outside goal'
              : state === 'over'
                ? 'over goal'
                : state === 'under'
                  ? 'under goal'
                  : 'logged';
    return `${tracker}, ${day}: ${word}`;
  };

  const row = (label: string, states: GoalState[]): MatrixRowData => ({
    label,
    states,
    titles: states.map((s, i) => describe(label, week.dayKeys[i], s)),
  });

  const caffeineStates: GoalState[] = week.caffeine.map((d) => {
    if (d.minutes.length === 0) return 'goal'; // no caffeine is meeting both goals
    const last = d.minutes[d.minutes.length - 1];
    return worse(evaluate(CAFFEINE_TIME_GOAL, last), evaluate(CAFFEINE_COUNT_GOAL, d.minutes.length));
  });

  return [
    row('Sleep', week.sleep.map((p) => p.state)),
    row(
      'Protein',
      week.protein.map((p, i) =>
        // Today's floor is still accumulating — never scored as a miss.
        i === week.todayIndex && p.state !== 'goal' && p.value !== null ? 'partial' : p.state,
      ),
    ),
    row('Caffeine', caffeineStates),
    row('Gym', week.gym.map((n) => evaluate(GYM_GOAL, n))),
    row('Mood', week.mood.map((p) => (p.value === null ? 'none' : 'goal'))),
  ];
}
