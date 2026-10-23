import {
  WorldManagementUseCase,
  ApiPromptAdapter,
  ShellAdapter,
  WorldRepository,
  ServerRepository,
  ConfigEnvWorldAssignmentAdapter,
  DockerComposeRuntimeAdapter,
  Paths,
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
