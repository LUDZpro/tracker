'use client';

import { useState } from 'react';
import Sheet from '@/components/sheets/Sheet';
import WheelTimePicker from '@/components/ui/WheelTimePicker';
import DoseStepper from './DoseStepper';
import { defaultDoseOf, formatDose, intakeLabel } from '@/lib/substances/format';
import type { Substance } from '@/lib/substances/types';
import { toLocalISO } from '@/lib/time';
import { PRECISIONS, type EventPayload, type Precision } from '@/lib/types';
import styles from './meds.module.css';
import sheetStyles from '@/components/sheets/sheets.module.css';

interface Props {
  substance: Substance;
  nowIso: string;
  onLog: (payload: EventPayload, label: string) => void;
  onClose: () => void;
}

/**
 * Long-press detail sheet: dose, time, precision, note.
 *
 * The precision rule is the brief's, and it differs from the rest of the app
 * on purpose: everywhere else a picked time is treated as `exact`, but a dose
 * you are backdating is one you are remembering, so the default drops to
 * `~5min` and the user can raise or lower it.
 */
export default function SupplementSheet({ substance, nowIso, onLog, onClose }: Props) {
  const fallback = { amount: substance.defaultDose ?? 1, unit: substance.unit };
  const [dose, setDose] = useState(defaultDoseOf(substance) ?? fallback);
  const [at, setAt] = useState(nowIso);
  const [precision, setPrecision] = useState<Precision>('exact');
  const [precisionTouched, setPrecisionTouched] = useState(false);
  const [note, setNote] = useState('');

  const backdated = at !== nowIso;
  // Backdating relaxes precision unless the user has said otherwise.
  const effectivePrecision: Precision =
    backdated && !precisionTouched && precision === 'exact' ? '~5min' : precision;

  const doseText = formatDose(dose);

  const logIt = () => {
    onLog(
      {
        type: 'supplement',
        occurred_at: at,
        precision: effectivePrecision,
        substance: substance.id,
        dose: doseText,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      intakeLabel(substance.type, doseText),
    );
    onClose();
  };

  return (
    <Sheet title={substance.name} onClose={onClose}>
      <DoseStepper dose={dose} onChange={setDose} unit={substance.unit} />

      <WheelTimePicker
        valueIso={at}
        onChange={setAt}
        nowIso={nowIso}
        accent="var(--intake)"
      />

      <div className={styles.precisionRow} role="group" aria-label="Precision">
        {PRECISIONS.map((p) => (
          <button
            key={p}
            type="button"
            className={`chip ${sheetStyles.bigChip}`}
            aria-pressed={effectivePrecision === p}
            onClick={() => {
              setPrecision(p);
              setPrecisionTouched(true);
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <label className={styles.noteLabel}>
        <span>Note</span>
        <textarea
          className={styles.noteInput}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="optional"
        />
      </label>

      <p className={styles.previewLine}>{intakeLabel(substance.type, doseText)}</p>

      <button className={sheetStyles.logBtn} onClick={logIt}>
        Log it
      </button>
    </Sheet>
  );
}
