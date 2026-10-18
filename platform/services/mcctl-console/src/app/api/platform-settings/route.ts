import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError, UserContext } from '@/adapters/McctlApiAdapter';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';
import type { PlatformSettingsUpdateRequest } from '@/types/platform-settings';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function getUserContext(session: { user: { name?: string | null; email: string; role?: string | null } }): UserContext {
  return {
    username: session.user.name || session.user.email,
    role: session.user.role || 'user',
  };
}

function isUpdateRequest(body: unknown): body is PlatformSettingsUpdateRequest {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.revision === 'string' &&
    Array.isArray(b.remove) &&
    b.remove.every((k) => typeof k === 'string') &&
    !!b.set &&
    typeof b.set === 'object' &&
    !Array.isArray(b.set) &&
    Object.values(b.set as object).every((v) => typeof v === 'string')
  );
}

// Request bodies carry secrets: never log them.
function errorResponse(error: unknown, fallback: string) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.statusCode === 401 ? 'Unauthorized' : 'Forbidden', message: error.message },
      { status: error.statusCode, headers: NO_STORE }
    );
  }
  if (error instanceof McctlApiError) {
    // Pass 400 (field errors) / 409 (currentRevision) bodies through unchanged.
    const body = error.body ?? { error: error.error, message: error.message };
    return NextResponse.json(body, { status: error.statusCode, headers: NO_STORE });
  }
  console.error(fallback);
  return NextResponse.json(
    { error: 'InternalServerError', message: fallback },
    { status: 500, headers: NO_STORE }
  );
}

/**
 * GET /api/platform-settings
 * Admin only. Proxy to mcctl-api: platform settings metadata (secrets masked).
 */
export async function GET() {
  try {
    const session = await requireAdmin(await headers());
    const data = await createMcctlApiClient(getUserContext(session)).getPlatformSettings();
    return NextResponse.json(data, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, 'Failed to load platform settings');
  }
}

/**
 * PUT /api/platform-settings
 * Admin only. Proxy to mcctl-api: update <MCCTL_ROOT>/.env.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin(await headers());

    const body: unknown = await request.json().catch(() => null);
    if (!isUpdateRequest(body)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'revision, set and remove are required' },
        { status: 400, headers: NO_STORE }
      );
    }

    const data = await createMcctlApiClient(getUserContext(session)).updatePlatformSettings(body);
    return NextResponse.json(data, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, 'Failed to update platform settings');
  }
}
