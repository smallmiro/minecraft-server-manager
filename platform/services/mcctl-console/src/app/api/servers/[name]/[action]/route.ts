import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

interface RouteParams {
  params: Promise<{ name: string; action: string }>;
}

type ServerAction = 'start' | 'stop' | 'restart' | 'exec' | 'logs';

const validActions: ServerAction[] = ['start', 'stop', 'restart', 'exec', 'logs'];

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
 * GET /api/servers/:name/:action
 * Proxy to mcctl-api: Handle GET actions (logs)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { name, action } = await params;

    if (!validActions.includes(action as ServerAction)) {
      return NextResponse.json(
        { error: 'BadRequest', message: `Invalid action: ${action}` },
        { status: 400 }
      );
    }

    const client = createMcctlApiClient(getUserContext(session));

    if (action === 'logs') {
      const { searchParams } = new URL(request.url);
      const lines = parseInt(searchParams.get('lines') || '100', 10);
      const data = await client.getLogs(name, lines);
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: 'MethodNotAllowed', message: 'Use POST for this action' },
      { status: 405 }
    );
  } catch (error) {
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to execute action:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to execute action' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/servers/:name/:action
 * Proxy to mcctl-api: Execute server actions (start, stop, restart, exec)
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

    const { name, action } = await params;

    if (!validActions.includes(action as ServerAction)) {
      return NextResponse.json(
        { error: 'BadRequest', message: `Invalid action: ${action}` },
        { status: 400 }
      );
    }

    const client = createMcctlApiClient(getUserContext(session));

    switch (action) {
      case 'start': {
        const data = await client.startServer(name);
        return NextResponse.json(data);
      }
      case 'stop': {
        const data = await client.stopServer(name);
        return NextResponse.json(data);
      }
      case 'restart': {
        const data = await client.restartServer(name);
        return NextResponse.json(data);
      }
      case 'exec': {
        const body = await request.json();
        if (!body.command) {
          return NextResponse.json(
            { error: 'BadRequest', message: 'Command is required' },
            { status: 400 }
          );
        }
        const data = await client.execCommand(name, body.command);
        return NextResponse.json(data);
      }
      default:
        return NextResponse.json(
          { error: 'BadRequest', message: `Invalid action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to execute action:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to execute action' },
      { status: 500 }
    );
  }
}
