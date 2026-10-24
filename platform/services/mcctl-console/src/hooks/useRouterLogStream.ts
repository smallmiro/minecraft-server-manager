'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RouterLogEvent } from '@/types/events';

export const ROUTER_LOG_MAX_EVENTS = 500;
const STREAM_URL = '/api/sse/router/logs/stream';
const RECONNECT_DELAY_MS = 5000;

export type RouterLogStreamStatus = 'connecting' | 'live' | 'disconnected' | 'ended';

export interface RouterLogEntry extends RouterLogEvent {
  /** Client-side sequence number, stable React key. */
  id: number;
}

/** Append `item` and keep only the `max` most recent items (does not mutate `list`). */
export function appendCapped<T>(list: readonly T[], item: T, max: number): T[] {
  const next = list.length >= max ? list.slice(list.length - max + 1) : list.slice();
  next.push(item);
  return next;
}

export interface UseRouterLogStreamReturn {
  events: RouterLogEntry[];
  status: RouterLogStreamStatus;
  clear: () => void;
}

/**
 * Live mc-router log lines. The EventSource is closed on unmount, which (through
 * the BFF proxy) ends the server-side `docker logs -f mc-router`.
 */
export function useRouterLogStream(): UseRouterLogStreamReturn {
  const supported = typeof EventSource !== 'undefined';
  const [events, setEvents] = useState<RouterLogEntry[]>([]);
  const [status, setStatus] = useState<RouterLogStreamStatus>(supported ? 'connecting' : 'disconnected');

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;

    let seq = 0;
    let disposed = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const parse = <T,>(event: Event): T | null => {
      try {
        return JSON.parse((event as MessageEvent).data) as T;
      } catch {
        return null;
      }
    };

    // Reconnect later: the stream ends when mc-router stops (e.g. after Restart), and the browser
    // never retries a CLOSED source (e.g. mcctl-api briefly down behind the proxy).
    const scheduleReconnect = () => {
      if (disposed || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connect();
      }, RECONNECT_DELAY_MS);
    };

    function connect() {
      if (disposed) return;
      let ended = false;
      let hadError = false;
      const es = new EventSource(STREAM_URL);
      source = es;
      setStatus('connecting');

      es.addEventListener('connected', () => {
        // The server replays the tail on every (re)connect: drop the old list instead of duplicating lines.
        if (hadError || seq > 0) setEvents([]);
        hadError = false;
        setStatus('live');
      });
      es.addEventListener('router-log', (event) => {
        const payload = parse<RouterLogEvent>(event);
        if (!payload) return;
        const entry: RouterLogEntry = { ...payload, id: seq++ };
        setEvents((prev) => appendCapped(prev, entry, ROUTER_LOG_MAX_EVENTS));
      });
      es.addEventListener('end', () => {
        ended = true;
        setStatus('ended');
        es.close();
        scheduleReconnect();
      });
      es.onerror = () => {
        if (ended) return;
        hadError = true;
        setStatus('disconnected');
        if (es.readyState === 2) {
          es.close();
          scheduleReconnect();
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, []);

  const clear = useCallback(() => setEvents([]), []);

  return { events, status, clear };
}
