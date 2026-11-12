import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Limits for long-lived SSE streams (#672). A stream past its lifetime ends;
 * EventSource clients reconnect on their own. Mutable so tests can lower them.
 */
export const sseLimits = {
  maxStreams: 100,
  lifetimeMs: 60 * 60_000,
  heartbeatMs: 30_000,
};

/** The end() of every open stream. */
const openStreams = new Set<() => void>();

/** Number of SSE streams open right now. */
export function openSseStreams(): number {
  return openStreams.size;
}

export interface SseStream {
  /** False once the stream ended: later writes are dropped. */
  readonly open: boolean;
  /** One frame: `event:` (when given) and JSON `data:`. */
  send(event: string | undefined, data: unknown): void;
  /** Raw SSE text, such as a comment line. */
  write(text: string): void;
  /** Runs once when the stream ends for any reason: client gone, error, lifetime or end(). */
  onClose(cleanup: () => void): void;
  /** End the stream from the server side. */
  end(): void;
}

const BASE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
};

/**
 * Opens an SSE stream on the raw response. The close and error listeners are
 * registered before anything is written, so a client that leaves early still
 * clears the stream's timers and children. With `sseLimits.maxStreams` open,
 * answers 503 and returns undefined: the handler should `return reply`. Also
 * returns undefined, without answering, for a client that already left.
 */
export function openSse(
  request: FastifyRequest,
  reply: FastifyReply,
  headers: Record<string, string> = {}
): SseStream | undefined {
  // The client may have left while the handler awaited (a docker query): its
  // close event is gone, so a stream opened now would hold a slot until its lifetime.
  if (request.raw.destroyed || reply.raw.destroyed || request.raw.socket?.destroyed) return undefined;
  if (openStreams.size >= sseLimits.maxStreams) {
    void reply
      .code(503)
      .header('Retry-After', '5')
      .send({ error: 'ServiceUnavailable', message: 'Too many open event streams' });
    return undefined;
  }

  const cleanups: Array<() => void> = [];
  let open = true;

  const end = () => {
    if (!open) return;
    open = false;
    openStreams.delete(end);
    clearInterval(heartbeat);
    clearTimeout(lifetime);
    for (const cleanup of cleanups.splice(0)) {
      try {
        cleanup();
      } catch (error) {
        request.log.warn(error, 'SSE cleanup failed');
      }
    }
    if (!reply.raw.destroyed) reply.raw.end();
  };

  openStreams.add(end);
  request.raw.on('close', end);
  reply.raw.on('close', end);
  reply.raw.on('error', end);

  const write = (text: string) => {
    if (open && !reply.raw.destroyed) reply.raw.write(text);
  };
  const heartbeat = setInterval(() => write(': heartbeat\n\n'), sseLimits.heartbeatMs);
  const lifetime = setTimeout(end, sseLimits.lifetimeMs);

  reply.raw.writeHead(200, { ...BASE_HEADERS, ...headers });

  return {
    get open() {
      return open;
    },
    send(event, data) {
      write(`${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`);
    },
    write,
    onClose(cleanup) {
      if (open) cleanups.push(cleanup);
      else cleanup();
    },
    end,
  };
}
