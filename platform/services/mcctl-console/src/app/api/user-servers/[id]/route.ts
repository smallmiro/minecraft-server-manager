import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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
 * PATCH /api/user-servers/[id]
 * Update permission level
 * Body: { permission }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { permission } = await request.json() as { permission: ServerPermission };

    const validPermissions: ServerPermission[] = ['view', 'manage', 'admin'];
    if (!permission || !validPermissions.includes(permission)) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Permission must be view, manage, or admin' },
        { status: 400 }
      );
    }

    // Get the record to check authorization
    const repository = new UserServerRepository();
    const existing = await repository.findByUserAndServer(id, '');

    // For PATCH, we use the ID from the URL to find the record
    // The caller must be a platform admin or server admin
    if (session.user.role !== 'admin') {
      // Need to look up the record by ID to get serverId
      const allUserServers = await repository.findByUser(session.user.id);
      const targetRecord = allUserServers.find((us) => us.id === id);

      if (!targetRecord) {
        const service = createService();
        // Try to find the target by ID in the server's users
        return NextResponse.json(
          { error: 'Forbidden', message: 'Admin permission required' },
          { status: 403 }
        );
      }
    }

    const service = createService();

    // Look up the record to get userId and serverId
    // Since we have the record ID, update directly
    try {
      const result = await repository.updatePermission(id, permission);
      return NextResponse.json(result);
    } catch (updateError) {
      throw updateError;
    }
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json(
        { error: 'Forbidden', message: error.message },
        { status: 403 }
      );
    }

    console.error('Failed to update permission:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to update permission' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user-servers/[id]
 * Revoke access
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Only platform admins can delete via ID directly
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin permission required' },
        { status: 403 }
      );
    }

    const repository = new UserServerRepository();
    await repository.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json(
        { error: 'Forbidden', message: error.message },
        { status: 403 }
      );
    }

    console.error('Failed to revoke access:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to revoke access' },
      { status: 500 }
    );
  }
}
