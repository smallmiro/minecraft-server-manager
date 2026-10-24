import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import { parseChangelog, type ChangelogVersion } from '@/lib/changelog';
import pkg from '../../../../package.json';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

const CHANGELOG_URL =
  'https://raw.githubusercontent.com/smallmiro/minecraft-server-manager/develop/CHANGELOG.md';
const CACHE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

interface CacheEntry {
  latest: ChangelogVersion;
  fetchedAt: number;
}

// Server-memory cache (per Node process). Lost on restart, which is acceptable.
let cache: CacheEntry | null = null;
let inflight: Promise<CacheEntry> | null = null;

async function fetchLatest(): Promise<CacheEntry> {
  const response = await fetch(CHANGELOG_URL, {
    headers: { Accept: 'text/plain' },
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GitHub responded with ${response.status}`);
  }
  const [latest] = parseChangelog(await response.text(), 1);
  if (!latest) {
    throw new Error('No version found in changelog');
  }
  return { latest, fetchedAt: Date.now() };
}

function refresh(): Promise<CacheEntry> {
  if (!inflight) {
    inflight = fetchLatest()
      .then((entry) => {
        cache = entry;
        return entry;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

function payload(entry: CacheEntry, stale: boolean) {
  return {
    latest: entry.latest,
    installedVersion: pkg.version,
    fetchedAt: new Date(entry.fetchedAt).toISOString(),
    stale,
  };
}

/**
 * GET /api/changelog
 * Authenticated users. Fetches CHANGELOG.md server-side (cached ~1h in memory) and returns
 * the latest version plus the installed console version. On GitHub failure the last good
 * value is returned (stale: true); without one, 502.
 */
export async function GET() {
  try {
    await requireAuth(await headers());
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.statusCode === 401 ? 'Unauthorized' : 'Forbidden', message: error.message },
        { status: error.statusCode, headers: NO_STORE }
      );
    }
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to load changelog' },
      { status: 500, headers: NO_STORE }
    );
  }

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(payload(cache, false), { headers: NO_STORE });
  }

  try {
    return NextResponse.json(payload(await refresh(), false), { headers: NO_STORE });
  } catch {
    if (cache) {
      return NextResponse.json(payload(cache, true), { headers: NO_STORE });
    }
    return NextResponse.json(
      { error: 'ChangelogUnavailable', message: 'Unable to load updates' },
      { status: 502, headers: NO_STORE }
    );
  }
}
