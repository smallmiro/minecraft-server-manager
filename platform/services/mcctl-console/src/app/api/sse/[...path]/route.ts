/**
 * SSE Proxy Route
 * BFF layer for proxying SSE requests to mcctl-api
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireAuth, AuthError } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

/**
 * Build the mcctl-api URL: keep the client's query string (tail, interval, ...)
 * and always force follow=true.
 */
function buildTargetUrl(request: NextRequest, path: string[]): string {
  const apiUrl = process.env.MCCTL_API_URL || 'http://localhost:5001';
  const target = new URL(`${apiUrl}/api/${path.join('/')}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== 'follow') target.searchParams.append(key, value);
  });
  target.searchParams.set('follow', 'true');
  return target.toString();
}

/**
 * Link the client request to an upstream AbortController, so that a client
 * disconnect closes the mcctl-api connection (which in turn stops e.g. the
 * server side `docker logs -f`).
 */
function linkAbort(request: NextRequest): AbortController {
  const upstream = new AbortController();
  if (request.signal.aborted) {
    upstream.abort();
  } else {
    request.signal.addEventListener('abort', () => upstream.abort(), { once: true });
  }
  return upstream;
}

function authErrorResponse(error: unknown): Response | null {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: 'Unauthorized', message: error.message }, { status: error.statusCode });
  }
  return null;
}

/**
 * Re-stream the upstream SSE body to the client. Cancelling the returned
 * stream (client went away) cancels the upstream reader and aborts the fetch.
 */
function createProxyStream(response: Response, upstream: AbortController): ReadableStream<Uint8Array> {
  const reader = response.body?.getReader();
  let cancelled = false;

  return new ReadableStream({
    async start(controller) {
      if (!reader) {
        controller.close();
        return;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (cancelled) return;

          if (done) {
            controller.close();
            break;
          }

          // Forward the bytes as-is; SSE frames need no re-encoding
          controller.enqueue(value);
        }
      } catch (error) {
        if (cancelled || upstream.signal.aborted) return;
        console.error('SSE stream error:', error);
        controller.error(error);
      }
    },
    async cancel() {
      cancelled = true;
      upstream.abort();
      try {
        await reader?.cancel();
      } catch {
        // upstream already gone
      }
    },
  });
}

/**
 * GET /api/sse/[...path]
 * Proxy SSE requests to mcctl-api
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const { path } = params;

  // Router logs contain player names and IPs: never stream without a session
  try {
    await requireAuth(await headers());
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }

  const targetUrl = buildTargetUrl(request, path);

  // Get API key
  const apiKey = process.env.MCCTL_API_KEY || '';
  if (!apiKey) {
    return new Response('API key not configured', { status: 500 });
  }

  const upstream = linkAbort(request);

  try {
    // Fetch SSE stream from mcctl-api
    const response = await fetch(targetUrl, {
      headers: {
        'X-API-Key': apiKey,
      },
      signal: upstream.signal,
    });

    if (!response.ok) {
      return new Response(
        `Failed to connect to SSE endpoint: ${response.statusText}`,
        { status: response.status }
      );
    }

    // Check if response is SSE
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/event-stream')) {
      return new Response('Invalid SSE response', { status: 500 });
    }

    const stream = createProxyStream(response, upstream);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('SSE proxy error:', error);
    return new Response('Failed to connect to SSE endpoint', { status: 500 });
  }
}

/**
 * POST /api/sse/[...path]
 * Proxy POST SSE requests to mcctl-api (for operations like server creation)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const { path } = params;

  try {
    await requireAuth(await headers());
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }

  // Build target URL with follow=true to enable SSE mode
  const targetUrl = buildTargetUrl(request, path);

  // Get API key
  const apiKey = process.env.MCCTL_API_KEY || '';
  if (!apiKey) {
    return new Response('API key not configured', { status: 500 });
  }

  const upstream = linkAbort(request);

  try {
    // Read request body
    const body = await request.text();

    // Fetch SSE stream from mcctl-api
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body,
      signal: upstream.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        errorText || `Failed to connect to SSE endpoint: ${response.statusText}`,
        { status: response.status }
      );
    }

    // Check if response is SSE
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/event-stream')) {
      // Not SSE, return as regular JSON
      const responseText = await response.text();
      return new Response(responseText, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('content-type') || 'application/json',
        },
      });
    }

    const stream = createProxyStream(response, upstream);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('SSE proxy POST error:', error);
    return new Response('Failed to connect to SSE endpoint', { status: 500 });
  }
}

/**
 * OPTIONS /api/sse/[...path]
 * CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
