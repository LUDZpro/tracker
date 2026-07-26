import { Pool, type QueryResultRow } from 'pg';

/** Thrown for any store failure; routes map it to a 502 (see lib/http.ts). */
export class StoreError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'StoreError';
  }
}

// Next's dev server re-evaluates modules on every edit; without this the app
// would leak a fresh pool per reload until Postgres refuses connections.
const globalForPool = globalThis as unknown as { __floorPool?: Pool };

function pool(): Pool {
  if (globalForPool.__floorPool) return globalForPool.__floorPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new StoreError(500, 'DATABASE_URL is not configured');

  const p = new Pool({
    connectionString,
    // Single-user app on one instance — a handful of connections is plenty.
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  // An idle-client error (Postgres restarted, network blip) is emitted on the
  // pool, not on a query. Unhandled, it would take the process down.
  p.on('error', (e) => console.error('Postgres idle client error:', e.message));

  globalForPool.__floorPool = p;
  return p;
}

/** Run a parameterised query; any driver failure surfaces as a StoreError so
 *  callers never have to know they are talking to Postgres. */
export async function query<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<T[]> {
  try {
    const res = await pool().query<T>(text, values as unknown[]);
    return res.rows;
  } catch (e) {
    // Postgres error text can echo row content — log the code, not the body.
    const code = (e as { code?: string }).code ?? 'unknown';
    console.error(`Postgres query failed (code ${code})`);
    throw new StoreError(502, 'Database request failed');
  }
}
