/**
 * Ban API Route
 * GET/POST/DELETE /api/players/ban
 * Uses dedicated mcctl-api bans endpoints (supports offline servers)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireServerPermission, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

function getUserContext(session: { user: { name?: string | null; email: string; role?: string | null } }): UserContext {
  return {
    username: session.user.name || session.user.email,
    role: session.user.role || 'user',
  };
}

/**
 * GET /api/players/ban?server=<name>
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const server = searchParams.get('server');

    if (!server) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Server name is required' },
        { status: 400 }
      );
    }

    const session = await requireServerPermission(await headers(), server, 'view');
    const client = createMcctlApiClient(getUserContext(session));

    const result = await client.getBans(server);

    // API now returns players with full ban details, pass through directly
    return NextResponse.json({ players: result.players, source: result.source });
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

    console.error('Failed to fetch ban list:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch ban list' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/players/ban
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

    const result = await client.banPlayer(server, player, reason);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      source: result.source,
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

    console.error('Failed to ban player:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to ban player' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/players/ban?player=<name>&server=<name>
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const player = searchParams.get('player');
    const server = searchParams.get('server');

    if (!player || !server) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Player and server are required' },
        { status: 400 }
      );
    }

    const session = await requireServerPermission(await headers(), server, 'manage');
    const client = createMcctlApiClient(getUserContext(session));

    const result = await client.unbanPlayer(server, player);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      source: result.source,
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

    console.error('Failed to unban player:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to unban player' },
      { status: 500 }
    );
  }
}
