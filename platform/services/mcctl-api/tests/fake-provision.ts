/**
 * A fake CreateServerUseCase for POST /api/servers tests (#675). The route
 * builds its use case through fastify.container.createServerUseCase (#667);
 * tests build the app with `container: provisionContainer` and replace
 * `provision.create` so no test ever writes server files, runs docker or calls sudo.
 */
import type { CreateServerConfig, CreateServerRunOptions, Server } from '@minecraft-docker/shared';
import { createApiContainer, type ApiContainer } from '../src/plugins/container.js';

const production = createApiContainer();

/** The create/delete use case factories the app uses; the production ones until a test replaces them. */
export const provision: {
  create: ApiContainer['createServerUseCase'];
  delete: ApiContainer['deleteServerUseCase'];
} = {
  create: production.createServerUseCase,
  delete: production.deleteServerUseCase,
};

/** Pass to buildApp({ container }) so the app reads `provision` on each request. */
export const provisionContainer: Partial<ApiContainer> = {
  createServerUseCase: (options) => provision.create(options),
  deleteServerUseCase: (options) => provision.delete(options),
};

export interface ProvisionCall {
  config: CreateServerConfig;
  sudoPassword?: string;
}

/** What the fake does for one create; the default reports the three stages and succeeds. */
export type ProvisionBehaviour = (config: CreateServerConfig, run: CreateServerRunOptions) => Promise<void>;

export const reportStages: ProvisionBehaviour = async (config, run) => {
  run.onProgress?.('creating', 'Creating server directory...');
  run.onProgress?.('configuring', 'Registering mDNS hostname...');
  if (config.autoStart !== false) run.onProgress?.('starting', 'Starting container...');
};

/** Install the fake; returns the recorded calls. Call again to change the behaviour. */
export function fakeProvision(behaviour: ProvisionBehaviour = reportStages): ProvisionCall[] {
  const calls: ProvisionCall[] = [];
  provision.create = ({ sudoPassword }) => ({
    execute: () => Promise.reject(new Error('interactive create is not used by the API')),
    executeWithConfig: async (config: CreateServerConfig, run: CreateServerRunOptions = {}) => {
      calls.push({ config, sudoPassword });
      await behaviour(config, run);
      return { name: { value: config.name } } as unknown as Server;
    },
  });
  return calls;
}

export interface DeleteCall {
  name: string;
  deleteWorld?: boolean;
  sudoPassword?: string;
}

/**
 * A fake DELETE /api/servers/:name deprovision (#735), the delete twin of
 * fakeProvision: no docker, sudo or file changes. Returns the recorded calls.
 */
export function fakeDelete(behaviour: (name: string) => Promise<void> = async () => {}): DeleteCall[] {
  const calls: DeleteCall[] = [];
  provision.delete = ({ sudoPassword }) => ({
    deprovision: async (name: string, options: { deleteWorld?: boolean } = {}) => {
      calls.push({ name, deleteWorld: options.deleteWorld, sudoPassword });
      await behaviour(name);
      return { movedWorlds: [], deletedWorlds: [] };
    },
  });
  return calls;
}
