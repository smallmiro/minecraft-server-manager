import type { IContainerRuntimePort } from '../ports/outbound/IContainerRuntimePort.js';
import type { ContainerStatus } from '../../types/index.js';
import { WorldAssignmentError } from '../../domain/services/worldAssignment.js';

/** A server in one of these states may not change its world. */
const ACTIVE_STATES: ReadonlySet<ContainerStatus> = new Set(['running', 'paused', 'restarting', 'created']);

/**
 * Refuse a world assignment change on a server that is not stopped (#670).
 * Nothing is stopped automatically. Known limit: in D1 'not_found' also means
 * "runtime unreachable" and passes; a throw (or no runtime) is undetermined.
 */
export function checkServerStopped(
  runtime: IContainerRuntimePort | undefined,
  server: string
): WorldAssignmentError | null {
  let status: ContainerStatus;
  try {
    if (!runtime) throw new Error('no runtime configured');
    status = runtime.getStatus(`mc-${server}`);
  } catch (error) {
    return new WorldAssignmentError(
      'undetermined',
      `Cannot check whether server '${server}' is running: ${error instanceof Error ? error.message : String(error)}`,
      [server]
    );
  }
  if (!ACTIVE_STATES.has(status)) return null;
  return new WorldAssignmentError(
    'server_running',
    `Server '${server}' is ${status}; stop it before changing its world`,
    [server]
  );
}
