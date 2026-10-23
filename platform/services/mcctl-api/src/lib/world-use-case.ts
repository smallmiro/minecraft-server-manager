import {
  WorldManagementUseCase,
  ApiPromptAdapter,
  ShellAdapter,
  WorldRepository,
  ServerRepository,
  ConfigEnvWorldAssignmentAdapter,
  DockerComposeRuntimeAdapter,
  Paths,
  type WorldAssignmentErrorCode,
} from '@minecraft-docker/shared';
import { childProcessEnv } from '../config/index.js';

/**
 * Create WorldManagementUseCase instance with API adapters
 */
export function createWorldUseCase(options?: {
  serverName?: string;
  worldName?: string;
  worldSeed?: string;
  confirmValue?: boolean;
}): WorldManagementUseCase {
  const paths = new Paths();
  const prompt = new ApiPromptAdapter({
    serverName: options?.serverName,
    worldName: options?.worldName,
    worldSeed: options?.worldSeed,
    confirmValue: options?.confirmValue ?? true,
  });
  const shell = new ShellAdapter({ paths });
  // #670: assignments come from each server's LEVEL; D2 moves these into its container plugin
  const assignments = new ConfigEnvWorldAssignmentAdapter(paths);
  const runtime = new DockerComposeRuntimeAdapter({ root: paths.root, env: () => childProcessEnv() });
  const worldRepo = new WorldRepository(paths, assignments);
  const serverRepo = new ServerRepository(paths);

  return new WorldManagementUseCase(prompt, shell, worldRepo, serverRepo, assignments, runtime);
}

/**
 * HTTP status and body for a failed world operation (#670): invalid_world ->
 * 400, server_not_found or a missing world -> 404, every other assignment
 * refusal (conflict, undetermined, server_running, ...) -> 409.
 */
export function worldFailure(
  result: { error?: string; errorCode?: WorldAssignmentErrorCode },
  fallback: string
): { status: 400 | 404 | 409; body: { error: string; message: string } } {
  const message = result.error || fallback;
  if (result.errorCode === 'invalid_world') return { status: 400, body: { error: 'BadRequest', message } };
  if (result.errorCode === 'server_not_found' || (!result.errorCode && / not found$/.test(message))) {
    return { status: 404, body: { error: 'NotFound', message } };
  }
  if (result.errorCode) return { status: 409, body: { error: 'Conflict', message } };
  return { status: 400, body: { error: 'BadRequest', message } };
}
