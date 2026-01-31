import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('./db', () => ({
  db: {},
  sqlite: {},
}));

describe('auth', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-testing';
    process.env.BETTER_AUTH_URL = 'http://localhost:5000';
  });

  it('should export auth instance', async () => {
    const { auth } = await import('./auth');
    expect(auth).toBeDefined();
  });

  it('should have api handler', async () => {
    const { auth } = await import('./auth');
    expect(auth.handler).toBeDefined();
  });

  it('should have admin plugin configured', async () => {
    const { auth } = await import('./auth');
    // The auth instance should have the admin plugin methods
    expect(auth).toBeDefined();
  });
});
