import type {
  IPlayerLookupUseCase,
  PlayerLookupResult,
  PlayerUuidResult,
  IPromptPort,
  IShellPort,
} from '../ports/index.js';

/**
 * Player Lookup Use Case
 * Looks up Minecraft player information
 */
export class PlayerLookupUseCase implements IPlayerLookupUseCase {
  constructor(
    private readonly prompt: IPromptPort,
    private readonly shell: IShellPort
  ) {}

  /**
   * Interactive player lookup
   */
  async lookup(): Promise<PlayerLookupResult> {
    this.prompt.intro('Player Lookup');

    try {
      // Prompt for player name
      const name = await this.prompt.text({
        message: 'Player name:',
        placeholder: 'Notch',
        validate: (value) => {
          if (!value.trim()) {
            return 'Player name is required';
          }
          if (!/^[a-zA-Z0-9_]{3,16}$/.test(value.trim())) {
            return 'Invalid player name (3-16 alphanumeric characters)';
          }
          return undefined;
        },
      });

      if (this.prompt.isCancel(name)) {
        this.prompt.outro('Lookup cancelled');
        return {
          success: false,
          error: 'Cancelled',
        };
      }

      // Execute lookup
      return await this.lookupByName(name);
    } catch (error) {
      if (this.prompt.isCancel(error)) {
        this.prompt.outro('Lookup cancelled');
        return {
          success: false,
          error: 'Cancelled',
        };
      }
      throw error;
    }
  }

  /**
   * Lookup player by name
   */
  async lookupByName(name: string): Promise<PlayerLookupResult> {
    const spinner = this.prompt.spinner();
    spinner.start('Looking up player...');

    const result = await this.shell.playerLookup(name);

    if (!result.success) {
      spinner.stop('Lookup failed');

      // Check if player not found
      if (result.stderr?.includes('not found') || result.code === 1) {
        this.prompt.warn(`Player '${name}' not found`);
        this.prompt.outro('Player does not exist');
        return {
          success: false,
          name,
          error: 'Player not found',
        };
      }

      this.prompt.error(result.stderr || 'Unknown error');
      return {
        success: false,
        name,
        error: result.stderr,
      };
    }

    spinner.stop('Player found');

    // Parse output
    const output = result.stdout;
    const uuidMatch = output.match(/UUID:\s*([a-f0-9-]+)/i);
    const skinMatch = output.match(/Skin:\s*(.+)/i);

    const uuid = uuidMatch ? uuidMatch[1] : undefined;
    const skinUrl = skinMatch ? skinMatch[1]?.trim() : undefined;

    // Display result
    this.prompt.note(
      `Name: ${name}\n` +
        (uuid ? `UUID: ${uuid}\n` : '') +
        (skinUrl ? `Skin: ${skinUrl}` : ''),
      'Player Info'
    );

    this.prompt.outro('Lookup complete');

    return {
      success: true,
      name,
      uuid,
      skinUrl,
    };
  }

  /**
   * Get player UUID
   */
  async getUuid(name: string, offline = false): Promise<PlayerUuidResult> {
    const result = await this.shell.playerUuid(name, offline);

    if (!result.success) {
      return {
        success: false,
        name,
        isOffline: offline,
        error: result.stderr || 'Failed to get UUID',
      };
    }

    // Parse UUID from output
    const uuidMatch = result.stdout.match(/([a-f0-9-]{36})/i);
    const uuid = uuidMatch ? uuidMatch[1] : undefined;

    if (!uuid) {
      return {
        success: false,
        name,
        isOffline: offline,
        error: 'Could not parse UUID from response',
      };
    }

    return {
      success: true,
      name,
      uuid,
      isOffline: offline,
    };
  }
}
