import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { or, like, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users?q=<search>
 * Search users by name or email (for autocomplete)
 * Only admins can search users
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only platform admins can search users
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin permission required' },
        { status: 403 }
      );
    }

    const query = request.nextUrl.searchParams.get('q');
    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Search users by name or email (LIKE %query%)
    const searchPattern = `%${query}%`;
    const results = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      })
      .from(users)
      .where(
        or(
          like(users.name, searchPattern),
          like(users.email, searchPattern)
        )
      )
      .limit(20);

    return NextResponse.json({ users: results });
  } catch (error) {
    console.error('Failed to search users:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to search users' },
      { status: 500 }
    );
  }
}
