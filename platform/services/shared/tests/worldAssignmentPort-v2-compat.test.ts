/**
 * IWorldAssignmentPort was a public (reserved) export before #670. v2.x keeps
 * its contract (#715, #736): getAssignment stays (deprecated), listAssignments
 * still returns WorldAssignment[], and WorldAssignment.internal is optional.
 * Richer reads (internal, undetermined) come from the added snapshot().
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { Paths } from '../src/utils/index.js';
import { ConfigEnvWorldAssignmentAdapter } from '../src/infrastructure/adapters/ConfigEnvWorldAssignmentAdapter.js';
import { WorldAssignmentError } from '../src/domain/services/worldAssignment.js';

const UNIVERSE = 'EXTRA_ARGS=--universe /worlds/\n';
let root: string;
let adapter: ConfigEnvWorldAssignmentAdapter;

function server(name: string, configEnv: string): void {
  mkdirSync(join(root, 'servers', name), { recursive: true });
  writeFileSync(join(root, 'servers', name, 'config.env'), configEnv);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-port-v2-'));
  adapter = new ConfigEnvWorldAssignmentAdapter(new Paths(root));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('IWorldAssignmentPort v2 contract (#670)', () => {
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

  it('getAssignment (deprecated) returns the holder of a world family, or null', async () => {
    server('a', `LEVEL=w\n${UNIVERSE}`);

    expect(await adapter.getAssignment('w')).toBe('a');
    expect(await adapter.getAssignment('w_nether')).toBe('a');
    expect(await adapter.getAssignment('free')).toBeNull();
  });

  it('getAssignment refuses to answer "free" while a server is undetermined', async () => {
    server('bad', `LEVEL=../x\n${UNIVERSE}`);

    await expect(adapter.getAssignment('free')).rejects.toBeInstanceOf(WorldAssignmentError);
  });

  it('v2 consumer code still type-checks', () => {
    const testsDir = dirname(fileURLToPath(import.meta.url));
    const file = join(testsDir, `.world-port-compat-${process.pid}.ts`);
    writeFileSync(
      file,
      [
        "import type { IWorldAssignmentPort, WorldAssignment } from '../src/index.js';",
        "export const a: WorldAssignment = { world: 'w', server: 's' };",
        'export async function use(port: IWorldAssignmentPort): Promise<void> {',
        "  const holder: string | null = await port.getAssignment('w');",
        '  const list: WorldAssignment[] = await port.listAssignments();',
        "  const first: { world: string; server: string } | undefined = list[0];",
        "  await port.assign('w', 's');",
        '  void holder; void first;',
        '}',
      ].join('\n')
    );
    try {
      const { options } = ts.parseJsonConfigFileContent(
        { extends: '../tsconfig.json', compilerOptions: { noEmit: true, rootDir: '..' } },
        ts.sys,
        testsDir
      );
      const program = ts.createProgram([file], options);
      const errors = ts
        .getPreEmitDiagnostics(program)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
      expect(errors).toEqual([]);
    } finally {
      rmSync(file, { force: true });
    }
  });
});
