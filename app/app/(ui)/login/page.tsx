'use client';

import { useState } from 'react';
import styles from './login.module.css';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = (k: string) => {
    navigator.vibrate?.(20);
    setError(null);
    if (k === '⌫') setPin((p) => p.slice(0, -1));
    else if (k && pin.length < 12) setPin((p) => p + k);
  };

  const unlock = async () => {
    if (!pin || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (res.status === 204) {
        window.location.href = '/';
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'Could not unlock');
      setPin('');
    } catch {
      setError('Offline — connect to unlock');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.wrap}>
      <h1 className={styles.title}>Floor Logger</h1>
      <p className={styles.dots} aria-label={`${pin.length} digits entered`}>
        {pin.length === 0 ? 'Enter PIN' : '●'.repeat(pin.length)}
      </p>
      {error && <p className="error-inline">{error}</p>}
      <div className={styles.pad}>
        {KEYS.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button key={i} className={styles.key} onClick={() => press(k)}>
              {k}
            </button>
          ),
        )}
      </div>
      <button className={styles.unlock} onClick={unlock} disabled={!pin || busy}>
        {busy ? 'Unlocking…' : 'Unlock'}
      </button>
    </main>
  );
}
