// Fake origin: real host/IP must never reach GA via dl/dr.
export const ANALYTICS_BASE = 'http://mcctl-console.invalid';

/** Strip query/hash/trailing slash and replace the server name segment. */
export function normalizePath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, '');
  if (!path) return '/';
  return path.replace(/^\/servers\/[^/]+/, '/servers/:name');
}
