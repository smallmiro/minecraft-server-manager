/**
 * World backup port for the API (ADR-0001 "Backup Port", #732).
 * Replaces the old <root>/scripts/backup.sh and raw git calls.
 */
import {
  GitWorldBackupAdapter,
  DockerComposeRuntimeAdapter,
  DockerRuntimeEnvironmentAdapter,
  DockerServerConsoleAdapter,
  type IWorldBackupPort,
  type WorldBackupErrorCode,
} from '@minecraft-docker/shared';
import { childProcessEnv } from '../config/index.js';

/** Scheduled pushes and prunes wait this long for another backup operation. */
export const SCHEDULED_LOCK_WAIT_MS = 600_000;

export function createWorldBackupPort(root: string): IWorldBackupPort {
  return new GitWorldBackupAdapter({
    root,
    runtime: new DockerComposeRuntimeAdapter({ root, env: () => childProcessEnv() }),
    environment: new DockerRuntimeEnvironmentAdapter(),
    console: new DockerServerConsoleAdapter(),
  });
}

/** HTTP status and error name for a port error code. */
export function backupErrorStatus(code: WorldBackupErrorCode): { status: number; error: string } {
  switch (code) {
    case 'not_configured':
    case 'missing_worlds':
    case 'empty_source':
    case 'unsupported_layout':
      return { status: 400, error: 'BadRequest' };
    case 'commit_not_found':
      return { status: 404, error: 'NotFound' };
    case 'locked':
    case 'servers_running':
    case 'recovery_required':
    case 'restore_conflict':
      return { status: 409, error: 'Conflict' };
    case 'runtime_unavailable':
      return { status: 503, error: 'ServiceUnavailable' };
    default:
      return { status: 500, error: 'InternalServerError' };
  }
}

export const shortHash = (hash: string | undefined) => hash?.substring(0, 7);
