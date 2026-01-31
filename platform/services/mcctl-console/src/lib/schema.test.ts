import { describe, it, expect } from 'vitest';
import {
  users,
  sessions,
  accounts,
  verifications,
  userServers,
} from './schema';

describe('schema', () => {
  describe('users table', () => {
    it('should have required columns', () => {
      expect(users.id).toBeDefined();
      expect(users.name).toBeDefined();
      expect(users.email).toBeDefined();
      expect(users.role).toBeDefined();
      expect(users.createdAt).toBeDefined();
      expect(users.updatedAt).toBeDefined();
    });
  });

  describe('sessions table', () => {
    it('should have required columns', () => {
      expect(sessions.id).toBeDefined();
      expect(sessions.expiresAt).toBeDefined();
      expect(sessions.token).toBeDefined();
      expect(sessions.userId).toBeDefined();
    });
  });

  describe('accounts table', () => {
    it('should have required columns', () => {
      expect(accounts.id).toBeDefined();
      expect(accounts.accountId).toBeDefined();
      expect(accounts.providerId).toBeDefined();
      expect(accounts.userId).toBeDefined();
    });
  });

  describe('verifications table', () => {
    it('should have required columns', () => {
      expect(verifications.id).toBeDefined();
      expect(verifications.identifier).toBeDefined();
      expect(verifications.value).toBeDefined();
      expect(verifications.expiresAt).toBeDefined();
    });
  });

  describe('userServers junction table', () => {
    it('should have required columns', () => {
      expect(userServers.id).toBeDefined();
      expect(userServers.userId).toBeDefined();
      expect(userServers.serverId).toBeDefined();
      expect(userServers.permission).toBeDefined();
    });

    it('should have createdAt column', () => {
      expect(userServers.createdAt).toBeDefined();
    });
  });
});
