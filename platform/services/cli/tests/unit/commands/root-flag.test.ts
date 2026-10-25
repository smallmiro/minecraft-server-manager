/** `--root` reaches `console user`, `console api` and `audit` (#824). */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const state = vi.hoisted(() => ({ options: undefined as unknown }));
vi.mock('../../../src/infrastructure/di/container.js', () => ({
  getContainer: (o: unknown) => {
    state.options = o;
    return { auditLogPort: { query: async () => [], count: async () => 0, getStats: async () => ({}) } };
  },
}));

import { consoleApiCommand } from '../../../src/commands/console/api.js';
import { consoleUserCommand } from '../../../src/commands/console/user.js';
import { auditCommand } from '../../../src/commands/audit.js';

let root: string;
let output: string[];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-cli-root-'));
  writeFileSync(join(root, 'docker-compose.yml'), 'services: {}\n');
  output = [];
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void output.push(a.join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void output.push(a.join(' ')));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('--root', () => {
  it('console api reads api-config.json under the given root', async () => {
    writeFileSync(
      join(root, 'api-config.json'),
      JSON.stringify({ accessMode: 'internal', apiKey: 'mctk_x', port: 5999, ipWhitelist: [] })
    );

    await consoleApiCommand(root).parseAsync(['status', '--json'], { from: 'user' });

    expect(output.join('\n')).toContain('5999');
  });

  it('console user keeps its database under the given root', async () => {
    mkdirSync(join(root, 'data'), { recursive: true });

    await consoleUserCommand(root).parseAsync(['list', '--json'], { from: 'user' });

    expect(existsSync(join(root, 'data', 'mcctl.db'))).toBe(true);
  });

  it('audit uses the given root for the platform check and the container', async () => {
    await auditCommand({ subcommand: 'stats', root });

    expect(state.options).toMatchObject({ rootDir: root });
  });
});
