import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ name: string }>;
}

/**
 * POST /api/worlds/:name/map/render
 * Proxy to mcctl-api with follow=true and stream the SSE progress back to the
 * browser (BlueMap render, #529). Auth-gated: rendering mutates filesystem
 * state (and with force discards prior config), so a session is required.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireAuth(await headers());
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized', message: error.message }, { status: error.statusCode });
    }
    throw error;
  }

  const { name } = await params;
  const apiUrl = process.env.MCCTL_API_URL || 'http://localhost:5001';
  const apiKey = process.env.MCCTL_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json(
      { error: 'InternalServerError', message: 'API key not configured' },
      { status: 500 }
    );
  }

  const targetUrl = `${apiUrl}/api/worlds/${encodeURIComponent(name)}/map/render?follow=true`;
  const body = await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'X-User': session.user.name || session.user.email,
        'X-Role': session.user.role || 'user',
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: body || '{}',
    });
  } catch (error) {
    console.error('Map render proxy error:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to reach render endpoint' },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    return new Response(text || 'Render failed', { status: upstream.status || 502 });
  }

  // Pass the SSE stream straight through.
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
