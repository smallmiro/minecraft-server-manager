import { existsSync, readFileSync, statSync } from 'node:fs';
import { atomicWriteFileSync } from '@minecraft-docker/shared/utils';

const DEFAULT_GID = '999';

function socketPath(): string {
  const host = process.env['DOCKER_HOST'];
  return host?.startsWith('unix://') ? host.slice('unix://'.length) : '/var/run/docker.sock';
}

/**
 * GID that owns the Docker socket, or null if it cannot be read.
 * root-owned sockets (gid 0) return null: never grant mc-router the root group.
 */
export function detectDockerGid(socket = socketPath()): number | null {
  try {
    const { gid } = statSync(socket);
    return gid > 0 ? gid : null;
  } catch {
    return null;
  }
}

/**
 * Write DOCKER_GID into .env (mc-router v1.46+ runs non-root and needs group_add).
 * Only fills a missing value or the template default; user-set values are kept.
 */
export function setDockerGid(envPath: string, gid: number | null): boolean {
  if (gid === null || !existsSync(envPath)) return false;
  const content = readFileSync(envPath, 'utf-8');
  const line = /^DOCKER_GID=(.*)$/m;
  const current = content.match(line)?.[1]?.trim();
  if (current !== undefined && current !== DEFAULT_GID && current !== '') return false;
  const next = current === undefined
    ? `${content}${content.endsWith('\n') ? '' : '\n'}DOCKER_GID=${gid}\n`
    : content.replace(line, `DOCKER_GID=${gid}`);
  atomicWriteFileSync(envPath, next);
  return true;
}
