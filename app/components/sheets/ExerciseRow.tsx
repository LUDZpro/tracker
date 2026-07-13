'use client';

import { EXERCISE_UNITS, type ExerciseRow as ExerciseRowValue } from '@/lib/types';
import styles from './sheets.module.css';

interface Props {
  value: ExerciseRowValue;
  onChange: (next: ExerciseRowValue) => void;
  onRemove: () => void;
  disabled?: boolean;
}

/** One exercise row in the gym sheet's array editor — every field optional. */
export default function ExerciseRow({ value, onChange, onRemove, disabled }: Props) {
  return (
    <div className={styles.exerciseRow}>
      <input
        className={styles.textInput}
        type="text"
        placeholder="Exercise name"
        value={value.name ?? ''}
        onChange={(e) => onChange({ ...value, name: e.target.value || undefined })}
        maxLength={60}
        disabled={disabled}
      />
      <div className={styles.exerciseFields}>
        <input
          className={styles.exerciseNum}
          type="number"
          inputMode="numeric"
          placeholder="sets"
          value={value.sets ?? ''}
          onChange={(e) =>
            onChange({ ...value, sets: e.target.value === '' ? undefined : Number(e.target.value) })
          }
          min={1}
          max={99}
          disabled={disabled}
        />
        <span className={styles.exerciseX} aria-hidden>
          ×
        </span>
        <input
          className={styles.exerciseNum}
          type="number"
          inputMode="numeric"
          placeholder="weight"
          value={value.weight ?? ''}
          onChange={(e) =>
            onChange({ ...value, weight: e.target.value === '' ? undefined : Number(e.target.value) })
          }
          min={0}
          disabled={disabled}
        />
        <div className={styles.unitToggle} role="group" aria-label="Unit">
          {EXERCISE_UNITS.map((u) => (
            <button
              key={u}
              type="button"
              className="chip"
              aria-pressed={value.unit === u}
              disabled={disabled}
              onClick={() => onChange({ ...value, unit: u })}
            >
              {u}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.exerciseRemove}
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove exercise"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
