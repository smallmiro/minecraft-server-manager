import {
  ServerName,
  ServerType,
  McVersion,
  Memory,
  WorldOptions,
  Server,
  World,
} from '../../../domain/index.js';
import type { WorldWithServerStatus } from './IWorldRepository.js';

/**
 * Prompt Port - Outbound Port
 * Interface for user interaction/prompts
 */
export interface IPromptPort {
  // ========================================
  // Basic Prompts
  // ========================================

  /**
   * Show introduction message
   */
  intro(message: string): void;

  /**
   * Show conclusion message
   */
  outro(message: string): void;

  /**
   * Text input prompt
   */
  text(options: TextPromptOptions): Promise<string>;

  /**
   * Select from options
   */
  select<T>(options: SelectPromptOptions<T>): Promise<T>;

  /**
   * Confirm yes/no prompt
   */
  confirm(options: ConfirmPromptOptions): Promise<boolean>;

  /**
   * Password input prompt (masked)
   */
  password(options: PasswordPromptOptions): Promise<string>;

  // ========================================
  // Domain-Specific Prompts
  // ========================================

  /**
   * Prompt for server name with validation
   */
  promptServerName(): Promise<ServerName>;

  /**
   * Prompt for server type selection
   */
  promptServerType(): Promise<ServerType>;

  /**
   * Prompt for Minecraft version
   */
  promptMcVersion(serverType: ServerType): Promise<McVersion>;

  /**
   * Prompt for memory allocation
   */
  promptMemory(): Promise<Memory>;

  /**
   * Prompt for world options (new/existing/download)
   */
  promptWorldOptions(): Promise<WorldOptions>;

  /**
   * Prompt for server selection from list
   */
  promptServerSelection(servers: Server[]): Promise<Server>;

  /**
   * Prompt for world selection from list
   */
  promptWorldSelection(worlds: World[]): Promise<World>;

  /**
   * Prompt for existing world selection with availability status
   * Shows worlds categorized by: available, stopped server, running server
   * @param worlds - List of worlds with their server status
   * @returns Selected world or null if cancelled/no selection
   */
  promptExistingWorldSelection(
    worlds: WorldWithServerStatus[]
  ): Promise<World | null>;

  // ========================================
  // Status Display
  // ========================================

  /**
   * Start a spinner with message
   */
  spinner(): Spinner;

  /**
   * Display success message
   */
  success(message: string): void;

  /**
   * Display error message
   */
  error(message: string): void;

  /**
   * Display warning message
   */
  warn(message: string): void;

  /**
   * Display info message
   */
  info(message: string): void;

  /**
   * Display note
   */
  note(message: string, title?: string): void;

  // ========================================
  // Utility
  // ========================================

  /**
   * Check if user cancelled
   */
  isCancel(value: unknown): boolean;

  /**
   * Handle user cancellation
   */
  handleCancel(): never;
}

/**
 * Text prompt options
 */
export interface TextPromptOptions {
  message: string;
  placeholder?: string;
  initialValue?: string;
  validate?: (value: string) => string | void;
}

/**
 * Select prompt options
 */
export interface SelectPromptOptions<T> {
  message: string;
  options: SelectOption<T>[];
  initialValue?: T;
}

/**
 * Select option
 */
export interface SelectOption<T> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * Confirm prompt options
 */
export interface ConfirmPromptOptions {
  message: string;
  initialValue?: boolean;
}

/**
 * Password prompt options
 */
export interface PasswordPromptOptions {
  message: string;
  mask?: string;
  validate?: (value: string) => string | void;
}

/**
 * Spinner interface
 */
export interface Spinner {
  start(message?: string): void;
  stop(message?: string): void;
  message(message: string): void;
}
