import { describe, expect, it } from 'vitest';
import { eventTitle, fromNotionPage, toNotionProperties } from './mapping';

const AT = '2026-07-06T07:12:00+01:00';

describe('eventTitle', () => {
  it('formats every button per the write contract', () => {
    expect(eventTitle({ type: 'wake_up', occurred_at: AT, precision: 'exact' })).toBe('marker:wake_up');
    expect(eventTitle({ type: 'sleep_start', occurred_at: AT, precision: 'exact' })).toBe('marker:sleep_start');
    expect(eventTitle({ type: 'nap', occurred_at: AT, precision: 'exact', duration: 45 })).toBe('action:nap — 45min');
    expect(eventTitle({ type: 'caffeine', occurred_at: AT, precision: 'exact', kind: 'coffee' })).toBe('intake:caffeine — coffee');
    expect(eventTitle({ type: 'mood', occurred_at: AT, precision: 'exact', intensity: 4 })).toBe('state:mood — 4/5');
    expect(eventTitle({ type: 'energy', occurred_at: AT, precision: 'exact', intensity: 2 })).toBe('state:energy — 2/5');
    expect(eventTitle({ type: 'meal', occurred_at: AT, precision: 'exact', mealName: 'Lunch' })).toBe('action:meal — Lunch');
    expect(
      eventTitle({
        type: 'gym-session',
        occurred_at: AT,
        precision: 'exact',
        sessionDuration: 45,
        exercises: [{ name: 'Bench' }, { name: 'Squats' }],
      }),
    ).toBe('action:gym-session — 2 exercises, 45min');
    expect(eventTitle({ type: 'gym-session', occurred_at: AT, precision: 'exact' })).toBe(
      'action:gym-session — 0 exercises, 0min',
    );
  });
});

describe('toNotionProperties', () => {
  it('writes title, datetime, precision, category and type', () => {
    const props = toNotionProperties({ type: 'wake_up', occurred_at: AT, precision: '~5min' }) as any;
    expect(props.Event.title[0].text.content).toBe('marker:wake_up');
    expect(props['Occurred at'].date.start).toBe(AT);
    expect(props.Precision.select.name).toBe('~5min');
    expect(props.Category.select.name).toBe('marker');
    expect(props.Type.rich_text[0].text.content).toBe('wake_up');
    expect(props['Duration (min)']).toBeUndefined();
    expect(props.Intensity).toBeUndefined();
  });

  it('adds Duration (min) for naps and Intensity+Scope for states', () => {
    const nap = toNotionProperties({ type: 'nap', occurred_at: AT, precision: 'exact', duration: 90 }) as any;
    expect(nap['Duration (min)'].number).toBe(90);
    const mood = toNotionProperties({ type: 'mood', occurred_at: AT, precision: 'exact', intensity: 5, scope: 'momentary' }) as any;
    expect(mood.Intensity.number).toBe(5);
    expect(mood.Scope.select.name).toBe('momentary');
  });

  it('writes meal description/macros into Notes as JSON, leaves Notes off when absent', () => {
    const bare = toNotionProperties({ type: 'meal', occurred_at: AT, precision: 'exact', mealName: 'Lunch' }) as any;
    expect(bare.Notes).toBeUndefined();
    const full = toNotionProperties({
      type: 'meal',
      occurred_at: AT,
      precision: 'exact',
      mealName: 'Lunch',
      description: 'chicken + rice',
      proteinG: 25,
      calories: 450,
    }) as any;
    const notes = JSON.parse(full.Notes.rich_text[0].text.content);
    expect(notes).toEqual({ v: 1, description: 'chicken + rice', proteinG: 25, calories: 450 });
    expect(full['Duration (min)']).toBeUndefined();
  });

  it('writes gym-session duration to Duration (min) and exercises to Notes', () => {
    const gym = toNotionProperties({
      type: 'gym-session',
      occurred_at: AT,
      precision: 'exact',
      sessionDuration: 45,
      exercises: [{ name: 'Bench press', sets: 5, weight: 80, unit: 'kg' }],
    }) as any;
    expect(gym['Duration (min)'].number).toBe(45);
    const notes = JSON.parse(gym.Notes.rich_text[0].text.content);
    expect(notes).toEqual({ v: 1, exercises: [{ name: 'Bench press', sets: 5, weight: 80, unit: 'kg' }] });
  });
});

describe('fromNotionPage', () => {
  const page = {
    id: 'page-1',
    properties: {
      Type: { rich_text: [{ plain_text: 'caffeine' }] },
      'Occurred at': { date: { start: AT } },
      Precision: { select: { name: 'exact' } },
    },
  };

  it('round-trips a valid page', () => {
    expect(fromNotionPage(page)).toEqual({
      id: 'page-1',
      type: 'caffeine',
      category: 'intake',
      occurredAt: AT,
      precision: 'exact',
    });
  });

  it('ignores archived pages and unknown types', () => {
    expect(fromNotionPage({ ...page, archived: true })).toBeNull();
    expect(
      fromNotionPage({
        ...page,
        properties: { ...page.properties, Type: { rich_text: [{ plain_text: 'mystery' }] } },
      }),
    ).toBeNull();
  });

  it('parses caffeine kind back from the title', () => {
    const withTitle = {
      ...page,
      properties: {
        ...page.properties,
        Event: { title: [{ plain_text: 'intake:caffeine — tea' }] },
      },
    };
    expect(fromNotionPage(withTitle)?.kind).toBe('tea');
  });

  it('drops unrecognized kind suffixes instead of guessing', () => {
    const withTitle = {
      ...page,
      properties: {
        ...page.properties,
        Event: { title: [{ plain_text: 'intake:caffeine — soda' }] },
      },
    };
    expect(fromNotionPage(withTitle)?.kind).toBeUndefined();
  });

  it('round-trips a meal: name from the title, macros from Notes JSON', () => {
    const mealPage = {
      id: 'page-2',
      properties: {
        Type: { rich_text: [{ plain_text: 'meal' }] },
        'Occurred at': { date: { start: AT } },
        Precision: { select: { name: 'exact' } },
        Event: { title: [{ plain_text: 'action:meal — Lunch' }] },
        Notes: {
          rich_text: [{ plain_text: JSON.stringify({ v: 1, description: 'chicken + rice', proteinG: 25 }) }],
        },
      },
    };
    const ev = fromNotionPage(mealPage);
    expect(ev?.mealName).toBe('Lunch');
    expect(ev?.description).toBe('chicken + rice');
    expect(ev?.proteinG).toBe(25);
    expect(ev?.calories).toBeUndefined();
  });

  it('round-trips a gym session: duration from Duration (min), exercises from Notes JSON', () => {
    const gymPage = {
      id: 'page-3',
      properties: {
        Type: { rich_text: [{ plain_text: 'gym-session' }] },
        'Occurred at': { date: { start: AT } },
        Precision: { select: { name: 'exact' } },
        'Duration (min)': { number: 45 },
        Event: { title: [{ plain_text: 'action:gym-session — 1 exercises, 45min' }] },
        Notes: {
          rich_text: [{ plain_text: JSON.stringify({ v: 1, exercises: [{ name: 'Bench', sets: 5 }] }) }],
        },
      },
    };
    const ev = fromNotionPage(gymPage);
    expect(ev?.sessionDuration).toBe(45);
    expect(ev?.duration).toBeUndefined(); // gym minutes never land on the nap-only field
    expect(ev?.exercises).toEqual([{ name: 'Bench', sets: 5 }]);
  });

  it('discards malformed Notes JSON instead of throwing', () => {
    const badPage = {
      id: 'page-4',
      properties: {
        Type: { rich_text: [{ plain_text: 'meal' }] },
        'Occurred at': { date: { start: AT } },
        Precision: { select: { name: 'exact' } },
        Event: { title: [{ plain_text: 'action:meal — Lunch' }] },
        Notes: { rich_text: [{ plain_text: 'not json at all' }] },
      },
    };
    const ev = fromNotionPage(badPage);
    expect(ev?.mealName).toBe('Lunch');
    expect(ev?.description).toBeUndefined();
  });
});

describe('eventTitle from a merged AppEvent (PATCH rewrite)', () => {
  it('rebuilds value-carrying titles from event state', () => {
    expect(
      eventTitle({
        id: 'e1', type: 'caffeine', category: 'intake', occurredAt: AT, precision: 'exact', kind: 'energy',
      }),
    ).toBe('intake:caffeine — energy');
    expect(
      eventTitle({
        id: 'e2', type: 'mood', category: 'state', occurredAt: AT, precision: 'exact', intensity: 4,
      }),
    ).toBe('state:mood — 4/5');
    expect(
      eventTitle({
        id: 'e3', type: 'nap', category: 'action', occurredAt: AT, precision: 'exact', duration: 25,
      }),
    ).toBe('action:nap — 25min');
  });
});
