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
}

export interface ServerTypeInfo {
  value: ServerTypeEnum;
  label: string;
  description: string;
  supportsPlugins: boolean;
  supportsMods: boolean;
  recommended: boolean;
}

const SERVER_TYPE_INFO: Record<ServerTypeEnum, Omit<ServerTypeInfo, 'value'>> = {
  [ServerTypeEnum.PAPER]: {
    label: 'Paper',
    description: 'High performance server with plugin support (Recommended)',
    supportsPlugins: true,
    supportsMods: false,
    recommended: true,
  },
  [ServerTypeEnum.VANILLA]: {
    label: 'Vanilla',
    description: 'Official Minecraft server',
    supportsPlugins: false,
    supportsMods: false,
    recommended: false,
  },
  [ServerTypeEnum.FORGE]: {
    label: 'Forge',
    description: 'Modded server for Forge mods',
    supportsPlugins: false,
    supportsMods: true,
    recommended: false,
  },
  [ServerTypeEnum.NEOFORGE]: {
    label: 'NeoForge',
    description: 'Modern Forge fork for Minecraft 1.20.1+',
    supportsPlugins: false,
    supportsMods: true,
    recommended: false,
  },
  [ServerTypeEnum.FABRIC]: {
    label: 'Fabric',
    description: 'Lightweight modded server',
    supportsPlugins: false,
    supportsMods: true,
    recommended: false,
  },
  [ServerTypeEnum.SPIGOT]: {
    label: 'Spigot',
    description: 'Modified Bukkit server with plugin support',
    supportsPlugins: true,
    supportsMods: false,
    recommended: false,
  },
  [ServerTypeEnum.BUKKIT]: {
    label: 'Bukkit',
    description: 'Classic plugin server',
    supportsPlugins: true,
    supportsMods: false,
    recommended: false,
  },
  [ServerTypeEnum.PURPUR]: {
    label: 'Purpur',
    description: 'Paper fork with additional features',
    supportsPlugins: true,
    supportsMods: false,
    recommended: false,
  },
  [ServerTypeEnum.QUILT]: {
    label: 'Quilt',
    description: 'Modern modding toolchain',
    supportsPlugins: false,
    supportsMods: true,
    recommended: false,
  },
};

export class ServerType {
  private constructor(private readonly _value: ServerTypeEnum) {
    Object.freeze(this);
  }

  get value(): ServerTypeEnum {
    return this._value;
  }

  get info(): ServerTypeInfo {
    return {
      value: this._value,
      ...SERVER_TYPE_INFO[this._value],
    };
  }

  get label(): string {
    return SERVER_TYPE_INFO[this._value].label;
  }

  get description(): string {
    return SERVER_TYPE_INFO[this._value].description;
  }

  get supportsPlugins(): boolean {
    return SERVER_TYPE_INFO[this._value].supportsPlugins;
  }

  get supportsMods(): boolean {
    return SERVER_TYPE_INFO[this._value].supportsMods;
  }

  static create(value: string): ServerType {
    const upperValue = value.toUpperCase().trim();

    if (!Object.values(ServerTypeEnum).includes(upperValue as ServerTypeEnum)) {
      const validTypes = Object.values(ServerTypeEnum).join(', ');
      throw new Error(`Invalid server type: ${value}. Valid types are: ${validTypes}`);
    }

    return new ServerType(upperValue as ServerTypeEnum);
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
