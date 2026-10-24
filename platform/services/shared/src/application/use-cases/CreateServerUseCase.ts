import {
  Server,
  ServerName,
  ServerType,
  McVersion,
  Memory,
  WorldOptions,
  WorldSetupType,
  ModpackOptions,
  WorldAssignmentError,
  checkAssign,
  buildCreateSpec,
  MC_VERSION_INPUT_PATTERN,
  ServerSpecError,
  assertServerSpecDocument,
  type ServerSpecDocument,
} from '../../domain/index.js';
import { AuditActionEnum } from '../../domain/value-objects/AuditAction.js';
import { Config, type Paths } from '../../utils/index.js';
import type {
  ICreateServerUseCase,
  CreateServerConfig,
  IPromptPort,
  IShellPort,
  IServerRepository,
  IWorldRepository,
  IAuditLogPort,
  IModSourcePort,
  IWorldAssignmentPort,
  IPlatformSettingsPort,
  CreateServerRunOptions,
  IServerSpecRepository,
  IHostnameRegistrarPort,
  IContainerRuntimePort,
} from '../ports/index.js';
import type { CreateServerOptions } from '../ports/outbound/IShellPort.js';

/**
 * What TypeScript provisioning needs (#675, ADR-0003 §5). Without it create
 * fails: create-server.sh was removed.
 */
export interface ServerProvisionDeps {
  specRepo: IServerSpecRepository;
  /** avahi `<name>.local`; skipped when absent. */
  hostnames?: IHostnameRegistrarPort;
  /** Starts the new server unless autoStart is false. */
  runtime?: IContainerRuntimePort;
  /** Host addresses; the first one is announced for `<name>.local`. */
  hostIps?: () => string[];
}

/**
 * The server was created but did not start (ADR-0003 decision 1). It stays
 * created: the CLI exits 1 with the cause, the API answers success with
 * `server.status: 'created'` and a warning.
 */
export class ServerStartError extends Error {
  constructor(
    readonly server: Server,
    readonly reason: string
  ) {
    super(`Server '${server.name.value}' was created but did not start: ${reason}. Start it with: mcctl start ${server.name.value}`);
    this.name = 'ServerStartError';
  }
}

/**
 * The create input as value objects, before anything is checked against the
 * platform. Pure: the API runs it before it opens an event stream. An input
 * they refuse is ServerSpecError invalid_spec (the API answers 400), never a
 * plain Error.
 * @param options.versionText accept a snapshot or pre-release McVersion cannot
 *   model, written as given (TypeScript provisioning only, #675).
 */
export function parseCreateServerConfig(config: CreateServerConfig, options: { versionText?: boolean } = {}) {
  try {
    const parsed = parseConfigValues(config, options.versionText ?? false);
    // The spec it writes, under the create rules: also every value config.env must hold (#675)
    assertServerSpecDocument(createSpecDocument(parsed.name, parsed.createOptions, parsed.versionToWrite), 'create', {
      server: parsed.name.value,
      file: `servers/${parsed.name.value}/server.yaml`,
    });
    return parsed;
  } catch (error) {
    if (error instanceof ServerSpecError) throw error;
    throw new ServerSpecError('invalid_spec', error instanceof Error ? error.message : String(error), config.name);
  }
}

function parseConfigValues(config: CreateServerConfig, allowVersionText: boolean) {
  const name = ServerName.create(config.name);
  const type = config.type
    ? ServerType.create(config.type)
    : ServerType.getRecommended();

  // Validate modpack requirements
  if (type.isModpack && !config.modpackSlug) {
    throw new Error(`Modpack slug is required for ${type.label} server type`);
  }

  // Snapshots and pre-releases (24w14a, 1.20.5-rc1) are valid requests that
  // McVersion cannot model: provisioning writes the text as given (#675).
  let versionText: string | undefined;
  let version: McVersion;
  try {
    version = config.version ? McVersion.create(config.version) : McVersion.latest();
  } catch (error) {
    if (!allowVersionText || !MC_VERSION_INPUT_PATTERN.test(config.version!)) throw error;
    version = McVersion.latest();
    versionText = config.version;
  }
  const memory = config.memory
    ? Memory.create(config.memory)
    : type.isModpack
      ? Memory.create('6G') // Default 6G for modpacks
      : Memory.default();

  // Determine world options
  let worldOptions: WorldOptions;
  if (config.worldUrl) {
    worldOptions = WorldOptions.downloadWorld(config.worldUrl);
  } else if (config.worldName) {
    worldOptions = WorldOptions.existingWorld(config.worldName);
  } else if (config.seed) {
    worldOptions = WorldOptions.newWorld(config.seed);
  } else {
    worldOptions = WorldOptions.default();
  }

  // Whitelist is off unless explicitly enabled or players are given;
  // an explicit false always wins
  const enableWhitelist =
    config.enableWhitelist ?? (config.whitelistPlayers?.length ?? 0) > 0;

  // Build modpack options if this is a modpack server
  const modpackOptions =
    type.isModpack && config.modpackSlug
      ? ModpackOptions.modrinth(config.modpackSlug, {
          version: config.modpackVersion,
          loader: config.modLoader,
          excludeFiles: config.modpackExcludeFiles,
        })
      : undefined;

  // Create server
  const server = Server.create({
    name,
    type,
    version,
    memory,
    worldOptions,
    modpackOptions,
  });

  // What provisioning writes. The modpack decides the Minecraft version unless
  // one is given (no VERSION); a given LATEST is written.
  const versionToWrite = !config.version && type.isModpack ? undefined : versionText ?? version.value;
  const createOptions: CreateServerOptions = {
    type,
    version,
    worldOptions,
    memory,
    autoStart: config.autoStart ?? true,
    modpackSlug: config.modpackSlug,
    modpackVersion: config.modpackVersion,
    modLoader: config.modLoader,
    modpackExcludeFiles: modpackOptions?.excludeFiles,
    enableWhitelist,
    whitelistPlayers: config.whitelistPlayers,
    playitDomain: config.playitDomain,
    noPlayitDomain: config.noPlayitDomain,
  };
  return { name, type, version, memory, worldOptions, enableWhitelist, server, createOptions, versionToWrite };
}

/**
 * The ServerSpec document a create writes (pure).
 * @param version VERSION as written; undefined writes none (the modpack decides).
 */
function createSpecDocument(name: ServerName, options: CreateServerOptions, version: string | undefined): ServerSpecDocument {
  const { type, worldOptions } = options;
  return buildCreateSpec({
    name: name.value,
    type: type.value,
    version,
    memory: (options.memory ?? (type.isModpack ? Memory.create('6G') : Memory.default())).formatted,
    seed: worldOptions.setupType === WorldSetupType.NEW ? worldOptions.seed : undefined,
    worldUrl: worldOptions.setupType === WorldSetupType.DOWNLOAD ? worldOptions.downloadUrl : undefined,
    worldName: worldOptions.setupType === WorldSetupType.EXISTING ? worldOptions.worldName : undefined,
    modpackSlug: options.modpackSlug,
    modpackVersion: options.modpackVersion,
    modLoader: options.modLoader,
    modpackExcludeFiles: options.modpackExcludeFiles,
    enableWhitelist: options.enableWhitelist,
    whitelistPlayers: options.whitelistPlayers,
    playitDomain: options.playitDomain,
  });
}

/**
 * Create Server Use Case
 * Orchestrates interactive server creation flow
 */
export class CreateServerUseCase implements ICreateServerUseCase {
  private readonly config: IPlatformSettingsPort;

  /**
   * @param settings Platform settings (#665). Passing `Paths`, or nothing, is the
   *   deprecated v2 form: `.mcctl.json` is then read under those paths.
   */
  constructor(
    private readonly prompt: IPromptPort,
    private readonly shell: IShellPort,
    private readonly serverRepo: IServerRepository,
    settings?: IPlatformSettingsPort | Paths,
    private readonly worldRepo?: IWorldRepository,
    private readonly auditLog?: IAuditLogPort,
    private readonly modSource?: IModSourcePort,
    private readonly assignments?: IWorldAssignmentPort,
    private readonly provision?: ServerProvisionDeps
  ) {
    this.config = settings && 'load' in settings ? settings : new Config(settings);
  }

  /**
   * R1 for the world the new server will use (#670): `--world`, else its
   * default world `<name>`, which a deleted server of the same name may have
   * left assigned to someone else. Adopting a free worlds/<name> stays allowed.
   * Without an assignment port, creation fails closed (R7).
   */
  private async assertWorldAssignable(worldOptions: WorldOptions, name: ServerName): Promise<void> {
    const world =
      worldOptions.setupType === WorldSetupType.EXISTING && worldOptions.worldName
        ? worldOptions.worldName
        : name.value;
    if (!this.assignments) {
      throw new WorldAssignmentError('undetermined', 'World assignments cannot be read: no assignment port configured');
    }
    const refused = checkAssign(await this.assignments.snapshot(), world, name.value, { newServer: true });
    if (refused) throw refused;
  }

  /**
   * Write the new server's files and bring it up: TypeScript provisioning
   * (ADR-0003 §5) when provision deps are given, else create-server.sh.
   * Rejects when the server was not created; a start failure is returned.
   * @param version VERSION as written; undefined writes none (the modpack decides).
   */
  private async createFiles(
    name: ServerName,
    options: CreateServerOptions,
    run: CreateServerRunOptions,
    version: string | undefined
  ): Promise<{ startError?: string }> {
    if (!this.provision) {
      // create-server.sh was removed in #675; the shell port is kept for v2 callers (#736).
      throw new Error('create-server.sh was removed in #675; pass specRepo / use ServerSpec provision');
    }
    const { specRepo, hostnames, runtime, hostIps } = this.provision;

    run.onProgress?.('creating', 'Creating server directory...');
    await specRepo.write(createSpecDocument(name, options, version), { create: true });

    run.onProgress?.('configuring', 'Registering mDNS hostname...');
    if (hostnames) {
      const ip = hostIps?.()[0];
      const result = ip
        ? await hostnames.register(`${name.value}.local`, ip)
        : { status: 'skipped' as const, reason: 'could not determine the host address (set HOST_IP in .env)' };
      if (result.status === 'skipped') run.onLog?.(`Warning: mDNS registration of ${name.value}.local skipped: ${result.reason}`);
    }

    if (options.autoStart === false) return {};
    run.onProgress?.('starting', 'Starting container...');
    if (!runtime) return { startError: 'no container runtime configured' };
    const started = await runtime.start(name);
    return started.success ? {} : { startError: started.error || started.stderr?.trim() || 'the container did not start' };
  }

  /**
   * Execute interactive server creation
   */
  async execute(): Promise<Server> {
    this.prompt.intro('Create Minecraft Server');

    try {
      // Prompt for server name
      const name = await this.prompt.promptServerName();

      // Check if server already exists
      if (await this.serverRepo.exists(name.value)) {
        this.prompt.error(`Server '${name.value}' already exists`);
        this.prompt.handleCancel();
      }

      // Prompt for server type
      const type = await this.prompt.promptServerType();

      // For modpack servers, prompt for modpack details
      let modpackSlug: string | undefined;
      let modpackVersion: string | undefined;
      let modLoader: string | undefined;
      let modpackExcludeFiles: string[] | undefined;

      if (type.isModpack) {
        modpackSlug = await this.prompt.promptModpackSlug();

        // Fetch supported loaders from mod source API
        let availableLoaders: string[] | undefined;
        if (this.modSource && modpackSlug) {
          try {
            const versions = await this.modSource.getVersions(modpackSlug);
            const loaderSet = new Set<string>();
            for (const v of versions) {
              for (const loader of v.loaders) {
                loaderSet.add(loader);
              }
            }
            if (loaderSet.size > 0) {
              availableLoaders = [...loaderSet];
            }
          } catch {
            // Fallback: show all loaders if API call fails
          }
        }

        modLoader = await this.prompt.promptModpackLoader(availableLoaders);
        modpackVersion = await this.prompt.promptModpackVersion();
        modpackExcludeFiles = await this.prompt.promptModpackExcludeFiles();
      }

      // Prompt for Minecraft version (skip for modpack servers)
      const version = type.isModpack
        ? McVersion.latest() // Modpack determines version
        : await this.prompt.promptMcVersion(type);

      // Prompt for world options
      let worldOptions = await this.prompt.promptWorldOptions();

      // If "existing" was selected and we have a world repository,
      // show the enhanced world selection with availability status
      if (
        worldOptions.setupType === WorldSetupType.EXISTING &&
        this.worldRepo
      ) {
        const worldsWithStatus = await this.worldRepo.findAllWithServerStatus();
        const selectedWorld =
          await this.prompt.promptExistingWorldSelection(worldsWithStatus);

        if (selectedWorld) {
          worldOptions = WorldOptions.existingWorld(selectedWorld.name);
        } else {
          // User cancelled or no world available, fallback to new world
          this.prompt.info('Creating a new world instead');
          worldOptions = WorldOptions.newWorld();
        }
      }

      // Prompt for memory (6G default for modpacks)
      const memory = await this.prompt.promptMemory(type.isModpack ? '6G' : '4G');

      // Whitelist is off by default; ask for players only when enabled
      const enableWhitelist = await this.prompt.confirm({
        message: 'Enable whitelist?',
        initialValue: false,
      });
      const whitelistPlayers = enableWhitelist
        ? await this.prompt.promptWhitelistPlayers()
        : [];

      // Prompt for playit.gg external domain if playit is enabled
      let playitDomain: string | undefined;
      const mcctlConfig = this.config.load();
      if (mcctlConfig?.playitEnabled) {
        const shouldRegisterDomain = await this.prompt.confirm({
          message: 'Register external domain for playit.gg?',
          initialValue: false,
        });

        if (shouldRegisterDomain) {
          playitDomain = await this.prompt.text({
            message: 'External domain:',
            placeholder: 'aa.example.com',
            validate: (value) => {
              if (!value) return 'Domain is required';
              // Basic domain validation
              if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(value)) {
                return 'Invalid domain format';
              }
              return undefined;
            },
          });

          if (playitDomain) {
            this.prompt.success(`External domain registered: ${playitDomain}`);
          }
        }
      }

      // Build modpack options if this is a modpack server
      const modpackOptions =
        type.isModpack && modpackSlug
          ? ModpackOptions.modrinth(modpackSlug, {
              version: modpackVersion,
              loader: modLoader,
              excludeFiles: modpackExcludeFiles,
            })
          : undefined;

      // Create server configuration
      const server = Server.create({
        name,
        type,
        version,
        memory,
        worldOptions,
        modpackOptions,
      });

      // Failures below reject without printing: the caller reports them once (mcctl create).
      await this.assertWorldAssignable(worldOptions, name);

      // Execute creation - stop spinner before running script to avoid output conflicts
      const spinner = this.prompt.spinner();
      spinner.start('Creating server...');
      spinner.stop('Writing server files...');

      let startError: string | undefined;
      // A modpack is asked no Minecraft version: it decides (no VERSION).
      const versionToWrite = type.isModpack ? undefined : version.value;
      const result = await this.createFiles(name, {
        type,
        version,
        worldOptions,
        memory,
        autoStart: true,
        modpackSlug,
        modpackVersion,
        modLoader,
        modpackExcludeFiles: modpackOptions?.excludeFiles,
        enableWhitelist,
        whitelistPlayers,
        playitDomain,
      }, {
        onProgress: (_stage, message) => this.prompt.info(message),
        onLog: (line) => this.prompt.warn(line),
      }, versionToWrite).then(
        (r) => {
          startError = r.startError;
          return { success: true, stderr: '' };
        },
        (error: unknown) => ({ success: false, stderr: error instanceof Error ? error.message : String(error) })
      );

      if (!result.success) {
        // Log audit failure
        await this.auditLog?.log({
          action: AuditActionEnum.SERVER_CREATE,
          actor: 'cli:local',
          targetType: 'server',
          targetName: name.value,
          status: 'failure',
          errorMessage: result.stderr || 'Unknown error occurred',
          details: null,
        });
        throw new Error(result.stderr || 'Server creation failed');
      }

      // Log audit success
      await this.auditLog?.log({
        action: AuditActionEnum.SERVER_CREATE,
        actor: 'cli:local',
        targetType: 'server',
        targetName: name.value,
        status: 'success',
        details: {
          type: type.value,
          version: version.value,
          memory: memory.value,
          enableWhitelist,
          whitelistPlayers: whitelistPlayers.length > 0 ? whitelistPlayers : undefined,
        },
        errorMessage: null,
      });

      if (startError) throw new ServerStartError(server, startError);

      this.prompt.success(`Server '${name.value}' created!`);

      const whitelistInfo = !enableWhitelist
        ? 'Whitelist: disabled'
        : whitelistPlayers.length > 0
          ? `Whitelist: enabled (${whitelistPlayers.join(', ')})`
          : 'Whitelist: enabled';
      this.prompt.note(
        `Connect via: ${name.hostname}:25565\n${whitelistInfo}`,
        'Connection Info'
      );

      this.prompt.outro('Happy mining!');

      return server;
    } catch (error) {
      if (this.prompt.isCancel(error)) {
        this.prompt.outro('Server creation cancelled');
        throw error;
      }
      throw error;
    }
  }

  /**
   * Execute server creation with provided configuration
   */
  async executeWithConfig(config: CreateServerConfig, options: CreateServerRunOptions = {}): Promise<Server> {
    const { name, type, version, memory, worldOptions, enableWhitelist, server, createOptions, versionToWrite } =
      parseCreateServerConfig(config, { versionText: !!this.provision });

    // Check if server already exists
    if (await this.serverRepo.exists(name.value)) {
      throw new Error(`Server '${name.value}' already exists`);
    }

    await this.assertWorldAssignable(worldOptions, name);

    // Execute creation
    let startError: string | undefined;
    const result = await this.createFiles(name, createOptions, options, versionToWrite).then(
      (r) => {
        startError = r.startError;
        return { success: true, stderr: '' };
      },
      (error: unknown) => ({ success: false, stderr: error instanceof Error ? error.message : String(error), error })
    );

    if (!result.success) {
      // Log audit failure
      await this.auditLog?.log({
        action: AuditActionEnum.SERVER_CREATE,
        actor: 'cli:local',
        targetType: 'server',
        targetName: name.value,
        status: 'failure',
        errorMessage: result.stderr || 'Server creation failed',
        details: null,
      });
      // Keep a typed provisioning error (ServerSpecError, WorldAssignmentError) for the caller.
      if ('error' in result && result.error instanceof Error) throw result.error;
      throw new Error(result.stderr || 'Server creation failed');
    }

    // Log audit success
    await this.auditLog?.log({
      action: AuditActionEnum.SERVER_CREATE,
      actor: 'cli:local',
      targetType: 'server',
      targetName: name.value,
      status: 'success',
      details: {
        type: type.value,
        version: version.value,
        memory: memory.value,
        enableWhitelist,
        whitelistPlayers: config.whitelistPlayers,
      },
      errorMessage: null,
    });

    if (startError) throw new ServerStartError(server, startError);
    return server;
  }
}
