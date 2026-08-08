'use client';

import { Icon } from '@/components/desktop/presentation';
import { useLongPress } from '@/hooks/useLongPress';
import { defaultDoseOf, formatDose, intakeLabel } from '@/lib/substances/format';
import type { Substance } from '@/lib/substances/types';
import { toLocalISO, wallHHMM } from '@/lib/time';
import type { AppEvent, EventPayload } from '@/lib/types';
import styles from './meds.module.css';

interface Props {
  substances: readonly Substance[];
  events: readonly AppEvent[];
  onLog: (payload: EventPayload, label: string) => void;
  onOpen: (substance: Substance) => void;
}

/** "2 today · 22:14" — the line that stops a second dose being taken blind. */
function todayMeta(events: readonly AppEvent[], id: string): string {
  const mine = events
    .filter((e) => e.type === 'supplement' && e.substance === id)
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const last = mine[mine.length - 1];
  if (!last) return '';
  const time = wallHHMM(last.occurredAt);
  return mine.length > 1 ? `${mine.length} today · ${time}` : time;
}

function Tile({
  substance,
  meta,
  taken,
  onLog,
  onOpen,
}: {
  substance: Substance;
  meta: string;
  taken: boolean;
  onLog: Props['onLog'];
  onOpen: Props['onOpen'];
}) {
  const { guard, handlers } = useLongPress(() => onOpen(substance));
  const dose = defaultDoseOf(substance);

  const tap = () => {
    // No default dose means there is nothing honest to write on a single tap,
    // so the tile opens the sheet instead of inventing one.
    if (!dose) {
      onOpen(substance);
      return;
    }
    const doseText = formatDose(dose);
    onLog(
      {
        type: 'supplement',
        occurred_at: toLocalISO(new Date()),
        precision: 'exact',
        substance: substance.id,
        dose: doseText,
      },
      intakeLabel(substance.type, doseText),
    );
  };

  return (
    <button
      className={`${styles.tile} ${taken ? styles.tileTaken : ''} btn-flash`}
      {...handlers}
      onClick={guard(tap)}
    >
      <span className={styles.tileFill} aria-hidden />
      <Icon name="pill" size={20} />
      <span className={styles.tileName}>{substance.name}</span>
      <span className={styles.tileDose}>
        {dose ? formatDose(dose) : `set ${substance.unit}`}
      </span>
      <span className={`${styles.tileMeta} ${meta ? styles.tileMetaHit : ''}`}>{meta || '—'}</span>
    </button>
  );
}

export default function SubstanceGrid({ substances, events, onLog, onOpen }: Props) {
  if (substances.length === 0) {
    return (
      <p className={styles.emptyHint}>
        No substances configured. Add one to <code>config/substances.json</code>.
      </p>
    );
  }

  return (
    <section className={styles.gridSection} aria-label="Log an intake">
      <div className={styles.grid}>
        {substances.map((s) => {
          const meta = todayMeta(events, s.id);
          return (
            <Tile
              key={s.id}
              substance={s}
              meta={meta}
              taken={meta !== ''}
              onLog={onLog}
              onOpen={onOpen}
            />
          );
        })}
      </div>
      <p className={styles.hint}>tap logs now · hold for dose, time &amp; notes</p>
    </section>
  );
}
