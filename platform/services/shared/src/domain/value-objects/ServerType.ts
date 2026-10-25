/**
 * ServerType Value Object
 * Represents Minecraft server types supported by itzg/minecraft-server
 */
export enum ServerTypeEnum {
  PAPER = 'PAPER',
  VANILLA = 'VANILLA',
  FORGE = 'FORGE',
  NEOFORGE = 'NEOFORGE',
  FABRIC = 'FABRIC',
  SPIGOT = 'SPIGOT',
  BUKKIT = 'BUKKIT',
  PURPUR = 'PURPUR',
  QUILT = 'QUILT',
  LEAF = 'LEAF',
  FOLIA = 'FOLIA',
  PUFFERFISH = 'PUFFERFISH',
  MODRINTH = 'MODRINTH',
  AUTO_CURSEFORGE = 'AUTO_CURSEFORGE',
}

export interface ServerTypeInfo {
  value: ServerTypeEnum;
  label: string;
  description: string;
  supportsPlugins: boolean;
  supportsMods: boolean;
  isModpack: boolean;
  recommended: boolean;
}

const SERVER_TYPE_INFO: Record<ServerTypeEnum, Omit<ServerTypeInfo, 'value'>> = {
  [ServerTypeEnum.PAPER]: {
    label: 'Paper',
    description: 'High performance server with plugin support (Recommended)',
    supportsPlugins: true,
    supportsMods: false,
    isModpack: false,
    recommended: true,
  },
  [ServerTypeEnum.VANILLA]: {
    label: 'Vanilla',
    description: 'Official Minecraft server',
    supportsPlugins: false,
    supportsMods: false,
    isModpack: false,
    recommended: false,
  },
  [ServerTypeEnum.FORGE]: {
    label: 'Forge',
    description: 'Modded server for Forge mods',
    supportsPlugins: false,
    supportsMods: true,
    isModpack: false,
    recommended: false,
  },
  [ServerTypeEnum.NEOFORGE]: {
    label: 'NeoForge',
    description: 'Modern Forge fork for Minecraft 1.20.1+',
    supportsPlugins: false,
    supportsMods: true,
    isModpack: false,
    recommended: false,
  },
  [ServerTypeEnum.FABRIC]: {
    label: 'Fabric',
    description: 'Lightweight modded server',
    supportsPlugins: false,
    supportsMods: true,
    isModpack: false,
    recommended: false,
  },
  [ServerTypeEnum.SPIGOT]: {
    label: 'Spigot',
    description: 'Modified Bukkit server with plugin support',
    supportsPlugins: true,
    supportsMods: false,
    isModpack: false,
    recommended: false,
  },
  [ServerTypeEnum.BUKKIT]: {
    label: 'Bukkit',
    description: 'Classic plugin server',
    supportsPlugins: true,
    supportsMods: false,
    isModpack: false,
    recommended: false,
  },
  [ServerTypeEnum.PURPUR]: {
    label: 'Purpur',
    description: 'Paper fork with additional features',
    supportsPlugins: true,
    supportsMods: false,
    isModpack: false,
    recommended: false,
  },
  [ServerTypeEnum.LEAF]: {
    label: 'Leaf',
    description: 'Performance optimized lightweight Paper fork',
    supportsPlugins: true,
    supportsMods: false,
    isModpack: false,
    recommended: false,
  },
  [ServerTypeEnum.FOLIA]: {
    label: 'Folia',
    description: 'PaperMC multi-threaded server for large worlds',
    supportsPlugins: true,
    supportsMods: false,
    isModpack: false,
    recommended: false,
  },
  [ServerTypeEnum.PUFFERFISH]: {
    label: 'Pufferfish',
    description: 'Performance optimized Paper fork for large servers',
    supportsPlugins: true,
    supportsMods: false,
    isModpack: false,
    recommended: false,
  },
  [ServerTypeEnum.QUILT]: {
    label: 'Quilt',
    description: 'Modern modding toolchain',
    supportsPlugins: false,
    supportsMods: true,
    isModpack: false,
    recommended: false,
  },
  [ServerTypeEnum.MODRINTH]: {
    label: 'Modrinth Modpack',
    description: 'Modpack from Modrinth platform',
    supportsPlugins: false,
    supportsMods: true,
    isModpack: true,
    recommended: false,
  },
  [ServerTypeEnum.AUTO_CURSEFORGE]: {
    label: 'CurseForge Modpack',
    description: 'Modpack from CurseForge platform',
    supportsPlugins: false,
    supportsMods: true,
    isModpack: true,
    recommended: false,
  },
};

/** A TYPE mcctl does not offer (FTBA, MOHIST, ... set with mcctl config): no known features. */
const OTHER_TYPE_INFO = {
  description: 'Server type set outside mcctl',
  supportsPlugins: false,
  supportsMods: false,
  isModpack: false,
  recommended: false,
};

export class ServerType {
  /** A ServerTypeEnum value, or any TYPE through fromExisting. */
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  private get details(): Omit<ServerTypeInfo, 'value'> {
    return SERVER_TYPE_INFO[this._value as ServerTypeEnum] ?? { label: this._value, ...OTHER_TYPE_INFO };
  }

  get info(): Omit<ServerTypeInfo, 'value'> & { value: string } {
    return {
      value: this._value,
      ...this.details,
    };
  }

  get label(): string {
    return this.details.label;
  }

  get description(): string {
    return this.details.description;
  }

  get supportsPlugins(): boolean {
    return this.details.supportsPlugins;
  }

  get supportsMods(): boolean {
    return this.details.supportsMods;
  }

  get isModpack(): boolean {
    return this.details.isModpack;
  }

  static create(value: string): ServerType {
    const upperValue = value.toUpperCase().trim();

    if (!Object.values(ServerTypeEnum).includes(upperValue as ServerTypeEnum)) {
      const validTypes = Object.values(ServerTypeEnum).join(', ');
      throw new Error(`Invalid server type: ${value}. Valid types are: ${validTypes}`);
    }

    return new ServerType(upperValue as ServerTypeEnum);
  }

  /**
   * A TYPE read from a server (#826): any value, so a server whose TYPE was
   * set outside mcctl can still be found. create() refuses the unknown ones.
   */
  static fromExisting(value: string): ServerType {
    return new ServerType(value.toUpperCase().trim());
  }

  static fromEnum(value: ServerTypeEnum): ServerType {
    return new ServerType(value);
  }

  static getAll(): ServerTypeInfo[] {
    return Object.values(ServerTypeEnum).map((type) => ({
      value: type,
      ...SERVER_TYPE_INFO[type],
    }));
  }

  static getRecommended(): ServerType {
    return new ServerType(ServerTypeEnum.PAPER);
  }

  equals(other: ServerType): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
