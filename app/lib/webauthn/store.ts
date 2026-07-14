import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * File-backed passkey store — single user, single instance, so a JSON file
 * on the Docker volume beats dragging in a database. One entry per enrolled
 * device (phone, laptop…).
 */

export interface StoredCredential {
  id: string; // base64url credential id
  publicKey: string; // base64url-encoded COSE public key
  counter: number;
  transports?: string[];
  createdAt: string;
}

function dir(): string {
  return process.env.WEBAUTHN_DIR ?? path.join(process.cwd(), 'data');
}

function file(): string {
  return path.join(dir(), 'webauthn.json');
}

export async function readCredentials(): Promise<StoredCredential[]> {
  try {
    const raw = await readFile(file(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.credentials) ? parsed.credentials : [];
  } catch {
    return []; // missing or corrupt file — treat as "no passkeys enrolled"
  }
}

async function writeCredentials(credentials: StoredCredential[]): Promise<void> {
  await mkdir(dir(), { recursive: true });
  await writeFile(file(), JSON.stringify({ v: 1, credentials }, null, 2), 'utf8');
}

export async function addCredential(cred: StoredCredential): Promise<void> {
  const all = await readCredentials();
  await writeCredentials([...all.filter((c) => c.id !== cred.id), cred]);
}

export async function updateCounter(id: string, counter: number): Promise<void> {
  const all = await readCredentials();
  await writeCredentials(all.map((c) => (c.id === id ? { ...c, counter } : c)));
}
