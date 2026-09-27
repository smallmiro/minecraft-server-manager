/**
 * Players Roster API Route (#528)
 * GET /api/servers/:name/players
 *
 * Returns the unified online+offline player roster. With ?follow=true it
 * proxies the mcctl-api SSE stream instead (auth checked before opening the
 * stream, unlike the generic /api/sse/[...path] proxy).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireServerPermission, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ name: string }>;
}

function getUserContext(session: { user: { name?: string | null; email: string; role?: string | null } }): UserContext {
  return {
    username: session.user.name || session.user.email,
    role: session.user.role || 'user',
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { name } = await params;
  const { searchParams } = new URL(request.url);
  const follow = searchParams.get('follow') === 'true';
  const interval = searchParams.get('interval');

  try {
    const session = await requireServerPermission(await headers(), name, 'view');

    if (!follow) {
      const client = createMcctlApiClient(getUserContext(session));
      const data = await client.getPlayers(name);
      return NextResponse.json(data);
    }

    const apiUrl = process.env.MCCTL_API_URL || 'http://localhost:5001';
    const apiKey = process.env.MCCTL_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json(
        { error: 'InternalServerError', message: 'API key not configured' },
        { status: 500 }
      );
    }

    const upstreamParams = new URLSearchParams({ follow: 'true' });
    if (interval) upstreamParams.set('interval', interval);
    const userContext = getUserContext(session);

    const upstream = await fetch(
      `${apiUrl}/api/servers/${encodeURIComponent(name)}/players?${upstreamParams}`,
      {
        headers: {
          'X-API-Key': apiKey,
          'X-User': userContext.username,
          'X-Role': userContext.role,
        },
        // Forward client disconnects so the upstream stream is aborted too.
        signal: request.signal,
      }
    );

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: 'UpstreamError', message: `Failed to connect to players stream (HTTP ${upstream.status})` },
        { status: upstream.status || 502 }
      );
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Forbidden', message: error.message }, { status: error.statusCode });
    }
    if (error instanceof McctlApiError) {
      return NextResponse.json({ error: error.error, message: error.message }, { status: error.statusCode });
    }
    console.error('Failed to fetch players roster:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to fetch players roster' },
      { status: 500 }
    );
  }
}
