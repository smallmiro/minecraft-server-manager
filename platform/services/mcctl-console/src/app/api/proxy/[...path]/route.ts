import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * BFF (Backend-For-Frontend) Proxy Route Handler
 *
 * Forwards authenticated requests to mcctl-api service.
 * All requests through this proxy are authenticated via NextAuth session.
 *
 * Features:
 * - Session validation before forwarding
 * - Auth headers injection (X-User, X-Role, X-API-Key)
 * - Request/response logging in development
 * - Graceful error handling
 *
 * @example
 * // Client request:
 * fetch('/api/proxy/servers')
 *
 * // Forwarded to:
 * fetch('http://mcctl-api:3001/api/servers', {
 *   headers: { 'X-User': 'admin', 'X-Role': 'admin', ... }
 * })
 */

const API_URL = process.env.MCCTL_API_URL || 'http://mcctl-api:3001';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-dev-key';
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Log request/response in development mode
 */
function devLog(message: string, data?: unknown): void {
  if (isDevelopment) {
    console.log(`[BFF Proxy] ${message}`, data ?? '');
  }
}

/**
 * Extract path from request URL
 */
function extractPath(request: NextRequest): string {
  const url = new URL(request.url);
  // Remove /api/proxy prefix to get the actual API path
  const path = url.pathname.replace('/api/proxy', '');
  // Preserve query string
  const queryString = url.search;
  return `${path}${queryString}`;
}

/**
 * Create error response with consistent format
 */
function createErrorResponse(
  message: string,
  status: number,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      status,
      timestamp: new Date().toISOString(),
      ...(isDevelopment && details ? { details } : {}),
    },
    { status }
  );
}

/**
 * Handle proxy request
 */
async function proxyHandler(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  // Validate session
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    devLog('Unauthorized request - no session');
    return createErrorResponse('Unauthorized', 401);
  }

  const path = extractPath(request);
  const targetUrl = `${API_URL}/api${path}`;

  devLog(`${request.method} ${path} -> ${targetUrl}`);

  try {
    // Prepare headers for forwarding
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-API-Key': INTERNAL_API_KEY,
      'X-User': session.user.username,
      'X-Role': session.user.role,
      'X-Forwarded-For':
        request.headers.get('x-forwarded-for') || request.ip || 'unknown',
      'X-Request-Id':
        request.headers.get('x-request-id') || crypto.randomUUID(),
    };

    // Forward the request
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    };

    // Include body for non-GET requests
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const body = await request.text();
      if (body) {
        fetchOptions.body = body;
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Get response body
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    let responseBody: string | null = null;
    if (response.body) {
      responseBody = await response.text();
    }

    const duration = Date.now() - startTime;
    devLog(`Response: ${response.status} (${duration}ms)`);

    // Create response with appropriate content type
    if (isJson && responseBody) {
      return NextResponse.json(JSON.parse(responseBody), {
        status: response.status,
        headers: {
          'X-Response-Time': `${duration}ms`,
        },
      });
    }

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': contentType || 'text/plain',
        'X-Response-Time': `${duration}ms`,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    devLog(`Error after ${duration}ms:`, error);

    // Handle fetch errors (network issues, API unavailable)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return createErrorResponse('API service unavailable', 503, {
        targetUrl,
        error: error.message,
      });
    }

    return createErrorResponse('Internal proxy error', 500, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Export handlers for all HTTP methods
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyHandler(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyHandler(request);
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return proxyHandler(request);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return proxyHandler(request);
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return proxyHandler(request);
}
