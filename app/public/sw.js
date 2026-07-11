/* Floor Logger service worker: offline shell + queued POSTs in IndexedDB.
 * Queued requests keep their original body, so tap-time timestamps survive. */

const SHELL_CACHE = 'fl-shell-v1';
const QUEUEABLE = ['/api/event', '/api/sleep/backfill'];

/* ——— IndexedDB queue ——— */

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('fl-queue', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('posts', { keyPath: 'tag' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', mode);
    const result = fn(tx.objectStore('posts'));
    tx.oncomplete = () => resolve(result.result !== undefined ? result.result : result);
    tx.onerror = () => reject(tx.error);
  });
}

function queueAll() {
  return withStore('readonly', (store) => store.getAll());
}

function queuePut(record) {
  return withStore('readwrite', (store) => store.put(record));
}

function queueDelete(tag) {
  return withStore('readwrite', (store) => store.delete(tag));
}

async function broadcastCount() {
  const items = await queueAll().catch(() => []);
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({ type: 'fl-queue-count', count: items.length });
  }
}

/* ——— queue flush ——— */

let flushing = false;

async function flushQueue() {
  if (flushing) return;
  flushing = true;
  try {
    const items = (await queueAll()).sort((a, b) => a.at - b.at);
    for (const item of items) {
      try {
        // Any HTTP response settles the item: 2xx succeeded, 4xx/5xx would
        // never succeed by retrying the same body unchanged forever.
        await fetch(item.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: item.body,
        });
        await queueDelete(item.tag);
      } catch {
        break; // still offline — keep the rest for later
      }
    }
  } finally {
    flushing = false;
    await broadcastCount();
  }
}

/* ——— POST handling ——— */

async function handleQueueablePost(request) {
  const body = await request.clone().text();
  try {
    return await fetch(request);
  } catch {
    let tag;
    try {
      tag = JSON.parse(body).client_tag;
    } catch {
      /* fall through */
    }
    if (!tag) tag = `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await queuePut({ tag, url: new URL(request.url).pathname, body, at: Date.now() });
    await broadcastCount();
    if (self.registration.sync) {
      self.registration.sync.register('fl-sync').catch(() => {});
    }
    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/* ——— shell caching ——— */

async function handleNavigation(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match('/');
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) {
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, res.clone());
  }
  return res;
}

/* ——— lifecycle ——— */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.method === 'POST' && QUEUEABLE.includes(url.pathname)) {
    event.respondWith(handleQueueablePost(event.request));
    return;
  }
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event.request));
    return;
  }
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(cacheFirst(event.request));
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'fl-sync') event.waitUntil(flushQueue());
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'fl-flush') event.waitUntil?.(flushQueue()) ?? flushQueue();
  if (msg.type === 'fl-queue-status') broadcastCount();
  if (msg.type === 'fl-cancel' && msg.tag) {
    queueDelete(msg.tag).then(broadcastCount);
  }
});
