'use client';

import styles from './sheets.module.css';

interface Props {
  mealName: string;
  onMealNameChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  proteinG: string;
  onProteinGChange: (v: string) => void;
  calories: string;
  onCaloriesChange: (v: string) => void;
  readOnly: boolean;
}

/** Meal-only edit fields for EditEventSheet: name/description/macros. */
export default function MealEditFields({
  mealName,
  onMealNameChange,
  description,
  onDescriptionChange,
  proteinG,
  onProteinGChange,
  calories,
  onCaloriesChange,
  readOnly,
}: Props) {
  return (
    <>
      <input
        className={styles.textInput}
        type="text"
        placeholder="Meal name"
        value={mealName}
        onChange={(e) => onMealNameChange(e.target.value)}
        maxLength={60}
        disabled={readOnly}
      />
      <textarea
        className={styles.textarea}
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        maxLength={500}
        rows={2}
        disabled={readOnly}
      />
      <div className={styles.macroRow}>
        <label className={styles.macroField}>
          <span>Protein (g)</span>
          <input
            type="number"
            inputMode="numeric"
            value={proteinG}
            onChange={(e) => onProteinGChange(e.target.value)}
            min={0}
            max={500}
            disabled={readOnly}
          />
        </label>
        <label className={styles.macroField}>
          <span>Calories</span>
          <input
            type="number"
            inputMode="numeric"
            value={calories}
            onChange={(e) => onCaloriesChange(e.target.value)}
            min={0}
            max={5000}
            disabled={readOnly}
          />
        </label>
      </div>
    </>
  );
}
