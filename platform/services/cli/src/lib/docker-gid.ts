import { existsSync, readFileSync, statSync } from 'node:fs';
import { applyEnvChanges, atomicWriteFileSync, parseEnvDocument } from '@minecraft-docker/shared/utils';

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
  const current = parseEnvDocument(content).values.get('DOCKER_GID');
  if (current !== undefined && current !== DEFAULT_GID && current !== '') return false;
  atomicWriteFileSync(envPath, applyEnvChanges(content, { set: { DOCKER_GID: String(gid) } }));
  return true;
}
