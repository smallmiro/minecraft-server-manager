import * as p from '@clack/prompts';
import pc from 'picocolors';
import {
  ServerName,
  ServerType,
  McVersion,
  Memory,
  WorldOptions,
  Server,
  World,
  type IPromptPort,
  type TextPromptOptions,
  type SelectPromptOptions,
  type ConfirmPromptOptions,
  type Spinner,
} from '@minecraft-docker/shared';

/**
 * ClackPromptAdapter
 * Implements IPromptPort using @clack/prompts
 */
export class ClackPromptAdapter implements IPromptPort {
  // ========================================
  // Basic Prompts
  // ========================================

  intro(message: string): void {
    p.intro(pc.bgCyan(pc.black(` ${message} `)));
  }

  outro(message: string): void {
    p.outro(pc.green(message));
  }

  async text(options: TextPromptOptions): Promise<string> {
    const result = await p.text({
      message: options.message,
      placeholder: options.placeholder,
      initialValue: options.initialValue,
      validate: options.validate,
    });

    if (this.isCancel(result)) {
      this.handleCancel();
    }

    return result as string;
  }

  async select<T>(options: SelectPromptOptions<T>): Promise<T> {
    // @clack/prompts requires label for non-primitive types
    const clackOptions = options.options.map((opt) => ({
      value: opt.value,
      label: opt.label,
      hint: opt.hint,
    }));

    const result = await p.select({
      message: options.message,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      options: clackOptions as any,
      initialValue: options.initialValue,
    });

    if (this.isCancel(result)) {
      this.handleCancel();
    }

    return result as T;
  }

  async confirm(options: ConfirmPromptOptions): Promise<boolean> {
    const result = await p.confirm({
      message: options.message,
      initialValue: options.initialValue,
    });

    if (this.isCancel(result)) {
      this.handleCancel();
    }

    return result as boolean;
  }

  // ========================================
  // Domain-Specific Prompts
  // ========================================

  async promptServerName(): Promise<ServerName> {
    const name = await p.text({
      message: 'Server name:',
      placeholder: 'myserver',
      validate: (value) => {
        try {
          ServerName.create(value);
          return undefined;
        } catch (error) {
          return error instanceof Error ? error.message : 'Invalid server name';
        }
      },
    });

    if (this.isCancel(name)) {
      this.handleCancel();
    }

    return ServerName.create(name as string);
  }

  async promptServerType(): Promise<ServerType> {
    const types = ServerType.getAll();

    const result = await p.select({
      message: 'Server type:',
      options: types.map((t) => ({
        value: t.value,
        label: t.label + (t.recommended ? ' (Recommended)' : ''),
        hint: t.description,
      })),
      initialValue: 'PAPER',
    });

    if (this.isCancel(result)) {
      this.handleCancel();
    }

    return ServerType.create(result as string);
  }

  async promptMcVersion(serverType: ServerType): Promise<McVersion> {
    const commonVersions = ['LATEST', '1.21.1', '1.21', '1.20.4', '1.20.1', '1.19.4'];

    const result = await p.select({
      message: 'Minecraft version:',
      options: [
        ...commonVersions.map((v) => ({
          value: v,
          label: v === 'LATEST' ? 'Latest' : v,
          hint: v === 'LATEST' ? 'Auto-detect latest version' : undefined,
        })),
        { value: 'other', label: 'Other...', hint: 'Enter a specific version' },
      ],
      initialValue: 'LATEST',
    });

    if (this.isCancel(result)) {
      this.handleCancel();
    }

    if (result === 'other') {
      const customVersion = await p.text({
        message: 'Enter Minecraft version:',
        placeholder: '1.21.1',
        validate: (value) => {
          try {
            McVersion.create(value);
            return undefined;
          } catch (error) {
            return error instanceof Error ? error.message : 'Invalid version';
          }
        },
      });

      if (this.isCancel(customVersion)) {
        this.handleCancel();
      }

      return McVersion.create(customVersion as string);
    }

    return McVersion.create(result as string);
  }

  async promptMemory(): Promise<Memory> {
    const memoryOptions = [
      { value: '2G', label: '2 GB', hint: 'Minimum for vanilla' },
      { value: '4G', label: '4 GB', hint: 'Recommended for most servers' },
      { value: '6G', label: '6 GB', hint: 'For modded servers' },
      { value: '8G', label: '8 GB', hint: 'For large modpacks' },
      { value: 'other', label: 'Other...', hint: 'Enter custom value' },
    ];

    const result = await p.select({
      message: 'Memory allocation:',
      options: memoryOptions,
      initialValue: '4G',
    });

    if (this.isCancel(result)) {
      this.handleCancel();
    }

    if (result === 'other') {
      const customMemory = await p.text({
        message: 'Enter memory (e.g., 4G, 512M):',
        placeholder: '4G',
        validate: (value) => {
          try {
            Memory.create(value);
            return undefined;
          } catch (error) {
            return error instanceof Error ? error.message : 'Invalid memory format';
          }
        },
      });

      if (this.isCancel(customMemory)) {
        this.handleCancel();
      }

      return Memory.create(customMemory as string);
    }

    return Memory.create(result as string);
  }

  async promptWorldOptions(): Promise<WorldOptions> {
    const setupType = await p.select({
      message: 'World setup:',
      options: [
        { value: 'new', label: 'New world', hint: 'Generate a new world' },
        { value: 'new-seed', label: 'New world with seed', hint: 'Generate with specific seed' },
        { value: 'existing', label: 'Use existing world', hint: 'From worlds/ directory' },
        { value: 'download', label: 'Download from URL', hint: 'Download world ZIP' },
      ],
      initialValue: 'new',
    });

    if (this.isCancel(setupType)) {
      this.handleCancel();
    }

    switch (setupType) {
      case 'new':
        return WorldOptions.newWorld();

      case 'new-seed': {
        const seed = await p.text({
          message: 'World seed:',
          placeholder: '12345 or any string',
        });

        if (this.isCancel(seed)) {
          this.handleCancel();
        }

        return WorldOptions.newWorld(seed as string);
      }

      case 'existing': {
        const worldName = await p.text({
          message: 'World name (from worlds/ directory):',
          placeholder: 'survival',
          validate: (value) => {
            if (!value.trim()) {
              return 'World name is required';
            }
            return undefined;
          },
        });

        if (this.isCancel(worldName)) {
          this.handleCancel();
        }

        return WorldOptions.existingWorld(worldName as string);
      }

      case 'download': {
        const url = await p.text({
          message: 'Download URL (ZIP file):',
          placeholder: 'https://example.com/world.zip',
          validate: (value) => {
            try {
              WorldOptions.downloadWorld(value);
              return undefined;
            } catch (error) {
              return error instanceof Error ? error.message : 'Invalid URL';
            }
          },
        });

        if (this.isCancel(url)) {
          this.handleCancel();
        }

        return WorldOptions.downloadWorld(url as string);
      }

      default:
        return WorldOptions.newWorld();
    }
  }

  async promptServerSelection(servers: Server[]): Promise<Server> {
    const result = await p.select({
      message: 'Select server:',
      options: servers.map((s) => ({
        value: s.name.value,
        label: s.containerName,
        hint: `${s.type.label} ${s.version.value} (${s.status}${s.hasPlayers ? `, ${s.playerCount} players` : ''})`,
      })),
    });

    if (this.isCancel(result)) {
      this.handleCancel();
    }

    const server = servers.find((s) => s.name.value === result);
    if (!server) {
      throw new Error('Server not found');
    }

    return server;
  }

  async promptWorldSelection(worlds: World[]): Promise<World> {
    const result = await p.select({
      message: 'Select world:',
      options: worlds.map((w) => ({
        value: w.name,
        label: w.name,
        hint: w.isLocked ? `Locked by ${w.lockedBy}` : `${w.sizeFormatted} (unlocked)`,
      })),
    });

    if (this.isCancel(result)) {
      this.handleCancel();
    }

    const world = worlds.find((w) => w.name === result);
    if (!world) {
      throw new Error('World not found');
    }

    return world;
  }

  // ========================================
  // Status Display
  // ========================================

  spinner(): Spinner {
    const spin = p.spinner();
    return {
      start: (message?: string) => spin.start(message),
      stop: (message?: string) => spin.stop(message),
      message: (message: string) => spin.message(message),
    };
  }

  success(message: string): void {
    p.log.success(pc.green(message));
  }

  error(message: string): void {
    p.log.error(pc.red(message));
  }

  warn(message: string): void {
    p.log.warn(pc.yellow(message));
  }

  info(message: string): void {
    p.log.info(pc.cyan(message));
  }

  note(message: string, title?: string): void {
    p.note(message, title);
  }

  // ========================================
  // Utility
  // ========================================

  isCancel(value: unknown): boolean {
    return p.isCancel(value);
  }

  handleCancel(): never {
    p.cancel('Operation cancelled');
    process.exit(0);
  }
}
