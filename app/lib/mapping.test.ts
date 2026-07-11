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
