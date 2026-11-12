/**
 * Apply Server Hostnames API Route (#671)
 * POST /api/servers/:name/hostnames/apply: mcctl-api recreates the container
 * so the saved hostnames reach mc-router.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError } from '@/adapters/McctlApiAdapter';
import { requireServerPermission, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ name: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { name } = await params;
    const session = await requireServerPermission(await headers(), name, 'manage');

    const client = createMcctlApiClient({
      username: session.user.name || session.user.email,
      role: session.user.role || 'user',
    });
    return NextResponse.json(await client.applyHostnames(name));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Forbidden', message: error.message }, { status: error.statusCode });
    }
    if (error instanceof McctlApiError) {
      return NextResponse.json({ error: error.error, message: error.message }, { status: error.statusCode });
    }

    console.error('Failed to apply server hostnames:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to apply server hostnames' },
      { status: 500 }
    );
  }
}
