import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userServers } from '@/lib/schema';
import type { UserServer, NewUserServer, ServerPermission } from '@/lib/schema';
import type { IUserServerRepository } from '@/ports/out/IUserServerRepository';

/**
 * Drizzle implementation of IUserServerRepository
 */
export class UserServerRepository implements IUserServerRepository {
  async findById(id: string): Promise<UserServer | null> {
    const results = await db
      .select()
      .from(userServers)
      .where(eq(userServers.id, id))
      .limit(1);

    return results[0] ?? null;
  }

  async findByUserAndServer(
    userId: string,
    serverId: string
  ): Promise<UserServer | null> {
    const results = await db
      .select()
      .from(userServers)
      .where(
        and(eq(userServers.userId, userId), eq(userServers.serverId, serverId))
      )
      .limit(1);

    return results[0] ?? null;
  }

  async findByServer(serverId: string): Promise<UserServer[]> {
    return db
      .select()
      .from(userServers)
      .where(eq(userServers.serverId, serverId));
  }

  async findByUser(userId: string): Promise<UserServer[]> {
    return db.select().from(userServers).where(eq(userServers.userId, userId));
  }

  async create(data: NewUserServer): Promise<UserServer> {
    const results = await db.insert(userServers).values(data).returning();

    if (!results[0]) {
      throw new Error('Failed to create user-server permission');
    }

    return results[0];
  }

  async updatePermission(
    id: string,
    permission: ServerPermission
  ): Promise<UserServer> {
    const results = await db
      .update(userServers)
      .set({
        permission,
        updatedAt: new Date(),
      })
      .where(eq(userServers.id, id))
      .returning();

    if (!results[0]) {
      throw new Error(`User-server permission not found: ${id}`);
    }

    return results[0];
  }

  async delete(id: string): Promise<void> {
    await db.delete(userServers).where(eq(userServers.id, id));
  }

  async deleteByUserAndServer(userId: string, serverId: string): Promise<void> {
    await db
      .delete(userServers)
      .where(
        and(eq(userServers.userId, userId), eq(userServers.serverId, serverId))
      );
  }

  async countByServerAndPermission(
    serverId: string,
    permission: ServerPermission
  ): Promise<number> {
    const results = await db
      .select()
      .from(userServers)
      .where(
        and(
          eq(userServers.serverId, serverId),
          eq(userServers.permission, permission)
        )
      );

    return results.length;
  }
}
