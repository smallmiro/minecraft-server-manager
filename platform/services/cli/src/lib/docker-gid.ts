import { readFileSync, writeFileSync, statSync } from 'node:fs';

const DEFAULT_GID = '999';

/** GID that owns the Docker socket, or null if it cannot be read. */
export function detectDockerGid(socket = '/var/run/docker.sock'): number | null {
  try {
    return statSync(socket).gid;
  } catch {
    return null;
  }
}

/**
 * Write DOCKER_GID into .env (mc-router v1.46+ runs non-root and needs group_add).
 * Only fills a missing value or the template default; user-set values are kept.
 */
export function setDockerGid(envPath: string, gid: number | null): boolean {
  if (gid === null) return false;
  const content = readFileSync(envPath, 'utf-8');
  const line = /^DOCKER_GID=(.*)$/m;
  const current = content.match(line)?.[1]?.trim();
  if (current !== undefined && current !== DEFAULT_GID) return false;
  const next = current === undefined
    ? `${content}${content.endsWith('\n') ? '' : '\n'}DOCKER_GID=${gid}\n`
    : content.replace(line, `DOCKER_GID=${gid}`);
  writeFileSync(envPath, next, 'utf-8');
  return true;
}
