import { describe, it, expect, vi } from 'vitest';

// Mock better-auth/react
vi.mock('better-auth/react', () => ({
  createAuthClient: vi.fn(() => ({
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    useSession: vi.fn(() => ({ data: null, isPending: false })),
    admin: {
      listUsers: vi.fn(),
      createUser: vi.fn(),
      deleteUser: vi.fn(),
      banUser: vi.fn(),
      unbanUser: vi.fn(),
      setRole: vi.fn(),
    },
  })),
}));

describe('auth-client', () => {
  it('should export authClient', async () => {
    const { authClient } = await import('./auth-client');
    expect(authClient).toBeDefined();
  });

  it('should have signIn method', async () => {
    const { authClient } = await import('./auth-client');
    expect(authClient.signIn).toBeDefined();
  });

  it('should have signOut method', async () => {
    const { authClient } = await import('./auth-client');
    expect(authClient.signOut).toBeDefined();
  });

  it('should have signUp method', async () => {
    const { authClient } = await import('./auth-client');
    expect(authClient.signUp).toBeDefined();
  });

  it('should have useSession hook', async () => {
    const { authClient } = await import('./auth-client');
    expect(authClient.useSession).toBeDefined();
  });

  it('should have admin client methods', async () => {
    const { authClient } = await import('./auth-client');
    expect(authClient.admin).toBeDefined();
    expect(authClient.admin.listUsers).toBeDefined();
    expect(authClient.admin.createUser).toBeDefined();
  });
});
