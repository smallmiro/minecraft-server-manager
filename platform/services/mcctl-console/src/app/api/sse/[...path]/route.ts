/**
 * SSE Proxy Route
 * BFF layer for proxying SSE requests to mcctl-api
 */

import { NextRequest } from 'next/server';

/**
 * GET /api/sse/[...path]
 * Proxy SSE requests to mcctl-api
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const { path } = params;

  // Build target URL
  const apiUrl = process.env.MCCTL_API_URL || 'http://localhost:5001';
  const apiPath = path.join('/');
  const targetUrl = `${apiUrl}/api/${apiPath}?follow=true`;

  // Get API key
  const apiKey = process.env.MCCTL_API_KEY || '';
  if (!apiKey) {
    return new Response('API key not configured', { status: 500 });
  }

  // TODO: Get user context from session
  // For now, we'll just proxy without user context
  // const session = await auth.api.getSession({ headers: request.headers });

  try {
    // Fetch SSE stream from mcctl-api
    const response = await fetch(targetUrl, {
      headers: {
        'X-API-Key': apiKey,
        // Add user context headers when auth is implemented
        // 'X-User': session.user.name,
        // 'X-Role': session.user.role,
      },
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

    // Create SSE response with proper headers
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.close();
              break;
            }

            // Decode and forward chunk
            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(new TextEncoder().encode(chunk));
          }
        } catch (error) {
          console.error('SSE stream error:', error);
          controller.error(error);
        }
      },
    });

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

  // Build target URL with follow=true to enable SSE mode
  const apiUrl = process.env.MCCTL_API_URL || 'http://localhost:5001';
  const apiPath = path.join('/');
  const targetUrl = `${apiUrl}/api/${apiPath}?follow=true`;

  // Get API key
  const apiKey = process.env.MCCTL_API_KEY || '';
  if (!apiKey) {
    return new Response('API key not configured', { status: 500 });
  }

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

    // Create SSE response with proper headers
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.close();
              break;
            }

            // Decode and forward chunk
            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(new TextEncoder().encode(chunk));
          }
        } catch (error) {
          console.error('SSE stream error:', error);
          controller.error(error);
        }
      },
    });

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
