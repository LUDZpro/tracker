'use client';

import { useState } from 'react';
import { CbtIcon, DISTORTION_META, EMOTION_META, sudsColor } from './presentation';
import { wallDateKey, wallHHMM } from '@/lib/time';
import type { CbtRecord } from '@/lib/cbt/types';
import styles from './cbt.module.css';

interface Props {
  record: CbtRecord;
  todayKey: string;
  onDelete: (record: CbtRecord) => void;
}

function dayLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return 'today';
  return dateKey;
}

/** Collapsed: when + emotion + trigger + before→after. Tap to open the full record. */
export default function RecordCard({ record, todayKey, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const meta = EMOTION_META[record.emotion];
  const delta = record.intensityBefore - record.intensityAfter;

  return (
    <article className={styles.card} data-open={open || undefined}>
      <button
        type="button"
        className={styles.cardHead}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={styles.cardEmotion} style={{ color: meta.color }}>
          <CbtIcon body={meta.face} size={24} />
        </span>
        <span className={styles.cardMain}>
          <span className={styles.cardTrigger}>{record.trigger}</span>
          <span className={styles.cardMeta}>
            {dayLabel(wallDateKey(record.occurredAt), todayKey)} · {wallHHMM(record.occurredAt)} ·{' '}
            {meta.label.toLowerCase()}
          </span>
        </span>
        <span className={styles.cardDelta}>
          <span className={styles.cardDeltaNums}>
            <b style={{ color: sudsColor(record.intensityBefore) }}>{record.intensityBefore}</b>
            <i aria-hidden>→</i>
            <b style={{ color: sudsColor(record.intensityAfter) }}>{record.intensityAfter}</b>
          </span>
          <span className={styles.reliefTrack} aria-hidden>
            <span
              className={styles.reliefBar}
              style={{
                width: `${record.intensityBefore}%`,
                background: sudsColor(record.intensityBefore),
              }}
            />
            <span
              className={styles.reliefBarAfter}
              style={{
                width: `${record.intensityAfter}%`,
                background: sudsColor(record.intensityAfter),
              }}
            />
          </span>
        </span>
      </button>

      {open && (
        <div className={styles.cardBody}>
          <h4>The thought</h4>
          <blockquote className={styles.thoughtQuote}>“{record.thought}”</blockquote>

          {record.distortions.length > 0 && (
            <>
              <h4>Traps spotted</h4>
              <div className={styles.cardTags}>
                {record.distortions.map((d) => (
                  <span key={d} className={styles.cardTag}>
                    <CbtIcon body={DISTORTION_META[d].icon} size={13} />
                    {DISTORTION_META[d].label}
                  </span>
                ))}
              </div>
            </>
          )}

          {(record.evidenceFor.length > 0 || record.evidenceAgainst.length > 0) && (
            <div className={styles.cardEvidence}>
              <div>
                <h4>Backs it up · {record.evidenceFor.length}</h4>
                <ul>
                  {record.evidenceFor.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Doesn’t fit · {record.evidenceAgainst.length}</h4>
                <ul>
                  {record.evidenceAgainst.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <h4>The fairer take</h4>
          <blockquote className={`${styles.thoughtQuote} ${styles.reframeQuote}`}>
            “{record.reframe}”
          </blockquote>

          <div className={styles.cardFooter}>
            {delta > 0 ? (
              <span className={styles.deltaBadge}>eased by {delta} pts</span>
            ) : (
              <span />
            )}
            <button type="button" className={styles.cardDelete} onClick={() => onDelete(record)}>
              Delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
