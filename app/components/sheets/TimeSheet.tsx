'use client';

import { useState } from 'react';
import Sheet from './Sheet';
import WheelTimePicker from '@/components/ui/WheelTimePicker';
import styles from './sheets.module.css';

interface Props {
  title: string;
  confirmLabel: string;
  initialIso: string;
  nowIso: string;
  allowPrevDay?: boolean;
  accent?: string;
  onConfirm: (iso: string) => Promise<{ ok: boolean; message?: string }> | void;
  onClose: () => void;
}

/** Picker-only sheet: long-press log flows and sleep-band handle taps. */
export default function TimeSheet({
  title,
  confirmLabel,
  initialIso,
  nowIso,
  allowPrevDay,
  accent,
  onConfirm,
  onClose,
}: Props) {
  const [iso, setIso] = useState(initialIso);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await onConfirm(iso);
    setBusy(false);
    if (res && !res.ok) {
      setError(res.message ?? 'Could not save');
      return;
    }
    onClose();
  };

  return (
    <Sheet title={title} onClose={onClose}>
      <WheelTimePicker
        valueIso={iso}
        onChange={setIso}
        nowIso={nowIso}
        allowPrevDay={allowPrevDay}
        accent={accent}
      />
      {error && <p className="error-inline">{error}</p>}
      <button className={styles.logBtn} onClick={confirm} disabled={busy}>
        {busy ? 'Saving…' : confirmLabel}
      </button>
    </Sheet>
  );
}
