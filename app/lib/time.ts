/**
 * Wall-clock helpers.
 *
 * Events are stored in Notion as ISO strings that carry the timezone offset
 * of the moment they happened. All day/night grouping here works on the
 * wall-clock part of the string (the time as the user experienced it), which
 * keeps grouping deterministic regardless of the server's own timezone.
 */

const WALL_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;

export interface WallParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
}

export function wallParts(iso: string): WallParts | null {
  const m = iso.match(WALL_RE);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
  };
}

/** "YYYY-MM-DD" of the wall-clock date. */
export function wallDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Minutes since local midnight of the wall-clock time. */
export function wallMinutes(iso: string): number {
  const p = wallParts(iso);
  if (!p) return 0;
  return p.hour * 60 + p.minute;
}

/** True chronological distance in minutes (offsets respected). */
export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000);
}

/** Shift a wall date key by n days (n may be negative). */
export function shiftDateKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Format a Date as ISO 8601 with the local UTC offset, minute precision. */
export function toLocalISO(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** Replace the wall-clock HH:MM of an ISO string, keeping date, seconds and offset. */
export function withWallTime(iso: string, hour: number, minute: number): string {
  if (!WALL_RE.test(iso)) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.min(23, Math.max(0, Math.trunc(hour)));
  const m = Math.min(59, Math.max(0, Math.trunc(minute)));
  return `${iso.slice(0, 11)}${pad(h)}:${pad(m)}${iso.slice(16)}`;
}

/** Replace the wall-clock date ("YYYY-MM-DD") of an ISO string, keeping time and offset. */
export function withWallDate(iso: string, dateKey: string): string {
  if (!WALL_RE.test(iso) || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return iso;
  return `${dateKey}${iso.slice(10)}`;
}

/** "HH:MM" for display, from the wall-clock part of an ISO string. */
export function wallHHMM(iso: string): string {
  const p = wallParts(iso);
  if (!p) return '--:--';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(p.hour)}:${pad(p.minute)}`;
}
