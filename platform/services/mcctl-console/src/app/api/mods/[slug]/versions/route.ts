/**
 * Mod Versions API Route
 * GET /api/mods/:slug/versions?source=...
 *
 * Returns a loader -> Minecraft-version compatibility matrix for a modpack,
 * used by the Create Server dialog to offer only valid combinations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError } from '@/adapters/McctlApiAdapter';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mods/:slug/versions
 * Get the loader/version compatibility matrix for a modpack.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await requireAuth(await headers());

    const { slug } = await params;
    const source = request.nextUrl.searchParams.get('source');

    if (!slug) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Path parameter "slug" is required' },
        { status: 400 }
      );
    }

    const client = createMcctlApiClient();
    const data = await client.getModVersions(slug, source ?? undefined);

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

    console.error('Failed to get mod versions:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to get mod versions' },
      { status: 500 }
    );
  }
}
