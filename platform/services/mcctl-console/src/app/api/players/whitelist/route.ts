/**
 * Whitelist API Route
 * GET/POST/DELETE /api/players/whitelist
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
 * GET /api/players/whitelist?server=<name>
 * Get whitelist for a server
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

    // Execute whitelist list command via RCON
    const result = await client.execCommand(server, 'whitelist list');

    // Parse whitelist output
    // Format: "There are X whitelisted players: name1, name2, name3"
    const players: { name: string; uuid: string }[] = [];
    const match = result.output.match(/:\s*(.+)$/);
    if (match) {
      const names = match[1].split(',').map((n) => n.trim()).filter(Boolean);
      names.forEach((name) => {
        players.push({ name, uuid: '' });
      });
    }

    return NextResponse.json({ players });
  } catch (error) {
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to fetch whitelist:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch whitelist' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/players/whitelist
 * Add player to whitelist
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

    // Add to whitelist
    const result = await client.execCommand(server, `whitelist add ${player}`);

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

    console.error('Failed to add to whitelist:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to add to whitelist' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/players/whitelist?player=<name>&server=<name>
 * Remove player from whitelist
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

    // Remove from whitelist
    const result = await client.execCommand(server, `whitelist remove ${player}`);

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

    console.error('Failed to remove from whitelist:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to remove from whitelist' },
      { status: 500 }
    );
  }
}
