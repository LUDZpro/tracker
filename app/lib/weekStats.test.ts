import { describe, expect, it } from 'vitest';
import {
  caffeineByDay,
  dayLetter,
  formatHhMm,
  intensityAvgByDay,
  lastNDayKeys,
  proteinByDay,
  sleepMinutesByDay,
} from './weekStats';
import { CATEGORY_BY_TYPE, type AppEvent, type EventType } from './types';

const TZ = '+01:00';
let seq = 0;

function ev(type: EventType, at: string, extra: Partial<AppEvent> = {}): AppEvent {
  return {
    id: `t-${seq++}`,
    type,
    category: CATEGORY_BY_TYPE[type],
    occurredAt: `${at}${TZ}`,
    precision: 'exact',
    ...extra,
  };
}

describe('lastNDayKeys', () => {
  it('returns n ascending keys ending today', () => {
    expect(lastNDayKeys('2026-07-12', 3)).toEqual([
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ]);
  });

  it('crosses month boundaries', () => {
    expect(lastNDayKeys('2026-07-02', 3)).toEqual([
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
    ]);
  });
});

describe('sleepMinutesByDay', () => {
  it('attributes a night to its wake day', () => {
    const events = [
      ev('sleep_start', '2026-07-11T23:41:00'),
      ev('wake_up', '2026-07-12T07:12:00'),
    ];
    const days = ['2026-07-11', '2026-07-12'];
    expect(sleepMinutesByDay(events, days)).toEqual([null, 451]);
  });

  it('sums multiple pairs ending the same day and leaves gaps null', () => {
    const events = [
      ev('sleep_start', '2026-07-11T23:00:00'),
      ev('wake_up', '2026-07-12T03:00:00'),
      ev('sleep_start', '2026-07-12T04:00:00'),
      ev('wake_up', '2026-07-12T07:00:00'),
    ];
    const days = ['2026-07-10', '2026-07-12'];
    expect(sleepMinutesByDay(events, days)).toEqual([null, 240 + 180]);
  });
});

describe('intensityAvgByDay', () => {
  it('averages the requested type per day, ignoring the other', () => {
    const events = [
      ev('mood', '2026-07-12T09:00:00', { intensity: 2 }),
      ev('mood', '2026-07-12T20:00:00', { intensity: 4 }),
      ev('energy', '2026-07-12T12:00:00', { intensity: 5 }),
    ];
    expect(intensityAvgByDay(events, ['2026-07-11', '2026-07-12'], 'mood')).toEqual([
      null,
      3,
    ]);
  });
});

describe('caffeineByDay', () => {
  it('lists intake minutes ascending with the last HH:MM', () => {
    const events = [
      ev('caffeine', '2026-07-12T19:15:00', { kind: 'coffee' }),
      ev('caffeine', '2026-07-12T12:30:00', { kind: 'coffee' }),
    ];
    const [day] = caffeineByDay(events, ['2026-07-12']);
    expect(day.minutes).toEqual([12 * 60 + 30, 19 * 60 + 15]);
    expect(day.last).toBe('19:15');
  });

  it('returns an empty day when nothing was logged', () => {
    expect(caffeineByDay([], ['2026-07-12'])).toEqual([{ minutes: [], last: null }]);
  });
});

describe('proteinByDay', () => {
  it('sums meal protein per day, treating missing values as 0', () => {
    const events = [
      ev('meal', '2026-07-12T08:40:00', { mealName: 'Breakfast', proteinG: 38 }),
      ev('meal', '2026-07-12T13:05:00', { mealName: 'Lunch', proteinG: 58 }),
      ev('meal', '2026-07-12T18:00:00', { mealName: 'Snack' }),
      ev('meal', '2026-07-11T13:00:00', { mealName: 'Lunch', proteinG: 40 }),
    ];
    expect(proteinByDay(events, ['2026-07-11', '2026-07-12'])).toEqual([40, 96]);
  });
});

describe('formatHhMm', () => {
  it('formats hours and zero-padded minutes', () => {
    expect(formatHhMm(451)).toBe('7 h 31');
    expect(formatHhMm(45)).toBe('45 min');
  });
});

describe('dayLetter', () => {
  it('maps a date key to its weekday letter', () => {
    expect(dayLetter('2026-07-12')).toBe('S'); // Sunday
    expect(dayLetter('2026-07-13')).toBe('M'); // Monday
  });
});
