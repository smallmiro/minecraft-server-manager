import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError } from '@/adapters/McctlApiAdapter';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

interface RouteParams {
  params: Promise<{ name: string }>;
}

/**
 * GET /api/servers/:name
 * Proxy to mcctl-api: Get server details
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
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
    const client = createMcctlApiClient();
    const data = await client.getServer(name);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to fetch server:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch server details' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/servers/:name
 * Proxy to mcctl-api: Delete a server
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const client = createMcctlApiClient();
    const data = await client.deleteServer(name, force);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to delete server:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to delete server' },
      { status: 500 }
    );
  }
}
