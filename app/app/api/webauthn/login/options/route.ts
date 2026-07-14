import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { clientIp, errorResponse, jsonError } from '@/lib/http';
import { allowPinAttempt } from '@/lib/rate-limit';
import { saveChallenge } from '@/lib/webauthn/challenge';
import { rpFromRequest } from '@/lib/webauthn/rp';
import { readCredentials } from '@/lib/webauthn/store';

/** Public: start a biometric sign-in (rate-limited alongside PIN attempts). */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!allowPinAttempt(`wa:${ip}`)) {
    return jsonError(429, 'Too many attempts — try again in an hour');
  }
  try {
    const creds = await readCredentials();
    if (creds.length === 0) return jsonError(404, 'No passkey enrolled');

    const { rpID } = rpFromRequest(req);
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      allowCredentials: creds.map((c) => ({
        id: c.id,
        transports: c.transports as AuthenticatorTransportFuture[] | undefined,
      })),
    });
    saveChallenge('login', options.challenge);
    return NextResponse.json(options, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
