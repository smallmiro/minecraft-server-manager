import type { IContainerRuntimePort } from '../ports/outbound/IContainerRuntimePort.js';
import type { IWorldAssignmentPort } from '../ports/outbound/IWorldAssignmentPort.js';
import type { ContainerStatus } from '../../types/index.js';
import { ServerName } from '../../domain/value-objects/ServerName.js';
import {
  WorldAssignmentError,
  checkProposed,
  type WorldAssignmentSnapshot,
} from '../../domain/services/worldAssignment.js';

/** A server in one of these states may not change its world. */
const ACTIVE_STATES: ReadonlySet<ContainerStatus> = new Set(['running', 'paused', 'restarting', 'created']);

/**
 * Refuse a world assignment change on a server that is not stopped (#670).
 * Nothing is stopped automatically. 'not_found' also means "runtime
 * unreachable" (D1), so it passes only when a strict list succeeds (#734). A
 * throw (or no runtime) is undetermined, and so is a name no server can have
 * (ServerName.fromExisting rejects it).
 */
export function checkServerStopped(
  runtime: IContainerRuntimePort | undefined,
  server: string
): WorldAssignmentError | null {
  let status: ContainerStatus;
  try {
    if (!runtime) throw new Error('no runtime configured');
    status = runtime.getStatus(ServerName.fromExisting(server));
    if (status === 'not_found') runtime.list({ strict: true });
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
 * Why the proposed snapshot `next` may not replace the current assignments,
 * or null (#670). Only servers whose assignment changes (world, location, or
 * readable/undetermined) are checked: each must pass checkProposed (R1, R7)
 * and every one of them must be stopped (the error lists the running ones).
 */
export async function checkSnapshotChange(
  assignments: IWorldAssignmentPort,
  runtime: IContainerRuntimePort | undefined,
  next: WorldAssignmentSnapshot
): Promise<WorldAssignmentError | null> {
  const current = await assignments.snapshot();
  const key = (s: WorldAssignmentSnapshot, server: string) => {
    const a = s.assignments.find((x) => x.server === server);
    return a ? `${a.world}\0${!!a.internal}` : undefined;
  };
  const servers = new Set([...current.assignments, ...next.assignments].map((a) => a.server));
  for (const s of [...current.undetermined, ...next.undetermined]) servers.add(s);
  const changed = [...servers].sort().filter((s) => key(current, s) !== key(next, s));

  for (const server of changed) {
    const refused = checkProposed(next, server);
    if (refused) return refused;
  }
  const stopErrors = changed.map((s) => checkServerStopped(runtime, s)).filter((e) => e !== null);
  if (stopErrors.length === 1) return stopErrors[0]!;
  if (stopErrors.length > 1) {
    const names = stopErrors.flatMap((e) => e.servers);
    const code = stopErrors.some((e) => e.code === 'undetermined') ? 'undetermined' : 'server_running';
    return new WorldAssignmentError(
      code,
      `Servers ${names.map((n) => `'${n}'`).join(', ')} are not stopped; stop them before changing where their worlds live`,
      names
    );
  }
  return null;
}

/** No assignment port: assignment changes fail closed (R7). */
function noPort(): WorldAssignmentError {
  return new WorldAssignmentError('undetermined', 'World assignments cannot be read: no assignment port configured');
}

/** Why `server`'s config.env may not become `configEnv`, or null (#670). */
export async function checkConfigEnvChange(
  assignments: IWorldAssignmentPort | undefined,
  runtime: IContainerRuntimePort | undefined,
  server: string,
  configEnv: string
): Promise<WorldAssignmentError | null> {
  if (!assignments) return noPort();
  return checkSnapshotChange(assignments, runtime, await assignments.preview(server, configEnv));
}

/** Why the platform .env may not become `dotenv` (inherited EXTRA_ARGS), or null (#670). */
export async function checkPlatformEnvChange(
  assignments: IWorldAssignmentPort | undefined,
  runtime: IContainerRuntimePort | undefined,
  dotenv: string
): Promise<WorldAssignmentError | null> {
  if (!assignments) return noPort();
  return checkSnapshotChange(assignments, runtime, await assignments.previewPlatformEnv(dotenv));
}
