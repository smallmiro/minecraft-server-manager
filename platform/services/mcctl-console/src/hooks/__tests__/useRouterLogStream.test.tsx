import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { appendCapped, useRouterLogStream, ROUTER_LOG_MAX_EVENTS } from '../useRouterLogStream';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, Array<(e: MessageEvent) => void>>();
  close = vi.fn(() => {
    this.readyState = 2;
  });

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(name: string, cb: (e: MessageEvent) => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), cb]);
  }

  emit(name: string, data: unknown) {
    for (const cb of this.listeners.get(name) ?? []) cb({ data: JSON.stringify(data) } as MessageEvent);
  }
}

describe('appendCapped', () => {
  it('appends without mutating the input', () => {
    const list = [1, 2];
    expect(appendCapped(list, 3, 5)).toEqual([1, 2, 3]);
    expect(list).toEqual([1, 2]);
  });

  it('drops the oldest items beyond max', () => {
    expect(appendCapped([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });

  it('keeps exactly max items for a long run', () => {
    let list: number[] = [];
    for (let i = 0; i < 1200; i++) list = appendCapped(list, i, 500);
    expect(list).toHaveLength(500);
    expect(list[0]).toBe(700);
    expect(list[499]).toBe(1199);
  });
});

describe('useRouterLogStream', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });
  afterEach(() => vi.unstubAllGlobals());

  const es = () => MockEventSource.instances[0];

  it('opens the router log stream and starts as connecting', () => {
    const { result } = renderHook(() => useRouterLogStream());
    expect(es().url).toBe('/api/sse/router/logs/stream');
    expect(result.current.status).toBe('connecting');
    expect(result.current.events).toEqual([]);
  });

  it('becomes live on the connected event and collects router-log events', () => {
    const { result } = renderHook(() => useRouterLogStream());
    act(() => es().emit('connected', { timestamp: 'x' }));
    expect(result.current.status).toBe('live');

    act(() => {
      es().emit('router-log', { kind: 'connect', hostname: 'a.local', raw: 'one' });
      es().emit('router-log', { kind: 'wake', target: 'mc-a:25565', raw: 'two' });
    });
    expect(result.current.events.map((e) => e.raw)).toEqual(['one', 'two']);
    expect(new Set(result.current.events.map((e) => e.id)).size).toBe(2);
  });

  it('keeps at most the most recent ROUTER_LOG_MAX_EVENTS events', () => {
    const { result } = renderHook(() => useRouterLogStream());
    act(() => {
      for (let i = 0; i < ROUTER_LOG_MAX_EVENTS + 20; i++) es().emit('router-log', { kind: 'info', raw: `l${i}` });
    });
    expect(ROUTER_LOG_MAX_EVENTS).toBe(500);
    expect(result.current.events).toHaveLength(500);
    expect(result.current.events[0].raw).toBe('l20');
  });

  it('ignores malformed frames', () => {
    const { result } = renderHook(() => useRouterLogStream());
    act(() => es().listeners.get('router-log')![0]({ data: 'not json' } as MessageEvent));
    expect(result.current.events).toEqual([]);
  });

  it('reports disconnected on error and live again with a cleared list on reconnect', () => {
    const { result } = renderHook(() => useRouterLogStream());
    act(() => {
      es().emit('connected', {});
      es().emit('router-log', { kind: 'info', raw: 'old' });
    });
    act(() => es().onerror?.());
    expect(result.current.status).toBe('disconnected');

    // reconnect replays the tail, so the previous list is dropped to avoid duplicates
    act(() => es().emit('connected', {}));
    expect(result.current.status).toBe('live');
    expect(result.current.events).toEqual([]);
  });

  it('ends and closes the source on the end event', () => {
    const { result } = renderHook(() => useRouterLogStream());
    act(() => es().emit('end', { code: 0 }));
    expect(result.current.status).toBe('ended');
    expect(es().close).toHaveBeenCalled();
    act(() => es().onerror?.());
    expect(result.current.status).toBe('ended');
  });

  describe('reconnecting', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('reconnects after the stream ends, e.g. when mc-router was restarted', () => {
      const { result } = renderHook(() => useRouterLogStream());
      act(() => es().emit('end', { code: 0 }));
      expect(result.current.status).toBe('ended');

      act(() => vi.advanceTimersByTime(5000));
      expect(MockEventSource.instances).toHaveLength(2);
      expect(result.current.status).toBe('connecting');
      act(() => MockEventSource.instances[1].emit('connected', {}));
      expect(result.current.status).toBe('live');
    });

    it('reconnects when the browser gave up on the connection (CLOSED), but not while it retries itself', () => {
      renderHook(() => useRouterLogStream());
      act(() => es().onerror?.());
      act(() => vi.advanceTimersByTime(5000));
      expect(MockEventSource.instances).toHaveLength(1);

      act(() => {
        es().readyState = 2;
        es().onerror?.();
      });
      act(() => vi.advanceTimersByTime(5000));
      expect(MockEventSource.instances).toHaveLength(2);
    });

    it('does not reconnect after unmount', () => {
      const { unmount } = renderHook(() => useRouterLogStream());
      act(() => es().emit('end', { code: 0 }));
      unmount();
      act(() => vi.advanceTimersByTime(10000));
      expect(MockEventSource.instances).toHaveLength(1);
    });
  });

  it('clear empties the list', () => {
    const { result } = renderHook(() => useRouterLogStream());
    act(() => es().emit('router-log', { kind: 'info', raw: 'x' }));
    act(() => result.current.clear());
    expect(result.current.events).toEqual([]);
  });

  it('closes the EventSource on unmount', () => {
    const { unmount } = renderHook(() => useRouterLogStream());
    unmount();
    expect(es().close).toHaveBeenCalledTimes(1);
  });

  it('reports disconnected without EventSource support', () => {
    vi.stubGlobal('EventSource', undefined);
    const { result } = renderHook(() => useRouterLogStream());
    expect(result.current.status).toBe('disconnected');
  });
});
