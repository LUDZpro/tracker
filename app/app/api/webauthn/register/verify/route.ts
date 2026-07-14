import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { jsonError, readJson } from '@/lib/http';
import { takeChallenge } from '@/lib/webauthn/challenge';
import { rpFromRequest } from '@/lib/webauthn/rp';
import { addCredential } from '@/lib/webauthn/store';

/** Auth'd (middleware): finish enrollment and persist the new passkey. */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return jsonError(400, 'Attestation response required');

  const challenge = takeChallenge('register');
  if (!challenge) return jsonError(400, 'Enrollment expired — try again');

  const { rpID, origin } = rpFromRequest(req);
  try {
    const result = await verifyRegistrationResponse({
      response: body as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!result.verified || !result.registrationInfo) {
      return jsonError(400, 'Could not verify the passkey');
    }
    const { credential } = result.registrationInfo;
    await addCredential({
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      ...(credential.transports ? { transports: credential.transports } : {}),
      createdAt: new Date().toISOString(),
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return jsonError(400, 'Could not verify the passkey');
  }
}
