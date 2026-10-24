import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST, OPTIONS } from './route';
import { NextRequest } from 'next/server';

const { requireAuthMock, MockAuthError } = vi.hoisted(() => {
  class MockAuthError extends Error {
    constructor(
      message: string,
      public statusCode: number = 401
    ) {
      super(message);
      this.name = 'AuthError';
    }
  }
  return { requireAuthMock: vi.fn(), MockAuthError };
});

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: requireAuthMock,
  AuthError: MockAuthError,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ cookie: 'session=abc' })),
}));

describe('SSE Proxy Route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      MCCTL_API_URL: 'http://localhost:5001',
      MCCTL_API_KEY: 'test-api-key',
    };

    // Mock global fetch
    global.fetch = vi.fn();
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({ user: { id: 'u1', role: 'user' } });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('authentication', () => {
    it('GET returns 401 without a session and never contacts mcctl-api', async () => {
      requireAuthMock.mockRejectedValue(new MockAuthError('Unauthorized', 401));

      const request = new NextRequest('http://localhost:5000/api/sse/router/logs/stream');
      const response = await GET(request, { params: { path: ['router', 'logs', 'stream'] } });

      expect(response.status).toBe(401);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('POST returns 401 without a session and never contacts mcctl-api', async () => {
      requireAuthMock.mockRejectedValue(new MockAuthError('Unauthorized', 401));

      const request = new NextRequest('http://localhost:5000/api/sse/servers', { method: 'POST', body: '{}' });
      const response = await POST(request, { params: { path: ['servers'] } });

      expect(response.status).toBe(401);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('checks the session with the request headers', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404, statusText: 'x' });
      const request = new NextRequest('http://localhost:5000/api/sse/router/logs/stream');
      await GET(request, { params: { path: ['router', 'logs', 'stream'] } });

      expect(requireAuthMock).toHaveBeenCalledTimes(1);
      expect(requireAuthMock.mock.calls[0][0]).toBeInstanceOf(Headers);
    });
  });

  describe('query string and disconnect handling', () => {
    const sseResponse = (reader: Record<string, unknown>) => ({
      ok: true,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: { getReader: vi.fn().mockReturnValue(reader) },
    });

    it('GET preserves the client query string and adds follow=true', async () => {
      const reader = { read: vi.fn().mockResolvedValue({ done: true }), cancel: vi.fn() };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(sseResponse(reader));

      const request = new NextRequest('http://localhost:5000/api/sse/router/logs/stream?tail=100&interval=5000');
      await GET(request, { params: { path: ['router', 'logs', 'stream'] } });

      const url = new URL((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(url.pathname).toBe('/api/router/logs/stream');
      expect(url.searchParams.get('tail')).toBe('100');
      expect(url.searchParams.get('interval')).toBe('5000');
      expect(url.searchParams.get('follow')).toBe('true');
    });

    it('GET does not let the client turn follow off', async () => {
      const reader = { read: vi.fn().mockResolvedValue({ done: true }), cancel: vi.fn() };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(sseResponse(reader));

      const request = new NextRequest('http://localhost:5000/api/sse/servers/a/logs?follow=false');
      await GET(request, { params: { path: ['servers', 'a', 'logs'] } });

      const url = new URL((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(url.searchParams.getAll('follow')).toEqual(['true']);
    });

    it('GET aborts the upstream fetch when the client request is aborted', async () => {
      const reader = { read: vi.fn(() => new Promise(() => {})), cancel: vi.fn() };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(sseResponse(reader));

      const abort = new AbortController();
      const request = new NextRequest('http://localhost:5000/api/sse/router/logs/stream', { signal: abort.signal });
      await GET(request, { params: { path: ['router', 'logs', 'stream'] } });

      const upstreamSignal = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].signal as AbortSignal;
      expect(upstreamSignal).toBeDefined();
      expect(upstreamSignal.aborted).toBe(false);
      abort.abort();
      expect(upstreamSignal.aborted).toBe(true);
    });

    it('GET cancels the upstream reader and aborts the fetch when the client cancels the stream', async () => {
      const reader = { read: vi.fn(() => new Promise(() => {})), cancel: vi.fn().mockResolvedValue(undefined) };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(sseResponse(reader));

      const request = new NextRequest('http://localhost:5000/api/sse/router/logs/stream');
      const response = await GET(request, { params: { path: ['router', 'logs', 'stream'] } });
      const upstreamSignal = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].signal as AbortSignal;

      await response.body!.cancel();

      expect(reader.cancel).toHaveBeenCalledTimes(1);
      expect(upstreamSignal.aborted).toBe(true);
    });

    it('POST cancels the upstream reader and aborts the fetch when the client cancels the stream', async () => {
      const reader = { read: vi.fn(() => new Promise(() => {})), cancel: vi.fn().mockResolvedValue(undefined) };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(sseResponse(reader));

      const request = new NextRequest('http://localhost:5000/api/sse/servers', { method: 'POST', body: '{}' });
      const response = await POST(request, { params: { path: ['servers'] } });
      const upstreamSignal = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].signal as AbortSignal;

      await response.body!.cancel();

      expect(reader.cancel).toHaveBeenCalledTimes(1);
      expect(upstreamSignal.aborted).toBe(true);
    });
  });

  describe('GET', () => {
    it('should return 500 if API key is not configured', async () => {
      process.env.MCCTL_API_KEY = '';

      const request = new NextRequest('http://localhost:5000/api/sse/servers/test/logs');
      const params = { path: ['servers', 'test', 'logs'] };

      const response = await GET(request, { params });

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('API key not configured');
    });

    it('should build correct target URL', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      };

      const mockResponse = {
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: {
          getReader: vi.fn().mockReturnValue(mockReader),
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const request = new NextRequest('http://localhost:5000/api/sse/servers/test/logs');
      const params = { path: ['servers', 'test', 'logs'] };

      await GET(request, { params });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/servers/test/logs?follow=true',
        expect.objectContaining({
          headers: {
            'X-API-Key': 'test-api-key',
          },
        })
      );
    });

    it('should return error if mcctl-api returns error', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const request = new NextRequest('http://localhost:5000/api/sse/servers/test/logs');
      const params = { path: ['servers', 'test', 'logs'] };

      const response = await GET(request, { params });

      expect(response.status).toBe(404);
      expect(await response.text()).toContain('Failed to connect to SSE endpoint');
    });

    it('should return error if response is not SSE', async () => {
      const mockResponse = {
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const request = new NextRequest('http://localhost:5000/api/sse/servers/test/logs');
      const params = { path: ['servers', 'test', 'logs'] };

      const response = await GET(request, { params });

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Invalid SSE response');
    });

    it('should stream SSE data from mcctl-api', async () => {
      const encoder = new TextEncoder();
      const testData = 'data: {"type":"server-log","data":{"log":"test"}}\n\n';

      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: encoder.encode(testData),
          })
          .mockResolvedValueOnce({
            done: true,
            value: undefined,
          }),
      };

      const mockResponse = {
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: {
          getReader: vi.fn().mockReturnValue(mockReader),
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const request = new NextRequest('http://localhost:5000/api/sse/servers/test/logs');
      const params = { path: ['servers', 'test', 'logs'] };

      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(response.headers.get('cache-control')).toBe('no-cache, no-transform');
      expect(response.headers.get('connection')).toBe('keep-alive');

      // Read response stream
      const reader = response.body?.getReader();
      expect(reader).toBeDefined();

      if (reader) {
        const { value } = await reader.read();
        const decoder = new TextDecoder();
        const chunk = decoder.decode(value);

        expect(chunk).toBe(testData);
      }
    });

    it('should handle stream errors gracefully', async () => {
      const mockReader = {
        read: vi.fn().mockRejectedValue(new Error('Stream error')),
      };

      const mockResponse = {
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: {
          getReader: vi.fn().mockReturnValue(mockReader),
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const request = new NextRequest('http://localhost:5000/api/sse/servers/test/logs');
      const params = { path: ['servers', 'test', 'logs'] };

      const response = await GET(request, { params });

      expect(response.status).toBe(200);

      // Stream should error
      const reader = response.body?.getReader();
      if (reader) {
        await expect(reader.read()).rejects.toThrow();
      }
    });

    it('should handle fetch errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const request = new NextRequest('http://localhost:5000/api/sse/servers/test/logs');
      const params = { path: ['servers', 'test', 'logs'] };

      const response = await GET(request, { params });

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Failed to connect to SSE endpoint');
    });

    it('should handle missing body in response', async () => {
      const mockResponse = {
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: null,
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const request = new NextRequest('http://localhost:5000/api/sse/servers/test/logs');
      const params = { path: ['servers', 'test', 'logs'] };

      const response = await GET(request, { params });

      expect(response.status).toBe(200);

      // Stream should close immediately
      const reader = response.body?.getReader();
      if (reader) {
        const { done } = await reader.read();
        expect(done).toBe(true);
      }
    });
  });

  describe('POST', () => {
    it('should return 500 if API key is not configured', async () => {
      process.env.MCCTL_API_KEY = '';

      const request = new NextRequest('http://localhost:5000/api/sse/servers', {
        method: 'POST',
        body: JSON.stringify({ name: 'test-server', type: 'PAPER' }),
      });
      const params = { path: ['servers'] };

      const response = await POST(request, { params });

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('API key not configured');
    });

    it('should build correct target URL with follow=true', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      };

      const mockResponse = {
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: {
          getReader: vi.fn().mockReturnValue(mockReader),
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const request = new NextRequest('http://localhost:5000/api/sse/servers', {
        method: 'POST',
        body: JSON.stringify({ name: 'test-server', type: 'PAPER' }),
      });
      const params = { path: ['servers'] };

      await POST(request, { params });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/servers?follow=true',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'X-API-Key': 'test-api-key',
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
        })
      );
    });

    it('should return error if mcctl-api returns error', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: vi.fn().mockResolvedValue('Invalid server name'),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const request = new NextRequest('http://localhost:5000/api/sse/servers', {
        method: 'POST',
        body: JSON.stringify({ name: 'invalid', type: 'PAPER' }),
      });
      const params = { path: ['servers'] };

      const response = await POST(request, { params });

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Invalid server name');
    });

    it('should return JSON response if not SSE', async () => {
      const jsonResult = { name: 'test-server', success: true };
      const mockResponse = {
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValue(JSON.stringify(jsonResult)),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const request = new NextRequest('http://localhost:5000/api/sse/servers', {
        method: 'POST',
        body: JSON.stringify({ name: 'test-server', type: 'PAPER' }),
      });
      const params = { path: ['servers'] };

      const response = await POST(request, { params });

      expect(response.status).toBe(201);
      expect(response.headers.get('content-type')).toBe('application/json');
      expect(await response.json()).toEqual(jsonResult);
    });

    it('should stream SSE data from mcctl-api', async () => {
      const encoder = new TextEncoder();
      const testData = 'data: {"type":"server-create","data":{"status":"creating"}}\n\n';

      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: encoder.encode(testData),
          })
          .mockResolvedValueOnce({
            done: true,
            value: undefined,
          }),
      };

      const mockResponse = {
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: {
          getReader: vi.fn().mockReturnValue(mockReader),
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const request = new NextRequest('http://localhost:5000/api/sse/servers', {
        method: 'POST',
        body: JSON.stringify({ name: 'test-server', type: 'PAPER' }),
      });
      const params = { path: ['servers'] };

      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');

      // Read response stream
      const reader = response.body?.getReader();
      expect(reader).toBeDefined();

      if (reader) {
        const { value } = await reader.read();
        const decoder = new TextDecoder();
        const chunk = decoder.decode(value);

        expect(chunk).toBe(testData);
      }
    });

    it('should handle fetch errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const request = new NextRequest('http://localhost:5000/api/sse/servers', {
        method: 'POST',
        body: JSON.stringify({ name: 'test-server', type: 'PAPER' }),
      });
      const params = { path: ['servers'] };

      const response = await POST(request, { params });

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Failed to connect to SSE endpoint');
    });
  });

  describe('OPTIONS', () => {
    it('should return CORS headers', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS');
      expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type');
    });
  });
});
