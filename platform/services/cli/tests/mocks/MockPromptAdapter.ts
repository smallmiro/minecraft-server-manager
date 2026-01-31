import type {
  IPromptPort,
  TextPromptOptions,
  SelectPromptOptions,
  ConfirmPromptOptions,
  PasswordPromptOptions,
  Spinner,
} from '../../src/application/ports/outbound/IPromptPort.js';
import {
  ServerName,
  ServerType,
  McVersion,
  Memory,
  WorldOptions,
  Server,
  World,
} from '../../src/domain/index.js';

/**
 * Mock prompt values for testing
 */
export interface MockPromptValues {
  serverName?: string;
  serverType?: string;
  version?: string;
  memory?: string;
  worldSetup?: 'new' | 'new-seed' | 'existing' | 'download';
  worldSeed?: string;
  worldName?: string;
  worldUrl?: string;
  confirm?: boolean;
  text?: string;
  password?: string;
  selectIndex?: number;
}

/**
 * Mock Prompt Adapter for testing
 * Provides predefined answers instead of interactive prompts
 */
export class MockPromptAdapter implements IPromptPort {
  private values: MockPromptValues;
  private _introMessage: string | null = null;
  private _outroMessage: string | null = null;
  private _messages: string[] = [];
  private _spinnerMessages: string[] = [];
  private _cancelled = false;
  private _textIndex = 0;

  /**
   * Set multiple text values for sequential text prompts
   */
  textValues: string[] = [];

  constructor(values: MockPromptValues = {}) {
    this.values = {
      serverName: 'testserver',
      serverType: 'PAPER',
      version: '1.21.1',
      memory: '4G',
      worldSetup: 'new',
      confirm: true,
      ...values,
    };
  }

  // ========================================
  // Testing Helpers
  // ========================================

  get introMessage(): string | null {
    return this._introMessage;
  }

  get outroMessage(): string | null {
    return this._outroMessage;
  }

  get messages(): string[] {
    return this._messages;
  }

  get spinnerMessages(): string[] {
    return this._spinnerMessages;
  }

  setCancelled(cancelled: boolean): void {
    this._cancelled = cancelled;
  }

  reset(): void {
    this._introMessage = null;
    this._outroMessage = null;
    this._messages = [];
    this._spinnerMessages = [];
    this._cancelled = false;
    this._textIndex = 0;
    this.textValues = [];
  }

  // ========================================
  // Basic Prompts
  // ========================================

  intro(message: string): void {
    this._introMessage = message;
  }

  outro(message: string): void {
    this._outroMessage = message;
  }

  async text(options: TextPromptOptions): Promise<string> {
    if (this._cancelled) {
      throw new MockCancelError();
    }
    // Support sequential text values
    if (this.textValues.length > 0) {
      const value = this.textValues[this._textIndex] ?? '';
      this._textIndex++;
      return value;
    }
    return this.values.text ?? options.initialValue ?? '';
  }

  async select<T>(options: SelectPromptOptions<T>): Promise<T> {
    if (this._cancelled) {
      throw new MockCancelError();
    }
    const index = this.values.selectIndex ?? 0;
    return options.options[index]?.value ?? options.options[0]!.value;
  }

  async confirm(options: ConfirmPromptOptions): Promise<boolean> {
    if (this._cancelled) {
      throw new MockCancelError();
    }
    return this.values.confirm ?? options.initialValue ?? false;
  }

  async password(_options: PasswordPromptOptions): Promise<string> {
    if (this._cancelled) {
      throw new MockCancelError();
    }
    return this.values.password ?? 'mock-token';
  }

  // ========================================
  // Domain-Specific Prompts
  // ========================================

  async promptServerName(): Promise<ServerName> {
    if (this._cancelled) {
      throw new MockCancelError();
    }
    return ServerName.create(this.values.serverName!);
  }

  async promptServerType(): Promise<ServerType> {
    if (this._cancelled) {
      throw new MockCancelError();
    }
    return ServerType.create(this.values.serverType!);
  }

  async promptMcVersion(_serverType: ServerType): Promise<McVersion> {
    if (this._cancelled) {
      throw new MockCancelError();
    }
    return McVersion.create(this.values.version!);
  }

  async promptMemory(): Promise<Memory> {
    if (this._cancelled) {
      throw new MockCancelError();
    }
    return Memory.create(this.values.memory!);
  }

  async promptWorldOptions(): Promise<WorldOptions> {
    if (this._cancelled) {
      throw new MockCancelError();
    }

    switch (this.values.worldSetup) {
      case 'new-seed':
        return WorldOptions.newWorld(this.values.worldSeed);
      case 'existing':
        return WorldOptions.existingWorld(this.values.worldName ?? 'survival');
      case 'download':
        return WorldOptions.downloadWorld(
          this.values.worldUrl ?? 'https://example.com/world.zip'
        );
      default:
        return WorldOptions.newWorld();
    }
  }

  async promptServerSelection(servers: Server[]): Promise<Server> {
    if (this._cancelled) {
      throw new MockCancelError();
    }
    const index = this.values.selectIndex ?? 0;
    return servers[index] ?? servers[0]!;
  }

  async promptWorldSelection(worlds: World[]): Promise<World> {
    if (this._cancelled) {
      throw new MockCancelError();
    }
    const index = this.values.selectIndex ?? 0;
    return worlds[index] ?? worlds[0]!;
  }

  // ========================================
  // Status Display
  // ========================================

  spinner(): Spinner {
    return {
      start: (message?: string) => {
        if (message) this._spinnerMessages.push(`start: ${message}`);
      },
      stop: (message?: string) => {
        if (message) this._spinnerMessages.push(`stop: ${message}`);
      },
      message: (message: string) => {
        this._spinnerMessages.push(`message: ${message}`);
      },
    };
  }

  success(message: string): void {
    this._messages.push(`success: ${message}`);
  }

  error(message: string): void {
    this._messages.push(`error: ${message}`);
  }

  warn(message: string): void {
    this._messages.push(`warn: ${message}`);
  }

  info(message: string): void {
    this._messages.push(`info: ${message}`);
  }

  note(message: string, title?: string): void {
    this._messages.push(`note: ${title ? `[${title}] ` : ''}${message}`);
  }

  // ========================================
  // Utility
  // ========================================

  isCancel(value: unknown): boolean {
    return value instanceof MockCancelError;
  }

  handleCancel(): never {
    throw new MockCancelError();
  }
}

/**
 * Mock cancel error for testing cancellation flow
 */
export class MockCancelError extends Error {
  constructor() {
    super('Operation cancelled');
    this.name = 'MockCancelError';
  }
}
