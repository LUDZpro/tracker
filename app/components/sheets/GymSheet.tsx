'use client';

import { useState } from 'react';
import Sheet from './Sheet';
import DayTimeField from './DayTimeField';
import ExerciseRow from './ExerciseRow';
import { toLocalISO } from '@/lib/time';
import type { EventPayload, ExerciseRow as ExerciseRowValue, Precision } from '@/lib/types';
import styles from './sheets.module.css';

const DURATION_STEP = 5;
const DURATION_MIN = 5;
const DURATION_MAX = 600;
const DEFAULT_DURATION = 45;

interface Props {
  onLog: (payload: EventPayload, label: string) => void;
  onClose: () => void;
}

/** Exercises are a 0..n array — a session with none logged is valid. */
export default function GymSheet({ onLog, onClose }: Props) {
  const [at, setAt] = useState(() => toLocalISO(new Date()));
  const [precision, setPrecision] = useState<Precision>('exact');
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [exercises, setExercises] = useState<ExerciseRowValue[]>([]);

  const addExercise = () => setExercises((ex) => [...ex, {}]);
  const updateExercise = (i: number, next: ExerciseRowValue) =>
    setExercises((ex) => ex.map((e, idx) => (idx === i ? next : e)));
  const removeExercise = (i: number) => setExercises((ex) => ex.filter((_, idx) => idx !== i));

  const logIt = () => {
    onLog(
      {
        type: 'gym-session',
        occurred_at: at,
        precision,
        sessionDuration: duration,
        ...(exercises.length > 0 ? { exercises } : {}),
      },
      `${exercises.length} exercises`,
    );
    onClose();
  };

  return (
    <Sheet title="Log gym session" onClose={onClose}>
      <DayTimeField
        at={at}
        onChange={(iso, p) => {
          setAt(iso);
          setPrecision(p);
        }}
        accent="var(--state)"
      />

      <div className={styles.stepper}>
        <button
          onClick={() => setDuration((d) => Math.max(DURATION_MIN, d - DURATION_STEP))}
          aria-label="Less"
        >
          −
        </button>
        <span className={styles.stepperValue}>{duration}min</span>
        <button
          onClick={() => setDuration((d) => Math.min(DURATION_MAX, d + DURATION_STEP))}
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
            onChange={(next) => updateExercise(i, next)}
            onRemove={() => removeExercise(i)}
          />
        ))}
        <button type="button" className="chip" onClick={addExercise}>
          + Add exercise
        </button>
      </div>

      <button className={styles.logBtn} onClick={logIt}>
        Log session
      </button>
    </Sheet>
  );
}
