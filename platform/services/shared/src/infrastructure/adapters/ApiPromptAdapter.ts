import {
  ServerName,
  ServerType,
  McVersion,
  Memory,
  WorldOptions,
  Server,
  World,
} from '../../domain/index.js';
import type {
  IPromptPort,
  TextPromptOptions,
  SelectPromptOptions,
  ConfirmPromptOptions,
  PasswordPromptOptions,
  Spinner,
} from '../../application/ports/outbound/IPromptPort.js';
import type { WorldWithServerStatus } from '../../application/ports/outbound/IWorldRepository.js';

/**
 * World setup types for API options
 */
export type WorldSetupType = 'new' | 'existing' | 'download';

/**
 * Options for ApiPromptAdapter
 * Pre-configured values that would normally be collected via interactive prompts
 */
export interface ApiPromptOptions {
  /** Server name (e.g., "myserver") */
  serverName?: string;
  /** Server type (e.g., "PAPER", "FORGE") */
  serverType?: string;
  /** Minecraft version (e.g., "1.21.1", "LATEST") */
  mcVersion?: string;
  /** Memory allocation (e.g., "4G", "2048M") */
  memory?: string;
  /** World setup type */
  worldSetup?: WorldSetupType;
  /** World name for existing world */
  worldName?: string;
  /** World seed for new world */
  worldSeed?: string;
  /** World download URL */
  worldDownloadUrl?: string;
  /** Password value for password prompts */
  password?: string;
  /** Default value for confirm prompts (defaults to true) */
  confirmValue?: boolean;
}

/**
 * Message types for collected output
 */
export type MessageType = 'intro' | 'outro' | 'success' | 'error' | 'warn' | 'info' | 'note';

/**
 * Collected message
 */
export interface CollectedMessage {
  type: MessageType;
  message: string;
  title?: string;
}

/**
 * Error thrown when API mode operation is not supported
 */
export class ApiModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiModeError';
  }
}

/**
 * ApiPromptAdapter
 * Implements IPromptPort for API/non-interactive contexts.
 * Returns pre-configured values instead of interactive prompts.
 *
 * Usage:
 * ```typescript
 * const adapter = new ApiPromptAdapter({
 *   serverName: 'myserver',
 *   serverType: 'PAPER',
 *   mcVersion: '1.21.1',
 *   memory: '4G',
 *   worldSetup: 'new',
 * });
 *
 * // Use with UseCase
 * const useCase = new CreateServerUseCase(adapter, shell, serverRepo);
 * await useCase.execute({ mode: 'cli' }); // Uses pre-configured values
 * ```
 */
export class ApiPromptAdapter implements IPromptPort {
  private readonly options: ApiPromptOptions;
  private readonly messages: CollectedMessage[] = [];

  constructor(options: ApiPromptOptions) {
    this.options = options;
  }

  // ========================================
  // Basic Prompts
  // ========================================

  intro(message: string): void {
    this.messages.push({ type: 'intro', message });
  }

  outro(message: string): void {
    this.messages.push({ type: 'outro', message });
  }

  async text(options: TextPromptOptions): Promise<string> {
    // Try to match the prompt message to a known option
    const value = this.resolveTextValue(options.message);
    if (value !== undefined) {
      return value;
    }

    throw new ApiModeError(
      `Value for prompt "${options.message}" is required in API mode. ` +
        'Please provide the appropriate option when creating ApiPromptAdapter.'
    );
  }

  async select<T>(options: SelectPromptOptions<T>): Promise<T> {
    // Try to match based on message context
    const value = this.resolveSelectValue(options.message);
    if (value !== undefined) {
      // Verify the value is in the options list
      const found = options.options.find((opt) => {
        if (typeof opt.value === 'string') {
          return opt.value.toLowerCase() === String(value).toLowerCase();
        }
        return opt.value === value;
      });
      if (found) {
        return found.value;
      }
    }

    // Return first option as fallback if available
    if (options.options.length > 0 && options.initialValue !== undefined) {
      return options.initialValue;
    }

    throw new ApiModeError(
      `Selection for prompt "${options.message}" is required in API mode.`
    );
  }

  async confirm(_options: ConfirmPromptOptions): Promise<boolean> {
    // Default to true in API mode unless explicitly configured
    return this.options.confirmValue ?? true;
  }

  async password(_options: PasswordPromptOptions): Promise<string> {
    if (this.options.password !== undefined) {
      return this.options.password;
    }

    throw new ApiModeError('Password is required in API mode.');
  }

  // ========================================
  // Domain-Specific Prompts
  // ========================================

  async promptServerName(): Promise<ServerName> {
    if (!this.options.serverName) {
      throw new ApiModeError('serverName is required in API mode');
    }
    return ServerName.create(this.options.serverName);
  }

  async promptServerType(): Promise<ServerType> {
    if (!this.options.serverType) {
      throw new ApiModeError('serverType is required in API mode');
    }
    return ServerType.create(this.options.serverType);
  }

  async promptMcVersion(_serverType: ServerType): Promise<McVersion> {
    if (!this.options.mcVersion) {
      throw new ApiModeError('mcVersion is required in API mode');
    }
    return McVersion.create(this.options.mcVersion);
  }

  async promptMemory(): Promise<Memory> {
    if (!this.options.memory) {
      throw new ApiModeError('memory is required in API mode');
    }
    return Memory.create(this.options.memory);
  }

  async promptWorldOptions(): Promise<WorldOptions> {
    if (!this.options.worldSetup) {
      throw new ApiModeError('worldSetup is required in API mode');
    }

    switch (this.options.worldSetup) {
      case 'new':
        return WorldOptions.newWorld(this.options.worldSeed);

      case 'existing':
        if (!this.options.worldName) {
          throw new ApiModeError(
            'worldName is required when worldSetup is "existing"'
          );
        }
        return WorldOptions.existingWorld(this.options.worldName);

      case 'download':
        if (!this.options.worldDownloadUrl) {
          throw new ApiModeError(
            'worldDownloadUrl is required when worldSetup is "download"'
          );
        }
        return WorldOptions.downloadWorld(this.options.worldDownloadUrl);

      default:
        throw new ApiModeError(`Invalid worldSetup: ${this.options.worldSetup}`);
    }
  }

  async promptServerSelection(servers: Server[]): Promise<Server> {
    if (!this.options.serverName) {
      throw new ApiModeError('serverName is required in API mode for server selection');
    }

    const server = servers.find(
      (s) => s.name.value.toLowerCase() === this.options.serverName!.toLowerCase()
    );

    if (!server) {
      throw new ApiModeError(`Server '${this.options.serverName}' not found`);
    }

    return server;
  }

  async promptWorldSelection(worlds: World[]): Promise<World> {
    if (!this.options.worldName) {
      throw new ApiModeError('worldName is required in API mode for world selection');
    }

    const world = worlds.find(
      (w) => w.name.toLowerCase() === this.options.worldName!.toLowerCase()
    );

    if (!world) {
      throw new ApiModeError(`World '${this.options.worldName}' not found`);
    }

    return world;
  }

  async promptExistingWorldSelection(
    worlds: WorldWithServerStatus[]
  ): Promise<World | null> {
    // If no worldName is configured, return null (no selection)
    if (!this.options.worldName) {
      return null;
    }

    const worldEntry = worlds.find(
      (w) => w.world.name.toLowerCase() === this.options.worldName!.toLowerCase()
    );

    if (!worldEntry) {
      throw new ApiModeError(`World '${this.options.worldName}' not found`);
    }

    // In API mode, we don't warn about stopped servers - caller should check
    return worldEntry.world;
  }

  // ========================================
  // Status Display
  // ========================================

  spinner(): Spinner {
    // Return a no-op spinner for API mode
    return {
      start: (_message?: string) => {},
      stop: (_message?: string) => {},
      message: (_message: string) => {},
    };
  }

  success(message: string): void {
    this.messages.push({ type: 'success', message });
  }

  error(message: string): void {
    this.messages.push({ type: 'error', message });
  }

  warn(message: string): void {
    this.messages.push({ type: 'warn', message });
  }

  info(message: string): void {
    this.messages.push({ type: 'info', message });
  }

  note(message: string, title?: string): void {
    this.messages.push({ type: 'note', message, title });
  }

  // ========================================
  // Utility
  // ========================================

  isCancel(_value: unknown): boolean {
    // In API mode, there's no user interaction to cancel
    return false;
  }

  handleCancel(): never {
    throw new ApiModeError('Cancel not supported in API mode');
  }

  // ========================================
  // API-specific methods
  // ========================================

  /**
   * Get all collected messages
   */
  getMessages(): CollectedMessage[] {
    return [...this.messages];
  }

  /**
   * Clear collected messages
   */
  clearMessages(): void {
    this.messages.length = 0;
  }

  // ========================================
  // Private Helpers
  // ========================================

  /**
   * Resolve text prompt value from options based on message context
   */
  private resolveTextValue(message: string): string | undefined {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('server name')) {
      return this.options.serverName;
    }
    if (lowerMessage.includes('version')) {
      return this.options.mcVersion;
    }
    if (lowerMessage.includes('memory')) {
      return this.options.memory;
    }
    if (lowerMessage.includes('world') && lowerMessage.includes('name')) {
      return this.options.worldName;
    }
    if (lowerMessage.includes('seed')) {
      return this.options.worldSeed;
    }
    if (lowerMessage.includes('url')) {
      return this.options.worldDownloadUrl;
    }
    if (lowerMessage.includes('password')) {
      return this.options.password;
    }

    return undefined;
  }

  /**
   * Resolve select prompt value from options based on message context
   */
  private resolveSelectValue(message: string): string | undefined {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('server type') || lowerMessage.includes('type')) {
      return this.options.serverType;
    }
    if (lowerMessage.includes('version')) {
      return this.options.mcVersion;
    }
    if (lowerMessage.includes('memory')) {
      return this.options.memory;
    }
    if (lowerMessage.includes('world') && lowerMessage.includes('setup')) {
      return this.options.worldSetup;
    }

    return undefined;
  }
}
