import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ cookie: 'session=test' })),
}));

vi.mock('@/lib/auth-utils', () => {
  class AuthError extends Error {
    statusCode = 401;
  }
  return { requireServerPermission: vi.fn(), AuthError };
});

const mockDeleteServer = vi.fn();

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
    createMcctlApiClient: vi.fn(() => ({ deleteServer: mockDeleteServer })),
    McctlApiError,
    UserContext: undefined,
  };
});

import { requireServerPermission } from '@/lib/auth-utils';
import { McctlApiError } from '@/adapters/McctlApiAdapter';
import { DELETE } from '../[name]/route';

const session = { user: { name: 'admin', email: 'a@b.c', role: 'admin' } };
const ctx = { params: Promise.resolve({ name: 'srv' }) };
const req = (qs: string) => new NextRequest(`http://localhost/api/servers/srv${qs}`, { method: 'DELETE' });

describe('DELETE /api/servers/:name (#652)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireServerPermission as ReturnType<typeof vi.fn>).mockResolvedValue(session);
    mockDeleteServer.mockResolvedValue({ success: true, server: 'srv', message: 'ok' });
  });

  it('forwards force and deleteWorld=true', async () => {
    await DELETE(req('?force=true&deleteWorld=true'), ctx);
    expect(mockDeleteServer).toHaveBeenCalledWith('srv', true, true, undefined);
  });

  it('defaults deleteWorld to false', async () => {
    await DELETE(req('?force=true'), ctx);
    expect(mockDeleteServer).toHaveBeenCalledWith('srv', true, false, undefined);
  });

  it('forwards the sudoPassword from the JSON body (#761)', async () => {
    const withBody = new NextRequest('http://localhost/api/servers/srv?force=true', {
      method: 'DELETE',
      body: JSON.stringify({ sudoPassword: 'pw' }),
    });
    await DELETE(withBody, ctx);
    expect(mockDeleteServer).toHaveBeenCalledWith('srv', true, false, 'pw');
  });

  it('passes no sudoPassword when the body is empty (#761)', async () => {
    await DELETE(req('?force=true'), ctx);
    expect(mockDeleteServer.mock.calls[0][3]).toBeUndefined();
  });

  it('does not log the sudoPassword when the API fails (#761)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDeleteServer.mockRejectedValue(new Error('boom'));
    await DELETE(
      new NextRequest('http://localhost/api/servers/srv', { method: 'DELETE', body: JSON.stringify({ sudoPassword: 'secret-pw' }) }),
      ctx,
    );
    expect(JSON.stringify(spy.mock.calls)).not.toContain('secret-pw');
    spy.mockRestore();
  });

  it('passes through the API 500 message', async () => {
    mockDeleteServer.mockRejectedValue(
      new McctlApiError(500, 'InternalServerError', 'worlds/x already exists. Nothing was deleted.'),
    );
    const res = await DELETE(req('?force=true'), ctx);
    expect(res.status).toBe(500);
    expect((await res.json()).message).toContain('Nothing was deleted.');
  });
});
