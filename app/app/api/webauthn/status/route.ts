import { NextResponse } from 'next/server';
import { readCredentials } from '@/lib/webauthn/store';

/** Public probe: the login page shows the biometrics button only when a
 *  passkey exists. Leaks a single boolean, nothing about the credential. */
export async function GET() {
  const creds = await readCredentials();
  return NextResponse.json(
    { enrolled: creds.length > 0 },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
