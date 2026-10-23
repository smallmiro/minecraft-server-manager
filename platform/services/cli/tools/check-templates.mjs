// Template drift check (#651): platform/services/cli/templates/ is the single source.
// Other locations must not hold their own copy, and the source must carry the agreed values.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

const cliRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(cliRoot, '..', '..', '..');
const src = resolve(cliRoot, 'templates');
const read = (p) => readFileSync(resolve(src, p), 'utf8');
const errors = [];

if (existsSync(resolve(repoRoot, 'templates'))) {
  errors.push('templates/ (repo root) must not exist: the single source is platform/services/cli/templates/');
}

// Dev-runtime paths must resolve (symlink) to the single source.
const links = {
  'platform/docker-compose.yml': 'docker-compose.yml',
  'platform/servers/_template': 'servers/_template',
};
for (const [dev, source] of Object.entries(links)) {
  const p = resolve(repoRoot, dev);
  if (!existsSync(p) || realpathSync(p) !== realpathSync(resolve(src, source))) {
    errors.push(`${dev} must be a symlink to platform/services/cli/templates/${source}`);
  }
}

const must = (file, re, msg) => {
  if (!re.test(read(file))) errors.push(`${file}: ${msg}`);
};
must('servers/_template/config.env', /^EXTRA_ARGS=--universe \/worlds\/$/m, 'missing EXTRA_ARGS=--universe /worlds/');
must('docker-compose.yml', /AUTO_SCALE_DOWN_AFTER: "10m"/, 'AUTO_SCALE_DOWN_AFTER must default to 10m');
must('docker-compose.yml', /DOCKER_TIMEOUT: "120s"/, 'DOCKER_TIMEOUT must be "120s" (Go duration)');
must('ecosystem.config.js', /PORT: 5001,/, 'API port must be 5001');
must('ecosystem.config.js', /PORT: 5000,/, 'console port must be 5000');
if (/\b300[01]\b/.test(read('ecosystem.config.js'))) errors.push('ecosystem.config.js: stale 3000/3001 port');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('check:templates OK');
