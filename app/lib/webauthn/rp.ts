/**
 * Relying-party identity derived from the request (nginx forwards proto and
 * host), so the same build works on localhost and in production without
 * extra configuration. A spoofed Host can only make verification fail —
 * signatures are checked against credentials enrolled under the real origin.
 */
export function rpFromRequest(req: Request): { rpID: string; origin: string } {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost';
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  return { rpID: host.split(':')[0], origin: `${proto}://${host}` };
}
