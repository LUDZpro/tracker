#!/usr/bin/env node
/**
 * Applies every db/migrations/*.sql file once, in filename order.
 * Runs on container start (before server.js) and via `npm run db:migrate`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('migrate: DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name       text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      // Each migration is one transaction: it applies whole or not at all.
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`migrate: applied ${file}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`migration ${file} failed: ${e.message}`);
      }
    }
    console.log(`migrate: up to date (${files.length} migration(s))`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(`migrate: ${e.message}`);
  process.exit(1);
});
