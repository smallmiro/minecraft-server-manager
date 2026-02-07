import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';
import { UserServerRepository } from '@/adapters/UserServerRepository';
import { UserServerService } from '@/services/UserServerService';

export const dynamic = 'force-dynamic';

/**
 * Extract user context from session for API forwarding
 */
function getUserContext(session: { user: { name?: string | null; email: string; role?: string | null } }): UserContext {
  return {
    username: session.user.name || session.user.email,
    role: session.user.role || 'user',
  };
}

/**
 * GET /api/servers
 * Proxy to mcctl-api: List all servers (filtered by user permissions)
 */
export async function GET() {
  try {
    const session = await requireAuth(await headers());

    const client = createMcctlApiClient(getUserContext(session));
    const allServers = await client.getServers();

    // Platform admins see all servers
    if (session.user.role === 'admin') {
      return NextResponse.json(allServers);
    }

    // Regular users see only servers they have permission for
    const repository = new UserServerRepository();
    const userServers = await repository.findByUser(session.user.id);
    const allowedServerNames = new Set(userServers.map((us) => us.serverId));

    const filteredServers = allServers.servers.filter((server) =>
      allowedServerNames.has(server.name)
    );

    return NextResponse.json({ servers: filteredServers, total: filteredServers.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: 'Unauthorized', message: error.message },
        { status: error.statusCode }
      );
    }
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to fetch servers:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch servers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/servers
 * Proxy to mcctl-api: Create a new server
 * Automatically assigns creator as admin
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(await headers());

    const body = await request.json();
    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.createServer(body);

    // Auto-assign creator as admin (unless platform admin)
    if (session.user.role !== 'admin') {
      const repository = new UserServerRepository();
      const service = new UserServerService(repository);

      try {
        await service.grantAccess(session.user.id, data.server.name, 'admin');
      } catch (permError) {
        console.error('Failed to grant admin permission:', permError);
        // Don't fail server creation if permission grant fails
      }
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: 'Unauthorized', message: error.message },
        { status: error.statusCode }
      );
    }
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to create server:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to create server' },
      { status: 500 }
    );
  }
}
