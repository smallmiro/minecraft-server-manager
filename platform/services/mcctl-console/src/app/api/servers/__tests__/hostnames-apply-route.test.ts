import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ cookie: 'session=test' })),
}));

vi.mock('@/lib/auth-utils', () => {
  class AuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 401) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { requireServerPermission: vi.fn(), AuthError };
});

const mockApplyHostnames = vi.fn();

vi.mock('@/adapters/McctlApiAdapter', () => {
  class McctlApiError extends Error {
    statusCode: number;
    error: string;
    constructor(statusCode: number, error: string, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.error = error;
    }
  }
  return {
    createMcctlApiClient: vi.fn(() => ({ applyHostnames: mockApplyHostnames })),
    McctlApiError,
  };
});

import { requireServerPermission, AuthError } from '@/lib/auth-utils';
import { McctlApiError } from '@/adapters/McctlApiAdapter';
import { POST } from '../[name]/hostnames/apply/route';

const session = { user: { name: 'admin', email: 'a@b.c', role: 'admin' } };
const ctx = { params: Promise.resolve({ name: 'srv' }) };
const req = () => new NextRequest('http://localhost/api/servers/srv/hostnames/apply', { method: 'POST' });

describe('POST /api/servers/:name/hostnames/apply (#671)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireServerPermission).mockResolvedValue(session as never);
  });

  it('proxies the apply to mcctl-api with manage permission', async () => {
    mockApplyHostnames.mockResolvedValue({ success: true, serverName: 'srv' });

    const response = await POST(req(), ctx);

    expect(requireServerPermission).toHaveBeenCalledWith(expect.anything(), 'srv', 'manage');
    expect(mockApplyHostnames).toHaveBeenCalledWith('srv');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, serverName: 'srv' });
  });

  it('returns the auth error status without calling the API', async () => {
    vi.mocked(requireServerPermission).mockRejectedValue(new AuthError('Forbidden', 403));

    const response = await POST(req(), ctx);

    expect(response.status).toBe(403);
    expect(mockApplyHostnames).not.toHaveBeenCalled();
  });

  it('forwards mcctl-api errors', async () => {
    mockApplyHostnames.mockRejectedValue(new McctlApiError(500, 'InternalServerError', 'recreate failed'));

    const response = await POST(req(), ctx);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'InternalServerError', message: 'recreate failed' });
  });
});
