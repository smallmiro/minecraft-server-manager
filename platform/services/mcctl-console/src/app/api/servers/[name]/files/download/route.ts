/**
 * Server File Download API Route (Streaming Proxy)
 * GET /api/servers/:name/files/download?path=...
 *
 * Streams the binary response from mcctl-api directly to the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireServerPermission, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ name: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { name } = await params;
    const session = await requireServerPermission(await headers(), name, 'view');

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

    const targetUrl = `${apiUrl}/api/servers/${encodeURIComponent(name)}/files/download?path=${encodeURIComponent(path)}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'X-User': username,
        'X-Role': role,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: 'UpstreamError',
        message: response.statusText,
      }));
      return NextResponse.json(errorData, { status: response.status });
    }

    // Stream the binary response to the browser
    const responseHeaders = new Headers();
    const contentDisposition = response.headers.get('content-disposition');
    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    responseHeaders.set('Content-Type', contentType);
    if (contentDisposition) {
      responseHeaders.set('Content-Disposition', contentDisposition);
    }
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: 'Forbidden', message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to download file:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to download file' },
      { status: 500 }
    );
  }
}
