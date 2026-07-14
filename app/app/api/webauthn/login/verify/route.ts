import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type {
  AuthenticatorTransportFuture,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { clientIp, jsonError, readJson } from '@/lib/http';
import { resetPinAttempts } from '@/lib/rate-limit';
import { SESSION_COOKIE, SESSION_TTL_MS, signSession } from '@/lib/session';
import { takeChallenge } from '@/lib/webauthn/challenge';
import { rpFromRequest } from '@/lib/webauthn/rp';
import { readCredentials, updateCounter } from '@/lib/webauthn/store';

/** Public: finish a biometric sign-in; success issues the session cookie. */
export async function POST(req: Request) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return jsonError(500, 'Server is not configured');

  const body = (await readJson(req)) as AuthenticationResponseJSON | null;
  if (!body?.id) return jsonError(400, 'Assertion response required');

  const challenge = takeChallenge('login');
  if (!challenge) return jsonError(400, 'Sign-in expired — try again');

  const creds = await readCredentials();
  const cred = creds.find((c) => c.id === body.id);
  if (!cred) return jsonError(401, 'Unknown passkey');

  const { rpID, origin } = rpFromRequest(req);
  try {
    const result = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: cred.id,
        publicKey: new Uint8Array(Buffer.from(cred.publicKey, 'base64url')),
        counter: cred.counter,
        transports: cred.transports as AuthenticatorTransportFuture[] | undefined,
      },
    });
    if (!result.verified) return jsonError(401, 'Passkey rejected');

    await updateCounter(cred.id, result.authenticationInfo.newCounter);
    resetPinAttempts(`wa:${clientIp(req)}`);

    const token = await signSession(secret);
    const res = new NextResponse(null, { status: 204 });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TTL_MS / 1000,
      path: '/',
    });
    return res;
  } catch {
    return jsonError(401, 'Passkey rejected');
  }
}
