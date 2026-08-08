import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import seed from '@/config/substances.json';
import { parseRegistry, type Substance } from './types';

/**
 * Where the registry comes from, in order:
 *
 *   1. $SUBSTANCES_PATH, if set
 *   2. data/substances.json — the Docker volume that already carries the
 *      passkey store, so on the VPS a new substance is one file edit and a
 *      container restart, with no rebuild and no code change
 *   3. the bundled seed in config/substances.json
 *
 * The override is read once per process and cached; a bad file falls through
 * to the seed rather than emptying the view.
 */

const OVERRIDE_PATH = process.env.SUBSTANCES_PATH ?? path.join(process.cwd(), 'data', 'substances.json');

let cached: Substance[] | null = null;

async function readOverride(): Promise<Substance[] | null> {
  try {
    const raw = await readFile(OVERRIDE_PATH, 'utf8');
    const parsed = parseRegistry(JSON.parse(raw) as unknown);
    return parsed.length > 0 ? parsed : null;
  } catch {
    return null; // absent, unreadable or malformed — the seed is the fallback
  }
}

export async function listSubstances(): Promise<Substance[]> {
  if (cached) return cached;
  cached = (await readOverride()) ?? parseRegistry(seed as unknown);
  return cached;
}

export async function findSubstance(id: string): Promise<Substance | undefined> {
  return (await listSubstances()).find((s) => s.id === id);
}

/** Test seam — the process-lifetime cache is otherwise never cleared. */
export function clearSubstanceCache(): void {
  cached = null;
}
