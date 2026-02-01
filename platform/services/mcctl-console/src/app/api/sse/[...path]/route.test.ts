import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, OPTIONS } from './route';
import { NextRequest } from 'next/server';

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
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
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

  describe('OPTIONS', () => {
    it('should return CORS headers', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type');
    });
  });
});
