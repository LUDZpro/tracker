'use client';

import { useState } from 'react';
import Sheet from './Sheet';
import DayTimeField from './DayTimeField';
import { toLocalISO } from '@/lib/time';
import { MEAL_PRESETS, type EventPayload, type MealPreset, type Precision } from '@/lib/types';
import styles from './sheets.module.css';

interface Props {
  onLog: (payload: EventPayload, label: string) => void;
  onClose: () => void;
}

/** Only meal name is required — description/protein/calories are all optional. */
export default function MealSheet({ onLog, onClose }: Props) {
  const [preset, setPreset] = useState<MealPreset>('Lunch');
  const [custom, setCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [at, setAt] = useState(() => toLocalISO(new Date()));
  const [precision, setPrecision] = useState<Precision>('exact');
  const [description, setDescription] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [calories, setCalories] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mealName = custom ? customName.trim() : preset;

  const logIt = () => {
    if (!mealName) {
      setError('Meal name is required');
      return;
    }
    const protein = proteinG.trim() === '' ? undefined : Number(proteinG);
    const cal = calories.trim() === '' ? undefined : Number(calories);
    onLog(
      {
        type: 'meal',
        occurred_at: at,
        precision,
        mealName,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(protein !== undefined && !Number.isNaN(protein) ? { proteinG: protein } : {}),
        ...(cal !== undefined && !Number.isNaN(cal) ? { calories: cal } : {}),
      },
      mealName,
    );
    onClose();
  };

  return (
    <Sheet title="Log meal" onClose={onClose}>
      {/* Plain (not .bigChip) — five variable-length labels need content-sized
          chips, not the equal-width stretch nap/caffeine's shorter chips use. */}
      <div className={styles.chipRow}>
        {MEAL_PRESETS.map((p) => (
          <button
            key={p}
            className="chip"
            aria-pressed={!custom && preset === p}
            onClick={() => {
              setCustom(false);
              setPreset(p);
            }}
          >
            {p}
          </button>
        ))}
        <button className="chip" aria-pressed={custom} onClick={() => setCustom(true)}>
          custom
        </button>
      </div>
      {custom && (
        <input
          className={styles.textInput}
          type="text"
          placeholder="Meal name"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          maxLength={60}
        />
      )}

      <DayTimeField
        at={at}
        onChange={(iso, p) => {
          setAt(iso);
          setPrecision(p);
        }}
        accent="var(--intake)"
      />

      <textarea
        className={styles.textarea}
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={500}
        rows={2}
      />

      <div className={styles.macroRow}>
        <label className={styles.macroField}>
          <span>Protein (g)</span>
          <input
            type="number"
            inputMode="numeric"
            value={proteinG}
            onChange={(e) => setProteinG(e.target.value)}
            min={0}
            max={500}
          />
        </label>
        <label className={styles.macroField}>
          <span>Calories</span>
          <input
            type="number"
            inputMode="numeric"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            min={0}
            max={5000}
          />
        </label>
      </div>

      {error && <p className="error-inline">{error}</p>}
      <button className={styles.logBtn} onClick={logIt}>
        Log it
      </button>
    </Sheet>
  );
}
