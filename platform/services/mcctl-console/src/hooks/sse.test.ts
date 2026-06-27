import { describe, it, expect } from 'vitest';
import { consumeSseStream } from './sse';

/** Build a Response whose body streams the given SSE text in chunks. */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
}

describe('consumeSseStream', () => {
  it('parses event/data frames split across chunk boundaries', async () => {
    const res = sseResponse([
      'event: progress\ndata: {"n":1}\n\nevent: pro',
      'gress\ndata: {"n":2}\n\n',
      'event: done\ndata: {"ok":true}\n\n',
    ]);
    const events: [string, unknown][] = [];
    await consumeSseStream(res, (e, p) => events.push([e, p]));
    expect(events).toEqual([
      ['progress', { n: 1 }],
      ['progress', { n: 2 }],
      ['done', { ok: true }],
    ]);
  });

  it('skips frames without data and unparseable JSON', async () => {
    const res = sseResponse(['event: heartbeat\n\nevent: bad\ndata: not-json\n\nevent: ok\ndata: {"a":1}\n\n']);
    const events: [string, unknown][] = [];
    await consumeSseStream(res, (e, p) => events.push([e, p]));
    expect(events).toEqual([['ok', { a: 1 }]]);
  });
});
