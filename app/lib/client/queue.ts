'use client';

/** Client-side glue for the service worker's offline POST queue. */

type QueueListener = (count: number) => void;

export async function cancelQueued(tag: string): Promise<void> {
  const reg = await navigator.serviceWorker?.ready;
  reg?.active?.postMessage({ type: 'fl-cancel', tag });
}

export function requestQueueStatus(): void {
  navigator.serviceWorker?.ready.then((reg) =>
    reg.active?.postMessage({ type: 'fl-queue-status' }),
  );
}

export function requestFlush(): void {
  navigator.serviceWorker?.ready.then((reg) =>
    reg.active?.postMessage({ type: 'fl-flush' }),
  );
}

export function onQueueCount(listener: QueueListener): () => void {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'fl-queue-count') listener(event.data.count as number);
  };
  navigator.serviceWorker?.addEventListener('message', handler);
  return () => navigator.serviceWorker?.removeEventListener('message', handler);
}
