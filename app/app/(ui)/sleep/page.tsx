'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import LastLine from '@/components/home/LastLine';
import QueueBanner from '@/components/home/QueueBanner';
import SleepCta from '@/components/home/SleepCta';
import MissingNightCard from '@/components/sleep/MissingNightCard';
import NapGuardCard from '@/components/sleep/NapGuardCard';
import SleepBand from '@/components/sleep/SleepBand';
import TimeSheet from '@/components/sheets/TimeSheet';
import { useLogger } from '@/hooks/useLogger';
import { useQueue } from '@/hooks/useQueue';
import { useToday } from '@/hooks/useToday';
import { patchEvent } from '@/lib/client/api';
import { isNightSkipped, isPairDismissed } from '@/lib/client/skips';
import { looksLikeNap } from '@/lib/sleep';
import { wallDateKey } from '@/lib/time';
import type { AppEvent } from '@/lib/types';
import styles from '@/components/home/home.module.css';

const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;

export default function SleepPage() {
  const { today, error: loadError, refresh } = useToday();
  const logger = useLogger(refresh);
  const queued = useQueue(useCallback(() => refresh(), [refresh]));
  const [resolved, setResolved] = useState<string[]>([]);
  const [pickingMarker, setPickingMarker] = useState<AppEvent | null>(null);

  const markResolved = (key: string) => {
    setResolved((r) => [...r, key]);
    refresh();
  };

  const moveEnd = async (ev: AppEvent, newIso: string) => {
    const res = await patchEvent(ev.id, { occurred_at: newIso, precision: '~5min' });
    refresh();
    return res.ok ? { ok: true } : { ok: false, message: res.message };
  };

  if (!today) {
    return (
      <main className={styles.page}>
        <p className={styles.emptyHint}>{loadError ?? 'Loading…'}</p>
      </main>
    );
  }

  const todayKey = wallDateKey(today.now);
  const { start, end } = today.last_sleep;
  const editable =
    (start ? Date.now() - Date.parse(start.occurredAt) < EDIT_WINDOW_MS : true) &&
    (end ? Date.now() - Date.parse(end.occurredAt) < EDIT_WINDOW_MS : true);

  const promptNight = today.missing_nights.find(
    (n) => !isNightSkipped(n) && !resolved.includes(n),
  );

  const completePair = start && end ? { start, end } : null;
  const showNapGuard =
    completePair !== null &&
    looksLikeNap(completePair) &&
    !isPairDismissed(completePair.end.id) &&
    !resolved.includes(completePair.end.id);

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Sleep</h1>
        <Link href="/" className={styles.navLink}>
          ← Home
        </Link>
      </header>

      <QueueBanner count={queued} />
      <SleepBand
        start={start}
        end={end}
        editable={editable}
        onMove={moveEnd}
        onTapHandle={(ev) => setPickingMarker(ev)}
      />
      {pickingMarker && (
        <TimeSheet
          title={pickingMarker.type === 'wake_up' ? 'Woke up at' : 'Fell asleep at'}
          confirmLabel="Set time"
          initialIso={pickingMarker.occurredAt}
          nowIso={today.now}
          allowPrevDay
          onConfirm={async (iso) => {
            const res = await patchEvent(pickingMarker.id, {
              occurred_at: iso,
              precision: 'exact',
            });
            refresh();
            return res.ok ? { ok: true } : { ok: false, message: res.message };
          }}
          onClose={() => setPickingMarker(null)}
        />
      )}
      <SleepCta state={today.state} onLog={logger.log} />

      {promptNight && (
        <MissingNightCard
          night={promptNight}
          todayKey={todayKey}
          onDone={() => markResolved(promptNight)}
        />
      )}
      {showNapGuard && completePair && (
        <NapGuardCard pair={completePair} onResolved={() => markResolved(completePair.end.id)} />
      )}

      <LastLine last={logger.last} canUndo={logger.canUndo} onUndo={logger.undo} />
      {logger.error && (
        <p className="error-inline">
          {logger.error}
          <button onClick={logger.retry}>retry</button>
        </p>
      )}
    </main>
  );
}
