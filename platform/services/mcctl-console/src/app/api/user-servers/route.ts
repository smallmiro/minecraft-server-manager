import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { headers } from 'next/headers';
import { UserServerRepository } from '@/adapters/UserServerRepository';
import { UserServerService, PermissionError } from '@/services/UserServerService';
import type { ServerPermission } from '@/lib/schema';

export const dynamic = 'force-dynamic';

function createService() {
  const repository = new UserServerRepository();
  return new UserServerService(repository);
}

/**
 * GET /api/user-servers?serverId=xxx
 * List users with access to a server (requires admin permission)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(await headers());

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const serverId = request.nextUrl.searchParams.get('serverId');
    if (!serverId) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'serverId query parameter is required' },
        { status: 400 }
      );
    }

    // Only platform admins or server admins can list server users
    if (session.user.role !== 'admin') {
      const service = createService();
      const hasAdmin = await service.hasPermission(session.user.id, serverId, 'admin');
      if (!hasAdmin) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Admin permission required' },
          { status: 403 }
        );
      }
    }

    const service = createService();
    const users = await service.getServerUsersWithDetails(serverId);

    return NextResponse.json({ users, total: users.length });
  } catch (error) {
    console.error('Failed to list user-server permissions:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to list permissions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user-servers
 * Grant access to a user for a server
 * Body: { userId, serverId, permission }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(await headers());

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId, serverId, permission } = await request.json() as {
      userId: string;
      serverId: string;
      permission: ServerPermission;
    };

    if (!userId || !serverId || !permission) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'userId, serverId, and permission are required' },
        { status: 400 }
      );
    }

    const validPermissions: ServerPermission[] = ['view', 'manage', 'admin'];
    if (!validPermissions.includes(permission)) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Permission must be view, manage, or admin' },
        { status: 400 }
      );
    }

    // Only platform admins or server admins can grant access
    if (session.user.role !== 'admin') {
      const service = createService();
      const hasAdmin = await service.hasPermission(session.user.id, serverId, 'admin');
      if (!hasAdmin) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Admin permission required to grant access' },
          { status: 403 }
        );
      }
    }

    const service = createService();
    const result = await service.grantAccess(userId, serverId, permission);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json(
        { error: 'Forbidden', message: error.message },
        { status: 403 }
      );
    }

    console.error('Failed to grant access:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to grant access' },
      { status: 500 }
    );
  }
}
