/**
 * ConfigEnvWorldAssignmentAdapter reads (#670): listAssignments returns the
 * readable assignments, snapshot adds the undetermined servers.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Paths } from '../src/utils/index.js';
import { ConfigEnvWorldAssignmentAdapter } from '../src/infrastructure/adapters/ConfigEnvWorldAssignmentAdapter.js';

const UNIVERSE = 'EXTRA_ARGS=--universe /worlds/\n';
let root: string;
let adapter: ConfigEnvWorldAssignmentAdapter;

function server(name: string, configEnv: string): void {
  mkdirSync(join(root, 'servers', name), { recursive: true });
  writeFileSync(join(root, 'servers', name, 'config.env'), configEnv);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-port-list-'));
  adapter = new ConfigEnvWorldAssignmentAdapter(new Paths(root));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('ConfigEnvWorldAssignmentAdapter reads (#670)', () => {
  it('listAssignments returns the readable assignments as an array', async () => {
    server('a', `LEVEL=w\n${UNIVERSE}`);
    server('bad', `LEVEL=../x\n${UNIVERSE}`);

    expect(await adapter.listAssignments()).toEqual([{ server: 'a', world: 'w', internal: false }]);
  });

  it('snapshot returns assignments and undetermined servers', async () => {
    server('a', `LEVEL=w\n${UNIVERSE}`);
    server('bad', `LEVEL=../x\n${UNIVERSE}`);

    expect(await adapter.snapshot()).toEqual({
      assignments: [{ server: 'a', world: 'w', internal: false }],
      undetermined: ['bad'],
    });
  });
});
