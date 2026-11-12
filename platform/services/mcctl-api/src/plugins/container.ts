/**
 * Composition root for mcctl-api (#667): the one place that builds adapters,
 * repositories and use cases. Routes take what they need from
 * `fastify.container`; tests pass fakes with `buildApp({ container })`.
 *
 * Lifetimes match what the routes did before the container existed:
 * - a method that builds per call is a factory (per request, or once per
 *   plugin when a route calls it at registration);
 * - a memoized method (marked "one per app") opens its SQLite handle on the
 *   first call and `close()` releases it when the app closes.
 */
import { join } from 'node:path';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import {
  AnvilBlockScanner,
  ApiPromptAdapter,
  AvahiHostnameRegistrarAdapter,
  BackupScheduleUseCase,
  BlueMapCliRenderer,
  BlueMapMarkerWriter,
  Config,
  ConfigEnvWorldAssignmentAdapter,
  ConfigSnapshotDatabase,
  ConfigSnapshotScheduleUseCaseImpl,
  CreateServerUseCase,
  DeleteServerUseCase,
  DockerComposeRuntimeAdapter,
  DockerRuntimeEnvironmentAdapter,
  DockerServerConsoleAdapter,
  FileServerSpecRepository,
  GetServerSummariesUseCase,
  GitWorldBackupAdapter,
  Paths,
  PlayerManagementUseCase,
  PlayerRepository,
  PlayerSessionUseCase,
  PrismarineWorldDataReader,
  RconCliAdapter,
  ServerRepository,
  SqliteBackupScheduleRepository,
  SqliteConfigSnapshotRepository,
  SqliteConfigSnapshotScheduleRepository,
  SqlitePlayerSessionRepository,
  WorldInfoUseCase,
  WorldManagementUseCase,
  WorldRepository,
  WorldStatsUseCase,
  YamlUserRepository,
  resolveHostIps,
  type IBackupScheduleUseCase,
  type IConfigSnapshotRepository,
  type IConfigSnapshotScheduleUseCase,
  type IContainerRuntimePort,
  type ICreateServerUseCase,
  type IGetServerSummariesUseCase,
  type IMapRenderer,
  type IPlayerManagementUseCase,
  type IPlayerSessionUseCase,
  type IWorldAssignmentPort,
  type IWorldBackupPort,
  type IWorldInfoUseCase,
  type IWorldRepository,
  type IWorldStatsUseCase,
} from '@minecraft-docker/shared';
import { config, childProcessEnv } from '../config/index.js';
import { resolveBlueMapDockerDir } from '../lib/docker-dir.js';
import { closeConfigSnapshotDatabase } from '../services/config-snapshot-service.js';

/** Request-specific values for the world use case's prompt adapter. */
export interface WorldUseCaseOptions {
  serverName?: string;
  worldName?: string;
  worldSeed?: string;
  confirmValue?: boolean;
}

export interface ApiContainer {
  /** POST /api/servers: the request's sudo password goes to avahi as an adapter option, never an env var. */
  createServerUseCase(options: { sudoPassword?: string; startTimeoutMs?: number }): ICreateServerUseCase;
  /** DELETE /api/servers/:name, with the request's sudo password as in create. */
  deleteServerUseCase(options: { sudoPassword?: string }): Pick<DeleteServerUseCase, 'deprovision'>;
  /** GET /api/servers?include=summary. One per app: its 10s TTL cache lives on it (#764). */
  serverSummariesUseCase(): IGetServerSummariesUseCase;
  containerRuntime(): IContainerRuntimePort;
  worldRepository(): IWorldRepository;
  worldAssignmentPort(): IWorldAssignmentPort;
  worldManagementUseCase(options?: WorldUseCaseOptions): WorldManagementUseCase;
  worldInfoUseCase(): IWorldInfoUseCase;
  worldStatsUseCase(): IWorldStatsUseCase;
  mapRenderer(): IMapRenderer;
  mapMarkerWriter(): Pick<BlueMapMarkerWriter, 'writeMarkers'>;
  worldBackupPort(): IWorldBackupPort;
  /** One per app (backup-schedules.db). */
  backupScheduleUseCase(): IBackupScheduleUseCase;
  /** One per app (config-snapshots.db, shared with configSnapshotRepository). */
  configSnapshotScheduleUseCase(): IConfigSnapshotScheduleUseCase;
  /** One per app (config-snapshots.db, shared with configSnapshotScheduleUseCase). */
  configSnapshotRepository(): IConfigSnapshotRepository;
  /** One per app (players.db). */
  playerSessionUseCase(): IPlayerSessionUseCase;
  /** One per app, on top of playerSessionUseCase. */
  playerManagementUseCase(): IPlayerManagementUseCase;
  userRepository(): Pick<YamlUserRepository, 'findByUsername' | 'verifyPassword'>;
}

/** Memoize a builder: the first call builds, later calls return the same value. */
function once<T>(build: () => T): { get: () => T; value: () => T | undefined } {
  let value: T | undefined;
  return { get: () => (value ??= build()), value: () => value };
}

/** The production container. `close()` releases the SQLite handles it opened. */
export function createApiContainer(): ApiContainer & { close(): void } {
  // Read on each build: tests point config.mcctlRoot at a temp root before buildApp.
  const root = () => config.mcctlRoot;
  const runtimeAt = (at: string, startTimeoutMs?: number) =>
    new DockerComposeRuntimeAdapter({
      root: at,
      env: () => childProcessEnv(),
      ...(startTimeoutMs !== undefined ? { startTimeoutMs } : {}),
    });

  const serverSummaries = once(() => {
    const paths = new Paths(root());
    return new GetServerSummariesUseCase(
      new ServerRepository(paths),
      runtimeAt(paths.root),
      new DockerServerConsoleAdapter()
    );
  });
  const backupScheduleRepository = once(
    () => new SqliteBackupScheduleRepository(join(root(), 'backups', 'meta', 'backup-schedules.db'))
  );
  const backupScheduleUseCase = once(() => new BackupScheduleUseCase(backupScheduleRepository.get()));
  const configSnapshotDatabase = once(
    () => new ConfigSnapshotDatabase(join(root(), 'backups', 'meta', 'config-snapshots.db'))
  );
  const configSnapshotScheduleUseCase = once(
    () => new ConfigSnapshotScheduleUseCaseImpl(new SqliteConfigSnapshotScheduleRepository(configSnapshotDatabase.get()))
  );
  const configSnapshotRepository = once(() => new SqliteConfigSnapshotRepository(configSnapshotDatabase.get()));
  const playerSessionRepository = once(
    () => new SqlitePlayerSessionRepository(join(root(), 'data', 'players.db'))
  );
  const playerSessionUseCase = once(() => new PlayerSessionUseCase(playerSessionRepository.get()));
  const playerManagementUseCase = once(
    () =>
      new PlayerManagementUseCase(
        new PlayerRepository(new Paths(root())),
        new RconCliAdapter(),
        playerSessionUseCase.get()
      )
  );

  // World paths resolve MCCTL_ROOT on each call (`new Paths()`), as the routes did.
  const container: ApiContainer = {
    createServerUseCase({ sudoPassword, startTimeoutMs }) {
      const paths = new Paths(root());
      // Image pulls and modpack downloads can take a while on the first start.
      const runtime = runtimeAt(paths.root, startTimeoutMs);
      return new CreateServerUseCase(
        new ApiPromptAdapter({}),
        new ServerRepository(paths),
        new Config(paths),
        {
          specRepo: new FileServerSpecRepository(paths, undefined, runtime),
          hostnames: new AvahiHostnameRegistrarAdapter({ sudoPassword }),
          runtime,
          hostIps: () => resolveHostIps(paths),
        },
        undefined,
        undefined,
        undefined,
        new ConfigEnvWorldAssignmentAdapter(paths)
      );
    },
    deleteServerUseCase({ sudoPassword }) {
      const paths = new Paths(root());
      const runtime = runtimeAt(paths.root);
      return new DeleteServerUseCase(new ApiPromptAdapter({}), new ServerRepository(paths), runtime, {
        specRepo: new FileServerSpecRepository(paths, undefined, runtime),
        hostnames: new AvahiHostnameRegistrarAdapter({ sudoPassword }),
      });
    },
    serverSummariesUseCase: serverSummaries.get,
    containerRuntime: () => runtimeAt(root()),
    worldRepository: () => new WorldRepository(new Paths()),
    worldAssignmentPort: () => new ConfigEnvWorldAssignmentAdapter(new Paths()),
    worldManagementUseCase(options) {
      const paths = new Paths();
      const prompt = new ApiPromptAdapter({
        serverName: options?.serverName,
        worldName: options?.worldName,
        worldSeed: options?.worldSeed,
        confirmValue: options?.confirmValue ?? true,
      });
      const runtime = runtimeAt(paths.root);
      // LEVEL and SEED writes go through the ServerSpec repository (#675), which checks the server is stopped
      const specRepo = new FileServerSpecRepository(paths, undefined, runtime);
      const assignments = new ConfigEnvWorldAssignmentAdapter(paths, specRepo);
      return new WorldManagementUseCase(
        prompt,
        new WorldRepository(paths, assignments),
        new ServerRepository(paths),
        assignments,
        runtime
      );
    },
    worldInfoUseCase: () =>
      new WorldInfoUseCase(new WorldRepository(new Paths()), new PrismarineWorldDataReader(), new RconCliAdapter()),
    worldStatsUseCase: () => new WorldStatsUseCase(new WorldRepository(new Paths()), new AnvilBlockScanner()),
    mapRenderer: () =>
      new BlueMapCliRenderer({
        worldsDir: new Paths().worlds,
        mapsDir: join(root(), 'maps'),
        dockerDir: resolveBlueMapDockerDir(root()),
      }),
    mapMarkerWriter: () => new BlueMapMarkerWriter(),
    worldBackupPort() {
      const at = root();
      return new GitWorldBackupAdapter({
        root: at,
        runtime: runtimeAt(at),
        environment: new DockerRuntimeEnvironmentAdapter(),
        console: new DockerServerConsoleAdapter(),
      });
    },
    backupScheduleUseCase: backupScheduleUseCase.get,
    configSnapshotScheduleUseCase: configSnapshotScheduleUseCase.get,
    configSnapshotRepository: configSnapshotRepository.get,
    playerSessionUseCase: playerSessionUseCase.get,
    playerManagementUseCase: playerManagementUseCase.get,
    userRepository: () => new YamlUserRepository(join(root(), 'users.yaml')),
  };

  return {
    ...container,
    close() {
      backupScheduleRepository.value()?.close();
      configSnapshotDatabase.value()?.close();
      playerSessionRepository.value()?.close();
      closeConfigSnapshotDatabase();
    },
  };
}

export interface ContainerPluginOptions {
  /** Replaces members of the production container (tests pass fakes here). */
  container?: Partial<ApiContainer>;
}

/**
 * Decorates `fastify.container`. Register it before the routes: its onClose
 * runs after theirs, so schedulers stop before their databases close.
 */
const containerPlugin: FastifyPluginAsync<ContainerPluginOptions> = async (fastify, opts) => {
  const defaults = createApiContainer();
  const container: ApiContainer = { ...defaults, ...opts.container };
  fastify.decorate('container', container);
  fastify.addHook('onClose', async () => {
    defaults.close();
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    container: ApiContainer;
  }
}

export default fp(containerPlugin, {
  name: 'container',
  fastify: '5.x',
});
