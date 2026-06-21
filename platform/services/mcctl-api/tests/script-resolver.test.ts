import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { resolveScriptPath } from '../src/lib/script-resolver.js';

const TMP = join(import.meta.dirname, '.tmp-script-resolver-test');
const BUNDLED = join(TMP, 'bundled-scripts');
const PLATFORM = join(TMP, 'platform');

function writeScript(dir: string, name: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), '#!/usr/bin/env bash\n', 'utf-8');
}

describe('resolveScriptPath', () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('prefers the bundled (version-matched) script over the deployed platform copy', () => {
    writeScript(BUNDLED, 'create-server.sh');
    writeScript(join(PLATFORM, 'scripts'), 'create-server.sh');

    const resolved = resolveScriptPath('create-server.sh', PLATFORM, BUNDLED);

    expect(resolved).not.toBeNull();
    expect(resolved!.scriptsDir).toBe(BUNDLED);
    expect(resolved!.scriptPath).toBe(join(BUNDLED, 'create-server.sh'));
  });

  it('falls back to the deployed platform script when no bundled script exists', () => {
    writeScript(join(PLATFORM, 'scripts'), 'create-server.sh');

    const resolved = resolveScriptPath('create-server.sh', PLATFORM, BUNDLED);

    expect(resolved).not.toBeNull();
    expect(resolved!.scriptsDir).toBe(join(PLATFORM, 'scripts'));
    expect(resolved!.scriptPath).toBe(join(PLATFORM, 'scripts', 'create-server.sh'));
  });

  it('returns null when the script exists in neither location (caller uses mcctl CLI fallback)', () => {
    const resolved = resolveScriptPath('create-server.sh', PLATFORM, BUNDLED);
    expect(resolved).toBeNull();
  });

  it('resolves each script name independently', () => {
    writeScript(BUNDLED, 'delete-server.sh');
    writeScript(join(PLATFORM, 'scripts'), 'backup.sh');

    const del = resolveScriptPath('delete-server.sh', PLATFORM, BUNDLED);
    const backup = resolveScriptPath('backup.sh', PLATFORM, BUNDLED);
    const missing = resolveScriptPath('create-server.sh', PLATFORM, BUNDLED);

    expect(del!.scriptsDir).toBe(BUNDLED);
    expect(backup!.scriptsDir).toBe(join(PLATFORM, 'scripts'));
    expect(missing).toBeNull();
  });
});
