import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mockConfirm = vi.fn();
const logInfo = vi.fn();
const logWarn = vi.fn();
vi.mock('@clack/prompts', () => ({
  confirm: (...a: unknown[]) => mockConfirm(...a),
  isCancel: (v: unknown) => v === Symbol.for('cancel'),
  log: { success: vi.fn(), info: (...a: unknown[]) => logInfo(...a), warn: (...a: unknown[]) => logWarn(...a) },
}));

import { handleLegacyScripts, LEGACY_SCRIPTS_DOC_URL } from '../../../src/lib/legacy-scripts.js';

let root: string;
const said = () => [...logInfo.mock.calls, ...logWarn.mock.calls].map((c) => String(c[0])).join('\n');

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcctl-legacy-'));
  mockConfirm.mockReset();
  logInfo.mockReset();
  logWarn.mockReset();
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function makeScripts(): string {
  const dir = join(root, 'scripts');
  mkdirSync(join(dir, 'lib'), { recursive: true });
  writeFileSync(join(dir, 'lib', 'common.sh'), '# mine');
  return dir;
}

describe('handleLegacyScripts (#736)', () => {
  it('lists what is inside before asking (#777 review)', async () => {
    const dir = makeScripts();
    writeFileSync(join(dir, 'my-cron.sh'), '# mine');
    mockConfirm.mockResolvedValue(false);
    await handleLegacyScripts(root, { interactive: true });
    expect(said()).toContain('lib/');
    expect(said()).toContain('my-cron.sh');
  });

  // root ignores the read-only folder that makes the removal fail
  it.skipIf(process.getuid?.() === 0)('warns and returns instead of failing the upgrade when the removal fails (#777 review)', async () => {
    const dir = makeScripts();
    mockConfirm.mockResolvedValue(true);
    chmodSync(join(dir, 'lib'), 0o500); // lib/common.sh cannot be removed
    try {
      await expect(handleLegacyScripts(root, { interactive: true })).resolves.toBeUndefined();
      expect(said()).toContain('Could not remove');
      expect(said()).toContain(`rm -r ${dir}`);
    } finally {
      chmodSync(join(dir, 'lib'), 0o700);
    }
  });

  it('does nothing when <root>/scripts is absent', async () => {
    await handleLegacyScripts(root, { interactive: true });
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(logWarn).not.toHaveBeenCalled();
  });

  it('interactive y deletes the folder and shows path, warning and doc URL', async () => {
    const dir = makeScripts();
    mockConfirm.mockResolvedValue(true);
    await handleLegacyScripts(root, { interactive: true });
    expect(said()).toContain(dir);
    expect(said()).toContain('v3.0.0');
    expect(said()).toContain(LEGACY_SCRIPTS_DOC_URL);
    expect(mockConfirm.mock.calls[0]![0].initialValue).toBe(false);
    expect(existsSync(dir)).toBe(false);
  });

  it('interactive n or cancel keeps the folder', async () => {
    const dir = makeScripts();
    mockConfirm.mockResolvedValueOnce(false);
    await handleLegacyScripts(root, { interactive: true });
    mockConfirm.mockResolvedValueOnce(Symbol.for('cancel'));
    await handleLegacyScripts(root, { interactive: true });
    expect(existsSync(dir)).toBe(true);
  });

  it('non-interactive only informs', async () => {
    const dir = makeScripts();
    await handleLegacyScripts(root, { interactive: false });
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(said()).toContain(LEGACY_SCRIPTS_DOC_URL);
    expect(existsSync(dir)).toBe(true);
  });

  it('dry-run does not ask or delete, and says what it would do', async () => {
    const dir = makeScripts();
    await handleLegacyScripts(root, { interactive: true, dryRun: true });
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(said()).toContain('Would');
    expect(existsSync(dir)).toBe(true);
  });

  it('a symlink is unlinked and its target is left alone', async () => {
    const target = join(root, 'elsewhere');
    mkdirSync(target);
    writeFileSync(join(target, 'keep.sh'), 'x');
    const link = join(root, 'scripts');
    symlinkSync(target, link);
    mockConfirm.mockResolvedValue(true);
    await handleLegacyScripts(root, { interactive: true });
    expect(() => lstatSync(link)).toThrow();
    expect(existsSync(join(target, 'keep.sh'))).toBe(true);
  });
});
