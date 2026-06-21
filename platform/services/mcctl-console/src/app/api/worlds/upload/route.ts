/**
 * World Zip Upload BFF Route (Streaming Proxy)
 * POST /api/worlds/upload?name=<name>&seed=<seed>
 *
 * Proxies a multipart/form-data zip upload to mcctl-api without buffering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

// Mirror the API's WORLD_UPLOAD_MAX_SIZE (default 1 GB) + multipart overhead margin,
// so raising the env var lifts the limit at both layers.
const WORLD_UPLOAD_MAX_SIZE =
  Number(process.env.WORLD_UPLOAD_MAX_SIZE) || 1024 * 1024 * 1024;
const MAX_REQUEST_SIZE = Math.floor(WORLD_UPLOAD_MAX_SIZE * 1.1) + 1024 * 1024;

const WORLD_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(await headers());

    // Early rejection for oversized requests at the BFF layer
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { error: 'PayloadTooLarge', message: 'Request body exceeds the maximum allowed size' },
        { status: 413 }
      );
    }

    const { searchParams } = request.nextUrl;
    const name = searchParams.get('name');
    if (!name) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'name query parameter is required' },
        { status: 400 }
      );
    }
    // Fail fast on invalid names before streaming the body upstream (mirrors API schema).
    if (!WORLD_NAME_PATTERN.test(name)) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Invalid world name' },
        { status: 400 }
      );
    }
    const seed = searchParams.get('seed');
    if (seed && seed.length > 128) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'seed is too long' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.MCCTL_API_URL || 'http://localhost:5001';
    const apiKey = process.env.MCCTL_API_KEY || '';
    const username = session.user.name || session.user.email;
    const role = session.user.role || 'user';

    const targetParams = new URLSearchParams({ name });
    if (seed) targetParams.set('seed', seed);

    const targetUrl = `${apiUrl}/api/worlds/upload?${targetParams.toString()}`;

    const proxyHeaders: Record<string, string> = {
      'X-API-Key': apiKey,
      'X-User': username,
      'X-Role': role,
    };

    // Forward Content-Type (includes the multipart boundary)
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

    // Preserve the upstream status even if the body is not JSON (proxy error page,
    // empty body, etc.) so the client sees the real status instead of a generic 500.
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: 'UpstreamError', message: text || response.statusText };
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: 'Unauthorized', message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to upload world zip:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to upload world zip' },
      { status: 500 }
    );
  }
}
