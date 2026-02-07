/**
 * Server Command Execution API Route
 * POST /api/servers/:name/exec
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ name: string }>;
}

interface ExecRequest {
  command: string;
}

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
 * POST /api/servers/:name/exec
 * Execute a command on the server via RCON
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const { name } = await params;
    const body = await request.json() as ExecRequest;

    if (!body.command || typeof body.command !== 'string') {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Command is required and must be a string' },
        { status: 400 }
      );
    }

    const client = createMcctlApiClient(getUserContext(session));
    const data = await client.execCommand(name, body.command);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to execute command:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to execute command' },
      { status: 500 }
    );
  }
}
