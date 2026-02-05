import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

/**
 * GET /api/audit-logs/stream
 * Proxy to mcctl-api: SSE stream for real-time audit log updates
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const apiUrl = process.env.MCCTL_API_URL || 'http://localhost:5001';
    const apiKey = process.env.MCCTL_API_KEY || '';

    // Connect to mcctl-api SSE endpoint
    const response = await fetch(`${apiUrl}/api/audit-logs/stream`, {
      headers: {
        'X-API-Key': apiKey,
        'X-User': session.user.name || session.user.email,
        'X-Role': session.user.role || 'user',
        'Accept': 'text/event-stream',
      },
    });

    if (!response.ok) {
      return new Response(
        `Failed to connect to audit log stream: ${response.statusText}`,
        { status: response.status }
      );
    }

    // Proxy the SSE stream
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

            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(new TextEncoder().encode(chunk));
          }
        } catch (error) {
          console.error('Audit log SSE stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('Audit log SSE proxy error:', error);
    return new Response('Failed to connect to audit log stream', { status: 500 });
  }
}
