'use client';

import { useState } from 'react';
import WheelTimePicker from '@/components/ui/WheelTimePicker';
import { toLocalISO, wallDateKey, wallHHMM } from '@/lib/time';
import type { Precision } from '@/lib/types';

interface Props {
  at: string; // current ISO value, defaults to now from the parent sheet
  onChange: (at: string, precision: Precision) => void;
  accent?: string;
}

/**
 * Today/yesterday + wheel time picker for Nutrition/Gym logging (spec §8's
 * precision auto-rule): "today" (the default) always resolves to exact.
 * "Yesterday" left untouched resolves to ~hour; touching the wheel or typing
 * an exact time — on either day — resolves to exact.
 */
export default function DayTimeField({ at, onChange, accent }: Props) {
  const [touched, setTouched] = useState(false);
  const nowIso = toLocalISO(new Date());

  const handleChange = (next: string) => {
    const timeChanged = wallHHMM(next) !== wallHHMM(at);
    const nextTouched = touched || timeChanged;
    if (timeChanged) setTouched(true);
    const isToday = wallDateKey(next) === wallDateKey(nowIso);
    const precision: Precision = isToday || nextTouched ? 'exact' : '~hour';
    onChange(next, precision);
  };

  return (
    <WheelTimePicker
      valueIso={at}
      onChange={handleChange}
      nowIso={nowIso}
      allowPrevDay
      accent={accent}
    />
  );
}
