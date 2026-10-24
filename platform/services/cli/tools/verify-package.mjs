// Packs the CLI and checks the tarball ships the BlueMap Dockerfile the map renderer builds from
// and no scripts/ directory (removed in v3.0.0, #736). Exits non-zero on any mismatch.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cliRoot = resolve(import.meta.dirname, '..');
const tmp = mkdtempSync(join(tmpdir(), 'mcctl-verify-'));
const errors = [];

try {
  execFileSync('pnpm', ['pack', '--pack-destination', tmp], { cwd: cliRoot, stdio: 'ignore' });
  const tgz = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
  execFileSync('tar', ['-xzf', join(tmp, tgz), '-C', tmp]);
  const pkg = join(tmp, 'package');

  if (existsSync(join(pkg, 'scripts'))) errors.push('package contains scripts/');
  if (!existsSync(join(pkg, 'docker/bluemap/Dockerfile'))) errors.push('package is missing docker/bluemap/Dockerfile');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('verify:package OK');
