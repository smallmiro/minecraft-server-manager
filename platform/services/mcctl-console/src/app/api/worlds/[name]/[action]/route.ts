import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError } from '@/adapters/McctlApiAdapter';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

interface RouteParams {
  params: Promise<{ name: string; action: string }>;
}

type WorldAction = 'assign' | 'release';

const validActions: WorldAction[] = ['assign', 'release'];

/**
 * POST /api/worlds/:name/:action
 * Proxy to mcctl-api: Execute world actions (assign, release)
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

    if (!validActions.includes(action as WorldAction)) {
      return NextResponse.json(
        { error: 'BadRequest', message: `Invalid action: ${action}` },
        { status: 400 }
      );
    }

    const client = createMcctlApiClient();

    switch (action) {
      case 'assign': {
        const body = await request.json();
        if (!body.serverName) {
          return NextResponse.json(
            { error: 'BadRequest', message: 'serverName is required' },
            { status: 400 }
          );
        }
        const data = await client.assignWorld(name, body.serverName);
        return NextResponse.json(data);
      }
      case 'release': {
        const { searchParams } = new URL(request.url);
        const force = searchParams.get('force') === 'true';
        const data = await client.releaseWorld(name, force);
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
