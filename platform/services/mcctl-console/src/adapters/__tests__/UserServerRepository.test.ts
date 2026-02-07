import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserServerRepository } from '../UserServerRepository';
import { db } from '@/lib/db';
import { userServers, users } from '@/lib/schema';
import type { ServerPermission } from '@/lib/schema';

describe('UserServerRepository', () => {
  let repository: UserServerRepository;
  const testUserId = 'test-user-1';
  const testServerId = 'test-server-1';

  beforeEach(async () => {
    repository = new UserServerRepository();

    // Create test user
    await db.insert(users).values({
      id: testUserId,
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: false,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(userServers);
    await db.delete(users);
  });

  describe('create', () => {
    it('should create a new user-server permission', async () => {
      const data = {
        userId: testUserId,
        serverId: testServerId,
        permission: 'view' as ServerPermission,
      };

      const result = await repository.create(data);

      expect(result).toMatchObject({
        userId: testUserId,
        serverId: testServerId,
        permission: 'view',
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should create with admin permission', async () => {
      const data = {
        userId: testUserId,
        serverId: testServerId,
        permission: 'admin' as ServerPermission,
      };

      const result = await repository.create(data);

      expect(result.permission).toBe('admin');
    });
  });

  describe('findById', () => {
    let createdId: string;

    beforeEach(async () => {
      const created = await db
        .insert(userServers)
        .values({
          userId: testUserId,
          serverId: testServerId,
          permission: 'manage',
        })
        .returning();

      createdId = created[0].id;
    });

    it('should find record by ID', async () => {
      const result = await repository.findById(createdId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(createdId);
      expect(result?.userId).toBe(testUserId);
      expect(result?.serverId).toBe(testServerId);
      expect(result?.permission).toBe('manage');
    });

    it('should return null when ID not found', async () => {
      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByUserAndServer', () => {
    beforeEach(async () => {
      await db.insert(userServers).values({
        userId: testUserId,
        serverId: testServerId,
        permission: 'manage',
      });
    });

    it('should find existing permission', async () => {
      const result = await repository.findByUserAndServer(testUserId, testServerId);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(testUserId);
      expect(result?.serverId).toBe(testServerId);
      expect(result?.permission).toBe('manage');
    });

    it('should return null when not found', async () => {
      const result = await repository.findByUserAndServer('non-existent', testServerId);

      expect(result).toBeNull();
    });
  });

  describe('findByServer', () => {
    beforeEach(async () => {
      // Create additional test user
      await db.insert(users).values({
        id: 'test-user-2',
        name: 'Test User 2',
        email: 'test2@example.com',
        emailVerified: false,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create permissions for multiple users
      await db.insert(userServers).values([
        { userId: testUserId, serverId: testServerId, permission: 'admin' },
        { userId: 'test-user-2', serverId: testServerId, permission: 'view' },
      ]);
    });

    it('should find all users with access to server', async () => {
      const results = await repository.findByServer(testServerId);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.userId)).toContain(testUserId);
      expect(results.map((r) => r.userId)).toContain('test-user-2');
    });

    it('should return empty array when no users have access', async () => {
      const results = await repository.findByServer('non-existent-server');

      expect(results).toEqual([]);
    });
  });

  describe('findByUser', () => {
    beforeEach(async () => {
      await db.insert(userServers).values([
        { userId: testUserId, serverId: 'server-1', permission: 'admin' },
        { userId: testUserId, serverId: 'server-2', permission: 'view' },
      ]);
    });

    it('should find all servers user has access to', async () => {
      const results = await repository.findByUser(testUserId);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.serverId)).toContain('server-1');
      expect(results.map((r) => r.serverId)).toContain('server-2');
    });

    it('should return empty array when user has no access', async () => {
      const results = await repository.findByUser('non-existent-user');

      expect(results).toEqual([]);
    });
  });

  describe('updatePermission', () => {
    let createdId: string;

    beforeEach(async () => {
      const created = await db
        .insert(userServers)
        .values({
          userId: testUserId,
          serverId: testServerId,
          permission: 'view',
        })
        .returning();

      createdId = created[0].id;
    });

    it('should update permission level', async () => {
      const result = await repository.updatePermission(createdId, 'admin');

      expect(result.permission).toBe('admin');
      expect(result.id).toBe(createdId);
    });

    it('should update updatedAt timestamp', async () => {
      const before = await repository.findByUserAndServer(testUserId, testServerId);

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await repository.updatePermission(createdId, 'manage');

      expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before!.updatedAt.getTime()
      );
    });

    it('should throw error when ID not found', async () => {
      await expect(
        repository.updatePermission('non-existent-id', 'admin')
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    let createdId: string;

    beforeEach(async () => {
      const created = await db
        .insert(userServers)
        .values({
          userId: testUserId,
          serverId: testServerId,
          permission: 'view',
        })
        .returning();

      createdId = created[0].id;
    });

    it('should delete by ID', async () => {
      await repository.delete(createdId);

      const result = await repository.findByUserAndServer(testUserId, testServerId);
      expect(result).toBeNull();
    });

    it('should not throw when deleting non-existent ID', async () => {
      await expect(repository.delete('non-existent-id')).resolves.toBeUndefined();
    });
  });

  describe('deleteByUserAndServer', () => {
    beforeEach(async () => {
      await db.insert(userServers).values({
        userId: testUserId,
        serverId: testServerId,
        permission: 'view',
      });
    });

    it('should delete by userId and serverId', async () => {
      await repository.deleteByUserAndServer(testUserId, testServerId);

      const result = await repository.findByUserAndServer(testUserId, testServerId);
      expect(result).toBeNull();
    });

    it('should not throw when deleting non-existent mapping', async () => {
      await expect(
        repository.deleteByUserAndServer('non-existent', testServerId)
      ).resolves.toBeUndefined();
    });
  });

  describe('countByServerAndPermission', () => {
    beforeEach(async () => {
      await db.insert(users).values([
        {
          id: 'user-2',
          name: 'User 2',
          email: 'user2@example.com',
          emailVerified: false,
          role: 'user',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'user-3',
          name: 'User 3',
          email: 'user3@example.com',
          emailVerified: false,
          role: 'user',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await db.insert(userServers).values([
        { userId: testUserId, serverId: testServerId, permission: 'admin' },
        { userId: 'user-2', serverId: testServerId, permission: 'admin' },
        { userId: 'user-3', serverId: testServerId, permission: 'view' },
      ]);
    });

    it('should count users with specific permission', async () => {
      const adminCount = await repository.countByServerAndPermission(
        testServerId,
        'admin'
      );
      const viewCount = await repository.countByServerAndPermission(
        testServerId,
        'view'
      );

      expect(adminCount).toBe(2);
      expect(viewCount).toBe(1);
    });

    it('should return 0 when no users have permission', async () => {
      const count = await repository.countByServerAndPermission(
        testServerId,
        'manage'
      );

      expect(count).toBe(0);
    });
  });
});
