import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ name: string; path?: string[] }>;
}

/**
 * GET /api/worlds/:name/map/web/[...path]
 * Proxy to mcctl-api's static map serving (BlueMap webroot, #529). The Fastify
 * side enforces path-traversal protection; here we just gate on auth and stream
 * the response (HTML/JS/tiles/assets) through with its content-type.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireAuth(await headers());
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized', message: error.message }, { status: error.statusCode });
    }
    throw error;
  }

  const { name, path = [] } = await params;
  const apiUrl = process.env.MCCTL_API_URL || 'http://localhost:5001';
  const apiKey = process.env.MCCTL_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json(
      { error: 'InternalServerError', message: 'API key not configured' },
      { status: 500 }
    );
  }

  const rel = path.map(encodeURIComponent).join('/');
  const targetUrl = `${apiUrl}/api/worlds/${encodeURIComponent(name)}/map/web/${rel}`;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      headers: {
        'X-API-Key': apiKey,
        'X-User': session.user.name || session.user.email,
        'X-Role': session.user.role || 'user',
      },
    });
  } catch (error) {
    console.error('Map web proxy error:', error);
    return new Response('Failed to reach map endpoint', { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(upstream.statusText || 'Not found', { status: upstream.status || 404 });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
