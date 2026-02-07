import type { UserServer, NewUserServer, ServerPermission } from '@/lib/schema';

/**
 * UserServer with user details (for API responses)
 */
export interface UserServerWithUser extends UserServer {
  user?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

/**
 * Repository interface for user-server permission management
 */
export interface IUserServerRepository {
  /**
   * Find a user-server permission mapping by ID
   */
  findById(id: string): Promise<UserServer | null>;

  /**
   * Find a specific user-server permission mapping
   */
  findByUserAndServer(userId: string, serverId: string): Promise<UserServer | null>;

  /**
   * Find all users with access to a specific server
   */
  findByServer(serverId: string): Promise<UserServer[]>;

  /**
   * Find all servers a user has access to
   */
  findByUser(userId: string): Promise<UserServer[]>;

  /**
   * Create a new user-server permission mapping
   */
  create(data: NewUserServer): Promise<UserServer>;

  /**
   * Update permission level for a user-server mapping
   */
  updatePermission(id: string, permission: ServerPermission): Promise<UserServer>;

  /**
   * Delete a user-server permission mapping by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete a user-server permission mapping by userId and serverId
   */
  deleteByUserAndServer(userId: string, serverId: string): Promise<void>;

  /**
   * Find all users with access to a server (with user details)
   */
  findByServerWithUsers(serverId: string): Promise<UserServerWithUser[]>;

  /**
   * Count users with a specific permission level for a server
   */
  countByServerAndPermission(serverId: string, permission: ServerPermission): Promise<number>;
}
