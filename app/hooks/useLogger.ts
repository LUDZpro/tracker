'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { postEvent, undoEvent } from '@/lib/client/api';
import { cancelQueued } from '@/lib/client/queue';
import { wallHHMM } from '@/lib/time';
import type { EventPayload } from '@/lib/types';

const UNDO_WINDOW_MS = 12_000; // UX-PATCH-03: [edit] [undo] strip for 12s

export interface LastLogged {
  id: string | null; // null while the event sits in the offline queue
  ids: string[]; // nap logs create sleep+wake marker pages
  tag: string;
  label: string;
  at: string;
  queued: boolean;
  payload: EventPayload; // lets [edit] open the just-logged event
}

export function useLogger(refresh: () => Promise<void> | void) {
  const [last, setLast] = useState<LastLogged | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const log = useCallback(
    async (payload: EventPayload, label: string) => {
      navigator.vibrate?.(50);
      setError(null);
      const tag = crypto.randomUUID();
      const res = await postEvent({ ...payload, client_tag: tag });

      if (res.status === 'error') {
        setError(res.message);
        retryRef.current = () => log(payload, label);
        return;
      }

      setLast({
        id: res.status === 'created' ? res.id : null,
        ids: res.status === 'created' ? res.ids : [],
        tag,
        label: `${label} ${wallHHMM(payload.occurred_at)}`,
        at: payload.occurred_at,
        queued: res.status === 'queued',
        payload,
      });
      setCanUndo(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCanUndo(false), UNDO_WINDOW_MS);
      refresh();
    },
    [refresh],
  );

  const undo = useCallback(async () => {
    if (!last) return;
    navigator.vibrate?.(50);
    setCanUndo(false);
    try {
      if (last.ids.length > 0) await Promise.all(last.ids.map((id) => undoEvent(id)));
      else await cancelQueued(last.tag);
      setLast(null);
      refresh();
    } catch {
      setError('Undo failed — retry');
      retryRef.current = () => undo();
      setCanUndo(true);
    }
  }, [last, refresh]);

  const retry = useCallback(() => {
    setError(null);
    retryRef.current?.();
  }, []);

  return { last, canUndo, error, log, undo, retry, clearError: () => setError(null) };
}
