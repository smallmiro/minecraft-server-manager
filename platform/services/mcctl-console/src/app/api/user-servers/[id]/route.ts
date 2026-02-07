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

    // Look up the target record by ID
    const service = createService();
    const repository = new UserServerRepository();
    const targetRecord = await repository.findById(id);

    if (!targetRecord) {
      return NextResponse.json(
        { error: 'NotFound', message: 'Permission record not found' },
        { status: 404 }
      );
    }

    // The caller must be a platform admin or server admin
    if (session.user.role !== 'admin') {
      const hasAdmin = await service.hasPermission(
        session.user.id,
        targetRecord.serverId,
        'admin'
      );
      if (!hasAdmin) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Admin permission required' },
          { status: 403 }
        );
      }
    }

    // Use service to enforce business rules (last-admin protection)
    const result = await service.updatePermission(
      targetRecord.userId,
      targetRecord.serverId,
      permission
    );

    return NextResponse.json(result);
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
