'use client';

/** Missing-bedtime prompts the user chose to skip, kept per night key. */

const PREFIX = 'fl-skip-';

export function isNightSkipped(night: string): boolean {
  try {
    return localStorage.getItem(`${PREFIX}${night}`) === '1';
  } catch {
    return false;
  }
}

export function skipNight(night: string): void {
  try {
    localStorage.setItem(`${PREFIX}${night}`, '1');
  } catch {
    /* private mode — the card will just reappear */
  }
}

export function isPairDismissed(pairId: string): boolean {
  try {
    return localStorage.getItem(`fl-napguard-${pairId}`) === '1';
  } catch {
    return false;
  }
}

export function dismissPair(pairId: string): void {
  try {
    localStorage.setItem(`fl-napguard-${pairId}`, '1');
  } catch {
    /* ignore */
  }
}
