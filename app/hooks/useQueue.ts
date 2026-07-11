'use client';

import { useEffect, useState } from 'react';
import { onQueueCount, requestFlush, requestQueueStatus } from '@/lib/client/queue';

/** Live count of offline-queued POSTs, fed by service worker messages. */
export function useQueue(onFlushed?: () => void) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const off = onQueueCount((n) => {
      setCount((prev) => {
        if (prev > 0 && n === 0) onFlushed?.();
        return n;
      });
    });
    requestQueueStatus();
    const flush = () => requestFlush();
    window.addEventListener('online', flush);
    return () => {
      off();
      window.removeEventListener('online', flush);
    };
  }, [onFlushed]);

  return count;
}
