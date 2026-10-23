import type { IContainerRuntimePort } from '../ports/outbound/IContainerRuntimePort.js';
import type { IWorldAssignmentPort } from '../ports/outbound/IWorldAssignmentPort.js';
import type { ContainerStatus } from '../../types/index.js';
import { WorldAssignmentError, checkProposed } from '../../domain/services/worldAssignment.js';

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

/**
 * Why `server`'s config.env may not become `configEnv`, or null (#670). Only
 * a change of its assignment (world or internal/worlds location) is checked:
 * the result must pass checkProposed (R1, R7) and the server must be
 * stopped. Without an assignment port the change fails closed.
 */
export async function checkConfigEnvChange(
  assignments: IWorldAssignmentPort | undefined,
  runtime: IContainerRuntimePort | undefined,
  server: string,
  configEnv: string
): Promise<WorldAssignmentError | null> {
  if (!assignments) {
    return new WorldAssignmentError('undetermined', 'World assignments cannot be read: no assignment port configured');
  }
  const [current, next] = await Promise.all([assignments.snapshot(), assignments.preview(server, configEnv)]);
  const before = current.assignments.find((a) => a.server === server);
  const after = next.assignments.find((a) => a.server === server);
  if (before?.world === after?.world && !!before?.internal === !!after?.internal) return null;
  return checkProposed(next, server) ?? checkServerStopped(runtime, server);
}
