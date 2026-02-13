/**
 * Mod Search API Route
 * GET /api/mods/search?q=...&limit=...&offset=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError } from '@/adapters/McctlApiAdapter';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mods/search
 * Search for mods on Modrinth
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(await headers());

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    if (!q) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    const client = createMcctlApiClient();
    const data = await client.searchMods(
      q,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined
    );

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: 'Forbidden', message: error.message },
        { status: error.statusCode }
      );
    }
    if (error instanceof McctlApiError) {
      return NextResponse.json(
        { error: error.error, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Failed to search mods:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to search mods' },
      { status: 500 }
    );
  }
}
