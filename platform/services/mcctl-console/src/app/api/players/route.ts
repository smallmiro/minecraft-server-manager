/**
 * Players API Route
 * GET /api/players - Get online players across all servers
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

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
 * GET /api/players
 * Get online players across all servers
 */
export async function GET(_request: NextRequest) {
  try {
    // Verify session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const client = createMcctlApiClient(getUserContext(session));

    // Get all servers
    const serversData = await client.getServers();

    // Get players for each running server
    const serversWithPlayers = await Promise.all(
      serversData.servers
        .filter((server) => server.status === 'running' && server.health === 'healthy')
        .map(async (server) => {
          try {
            const serverDetail = await client.getServer(server.name);
            return {
              name: server.name,
              players: serverDetail.server.players?.list.map((name) => ({
                name,
                uuid: '', // UUID not available from basic list
              })) || [],
            };
          } catch {
            return {
              name: server.name,
              players: [],
            };
          }
        })
    );

    return NextResponse.json({ servers: serversWithPlayers });
  } catch (error) {
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to fetch players:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch players' },
      { status: 500 }
    );
  }
}
