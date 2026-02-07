import type { IUserServerRepository } from '@/ports/out/IUserServerRepository';
import type { UserServer, ServerPermission } from '@/lib/schema';
import type { UserServerWithUser } from '@/adapters/UserServerRepository';

/**
 * Business logic error for permission operations
 */
export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

/**
 * Service for managing user-server permissions
 * Implements business rules like "must have at least one admin"
 */
export class UserServerService {
  constructor(private readonly repository: IUserServerRepository) {}

  /**
   * Grant access to a user for a server
   * If permission already exists, updates it
   */
  async grantAccess(
    userId: string,
    serverId: string,
    permission: ServerPermission
  ): Promise<UserServer> {
    const existing = await this.repository.findByUserAndServer(userId, serverId);

    if (existing) {
      return this.repository.updatePermission(existing.id, permission);
    }

    return this.repository.create({
      userId,
      serverId,
      permission,
    });
  }

  /**
   * Revoke user's access to a server
   * Prevents removing the last admin
   */
  async revokeAccess(userId: string, serverId: string): Promise<void> {
    const permission = await this.repository.findByUserAndServer(userId, serverId);

    if (permission?.permission === 'admin') {
      const adminCount = await this.repository.countByServerAndPermission(
        serverId,
        'admin'
      );

      if (adminCount <= 1) {
        throw new PermissionError(
          'Cannot remove the last admin from the server'
        );
      }
    }

    await this.repository.deleteByUserAndServer(userId, serverId);
  }

  /**
   * Update a user's permission level for a server
   * Prevents downgrading the last admin
   */
  async updatePermission(
    userId: string,
    serverId: string,
    newPermission: ServerPermission
  ): Promise<UserServer> {
    const existing = await this.repository.findByUserAndServer(userId, serverId);

    if (!existing) {
      throw new PermissionError('Permission not found for this user and server');
    }

    // Check if we're downgrading the last admin
    if (existing.permission === 'admin' && newPermission !== 'admin') {
      const adminCount = await this.repository.countByServerAndPermission(
        serverId,
        'admin'
      );

      if (adminCount <= 1) {
        throw new PermissionError(
          'Cannot downgrade the last admin. Assign another admin first.'
        );
      }
    }

    return this.repository.updatePermission(existing.id, newPermission);
  }

  /**
   * Get all users with access to a server
   */
  async getServerUsers(serverId: string): Promise<UserServer[]> {
    return this.repository.findByServer(serverId);
  }

  /**
   * Get all users with access to a server (with user details)
   */
  async getServerUsersWithDetails(serverId: string): Promise<UserServerWithUser[]> {
    // Type assertion - repository might not have this method yet
    const repo = this.repository as any;
    if (repo.findByServerWithUsers) {
      return repo.findByServerWithUsers(serverId);
    }
    // Fallback to basic method
    return this.repository.findByServer(serverId);
  }

  /**
   * Get all servers a user has access to
   */
  async getUserServers(userId: string): Promise<UserServer[]> {
    return this.repository.findByUser(userId);
  }

  /**
   * Check if a user has a specific permission level or higher
   */
  async hasPermission(
    userId: string,
    serverId: string,
    requiredLevel: ServerPermission
  ): Promise<boolean> {
    const permission = await this.repository.findByUserAndServer(userId, serverId);

    if (!permission) {
      return false;
    }

    const permissionLevels: Record<ServerPermission, number> = {
      view: 1,
      manage: 2,
      admin: 3,
    };

    return (
      permissionLevels[permission.permission] >= permissionLevels[requiredLevel]
    );
  }

  /**
   * Ensure a server has at least one admin
   * Throws error if validation fails
   */
  async ensureAtLeastOneAdmin(serverId: string): Promise<void> {
    const adminCount = await this.repository.countByServerAndPermission(
      serverId,
      'admin'
    );

    if (adminCount === 0) {
      throw new PermissionError('Server must have at least one admin');
    }
  }
}
