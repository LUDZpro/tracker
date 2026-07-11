'use client';

import { useEffect } from 'react';

export default function SwRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline queueing degrades gracefully; logging still works online.
    });
  }, []);
  return null;
}
