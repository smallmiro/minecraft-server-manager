/**
 * Platform-level docker operations of `mcctl init` and `mcctl upgrade`.
 * Not runtime-port work (ADR-0001 row 15): the shared network and the router
 * service belong to the compose project (on k8s: Helm, #641).
 */
import { execSync } from 'node:child_process';

/** Make sure the `minecraft-net` bridge network exists. */
export function ensureMinecraftNetwork(): 'exists' | 'created' | 'failed' {
  try {
    execSync('docker network inspect minecraft-net', { stdio: 'pipe' });
    return 'exists';
  } catch {
    try {
      execSync('docker network create --driver bridge --subnet 172.28.0.0/16 minecraft-net', {
        stdio: 'pipe',
      });
      return 'created';
    } catch {
      return 'failed';
    }
  }
}

/** `docker compose restart router` (the compose service; mc-router is the container name). Throws on failure. */
export function restartRouterService(root: string): void {
  execSync('docker compose restart router', { cwd: root, stdio: 'pipe' });
}

/** Recreate the router from the compose file (`docker compose up -d router`). Throws on failure. */
export function recreateRouterService(root: string): void {
  execSync('docker compose up -d router', { cwd: root, stdio: 'inherit', timeout: 5 * 60_000 });
}
