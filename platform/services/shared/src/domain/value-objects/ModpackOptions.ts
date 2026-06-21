/**
 * ModpackOptions Value Object
 * Represents modpack configuration for MODRINTH and AUTO_CURSEFORGE server types
 */

export type ModpackSource = 'MODRINTH' | 'CURSEFORGE';

export interface ModpackConfig {
  version?: string;
  loader?: string;
  /**
   * Partial file names (Modrinth) or project IDs/slugs (CurseForge) of mods to
   * exclude from the modpack installation. Used to drop client-only mods that
   * the modpack incorrectly marks as server-compatible and would otherwise
   * crash a dedicated server.
   */
  excludeFiles?: string[];
}

/**
 * Normalize an exclude list: trim entries and drop empty ones.
 * Returns undefined when nothing remains so callers can omit the field.
 */
function normalizeExcludeFiles(excludeFiles?: string[]): string[] | undefined {
  if (!excludeFiles) {
    return undefined;
  }
  const cleaned = excludeFiles.map((f) => f.trim()).filter((f) => f.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

export class ModpackOptions {
  private constructor(
    public readonly source: ModpackSource,
    public readonly slug: string,
    public readonly version?: string,
    public readonly loader?: string,
    public readonly excludeFiles?: string[]
  ) {
    Object.freeze(this);
  }

  /**
   * Create Modrinth modpack options
   * @param slug - Modrinth modpack slug
   * @param config - Optional version, loader, and excludeFiles
   */
  static modrinth(slug: string, config?: ModpackConfig): ModpackOptions {
    const trimmedSlug = slug.trim();
    if (!trimmedSlug) {
      throw new Error('Modpack slug cannot be empty');
    }
    return new ModpackOptions(
      'MODRINTH',
      trimmedSlug,
      config?.version,
      config?.loader,
      normalizeExcludeFiles(config?.excludeFiles)
    );
  }

  /**
   * Create CurseForge modpack options
   * @param slug - CurseForge modpack slug
   * @param config - Optional version, loader, and excludeFiles
   */
  static curseforge(slug: string, config?: ModpackConfig): ModpackOptions {
    const trimmedSlug = slug.trim();
    if (!trimmedSlug) {
      throw new Error('Modpack slug cannot be empty');
    }
    return new ModpackOptions(
      'CURSEFORGE',
      trimmedSlug,
      config?.version,
      config?.loader,
      normalizeExcludeFiles(config?.excludeFiles)
    );
  }

  /**
   * Convert to environment variables for docker-compose
   */
  toEnvVars(): Record<string, string> {
    const envVars: Record<string, string> = {};

    if (this.source === 'MODRINTH') {
      envVars.TYPE = 'MODRINTH';
      envVars.MODRINTH_MODPACK = this.slug;
      if (this.version) {
        envVars.MODRINTH_VERSION = this.version;
      }
      if (this.loader) {
        envVars.MODRINTH_LOADER = this.loader;
      }
      if (this.excludeFiles && this.excludeFiles.length > 0) {
        envVars.MODRINTH_EXCLUDE_FILES = this.excludeFiles.join(',');
      }
    } else if (this.source === 'CURSEFORGE') {
      envVars.TYPE = 'AUTO_CURSEFORGE';
      envVars.CF_SLUG = this.slug;
      if (this.version) {
        envVars.CF_VERSION = this.version;
      }
      if (this.loader) {
        envVars.CF_LOADER = this.loader;
      }
      if (this.excludeFiles && this.excludeFiles.length > 0) {
        envVars.CF_EXCLUDE_MODS = this.excludeFiles.join(',');
      }
    }

    return envVars;
  }

  /**
   * Convert to CLI arguments
   */
  toCliArgs(): string[] {
    const args: string[] = [];

    if (this.source === 'MODRINTH') {
      args.push('--type', 'MODRINTH');
      args.push('--modpack-slug', this.slug);
      if (this.version) {
        args.push('--modpack-version', this.version);
      }
      if (this.loader) {
        args.push('--mod-loader', this.loader);
      }
    } else if (this.source === 'CURSEFORGE') {
      args.push('--type', 'AUTO_CURSEFORGE');
      args.push('--modpack-slug', this.slug);
      if (this.version) {
        args.push('--modpack-version', this.version);
      }
      if (this.loader) {
        args.push('--mod-loader', this.loader);
      }
    }

    if (this.excludeFiles && this.excludeFiles.length > 0) {
      args.push('--exclude-files', this.excludeFiles.join(','));
    }

    return args;
  }
}
