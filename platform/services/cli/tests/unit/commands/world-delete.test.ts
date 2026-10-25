/**
 * `mcctl world delete <world>` asks before deleting (#823): --force/--yes skip the
 * question, a missing terminal refuses, and --json never deletes unasked.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const state = vi.hoisted(() => ({ container: undefined as unknown }));
vi.mock('../../../src/infrastructure/di/container.js', () => ({
  getContainer: () => state.container,
}));

import { worldCommand } from '../../../src/commands/world.js';

let root: string;
let output: string[];
let confirm: ReturnType<typeof vi.fn>;
let deleteWorldByName: ReturnType<typeof vi.fn>;
const tty = process.stdin.isTTY;
const setTty = (v: boolean) => Object.defineProperty(process.stdin, 'isTTY', { value: v, configurable: true });
const run = (extra: { force?: boolean; yes?: boolean; json?: boolean } = {}) =>
  worldCommand({ root, subCommand: 'delete', worldName: 'myworld', ...extra });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-cli-wdel-'));
  writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
  confirm = vi.fn().mockResolvedValue(true);
  deleteWorldByName = vi.fn().mockResolvedValue({ success: true, worldName: 'myworld', size: '1 MB' });
  state.container = {
    promptPort: { isCancel: () => false, confirm },
    worldManagementUseCase: {
      listWorlds: async () => [{ name: 'myworld', size: '1 MB' }],
      deleteWorldByName,
    },
  };
  output = [];
  const capture = (...args: unknown[]) => output.push(args.join(' '));
  vi.spyOn(console, 'log').mockImplementation(capture);
  vi.spyOn(console, 'error').mockImplementation(capture);
  vi.spyOn(console, 'warn').mockImplementation(capture);
});

afterEach(() => {
  vi.restoreAllMocks();
  setTty(tty as boolean);
  rmSync(root, { recursive: true, force: true });
});

describe('mcctl world delete <world>', () => {
  it('deletes after the user confirms in a terminal, showing name and size', async () => {
    setTty(true);

    expect(await run()).toBe(0);
    expect(confirm.mock.calls[0][0]).toMatchObject({ initialValue: false });
    expect(confirm.mock.calls[0][0].message).toContain('myworld');
    expect(confirm.mock.calls[0][0].message).toContain('1 MB');
    expect(deleteWorldByName).toHaveBeenCalledOnce();
  });

  it('deletes nothing when the user declines', async () => {
    setTty(true);
    confirm.mockResolvedValue(false);

    expect(await run()).toBe(1);
    expect(deleteWorldByName).not.toHaveBeenCalled();
  });

  it('refuses without a terminal and without --force', async () => {
    setTty(false);

    expect(await run()).toBe(1);
    expect(output.join('\n')).toContain('Pass --force to confirm.');
    expect(confirm).not.toHaveBeenCalled();
    expect(deleteWorldByName).not.toHaveBeenCalled();
  });

  it.each([{ force: true }, { yes: true }])('deletes without asking for %o', async (flag) => {
    setTty(false);

    expect(await run(flag)).toBe(0);
    expect(confirm).not.toHaveBeenCalled();
    expect(deleteWorldByName).toHaveBeenCalledOnce();
  });

  it('does not delete with --json alone, even in a terminal', async () => {
    setTty(true);

    expect(await run({ json: true })).toBe(1);
    expect(confirm).not.toHaveBeenCalled();
    expect(deleteWorldByName).not.toHaveBeenCalled();
  });

  it('deletes with --json --force', async () => {
    setTty(false);

    expect(await run({ json: true, force: true })).toBe(0);
    expect(deleteWorldByName).toHaveBeenCalledOnce();
  });
});
