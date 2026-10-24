'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RouterLogEvent } from '@/types/events';

export const ROUTER_LOG_MAX_EVENTS = 500;
const STREAM_URL = '/api/sse/router/logs/stream';

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
    let ended = false;
    let hadError = false;
    const source = new EventSource(STREAM_URL);

    const parse = <T,>(event: Event): T | null => {
      try {
        return JSON.parse((event as MessageEvent).data) as T;
      } catch {
        return null;
      }
    };

    source.addEventListener('connected', () => {
      if (hadError) {
        // The server replays the tail on reconnect: drop the old list instead of duplicating lines.
        setEvents([]);
        hadError = false;
      }
      setStatus('live');
    });
    source.addEventListener('router-log', (event) => {
      const payload = parse<RouterLogEvent>(event);
      if (!payload) return;
      const entry: RouterLogEntry = { ...payload, id: seq++ };
      setEvents((prev) => appendCapped(prev, entry, ROUTER_LOG_MAX_EVENTS));
    });
    source.addEventListener('end', () => {
      ended = true;
      setStatus('ended');
      source.close();
    });
    source.onerror = () => {
      if (ended) return;
      hadError = true;
      setStatus('disconnected');
    };

    return () => {
      source.close();
    };
  }, []);

  const clear = useCallback(() => setEvents([]), []);

  return { events, status, clear };
}
