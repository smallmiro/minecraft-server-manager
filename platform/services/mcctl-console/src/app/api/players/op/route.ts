/**
 * Operators API Route
 * GET/POST/DELETE /api/players/op
 * Uses dedicated mcctl-api ops endpoints (supports offline servers)
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
 * GET /api/players/op?server=<name>
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

    const result = await client.getOps(server);

    const operators = result.players.map((name) => ({ name, uuid: '', level: 4 }));

    return NextResponse.json({ operators, source: result.source });
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

    console.error('Failed to fetch operators:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch operators' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/players/op
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { player, server } = body;

    if (!player || !server) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Player and server are required' },
        { status: 400 }
      );
    }

    const session = await requireServerPermission(await headers(), server, 'admin');
    const client = createMcctlApiClient(getUserContext(session));

    const result = await client.addOp(server, player);

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

    console.error('Failed to add operator:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to add operator' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/players/op?player=<name>&server=<name>
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

    const session = await requireServerPermission(await headers(), server, 'admin');
    const client = createMcctlApiClient(getUserContext(session));

    const result = await client.removeOp(server, player);

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

    console.error('Failed to remove operator:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to remove operator' },
      { status: 500 }
    );
  }
}
