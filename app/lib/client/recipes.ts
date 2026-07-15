'use client';

import type { RecipesResponse } from '@/lib/recipes/types';

/** Load the pre-planned recipe list plus daily targets. 401 → /login. */
export async function fetchRecipes(): Promise<RecipesResponse> {
  const res = await fetch('/api/recipes');
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.error === 'string') message = data.error;
    } catch {
      /* fall through */
    }
    throw new Error(message);
  }
  return res.json();
}
