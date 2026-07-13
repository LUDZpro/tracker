'use client';

import ExerciseRow from './ExerciseRow';
import type { ExerciseRow as ExerciseRowValue } from '@/lib/types';
import styles from './sheets.module.css';

const STEP = 5;
const MIN = 5;
const MAX = 600;

interface Props {
  duration: number;
  onDurationChange: (n: number) => void;
  exercises: ExerciseRowValue[];
  onExercisesChange: (rows: ExerciseRowValue[]) => void;
  readOnly: boolean;
}

/** Gym-session-only edit fields for EditEventSheet: duration + exercise rows. */
export default function GymEditFields({
  duration,
  onDurationChange,
  exercises,
  onExercisesChange,
  readOnly,
}: Props) {
  const update = (i: number, next: ExerciseRowValue) =>
    onExercisesChange(exercises.map((e, idx) => (idx === i ? next : e)));
  const remove = (i: number) => onExercisesChange(exercises.filter((_, idx) => idx !== i));
  const add = () => onExercisesChange([...exercises, {}]);

  return (
    <>
      <div className={styles.stepper}>
        <button
          disabled={readOnly}
          onClick={() => onDurationChange(Math.max(MIN, duration - STEP))}
          aria-label="Less"
        >
          −
        </button>
        <span className={styles.stepperValue}>{duration}min</span>
        <button
          disabled={readOnly}
          onClick={() => onDurationChange(Math.min(MAX, duration + STEP))}
          aria-label="More"
        >
          +
        </button>
      </div>
      <div className={styles.exerciseList}>
        {exercises.map((ex, i) => (
          <ExerciseRow
            key={i}
            value={ex}
            onChange={(next) => update(i, next)}
            onRemove={() => remove(i)}
            disabled={readOnly}
          />
        ))}
        {!readOnly && (
          <button type="button" className="chip" onClick={add}>
            + Add exercise
          </button>
        )}
      </div>
    </>
  );
}
