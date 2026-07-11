import { describe, expect, it } from 'vitest';
import { SESSION_TTL_MS, signSession, verifySession } from './session';

const SECRET = 'test-secret';

describe('session tokens', () => {
  it('verifies a token it signed', async () => {
    const token = await signSession(SECRET);
    expect(await verifySession(SECRET, token)).toBe(true);
  });

  it('rejects tampered and foreign tokens', async () => {
    const token = await signSession(SECRET);
    expect(await verifySession(SECRET, `9${token}`)).toBe(false);
    expect(await verifySession('other-secret', token)).toBe(false);
    expect(await verifySession(SECRET, undefined)).toBe(false);
    expect(await verifySession(SECRET, 'garbage')).toBe(false);
  });

  it('rejects expired tokens', async () => {
    const past = Date.now() - SESSION_TTL_MS - 1000;
    const token = await signSession(SECRET, past);
    expect(await verifySession(SECRET, token)).toBe(false);
  });
});
