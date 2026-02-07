/**
 * Operators API Route
 * GET/POST/DELETE /api/players/op
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
 * GET /api/players/op?server=<name>
 * Get operators for a server
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const server = searchParams.get('server');

    if (!server) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Server name is required' },
        { status: 400 }
      );
    }

    const client = createMcctlApiClient(getUserContext(session));

    // Execute list operators command
    // Note: Minecraft doesn't have a native command to list ops via RCON
    // This would typically require reading ops.json from the server
    // For now, we return an empty list - the backend API should handle this
    const result = await client.execCommand(server, 'list');

    // Parse ops list if available (depends on server implementation)
    const operators: { name: string; uuid: string; level: number }[] = [];

    return NextResponse.json({ operators });
  } catch (error) {
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to fetch operators:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch operators' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/players/op
 * Add operator
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { player, server } = body;

    if (!player || !server) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Player and server are required' },
        { status: 400 }
      );
    }

    const client = createMcctlApiClient(getUserContext(session));

    // Add operator
    const result = await client.execCommand(server, `op ${player}`);

    return NextResponse.json({
      success: true,
      message: result.output,
    });
  } catch (error) {
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to add operator:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to add operator' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/players/op?player=<name>&server=<name>
 * Remove operator
 */
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const player = searchParams.get('player');
    const server = searchParams.get('server');

    if (!player || !server) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Player and server are required' },
        { status: 400 }
      );
    }

    const client = createMcctlApiClient(getUserContext(session));

    // Remove operator
    const result = await client.execCommand(server, `deop ${player}`);

    return NextResponse.json({
      success: true,
      message: result.output,
    });
  } catch (error) {
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to remove operator:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to remove operator' },
      { status: 500 }
    );
  }
}
