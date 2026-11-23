// Packs the CLI and mcctl-api and checks each tarball ships the BlueMap Dockerfile the map renderer
// builds from and no scripts/ directory (removed in v3.0.0, #736). Exits non-zero on any mismatch.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const services = resolve(import.meta.dirname, '..', '..');
const errors = [];

for (const name of ['cli', 'mcctl-api', 'shared']) {
  const tmp = mkdtempSync(join(tmpdir(), 'mcctl-verify-'));
  try {
    // stderr stays visible, so a failing pack or prepack (sync-docker) shows its cause
    execFileSync('pnpm', ['pack', '--pack-destination', tmp], {
      cwd: join(services, name),
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    const tgz = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
    if (!tgz) {
      errors.push(`${name}: pnpm pack produced no tarball`);
      continue;
    }
    execFileSync('tar', ['-xzf', join(tmp, tgz), '-C', tmp]);
    const pkg = join(tmp, 'package');
    if (existsSync(join(pkg, 'scripts'))) errors.push(`${name}: package contains scripts/`);
    if (name === 'shared') {
      // mcctl-api resolves templates here when the CLI package is not installed next to it (#882)
      for (const f of ['servers/_template/config.env', 'servers/_template/docker-compose.yml', 'servers/global.env']) {
        if (!existsSync(join(pkg, 'templates', f))) errors.push(`shared: package is missing templates/${f}`);
      }
    } else if (!existsSync(join(pkg, 'docker/bluemap/Dockerfile'))) errors.push(`${name}: package is missing docker/bluemap/Dockerfile`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('verify:package OK (cli, mcctl-api, shared)');
