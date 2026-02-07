/**
 * ModpackOptions Value Object
 * Represents modpack configuration for MODRINTH and AUTO_CURSEFORGE server types
 */

export type ModpackSource = 'MODRINTH' | 'CURSEFORGE';

export interface ModpackConfig {
  version?: string;
  loader?: string;
}

export class ModpackOptions {
  private constructor(
    public readonly source: ModpackSource,
    public readonly slug: string,
    public readonly version?: string,
    public readonly loader?: string
  ) {
    Object.freeze(this);
  }

  /**
   * Create Modrinth modpack options
   * @param slug - Modrinth modpack slug
   * @param config - Optional version and loader
   */
  static modrinth(slug: string, config?: ModpackConfig): ModpackOptions {
    const trimmedSlug = slug.trim();
    if (!trimmedSlug) {
      throw new Error('Modpack slug cannot be empty');
    }
    return new ModpackOptions('MODRINTH', trimmedSlug, config?.version, config?.loader);
  }

  /**
   * Create CurseForge modpack options
   * @param slug - CurseForge modpack slug
   * @param config - Optional version and loader
   */
  static curseforge(slug: string, config?: ModpackConfig): ModpackOptions {
    const trimmedSlug = slug.trim();
    if (!trimmedSlug) {
      throw new Error('Modpack slug cannot be empty');
    }
    return new ModpackOptions('CURSEFORGE', trimmedSlug, config?.version, config?.loader);
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
    } else if (this.source === 'CURSEFORGE') {
      envVars.TYPE = 'AUTO_CURSEFORGE';
      envVars.CF_SLUG = this.slug;
      if (this.version) {
        envVars.CF_VERSION = this.version;
      }
      if (this.loader) {
        envVars.CF_LOADER = this.loader;
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

    return args;
  }
}
