import {
  CAFFEINE_KINDS,
  CATEGORY_BY_TYPE,
  EXERCISE_UNITS,
  PRECISIONS,
  type EventPatch,
  type EventPayload,
  type EventType,
  type ExerciseRow,
  type Precision,
} from './types';

export type ValidationResult =
  | { ok: true; value: EventPayload }
  | { ok: false; error: string };

const MAX_CLOCK_SKEW_MS = 48 * 60 * 60 * 1000; // ±48h of server time
const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export const SLEEP_SPAN_MIN_MINUTES = 20;
export const SLEEP_SPAN_MAX_MINUTES = 16 * 60;
export const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000; // events older than this are locked

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isValidTimestamp(value: unknown, now: Date): value is string {
  if (typeof value !== 'string' || !ISO_WITH_TZ.test(value)) return false;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return false;
  return Math.abs(t - now.getTime()) <= MAX_CLOCK_SKEW_MS;
}

export function isPrecision(value: unknown): value is Precision {
  return typeof value === 'string' && (PRECISIONS as readonly string[]).includes(value);
}

function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && value in CATEGORY_BY_TYPE;
}

const MAX_EXERCISE_ROWS = 30;

function isExerciseRow(v: unknown): v is ExerciseRow {
  if (!isRecord(v)) return false;
  if (v.name !== undefined && (typeof v.name !== 'string' || v.name.length > 60)) return false;
  if (v.sets !== undefined) {
    if (typeof v.sets !== 'number' || !Number.isInteger(v.sets) || v.sets < 1 || v.sets > 99) {
      return false;
    }
  }
  if (v.weight !== undefined && (typeof v.weight !== 'number' || v.weight < 0)) return false;
  if (v.unit !== undefined && !(EXERCISE_UNITS as readonly string[]).includes(v.unit as string)) {
    return false;
  }
  return true;
}

/**
 * Validate an untrusted POST /api/event body. Unknown extra keys (e.g. the
 * offline queue's client_tag) are dropped, never forwarded to Notion.
 */
export function validateEventPayload(body: unknown, now = new Date()): ValidationResult {
  if (!isRecord(body)) return { ok: false, error: 'Body must be a JSON object' };
  if (!isEventType(body.type)) return { ok: false, error: 'Unknown event type' };
  if (!isValidTimestamp(body.occurred_at, now)) {
    return { ok: false, error: 'occurred_at must be ISO 8601 with timezone, within 48h of now' };
  }
  if (!isPrecision(body.precision)) return { ok: false, error: 'Unknown precision' };

  const type = body.type;
  const base: EventPayload = {
    type,
    occurred_at: body.occurred_at,
    precision: body.precision,
  };

  if (type === 'nap') {
    const d = body.duration;
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 1 || d > 600) {
      return { ok: false, error: 'Nap duration must be an integer between 1 and 600 minutes' };
    }
    return { ok: true, value: { ...base, duration: d } };
  }

  if (type === 'caffeine') {
    const kind = body.kind;
    if (typeof kind !== 'string' || !(CAFFEINE_KINDS as readonly string[]).includes(kind)) {
      return { ok: false, error: 'Caffeine kind must be coffee, tea, energy or other' };
    }
    return { ok: true, value: { ...base, kind: kind as EventPayload['kind'] } };
  }

  if (type === 'mood' || type === 'energy') {
    const n = body.intensity;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 5) {
      return { ok: false, error: 'Intensity must be an integer between 1 and 5' };
    }
    const scope = typeof body.scope === 'string' && body.scope.length <= 40 ? body.scope : 'momentary';
    return { ok: true, value: { ...base, intensity: n, scope } };
  }

  if (type === 'meal') {
    const name = body.mealName;
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 60) {
      return { ok: false, error: 'Meal name is required and must be 1–60 characters' };
    }
    if (body.description !== undefined) {
      if (typeof body.description !== 'string' || body.description.length > 500) {
        return { ok: false, error: 'Description must be a string up to 500 characters' };
      }
    }
    if (body.proteinG !== undefined) {
      if (typeof body.proteinG !== 'number' || body.proteinG < 0 || body.proteinG > 500) {
        return { ok: false, error: 'Protein (g) must be a number between 0 and 500' };
      }
    }
    if (body.calories !== undefined) {
      if (typeof body.calories !== 'number' || body.calories < 0 || body.calories > 5000) {
        return { ok: false, error: 'Calories must be a number between 0 and 5000' };
      }
    }
    return {
      ok: true,
      value: {
        ...base,
        mealName: name,
        ...(body.description !== undefined ? { description: body.description as string } : {}),
        ...(body.proteinG !== undefined ? { proteinG: body.proteinG as number } : {}),
        ...(body.calories !== undefined ? { calories: body.calories as number } : {}),
      },
    };
  }

  if (type === 'gym-session') {
    if (body.sessionDuration !== undefined) {
      const d = body.sessionDuration;
      if (typeof d !== 'number' || !Number.isInteger(d) || d < 5 || d > 600) {
        return { ok: false, error: 'Session duration must be an integer between 5 and 600 minutes' };
      }
    }
    if (body.exercises !== undefined) {
      if (!Array.isArray(body.exercises) || body.exercises.length > MAX_EXERCISE_ROWS) {
        return { ok: false, error: `Exercises must be an array of at most ${MAX_EXERCISE_ROWS} rows` };
      }
      if (!body.exercises.every(isExerciseRow)) {
        return { ok: false, error: 'Each exercise row must have a valid name/sets/weight/unit' };
      }
    }
    return {
      ok: true,
      value: {
        ...base,
        ...(body.sessionDuration !== undefined
          ? { sessionDuration: body.sessionDuration as number }
          : {}),
        ...(body.exercises !== undefined
          ? { exercises: body.exercises as ExerciseRow[] }
          : {}),
      },
    };
  }

  // markers: wake_up / sleep_start carry no extras
  return { ok: true, value: base };
}

export type PatchValidation =
  | { ok: true; value: EventPatch }
  | { ok: false; error: string };

/** Validate an untrusted PATCH /api/event/[id] body (field values only). */
export function validatePatchBody(body: unknown, now = new Date()): PatchValidation {
  if (!isRecord(body)) return { ok: false, error: 'Body must be a JSON object' };

  const value: EventPatch = {};
  if (body.occurred_at !== undefined) {
    if (!isValidTimestamp(body.occurred_at, now)) {
      return { ok: false, error: 'occurred_at must be ISO 8601 with timezone, within 48h of now' };
    }
    value.occurred_at = body.occurred_at;
  }
  if (body.precision !== undefined) {
    if (!isPrecision(body.precision)) return { ok: false, error: 'Unknown precision' };
    value.precision = body.precision;
  }
  if (body.kind !== undefined) {
    if (typeof body.kind !== 'string' || !(CAFFEINE_KINDS as readonly string[]).includes(body.kind)) {
      return { ok: false, error: 'Caffeine kind must be coffee, tea, energy or other' };
    }
    value.kind = body.kind as EventPatch['kind'];
  }
  if (body.intensity !== undefined) {
    const n = body.intensity;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 5) {
      return { ok: false, error: 'Intensity must be an integer between 1 and 5' };
    }
    value.intensity = n;
  }
  if (body.duration !== undefined) {
    const d = body.duration;
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 1 || d > 600) {
      return { ok: false, error: 'Nap duration must be an integer between 1 and 600 minutes' };
    }
    value.duration = d;
  }
  if (body.mealName !== undefined) {
    const name = body.mealName;
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 60) {
      return { ok: false, error: 'Meal name must be 1–60 characters' };
    }
    value.mealName = name;
  }
  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.length > 500) {
      return { ok: false, error: 'Description must be a string up to 500 characters' };
    }
    value.description = body.description;
  }
  if (body.proteinG !== undefined) {
    const n = body.proteinG;
    if (typeof n !== 'number' || n < 0 || n > 500) {
      return { ok: false, error: 'Protein (g) must be a number between 0 and 500' };
    }
    value.proteinG = n;
  }
  if (body.calories !== undefined) {
    const n = body.calories;
    if (typeof n !== 'number' || n < 0 || n > 5000) {
      return { ok: false, error: 'Calories must be a number between 0 and 5000' };
    }
    value.calories = n;
  }
  if (body.sessionDuration !== undefined) {
    const d = body.sessionDuration;
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 5 || d > 600) {
      return { ok: false, error: 'Session duration must be an integer between 5 and 600 minutes' };
    }
    value.sessionDuration = d;
  }
  if (body.exercises !== undefined) {
    if (!Array.isArray(body.exercises) || body.exercises.length > MAX_EXERCISE_ROWS) {
      return { ok: false, error: `Exercises must be an array of at most ${MAX_EXERCISE_ROWS} rows` };
    }
    if (!body.exercises.every(isExerciseRow)) {
      return { ok: false, error: 'Each exercise row must have a valid name/sets/weight/unit' };
    }
    value.exercises = body.exercises as ExerciseRow[];
  }

  if (Object.keys(value).length === 0) {
    return {
      ok: false,
      error:
        'Provide at least one of occurred_at, precision, kind, intensity, duration, mealName, description, proteinG, calories, sessionDuration, exercises',
    };
  }
  return { ok: true, value };
}

/** A value field sent for an event type that doesn't carry it → error string. */
export function patchMismatch(type: EventType, patch: EventPatch): string | null {
  if (patch.kind !== undefined && type !== 'caffeine') {
    return 'kind only applies to caffeine events';
  }
  if (patch.intensity !== undefined && type !== 'mood' && type !== 'energy') {
    return 'intensity only applies to mood/energy events';
  }
  if (patch.duration !== undefined && type !== 'nap') {
    return 'duration only applies to nap events';
  }
  if (
    (patch.mealName !== undefined ||
      patch.description !== undefined ||
      patch.proteinG !== undefined ||
      patch.calories !== undefined) &&
    type !== 'meal'
  ) {
    return 'mealName/description/proteinG/calories only apply to meal events';
  }
  if ((patch.sessionDuration !== undefined || patch.exercises !== undefined) && type !== 'gym-session') {
    return 'sessionDuration/exercises only apply to gym-session events';
  }
  return null;
}
