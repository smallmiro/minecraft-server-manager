import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Paths } from '../../utils/index.js';
import { ServerTypeEnum } from '../../domain/index.js';
import type {
  IDocProvider,
  DocServerTypeInfo,
  DocEnvVarInfo,
  DocVersionInfo,
  DocMemoryInfo,
} from '../../application/ports/outbound/IDocProvider.js';

/**
 * DocsAdapter
 * Parses docs/ directory for dynamic server configuration information
 */
export class DocsAdapter implements IDocProvider {
  private readonly docsDir: string;
  private serverTypesCache: DocServerTypeInfo[] | null = null;
  private envVarsCache: DocEnvVarInfo[] | null = null;

  constructor(rootDir?: string) {
    const paths = new Paths(rootDir);
    // docs/ is at project root, not platform root
    this.docsDir = join(paths.root, '..', 'docs');
  }

  /**
   * Check if docs directory is available
   */
  async isAvailable(): Promise<boolean> {
    const typesFile = join(this.docsDir, '06-types-and-platforms.md');
    return existsSync(typesFile);
  }

  /**
   * Get server types from docs/06-types-and-platforms.md
   */
  async getServerTypes(): Promise<DocServerTypeInfo[]> {
    if (this.serverTypesCache) {
      return this.serverTypesCache;
    }

    const filePath = join(this.docsDir, '06-types-and-platforms.md');

    if (!existsSync(filePath)) {
      return this.getDefaultServerTypes();
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      this.serverTypesCache = this.parseServerTypes(content);
      return this.serverTypesCache;
    } catch {
      return this.getDefaultServerTypes();
    }
  }

  /**
   * Get environment variables from docs/03-variables.md
   */
  async getEnvVars(category?: string): Promise<DocEnvVarInfo[]> {
    if (!this.envVarsCache) {
      const filePath = join(this.docsDir, '03-variables.md');

      if (!existsSync(filePath)) {
        this.envVarsCache = this.getDefaultEnvVars();
      } else {
        try {
          const content = await readFile(filePath, 'utf-8');
          this.envVarsCache = this.parseEnvVars(content);
        } catch {
          this.envVarsCache = this.getDefaultEnvVars();
        }
      }
    }

    if (category) {
      return this.envVarsCache.filter(
        (v) => v.category.toLowerCase() === category.toLowerCase()
      );
    }

    return this.envVarsCache;
  }

  /**
   * Get version compatibility information
   */
  async getVersionCompatibility(serverType: string): Promise<DocVersionInfo[]> {
    // Version compatibility based on known data
    const commonVersions = await this.getCommonVersions();

    return commonVersions.map((version) => {
      const javaVersion = this.getJavaVersionForMc(version);
      const supportedTypes = this.getSupportedTypesForVersion(version);

      return {
        mcVersion: version,
        javaVersion,
        supportedTypes,
        isLatest: version === 'LATEST',
      };
    });
  }

  /**
   * Get common Minecraft versions
   */
  async getCommonVersions(): Promise<string[]> {
    return [
      'LATEST',
      '1.21.4',
      '1.21.3',
      '1.21.1',
      '1.21',
      '1.20.4',
      '1.20.1',
      '1.19.4',
      '1.18.2',
      '1.16.5',
      '1.12.2',
    ];
  }

  /**
   * Get recommended memory settings
   */
  async getMemoryRecommendations(): Promise<DocMemoryInfo[]> {
    return [
      {
        label: '2 GB',
        value: '2G',
        description: 'Minimum for vanilla servers',
        recommended: false,
        forMods: false,
      },
      {
        label: '4 GB',
        value: '4G',
        description: 'Recommended for most servers',
        recommended: true,
        forMods: false,
      },
      {
        label: '6 GB',
        value: '6G',
        description: 'For modded servers with 20-50 mods',
        recommended: false,
        forMods: true,
      },
      {
        label: '8 GB',
        value: '8G',
        description: 'For large modpacks (50+ mods)',
        recommended: false,
        forMods: true,
      },
      {
        label: '10 GB',
        value: '10G',
        description: 'For heavy modpacks and many players',
        recommended: false,
        forMods: true,
      },
    ];
  }

  // ========================================
  // Private: Parsing Methods
  // ========================================

  private parseServerTypes(content: string): DocServerTypeInfo[] {
    const types: DocServerTypeInfo[] = [];
    const lines = content.split('\n');

    // Parse the summary table at the end
    const summaryStart = content.indexOf('## Server Type Summary');
    if (summaryStart !== -1) {
      const tableMatch = content
        .slice(summaryStart)
        .match(/\| Type \| Purpose \| Plugins \| Mods \|[\s\S]*?(?=\n\n|$)/);

      if (tableMatch) {
        const tableLines = tableMatch[0].split('\n').slice(2); // Skip header and separator

        for (const line of tableLines) {
          const match = line.match(
            /\|\s*`(\w+)`\s*\|\s*([^|]+)\s*\|\s*([OX-])\s*\|\s*([OX-])\s*\|/
          );
          if (match) {
            const typeValue = match[1];
            const purpose = match[2];
            const plugins = match[3];
            const mods = match[4];

            if (!typeValue || !purpose || !plugins || !mods) continue;

            const enumValue = typeValue as ServerTypeEnum;

            if (Object.values(ServerTypeEnum).includes(enumValue)) {
              types.push({
                value: enumValue,
                label: this.formatLabel(typeValue),
                description: purpose.trim(),
                supportsPlugins: plugins === 'O',
                supportsMods: mods === 'O',
                recommended: typeValue === 'PAPER',
                javaVersions: this.getDefaultJavaVersions(typeValue),
              });
            }
          }
        }
      }
    }

    // If parsing failed, return defaults
    if (types.length === 0) {
      return this.getDefaultServerTypes();
    }

    return types;
  }

  private parseEnvVars(content: string): DocEnvVarInfo[] {
    const vars: DocEnvVarInfo[] = [];
    const sections = content.split(/^## /m).slice(1);

    for (const section of sections) {
      const lines = section.split('\n');
      const categoryLine = lines[0];
      const rest = lines.slice(1);

      if (!categoryLine) continue;

      const category = categoryLine.trim();
      const sectionContent = rest.join('\n');

      // Parse tables in this section
      const tableMatches = sectionContent.matchAll(
        /\| Variable \|[^|]*\|[^|]*\|?\n\|[-|]+\|\n([\s\S]*?)(?=\n\n|\n##|$)/g
      );

      for (const tableMatch of tableMatches) {
        const tableContent = tableMatch[1];
        if (!tableContent) continue;

        const rows = tableContent.split('\n').filter((r) => r.includes('|'));

        for (const row of rows) {
          const cells = row
            .split('|')
            .map((c) => c.trim())
            .filter(Boolean);
          if (cells.length >= 2) {
            const name = (cells[0] ?? '').replace(/`/g, '');
            const defaultOrDesc = cells[1] ?? '';
            const description = cells[2] ?? defaultOrDesc;

            vars.push({
              name,
              type: this.inferType(name, description),
              default: cells.length >= 3 ? (defaultOrDesc !== '-' ? defaultOrDesc : undefined) : undefined,
              description: description.replace(/\*\*/g, ''),
              required: description.toLowerCase().includes('required'),
              category,
            });
          }
        }
      }
    }

    if (vars.length === 0) {
      return this.getDefaultEnvVars();
    }

    return vars;
  }

  // ========================================
  // Private: Helper Methods
  // ========================================

  private formatLabel(type: string): string {
    const labels: Record<string, string> = {
      VANILLA: 'Vanilla',
      PAPER: 'Paper',
      FORGE: 'Forge',
      FABRIC: 'Fabric',
      QUILT: 'Quilt',
      SPIGOT: 'Spigot',
      BUKKIT: 'Bukkit',
      PURPUR: 'Purpur',
      MOHIST: 'Mohist',
      AUTO_CURSEFORGE: 'CurseForge Modpack',
      MODRINTH: 'Modrinth Modpack',
    };
    return labels[type] || type;
  }

  private getDefaultJavaVersions(type: string): string[] {
    // Based on server type, return recommended Java versions
    switch (type.toUpperCase()) {
      case 'FORGE':
        return ['java8', 'java17', 'java21'];
      case 'FABRIC':
      case 'QUILT':
        return ['java17', 'java21'];
      default:
        return ['java21', 'java17'];
    }
  }

  private getJavaVersionForMc(version: string): string {
    if (version === 'LATEST') return 'java21';

    const parts = version.split('.').map(Number);
    const major = parts[0] ?? 0;
    const minor = parts[1] ?? 0;

    if (major === 1) {
      if (minor >= 21) return 'java21';
      if (minor >= 18) return 'java17';
      if (minor >= 17) return 'java16';
      return 'java8';
    }

    return 'java21';
  }

  private getSupportedTypesForVersion(version: string): string[] {
    if (version === 'LATEST') {
      return ['VANILLA', 'PAPER', 'FABRIC', 'FORGE', 'QUILT'];
    }

    const parts = version.split('.').map(Number);
    const major = parts[0] ?? 0;
    const minor = parts[1] ?? 0;

    if (major === 1) {
      if (minor >= 20) {
        return ['VANILLA', 'PAPER', 'FABRIC', 'FORGE', 'QUILT', 'PURPUR'];
      }
      if (minor >= 17) {
        return ['VANILLA', 'PAPER', 'FABRIC', 'FORGE', 'SPIGOT'];
      }
      if (minor >= 12) {
        return ['VANILLA', 'PAPER', 'FORGE', 'SPIGOT', 'BUKKIT'];
      }
    }

    return ['VANILLA', 'FORGE'];
  }

  private inferType(name: string, description: string): string {
    const lowerName = name.toLowerCase();
    const lowerDesc = description.toLowerCase();

    if (lowerName.includes('enable') || lowerDesc.includes('true/false')) {
      return 'boolean';
    }
    if (lowerName.includes('port') || lowerName.includes('count') || lowerName.includes('max')) {
      return 'number';
    }
    if (lowerName.includes('memory') || name === 'MEMORY') {
      return 'memory';
    }

    return 'string';
  }

  // ========================================
  // Private: Default Data
  // ========================================

  private getDefaultServerTypes(): DocServerTypeInfo[] {
    return [
      {
        value: ServerTypeEnum.PAPER,
        label: 'Paper',
        description: 'High performance server with plugin support',
        supportsPlugins: true,
        supportsMods: false,
        recommended: true,
        javaVersions: ['java21', 'java17'],
      },
      {
        value: ServerTypeEnum.VANILLA,
        label: 'Vanilla',
        description: 'Official Minecraft server',
        supportsPlugins: false,
        supportsMods: false,
        recommended: false,
        javaVersions: ['java21', 'java17'],
      },
      {
        value: ServerTypeEnum.FORGE,
        label: 'Forge',
        description: 'Mod server for Forge mods',
        supportsPlugins: false,
        supportsMods: true,
        recommended: false,
        javaVersions: ['java8', 'java17', 'java21'],
      },
      {
        value: ServerTypeEnum.FABRIC,
        label: 'Fabric',
        description: 'Lightweight modded server',
        supportsPlugins: false,
        supportsMods: true,
        recommended: false,
        javaVersions: ['java17', 'java21'],
      },
      {
        value: ServerTypeEnum.QUILT,
        label: 'Quilt',
        description: 'Fabric-compatible mod loader',
        supportsPlugins: false,
        supportsMods: true,
        recommended: false,
        javaVersions: ['java17', 'java21'],
      },
      {
        value: ServerTypeEnum.SPIGOT,
        label: 'Spigot',
        description: 'Modified Bukkit server with plugin support',
        supportsPlugins: true,
        supportsMods: false,
        recommended: false,
        javaVersions: ['java17', 'java21'],
      },
      {
        value: ServerTypeEnum.BUKKIT,
        label: 'Bukkit',
        description: 'Classic plugin server',
        supportsPlugins: true,
        supportsMods: false,
        recommended: false,
        javaVersions: ['java17', 'java21'],
      },
      {
        value: ServerTypeEnum.PURPUR,
        label: 'Purpur',
        description: 'Paper fork with additional features',
        supportsPlugins: true,
        supportsMods: false,
        recommended: false,
        javaVersions: ['java17', 'java21'],
      },
    ];
  }

  private getDefaultEnvVars(): DocEnvVarInfo[] {
    return [
      {
        name: 'EULA',
        type: 'boolean',
        default: undefined,
        description: 'Minecraft EULA agreement (Required: TRUE)',
        required: true,
        category: 'General Settings',
      },
      {
        name: 'TYPE',
        type: 'string',
        default: 'VANILLA',
        description: 'Server type',
        required: false,
        category: 'General Settings',
      },
      {
        name: 'VERSION',
        type: 'string',
        default: 'LATEST',
        description: 'Minecraft version',
        required: false,
        category: 'General Settings',
      },
      {
        name: 'MEMORY',
        type: 'memory',
        default: '1G',
        description: 'Initial/max heap memory',
        required: false,
        category: 'Memory Settings',
      },
      {
        name: 'SEED',
        type: 'string',
        default: undefined,
        description: 'World seed',
        required: false,
        category: 'Server Settings',
      },
      {
        name: 'MOTD',
        type: 'string',
        default: undefined,
        description: 'Server message',
        required: false,
        category: 'Server Settings',
      },
      {
        name: 'DIFFICULTY',
        type: 'string',
        default: 'easy',
        description: 'Difficulty (peaceful, easy, normal, hard)',
        required: false,
        category: 'Server Settings',
      },
      {
        name: 'MODE',
        type: 'string',
        default: 'survival',
        description: 'Game mode (survival, creative, adventure, spectator)',
        required: false,
        category: 'Server Settings',
      },
      {
        name: 'MAX_PLAYERS',
        type: 'number',
        default: '20',
        description: 'Maximum player count',
        required: false,
        category: 'Server Settings',
      },
      {
        name: 'ENABLE_RCON',
        type: 'boolean',
        default: 'true',
        description: 'Enable RCON',
        required: false,
        category: 'RCON',
      },
      {
        name: 'RCON_PASSWORD',
        type: 'string',
        default: undefined,
        description: 'RCON password',
        required: false,
        category: 'RCON',
      },
    ];
  }
}
