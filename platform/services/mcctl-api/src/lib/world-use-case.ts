import {
  WorldManagementUseCase,
  ApiPromptAdapter,
  WorldRepository,
  ServerRepository,
  ConfigEnvWorldAssignmentAdapter,
  DockerComposeRuntimeAdapter,
  FileServerSpecRepository,
  Paths,
  type ServerSpecErrorCode,
  type WorldAssignmentErrorCode,
} from '@minecraft-docker/shared';
import { childProcessEnv } from '../config/index.js';
import { serverSpecFailure } from './server-spec.js';

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
  // #670: assignments come from each server's LEVEL; D2 moves these into its container plugin
  const runtime = new DockerComposeRuntimeAdapter({ root: paths.root, env: () => childProcessEnv() });
  // LEVEL and SEED writes go through the ServerSpec repository (#675), which checks the server is stopped
  const specRepo = new FileServerSpecRepository(paths, undefined, runtime);
  const assignments = new ConfigEnvWorldAssignmentAdapter(paths, specRepo);
  const worldRepo = new WorldRepository(paths, assignments);
  const serverRepo = new ServerRepository(paths);

  // No shell: SEED is written with LEVEL by the assignment port (#734)
  return new WorldManagementUseCase(prompt, undefined, worldRepo, serverRepo, assignments, runtime);
}

/**
 * HTTP status and body for a failed world operation (#670): invalid_world ->
 * 400, server_not_found or a missing world -> 404, every other assignment
 * refusal (conflict, undetermined, server_running, ...) -> 409. A refused
 * ServerSpec write (#675) maps as serverSpecFailure.
 */
export function worldFailure(
  result: { error?: string; errorCode?: WorldAssignmentErrorCode; specErrorCode?: ServerSpecErrorCode },
  fallback: string
): { status: 400 | 404 | 409; body: { error: string; message: string } } {
  const message = result.error || fallback;
  if (result.specErrorCode) return serverSpecFailure({ code: result.specErrorCode, message });
  if (result.errorCode === 'invalid_world') return { status: 400, body: { error: 'BadRequest', message } };
  if (result.errorCode === 'server_not_found' || (!result.errorCode && / not found$/.test(message))) {
    return { status: 404, body: { error: 'NotFound', message } };
  }
  if (result.errorCode) return { status: 409, body: { error: 'Conflict', message } };
  return { status: 400, body: { error: 'BadRequest', message } };
}
