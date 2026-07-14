'use client';

import { CBT_DISTORTIONS, type CbtDistortion } from '@/lib/cbt/types';
import { CbtIcon, DISTORTION_META } from './presentation';
import styles from './cbt.module.css';

interface Props {
  selected: CbtDistortion[];
  onToggle: (d: CbtDistortion) => void;
}

/** Icon-card multi-picker for the 11 classic cognitive distortions. */
export default function DistortionGrid({ selected, onToggle }: Props) {
  return (
    <div className={styles.distortionGrid} role="group" aria-label="Thinking traps">
      {CBT_DISTORTIONS.map((d) => {
        const meta = DISTORTION_META[d];
        const on = selected.includes(d);
        return (
          <button
            key={d}
            type="button"
            className={styles.distortionCard}
            aria-pressed={on}
            onClick={() => onToggle(d)}
          >
            <span className={styles.distortionIcon}>
              <CbtIcon body={meta.icon} />
            </span>
            <span className={styles.distortionLabel}>{meta.label}</span>
            <span className={styles.distortionBlurb}>{meta.blurb}</span>
          </button>
        );
      })}
    </div>
  );
}
