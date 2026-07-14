'use client';

import { useState } from 'react';
import { CBT_MAX_EVIDENCE_ITEMS, CBT_TEXT_LIMITS } from '@/lib/cbt/types';
import styles from './cbt.module.css';

export type EvidenceSide = 'for' | 'against';

interface Props {
  forItems: string[];
  againstItems: string[];
  onAdd: (side: EvidenceSide, text: string) => void;
  onRemove: (side: EvidenceSide, index: number) => void;
}

const MAX_TILT_DEG = 11;
const DEG_PER_FACT = 3.5;

/** A balance beam that physically tips toward whichever side has more facts —
 *  watching "against" outweigh "for" is the point of the exercise. */
export default function EvidenceScale({ forItems, againstItems, onAdd, onRemove }: Props) {
  // Positive tilt = right ("against") side heavier and lower.
  const tilt = Math.max(
    -MAX_TILT_DEG,
    Math.min(MAX_TILT_DEG, (againstItems.length - forItems.length) * DEG_PER_FACT),
  );

  return (
    <div className={styles.evidence}>
      <svg viewBox="0 0 240 96" className={styles.beamSvg} aria-hidden>
        {/* fulcrum */}
        <path d="M120 48 L110 84 H130 Z" fill="none" stroke="var(--t4)" strokeWidth="1.5" />
        <path d="M92 84h56" stroke="var(--t4)" strokeWidth="1.5" strokeLinecap="round" />
        {/* beam + pans rotate together around the pivot */}
        <g
          style={{
            transform: `rotate(${tilt}deg)`,
            transformOrigin: '120px 48px',
            transition: 'transform var(--duration-normal) var(--ease-out-expo)',
          }}
        >
          <path d="M30 48 H210" stroke="var(--t2)" strokeWidth="2" strokeLinecap="round" />
          <circle cx="120" cy="48" r="3" fill="var(--t2)" />
          {/* left pan — for */}
          <path d="M30 48 L20 64 M30 48 L40 64" stroke="var(--t3)" strokeWidth="1.5" />
          <path d="M14 64 A 16 16 0 0 0 46 64 Z" fill="var(--bad-d)" stroke="var(--bad)" strokeWidth="1.5" />
          <text x="30" y="76" textAnchor="middle" className={styles.panCount} fill="var(--bad)">
            {forItems.length}
          </text>
          {/* right pan — against */}
          <path d="M210 48 L200 64 M210 48 L220 64" stroke="var(--t3)" strokeWidth="1.5" />
          <path d="M194 64 A 16 16 0 0 0 226 64 Z" fill="var(--ok-d)" stroke="var(--ok)" strokeWidth="1.5" />
          <text x="210" y="76" textAnchor="middle" className={styles.panCount} fill="var(--ok)">
            {againstItems.length}
          </text>
        </g>
      </svg>

      <div className={styles.evidenceCols}>
        <EvidencePane
          side="for"
          title="Backs it up"
          hint="What actually supports the thought?"
          items={forItems}
          onAdd={onAdd}
          onRemove={onRemove}
        />
        <EvidencePane
          side="against"
          title="Doesn't fit"
          hint="Facts the thought conveniently ignores"
          items={againstItems}
          onAdd={onAdd}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}

function EvidencePane({
  side,
  title,
  hint,
  items,
  onAdd,
  onRemove,
}: {
  side: EvidenceSide;
  title: string;
  hint: string;
  items: string[];
  onAdd: (side: EvidenceSide, text: string) => void;
  onRemove: (side: EvidenceSide, index: number) => void;
}) {
  const [draft, setDraft] = useState('');
  const full = items.length >= CBT_MAX_EVIDENCE_ITEMS;

  const add = () => {
    const text = draft.trim();
    if (!text || full) return;
    onAdd(side, text);
    setDraft('');
  };

  return (
    <section className={styles.evidencePane} data-side={side}>
      <h3 className={styles.evidenceTitle}>{title}</h3>
      <p className={styles.evidenceHint}>{hint}</p>
      <ul className={styles.evidenceList}>
        {items.map((text, i) => (
          <li key={`${i}-${text}`} className={styles.evidenceChip}>
            <span>{text}</span>
            <button
              type="button"
              aria-label={`Remove: ${text}`}
              onClick={() => onRemove(side, i)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {!full && (
        <div className={styles.evidenceAddRow}>
          <input
            type="text"
            value={draft}
            placeholder="Add a fact"
            maxLength={CBT_TEXT_LIMITS.evidenceItem}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
          <button type="button" onClick={add} disabled={!draft.trim()} aria-label="Add fact">
            +
          </button>
        </div>
      )}
    </section>
  );
}
