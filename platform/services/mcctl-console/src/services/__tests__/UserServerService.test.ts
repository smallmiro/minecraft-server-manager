import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserServerService } from '../UserServerService';
import type { IUserServerRepository } from '@/ports/out/IUserServerRepository';
import type { UserServer, ServerPermission } from '@/lib/schema';

// Mock repository
const mockRepository: IUserServerRepository = {
  findByUserAndServer: vi.fn(),
  findByServer: vi.fn(),
  findByUser: vi.fn(),
  create: vi.fn(),
  updatePermission: vi.fn(),
  delete: vi.fn(),
  deleteByUserAndServer: vi.fn(),
  countByServerAndPermission: vi.fn(),
};

describe('UserServerService', () => {
  let service: UserServerService;

  beforeEach(() => {
    service = new UserServerService(mockRepository);
    vi.clearAllMocks();
  });

  describe('grantAccess', () => {
    it('should create new permission when not exists', async () => {
      vi.mocked(mockRepository.findByUserAndServer).mockResolvedValue(null);
      vi.mocked(mockRepository.create).mockResolvedValue({
        id: 'us-1',
        userId: 'user-1',
        serverId: 'server-1',
        permission: 'view',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.grantAccess('user-1', 'server-1', 'view');

      expect(mockRepository.findByUserAndServer).toHaveBeenCalledWith(
        'user-1',
        'server-1'
      );
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        serverId: 'server-1',
        permission: 'view',
      });
      expect(result.permission).toBe('view');
    });

    it('should update permission when already exists', async () => {
      const existing: UserServer = {
        id: 'us-1',
        userId: 'user-1',
        serverId: 'server-1',
        permission: 'view',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockRepository.findByUserAndServer).mockResolvedValue(existing);
      vi.mocked(mockRepository.updatePermission).mockResolvedValue({
        ...existing,
        permission: 'manage',
      });

      const result = await service.grantAccess('user-1', 'server-1', 'manage');

      expect(mockRepository.updatePermission).toHaveBeenCalledWith('us-1', 'manage');
      expect(result.permission).toBe('manage');
    });
  });

  describe('revokeAccess', () => {
    it('should delete user-server permission', async () => {
      vi.mocked(mockRepository.deleteByUserAndServer).mockResolvedValue(undefined);

      await service.revokeAccess('user-1', 'server-1');

      expect(mockRepository.deleteByUserAndServer).toHaveBeenCalledWith(
        'user-1',
        'server-1'
      );
    });

    it('should throw error when trying to remove last admin', async () => {
      vi.mocked(mockRepository.findByUserAndServer).mockResolvedValue({
        id: 'us-1',
        userId: 'user-1',
        serverId: 'server-1',
        permission: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(mockRepository.countByServerAndPermission).mockResolvedValue(1);

      await expect(service.revokeAccess('user-1', 'server-1')).rejects.toThrow(
        'Cannot remove the last admin'
      );

      expect(mockRepository.deleteByUserAndServer).not.toHaveBeenCalled();
    });

    it('should allow removing admin when multiple admins exist', async () => {
      vi.mocked(mockRepository.findByUserAndServer).mockResolvedValue({
        id: 'us-1',
        userId: 'user-1',
        serverId: 'server-1',
        permission: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(mockRepository.countByServerAndPermission).mockResolvedValue(2);
      vi.mocked(mockRepository.deleteByUserAndServer).mockResolvedValue(undefined);

      await service.revokeAccess('user-1', 'server-1');

      expect(mockRepository.deleteByUserAndServer).toHaveBeenCalledWith(
        'user-1',
        'server-1'
      );
    });
  });

  describe('updatePermission', () => {
    it('should update permission level', async () => {
      const existing: UserServer = {
        id: 'us-1',
        userId: 'user-1',
        serverId: 'server-1',
        permission: 'view',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockRepository.findByUserAndServer).mockResolvedValue(existing);
      vi.mocked(mockRepository.updatePermission).mockResolvedValue({
        ...existing,
        permission: 'manage',
      });

      const result = await service.updatePermission('user-1', 'server-1', 'manage');

      expect(mockRepository.updatePermission).toHaveBeenCalledWith('us-1', 'manage');
      expect(result.permission).toBe('manage');
    });

    it('should throw error when permission not found', async () => {
      vi.mocked(mockRepository.findByUserAndServer).mockResolvedValue(null);

      await expect(
        service.updatePermission('user-1', 'server-1', 'manage')
      ).rejects.toThrow('Permission not found');
    });

    it('should throw error when downgrading last admin', async () => {
      vi.mocked(mockRepository.findByUserAndServer).mockResolvedValue({
        id: 'us-1',
        userId: 'user-1',
        serverId: 'server-1',
        permission: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(mockRepository.countByServerAndPermission).mockResolvedValue(1);

      await expect(
        service.updatePermission('user-1', 'server-1', 'manage')
      ).rejects.toThrow('Cannot downgrade the last admin');
    });
  });

  describe('getServerUsers', () => {
    it('should return all users with access to server', async () => {
      const permissions: UserServer[] = [
        {
          id: 'us-1',
          userId: 'user-1',
          serverId: 'server-1',
          permission: 'admin',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'us-2',
          userId: 'user-2',
          serverId: 'server-1',
          permission: 'view',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockRepository.findByServer).mockResolvedValue(permissions);

      const results = await service.getServerUsers('server-1');

      expect(mockRepository.findByServer).toHaveBeenCalledWith('server-1');
      expect(results).toHaveLength(2);
    });
  });

  describe('getUserServers', () => {
    it('should return all servers user has access to', async () => {
      const permissions: UserServer[] = [
        {
          id: 'us-1',
          userId: 'user-1',
          serverId: 'server-1',
          permission: 'admin',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'us-2',
          userId: 'user-1',
          serverId: 'server-2',
          permission: 'view',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockRepository.findByUser).mockResolvedValue(permissions);

      const results = await service.getUserServers('user-1');

      expect(mockRepository.findByUser).toHaveBeenCalledWith('user-1');
      expect(results).toHaveLength(2);
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has exact permission', async () => {
      vi.mocked(mockRepository.findByUserAndServer).mockResolvedValue({
        id: 'us-1',
        userId: 'user-1',
        serverId: 'server-1',
        permission: 'manage',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.hasPermission('user-1', 'server-1', 'manage');

      expect(result).toBe(true);
    });

    it('should return true when user has higher permission', async () => {
      vi.mocked(mockRepository.findByUserAndServer).mockResolvedValue({
        id: 'us-1',
        userId: 'user-1',
        serverId: 'server-1',
        permission: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.hasPermission('user-1', 'server-1', 'view');

      expect(result).toBe(true);
    });

    it('should return false when user has lower permission', async () => {
      vi.mocked(mockRepository.findByUserAndServer).mockResolvedValue({
        id: 'us-1',
        userId: 'user-1',
        serverId: 'server-1',
        permission: 'view',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.hasPermission('user-1', 'server-1', 'admin');

      expect(result).toBe(false);
    });

    it('should return false when permission not found', async () => {
      vi.mocked(mockRepository.findByUserAndServer).mockResolvedValue(null);

      const result = await service.hasPermission('user-1', 'server-1', 'view');

      expect(result).toBe(false);
    });
  });

  describe('ensureAtLeastOneAdmin', () => {
    it('should not throw when at least one admin exists', async () => {
      vi.mocked(mockRepository.countByServerAndPermission).mockResolvedValue(1);

      await expect(
        service.ensureAtLeastOneAdmin('server-1')
      ).resolves.toBeUndefined();
    });

    it('should throw error when no admins exist', async () => {
      vi.mocked(mockRepository.countByServerAndPermission).mockResolvedValue(0);

      await expect(service.ensureAtLeastOneAdmin('server-1')).rejects.toThrow(
        'Server must have at least one admin'
      );
    });
  });
});
