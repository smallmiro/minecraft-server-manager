import { describe, it, expect } from 'vitest';
import { RconCliAdapter, type CommandRunner } from '../src/infrastructure/adapters/RconCliAdapter.js';
import { Dimension } from '../src/domain/index.js';

describe('RconCliAdapter', () => {
  it('parses Pos and Dimension into an EntityPosition', async () => {
    const calls: string[][] = [];
    const runner: CommandRunner = async (file, args) => {
      calls.push([file, ...args]);
      if (args.includes('Pos')) {
        return 'Steve has the following entity data: [123.5d, 70.0d, -45.25d]';
      }
      if (args.includes('Dimension')) {
        return 'Steve has the following entity data: "minecraft:the_nether"';
      }
      return '';
    };
    const adapter = new RconCliAdapter(runner);

    const pos = await adapter.getEntityPosition('mc-survival', 'Steve');

    expect(pos).not.toBeNull();
    expect(pos!.x).toBeCloseTo(123.5);
    expect(pos!.y).toBeCloseTo(70);
    expect(pos!.z).toBeCloseTo(-45.25);
    expect(pos!.dimension).toBe(Dimension.Nether);
    // argv form: no shell string, player passed as a discrete argument
    expect(calls[0]).toEqual([
      'docker', 'exec', 'mc-survival', 'rcon-cli', 'data', 'get', 'entity', 'Steve', 'Pos',
    ]);
  });

  it('passes player names with spaces safely as a single argument', async () => {
    let captured: string[] = [];
    const runner: CommandRunner = async (_file, args) => {
      captured = args;
      return 'x has the following entity data: [1.0d, 2.0d, 3.0d]';
    };
    const adapter = new RconCliAdapter(runner);
    await adapter.getEntityPosition('mc-x', '.Bedrock Player');
    expect(captured).toContain('.Bedrock Player');
  });

  it('strips ANSI escape codes before parsing', async () => {
    const runner: CommandRunner = async (_file, args) =>
      args.includes('Pos')
        ? '\x1b[0mAlex has the following entity data: [1.0d, 2.0d, 3.0d]\x1b[0m'
        : 'Alex has the following entity data: "minecraft:overworld"';
    const adapter = new RconCliAdapter(runner);

    const pos = await adapter.getEntityPosition('mc-x', 'Alex');
    expect(pos).toEqual({ x: 1, y: 2, z: 3, dimension: Dimension.Overworld });
  });

  it('returns null when the entity is not found', async () => {
    const runner: CommandRunner = async () => 'No entity was found';
    const adapter = new RconCliAdapter(runner);
    expect(await adapter.getEntityPosition('mc-x', 'Ghost')).toBeNull();
  });

  it('returns null when the command throws (server offline)', async () => {
    const runner: CommandRunner = async () => {
      throw new Error('Error: No such container: mc-x');
    };
    const adapter = new RconCliAdapter(runner);
    expect(await adapter.getEntityPosition('mc-x', 'Steve')).toBeNull();
  });

  it('returns position without dimension when Dimension lookup fails', async () => {
    const runner: CommandRunner = async (_file, args) => {
      if (args.includes('Pos')) {
        return 'Steve has the following entity data: [10.0d, 64.0d, 20.0d]';
      }
      throw new Error('dimension failed');
    };
    const adapter = new RconCliAdapter(runner);
    const pos = await adapter.getEntityPosition('mc-x', 'Steve');
    expect(pos).toEqual({ x: 10, y: 64, z: 20, dimension: undefined });
  });
});
