/**
 * Mod Projects API Route
 * GET /api/mods/projects?slugs=sodium,lithium&source=modrinth
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMcctlApiClient, McctlApiError } from '@/adapters/McctlApiAdapter';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mods/projects
 * Get project details for multiple mod slugs (batch)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(await headers());

    const searchParams = request.nextUrl.searchParams;
    const slugs = searchParams.get('slugs');
    const source = searchParams.get('source');

    if (!slugs) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Query parameter "slugs" is required' },
        { status: 400 }
      );
    }

    const slugList = slugs.split(',').map(s => s.trim()).filter(Boolean);
    if (slugList.length === 0) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'At least one slug is required' },
        { status: 400 }
      );
    }

    const client = createMcctlApiClient();
    const data = await client.getModProjects(slugList, source || undefined);

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

    console.error('Failed to get mod projects:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to get mod projects' },
      { status: 500 }
    );
  }
}
