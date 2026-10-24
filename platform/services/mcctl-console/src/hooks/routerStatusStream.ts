/**
 * Shared router status SSE subscription.
 *
 * One EventSource per browser tab, no matter how many components call
 * `useRouterStatus()`: the first consumer opens it, the last one closes it.
 * Every `router-status` event is written into the React Query cache, and the
 * connected flag lets the hook switch polling off while the stream is live.
 */

import type { QueryClient } from '@tanstack/react-query';
import type { RouterStatusResponse } from '@/ports/api/IMcctlApiClient';

export const ROUTER_STATUS_QUERY_KEY = ['router-status'] as const;
const STREAM_URL = '/api/sse/router/status/stream';
const RETRY_DELAY_MS = 5000;

const clients = new Map<QueryClient, number>();
const connectionListeners = new Set<() => void>();
let source: EventSource | null = null;
let connected = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  connectionListeners.forEach((listener) => listener());
}

function open() {
  if (typeof EventSource === 'undefined' || source) return;

  const es = new EventSource(STREAM_URL);
  source = es;

  es.onopen = () => setConnected(true);
  es.addEventListener('router-status', (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent).data) as RouterStatusResponse;
      clients.forEach((_count, client) => client.setQueryData(ROUTER_STATUS_QUERY_KEY, payload));
      setConnected(true);
    } catch {
      // ignore malformed frames; the next event (or polling) corrects the state
    }
  });
  // The server could not read the status: poll GET /status until the next good frame.
  es.addEventListener('router-status-error', () => setConnected(false));
  es.onerror = () => {
    setConnected(false);
    // The browser retries on its own while CONNECTING; a CLOSED source (e.g. 401 from the proxy) never will.
    if (es.readyState === 2 && source === es) {
      es.close();
      source = null;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (clients.size > 0) open();
      }, RETRY_DELAY_MS);
    }
  };
}

function close() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  source?.close();
  source = null;
  setConnected(false);
}

/** Ref-counted subscription; returns the release function. */
export function acquireRouterStatusStream(client: QueryClient): () => void {
  clients.set(client, (clients.get(client) ?? 0) + 1);
  open();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count = (clients.get(client) ?? 1) - 1;
    if (count <= 0) clients.delete(client);
    else clients.set(client, count);
    if (clients.size === 0) close();
  };
}

export function subscribeRouterStatusConnection(listener: () => void): () => void {
  connectionListeners.add(listener);
  return () => connectionListeners.delete(listener);
}

export function isRouterStatusStreamConnected(): boolean {
  return connected;
}
