'use client';

import { useEffect, useState } from 'react';
import styles from './login.module.css';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

async function platformAuthAvailable(): Promise<boolean> {
  try {
    return (
      typeof window.PublicKeyCredential !== 'undefined' &&
      (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);
  // After a successful PIN unlock on a biometric-capable, un-enrolled device,
  // offer to create a passkey before heading in.
  const [offerEnroll, setOfferEnroll] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supported = await platformAuthAvailable();
      if (!alive) return;
      setBioSupported(supported);
      if (!supported) return;
      try {
        const res = await fetch('/api/webauthn/status');
        const data = await res.json();
        if (alive) setBioEnrolled(Boolean(data?.enrolled));
      } catch {
        /* status probe failing just hides the button */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
        if (bioSupported && !bioEnrolled) {
          setOfferEnroll(true); // hold the redirect for the one-tap passkey offer
          return;
        }
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

  const bioLogin = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const optRes = await fetch('/api/webauthn/login/options', { method: 'POST' });
      if (!optRes.ok) throw new Error('Biometric sign-in unavailable');
      const assertion = await startAuthentication({ optionsJSON: await optRes.json() });
      const res = await fetch('/api/webauthn/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assertion),
      });
      if (res.status === 204) {
        window.location.href = '/';
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'Biometric sign-in failed — use the PIN');
    } catch {
      setError('Biometric sign-in was cancelled — use the PIN');
    } finally {
      setBusy(false);
    }
  };

  const enroll = async () => {
    setBusy(true);
    setError(null);
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const optRes = await fetch('/api/webauthn/register/options', { method: 'POST' });
      if (!optRes.ok) throw new Error('Could not start enrollment');
      const attestation = await startRegistration({ optionsJSON: await optRes.json() });
      const res = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestation),
      });
      if (!res.ok) throw new Error('Could not save the passkey');
    } catch {
      /* enrollment is best-effort — never block getting into the app */
    } finally {
      window.location.href = '/';
    }
  };

  if (offerEnroll) {
    return (
      <main className={styles.wrap}>
        <h1 className={styles.title}>Floor Logger</h1>
        <div className={styles.enrollCard}>
          <p className={styles.enrollLead}>Unlock faster next time?</p>
          <p className={styles.enrollHint}>
            Use Face ID, Touch ID or your fingerprint instead of the PIN on this device.
          </p>
          <button className={styles.unlock} onClick={enroll} disabled={busy}>
            {busy ? 'Setting up…' : 'Enable biometrics'}
          </button>
          <button className={styles.skipBtn} onClick={() => (window.location.href = '/')}>
            Not now
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <h1 className={styles.title}>Floor Logger</h1>
      <p className={styles.dots} aria-label={`${pin.length} digits entered`}>
        {pin.length === 0 ? 'Enter PIN' : '●'.repeat(pin.length)}
      </p>
      {error && <p className="error-inline">{error}</p>}
      {bioSupported && bioEnrolled && (
        <button className={styles.bioBtn} onClick={bioLogin} disabled={busy}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 11v3.5M8.5 9.5a3.5 3.5 0 0 1 7 0v4a3.5 3.5 0 0 1-.6 2M5.5 8a7 7 0 0 1 13 0M5 12v1.5a7 7 0 0 0 2.3 5.2M12 18.5v.5" />
          </svg>
          Unlock with biometrics
        </button>
      )}
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
