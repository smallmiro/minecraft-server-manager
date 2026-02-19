/**
 * Server File Upload API Route (Streaming Proxy)
 * POST /api/servers/:name/files/upload?path=...
 *
 * Streams multipart/form-data directly to mcctl-api without buffering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireServerPermission, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ name: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { name } = await params;
    const session = await requireServerPermission(await headers(), name, 'manage');

    const path = request.nextUrl.searchParams.get('path');
    if (!path) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'path query parameter is required' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.MCCTL_API_URL || 'http://localhost:5001';
    const apiKey = process.env.MCCTL_API_KEY || '';
    const username = session.user.name || session.user.email;
    const role = session.user.role || 'user';

    const targetUrl = `${apiUrl}/api/servers/${encodeURIComponent(name)}/files/upload?path=${encodeURIComponent(path)}`;

    // Stream the request body directly to mcctl-api (no buffering)
    const proxyHeaders: Record<string, string> = {
      'X-API-Key': apiKey,
      'X-User': username,
      'X-Role': role,
    };

    // Forward the Content-Type header (includes multipart boundary)
    const contentType = request.headers.get('content-type');
    if (contentType) {
      proxyHeaders['Content-Type'] = contentType;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: proxyHeaders,
      body: request.body,
      // @ts-expect-error -- Node.js fetch supports duplex for streaming request bodies
      duplex: 'half',
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: 'Forbidden', message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to upload file:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
