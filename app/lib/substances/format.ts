/**
 * Dose strings.
 *
 * Postgres gave every other field its own column, but the brief was explicit
 * that dose is not to become one — so a dose lives as text on the existing
 * `description` column ("25 mg"), and these helpers are the only place that
 * knows how to write and read it back. Keeping the round-trip in one tested
 * module is what makes the string safe to treat as a field.
 */
import type { Substance } from './types';

export interface Dose {
  amount: number;
  unit: string;
}

/** "25 mg" / "1.9 mg". Trailing zeros are dropped so 1.90 never renders. */
export function formatDose(dose: Dose): string {
  const amount = Number.isInteger(dose.amount)
    ? String(dose.amount)
    : String(Number(dose.amount.toFixed(3)));
  return `${amount} ${dose.unit}`.trim();
}

/**
 * Read a dose back out of the stored text. Returns null for anything that
 * isn't a leading number, so a hand-edited row can't crash the sheet.
 */
export function parseDose(text: string | undefined): Dose | null {
  if (!text) return null;
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return null;
  const amount = Number(m[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, unit: m[2].trim() };
}

/**
 * The row label. The original Notion title convention was
 * `category:type — description`; there is no title column any more, so the
 * same string is composed at render time and stays the thing you read in the
 * feed, the undo toast and the edit sheet header.
 */
export function intakeLabel(type: string, doseText?: string): string {
  return doseText ? `intake:${type} — ${doseText}` : `intake:${type}`;
}

/** The label for an event whose substance is (or isn't) in the registry. */
export function labelForEvent(
  substance: string | undefined,
  doseText: string | undefined,
  registry: readonly Substance[],
): string {
  const known = registry.find((s) => s.id === substance);
  return intakeLabel(known?.type ?? substance ?? 'supplement', doseText);
}

/** Default dose for a tile, or null when the registry leaves it unset. */
export function defaultDoseOf(substance: Substance): Dose | null {
  if (substance.defaultDose === undefined) return null;
  return { amount: substance.defaultDose, unit: substance.unit };
}
