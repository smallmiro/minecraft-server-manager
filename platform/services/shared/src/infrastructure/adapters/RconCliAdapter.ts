import { execSync } from 'node:child_process';
import type { IRconPort } from '../../application/ports/outbound/IRconPort.js';
import { Dimension, type EntityPosition } from '../../domain/index.js';

/**
 * Runs a shell command and returns its stdout. Throws on failure.
 * Injectable so the adapter can be unit-tested without Docker.
 */
export type CommandRunner = (command: string) => string;

const defaultRunner: CommandRunner = (command) =>
  execSync(command, {
    encoding: 'utf-8',
    timeout: 5000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

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
 */
export class RconCliAdapter implements IRconPort {
  constructor(private readonly run: CommandRunner = defaultRunner) {}

  async getEntityPosition(
    container: string,
    player: string
  ): Promise<EntityPosition | null> {
    let posOutput: string;
    try {
      posOutput = this.run(
        `docker exec ${container} rcon-cli data get entity ${player} Pos`
      );
    } catch {
      return null;
    }

    const pos = parsePos(posOutput);
    if (!pos) return null;

    let dimension: Dimension | undefined;
    try {
      dimension = parseDimension(
        this.run(
          `docker exec ${container} rcon-cli data get entity ${player} Dimension`
        )
      );
    } catch {
      dimension = undefined;
    }

    return { ...pos, dimension };
  }
}
