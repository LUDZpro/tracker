import { jsonError } from '@/lib/http';

/**
 * Nap-specific pages are no longer created. Short sleeps remain represented
 * as their sleep_start and wake_up markers.
 */
export async function POST() {
  return jsonError(410, 'Naps are stored as sleep and wake markers');
}
