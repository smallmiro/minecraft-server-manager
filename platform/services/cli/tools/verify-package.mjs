// Packs the CLI and checks the tarball ships the same scripts as platform/scripts (minus tests/),
// plus the BlueMap Dockerfile the map renderer builds from. Exits non-zero on any mismatch.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cliRoot = resolve(import.meta.dirname, '..');
const platformScripts = resolve(cliRoot, '..', '..', 'scripts');
const tmp = mkdtempSync(join(tmpdir(), 'mcctl-verify-'));
const errors = [];

try {
  execFileSync('pnpm', ['pack', '--pack-destination', tmp], { cwd: cliRoot, stdio: 'ignore' });
  const tgz = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
  execFileSync('tar', ['-xzf', join(tmp, tgz), '-C', tmp]);
  const pkg = join(tmp, 'package');

  if (existsSync(join(pkg, 'scripts', 'tests'))) errors.push('package contains scripts/tests/');
  if (!existsSync(join(pkg, 'docker/bluemap/Dockerfile'))) errors.push('package is missing docker/bluemap/Dockerfile');
  try {
    execFileSync('diff', ['-r', '-x', 'tests', '-x', '.gitkeep', platformScripts, join(pkg, 'scripts')], { encoding: 'utf8' });
  } catch (e) {
    errors.push(`packaged scripts differ from platform/scripts:\n${e.stdout ?? e.message}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('verify:package OK');
