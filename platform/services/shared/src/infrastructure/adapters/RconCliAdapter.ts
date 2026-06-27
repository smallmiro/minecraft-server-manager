import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { IRconPort } from '../../application/ports/outbound/IRconPort.js';
import { Dimension, type EntityPosition } from '../../domain/index.js';

const execFileAsync = promisify(execFile);

/**
 * Runs a command with explicit argv (no shell) and returns stdout.
 * Injectable so the adapter can be unit-tested without Docker.
 *
 * Using argv (not a shell string) prevents command injection via player
 * names and is async so it never blocks the Node event loop.
 */
export type CommandRunner = (file: string, args: string[]) => Promise<string>;

const defaultRunner: CommandRunner = async (file, args) => {
  const { stdout } = await execFileAsync(file, args, {
    timeout: 5000,
    encoding: 'utf-8',
  });
  return stdout;
};

/** Strip ANSI escape codes from RCON output. */
function stripAnsi(text: string): string {
  return text
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\[\d*m/g, '');
}

/** Parse `[x.xd, y.yd, z.zd]` into coordinates. */
export function parsePos(
  output: string
): { x: number; y: number; z: number } | null {
  const match = stripAnsi(output).match(
    /\[\s*(-?[\d.]+)d?\s*,\s*(-?[\d.]+)d?\s*,\s*(-?[\d.]+)d?\s*\]/
  );
  if (!match) return null;
  return {
    x: parseFloat(match[1]!),
    y: parseFloat(match[2]!),
    z: parseFloat(match[3]!),
  };
}

/** Parse a dimension id string and normalize to {@link Dimension}. */
export function parseDimension(output: string): Dimension | undefined {
  const match = stripAnsi(output).match(/"(minecraft:[a-z_]+)"/);
  if (!match) return undefined;
  switch (match[1]) {
    case 'minecraft:the_nether':
      return Dimension.Nether;
    case 'minecraft:the_end':
      return Dimension.End;
    case 'minecraft:overworld':
      return Dimension.Overworld;
    default:
      return undefined;
  }
}

/**
 * RCON adapter that resolves live entity positions via
 * `docker exec <container> rcon-cli data get entity <player> Pos`.
 *
 * Commands are run with explicit argv (no shell interpolation) and
 * asynchronously, so player names with spaces/metacharacters are safe
 * and concurrent lookups do not block the event loop.
 */
export class RconCliAdapter implements IRconPort {
  constructor(private readonly run: CommandRunner = defaultRunner) {}

  private rconArgs(container: string, player: string, path: string): string[] {
    return ['exec', container, 'rcon-cli', 'data', 'get', 'entity', player, path];
  }

  async getEntityPosition(
    container: string,
    player: string
  ): Promise<EntityPosition | null> {
    let posOutput: string;
    try {
      posOutput = await this.run('docker', this.rconArgs(container, player, 'Pos'));
    } catch {
      return null;
    }

    const pos = parsePos(posOutput);
    if (!pos) return null;

    let dimension: Dimension | undefined;
    try {
      dimension = parseDimension(
        await this.run('docker', this.rconArgs(container, player, 'Dimension'))
      );
    } catch {
      dimension = undefined;
    }

    return { ...pos, dimension };
  }
}
