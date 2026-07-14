import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { errorResponse } from '@/lib/http';
import { saveChallenge } from '@/lib/webauthn/challenge';
import { rpFromRequest } from '@/lib/webauthn/rp';
import { readCredentials } from '@/lib/webauthn/store';

/** Auth'd (middleware): start enrolling this device's platform authenticator. */
export async function POST(req: Request) {
  try {
    const { rpID } = rpFromRequest(req);
    const creds = await readCredentials();
    const options = await generateRegistrationOptions({
      rpName: 'Tracker',
      rpID,
      userName: 'tracker',
      userDisplayName: 'Tracker',
      attestationType: 'none',
      excludeCredentials: creds.map((c) => ({
        id: c.id,
        transports: c.transports as AuthenticatorTransportFuture[] | undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
        authenticatorAttachment: 'platform', // Face ID / Touch ID / fingerprint
      },
    });
    saveChallenge('register', options.challenge);
    return NextResponse.json(options, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
