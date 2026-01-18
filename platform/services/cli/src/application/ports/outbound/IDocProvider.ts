import { ServerTypeInfo } from '../../../domain/index.js';

/**
 * Doc Provider Port - Outbound Port
 * Interface for reading and parsing docs/ directory
 */
export interface IDocProvider {
  /**
   * Get server types from docs/06-types-and-platforms.md
   */
  getServerTypes(): Promise<DocServerTypeInfo[]>;

  /**
   * Get environment variables from docs/03-variables.md
   */
  getEnvVars(category?: string): Promise<DocEnvVarInfo[]>;

  /**
   * Get version compatibility information
   */
  getVersionCompatibility(serverType: string): Promise<DocVersionInfo[]>;

  /**
   * Get common Minecraft versions
   */
  getCommonVersions(): Promise<string[]>;

  /**
   * Get recommended memory settings
   */
  getMemoryRecommendations(): Promise<DocMemoryInfo[]>;

  /**
   * Check if docs are available
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Server type information from docs
 */
export interface DocServerTypeInfo extends ServerTypeInfo {
  docSection?: string;
  defaultVersion?: string;
  javaVersions: string[];
  notes?: string[];
}

/**
 * Environment variable information from docs
 */
export interface DocEnvVarInfo {
  name: string;
  type: string;
  default?: string;
  description: string;
  required: boolean;
  category: string;
  example?: string;
}

/**
 * Version compatibility information
 */
export interface DocVersionInfo {
  mcVersion: string;
  javaVersion: string;
  supportedTypes: string[];
  releaseDate?: string;
  isLatest?: boolean;
}

/**
 * Memory recommendation information
 */
export interface DocMemoryInfo {
  label: string;
  value: string;
  description: string;
  recommended?: boolean;
  forMods?: boolean;
}
