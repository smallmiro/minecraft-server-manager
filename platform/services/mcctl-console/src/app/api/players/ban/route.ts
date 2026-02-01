/**
 * Ban API Route
 * GET/POST/DELETE /api/players/ban
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

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
 * GET /api/players/ban?server=<name>
 * Get ban list for a server
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

    // Execute banlist command
    const result = await client.execCommand(server, 'banlist players');

    // Parse ban list output
    // Format varies, commonly: "There are X banned players: name1, name2"
    const players: { name: string; uuid: string; reason: string; created: string; source: string }[] = [];
    const match = result.output.match(/:\s*(.+)$/);
    if (match) {
      const names = match[1].split(',').map((n) => n.trim()).filter(Boolean);
      names.forEach((name) => {
        players.push({
          name,
          uuid: '',
          reason: 'No reason provided',
          created: new Date().toISOString(),
          source: 'Server',
        });
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

    console.error('Failed to fetch ban list:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch ban list' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/players/ban
 * Ban a player
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
    const { player, server, reason } = body;

    if (!player || !server) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Player and server are required' },
        { status: 400 }
      );
    }

    const client = createMcctlApiClient(getUserContext(session));

    // Ban player with optional reason
    const command = reason ? `ban ${player} ${reason}` : `ban ${player}`;
    const result = await client.execCommand(server, command);

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

    console.error('Failed to ban player:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to ban player' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/players/ban?player=<name>&server=<name>
 * Unban a player (pardon)
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

    // Pardon (unban) player
    const result = await client.execCommand(server, `pardon ${player}`);

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

    console.error('Failed to unban player:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to unban player' },
      { status: 500 }
    );
  }
}
