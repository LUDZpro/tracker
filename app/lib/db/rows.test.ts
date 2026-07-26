import { describe, expect, it } from 'vitest';
import { fromEventRow, type EventRow } from './rows';

const BASE: EventRow = {
  id: '11111111-2222-3333-4444-555555555555',
  type: 'wake_up',
  occurred_at: '2026-07-26T07:27:00.000+01:00',
  precision: 'exact',
  duration: null,
  intensity: null,
  kind: null,
  scope: null,
  meal_name: null,
  description: null,
  protein_g: null,
  calories: null,
  session_duration: null,
  exercises: null,
};

const row = (over: Partial<EventRow>): EventRow => ({ ...BASE, ...over });

describe('fromEventRow', () => {
  it('maps a marker and derives its category', () => {
    expect(fromEventRow(BASE)).toEqual({
      id: BASE.id,
      type: 'wake_up',
      category: 'marker',
      occurredAt: '2026-07-26T07:27:00.000+01:00',
      precision: 'exact',
    });
  });

  it('keeps occurred_at byte-identical, offset included', () => {
    // lib/time.ts groups days by the wall-clock text, so the original offset
    // must survive the round-trip untouched.
    const ev = fromEventRow(row({ occurred_at: '2026-01-02T23:15:00.000-05:00' }));
    expect(ev?.occurredAt).toBe('2026-01-02T23:15:00.000-05:00');
  });

  it('omits absent optional fields rather than emitting nulls', () => {
    const ev = fromEventRow(BASE)!;
    expect('duration' in ev).toBe(false);
    expect('intensity' in ev).toBe(false);
    expect('kind' in ev).toBe(false);
  });

  it('reads caffeine kind from its own column', () => {
    expect(fromEventRow(row({ type: 'caffeine', kind: 'tea' }))).toMatchObject({
      type: 'caffeine',
      category: 'intake',
      kind: 'tea',
    });
  });

  it('keeps nap duration and gym minutes in separate fields', () => {
    expect(fromEventRow(row({ type: 'nap', duration: 45 }))).toMatchObject({ duration: 45 });

    const gym = fromEventRow(row({ type: 'gym-session', session_duration: 135 }))!;
    expect(gym.sessionDuration).toBe(135);
    expect('duration' in gym).toBe(false);
  });

  it('maps a full meal row including macros', () => {
    const ev = fromEventRow(
      row({
        type: 'meal',
        meal_name: 'Lunch',
        description: 'chicken rice bowl',
        protein_g: '52',
        calories: '620',
      }),
    );
    expect(ev).toMatchObject({
      type: 'meal',
      category: 'action',
      mealName: 'Lunch',
      description: 'chicken rice bowl',
      proteinG: 52,
      calories: 620,
    });
  });

  it('converts numeric columns, which pg returns as strings', () => {
    const ev = fromEventRow(row({ type: 'meal', meal_name: 'Snack', protein_g: '18.5' }))!;
    expect(ev.proteinG).toBe(18.5);
    expect(typeof ev.proteinG).toBe('number');
  });

  it('treats an unusable numeric as absent instead of NaN', () => {
    const ev = fromEventRow(row({ type: 'meal', meal_name: 'Snack', protein_g: 'not-a-number' }))!;
    expect('proteinG' in ev).toBe(false);
  });

  it('passes gym exercises through as parsed jsonb', () => {
    const exercises = [{ name: 'bench', sets: 3, weight: 60, unit: 'kg' as const }];
    expect(fromEventRow(row({ type: 'gym-session', exercises }))?.exercises).toEqual(exercises);
  });

  it('drops a row whose type the app no longer knows', () => {
    // Pre-app history lives in legacy_events, but a stray row must never
    // break the feed it appears in.
    expect(fromEventRow(row({ type: 'journal' }))).toBeNull();
    expect(fromEventRow(row({ type: 'snooker_club' }))).toBeNull();
  });

  it('falls back to exact precision when the column is null', () => {
    expect(fromEventRow(row({ precision: null }))?.precision).toBe('exact');
  });
});
