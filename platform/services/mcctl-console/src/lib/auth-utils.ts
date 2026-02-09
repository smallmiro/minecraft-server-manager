import { getServerSession } from './auth';
import { db } from './db';
import { userServers } from './schema';
import { eq, and } from 'drizzle-orm';

/**
 * Error thrown when authentication is required but missing
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Require authentication - throws if not authenticated
 * @param headers - Request headers containing session cookie
 * @returns The session object
 */
export async function requireAuth(headers: Headers) {
  const session = await getServerSession(headers);

  if (!session) {
    throw new AuthError('Unauthorized', 401);
  }

  return session;
}

/**
 * Require admin role - throws if not admin
 * @param headers - Request headers containing session cookie
 * @returns The session object
 */
export async function requireAdmin(headers: Headers) {
  const session = await requireAuth(headers);

  if (session.user.role !== 'admin') {
    throw new AuthError('Forbidden: Admin access required', 403);
  }

  return session;
}

/**
 * Check if user has permission for a specific server
 * Admins always have access to all servers
 * @param headers - Request headers containing session cookie
 * @param serverId - The server ID to check permission for
 * @param requiredPermission - Minimum permission level required (default: 'view')
 * @returns The session object
 */
export async function requireServerPermission(
  headers: Headers,
  serverId: string,
  requiredPermission: 'view' | 'manage' | 'admin' = 'view'
) {
  const session = await requireAuth(headers);

  // Admins have access to everything
  if (session.user.role === 'admin') {
    return session;
  }

  // Check user_servers table for permission
  const permissions = await db
    .select()
    .from(userServers)
    .where(
      and(
        eq(userServers.userId, session.user.id),
        eq(userServers.serverId, serverId)
      )
    )
    .limit(1);

  if (permissions.length === 0) {
    throw new AuthError('Forbidden: No access to this server', 403);
  }

  const userPermission = permissions[0].permission;
  const permissionLevels = { view: 1, manage: 2, admin: 3 };

  if (permissionLevels[userPermission] < permissionLevels[requiredPermission]) {
    throw new AuthError(
      `Forbidden: Requires ${requiredPermission} permission`,
      403
    );
  }

  return session;
}

/**
 * Get current session without throwing (for optional auth)
 * @param headers - Request headers containing session cookie
 * @returns The session object or null
 */
export async function getOptionalSession(headers: Headers) {
  return getServerSession(headers);
}
