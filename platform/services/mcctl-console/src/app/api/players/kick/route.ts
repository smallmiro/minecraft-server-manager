/**
 * Kick API Route
 * POST /api/players/kick
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireServerPermission, AuthError } from '@/lib/auth-utils';
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
 * POST /api/players/kick
 * Kick a player from the server
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { player, server, reason } = body;

    if (!player || !server) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Player and server are required' },
        { status: 400 }
      );
    }

    const session = await requireServerPermission(await headers(), server, 'manage');
    const client = createMcctlApiClient(getUserContext(session));

    // Kick player with optional reason
    const command = reason ? `kick ${player} ${reason}` : `kick ${player}`;
    const result = await client.execCommand(server, command);

    return NextResponse.json({
      success: true,
      message: result.output,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: 'Forbidden', message: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to kick player:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to kick player' },
      { status: 500 }
    );
  }
}
