// Template drift check (#651): platform/services/cli/templates/ is the single source.
// Other locations must not hold their own copy, and the source must carry the agreed values.
// Values are read structurally (YAML / evaluated ecosystem / active config.env lines), so
// comments or swapped values cannot satisfy the check.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import yaml from 'js-yaml';

const LINKS = {
  'platform/docker-compose.yml': 'docker-compose.yml',
  'platform/servers/_template': 'servers/_template',
  'platform/servers/global.env': 'servers/global.env',
  'platform/.env.example': '.env.example',
};

/** @returns {string[]} error messages (empty when OK). `src` = templates dir, `repoRoot` = repo root. */
export function checkTemplates(src, repoRoot) {
  const errors = [];
  const read = (p) => readFileSync(resolve(src, p), 'utf8');

  if (existsSync(resolve(repoRoot, 'templates'))) {
    errors.push('templates/ (repo root) must not exist: the single source is platform/services/cli/templates/');
  }
  for (const [dev, source] of Object.entries(LINKS)) {
    const p = resolve(repoRoot, dev);
    if (!existsSync(p) || realpathSync(p) !== realpathSync(resolve(src, source))) {
      errors.push(`${dev} must be a symlink to platform/services/cli/templates/${source}`);
    }
  }

  // config.env: active (non-comment) lines only
  const active = read('servers/_template/config.env')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (!active.includes('EXTRA_ARGS=--universe /worlds/')) {
    errors.push('servers/_template/config.env: missing active EXTRA_ARGS=--universe /worlds/');
  }

  // docker-compose.yml: router environment
  const env = yaml.load(read('docker-compose.yml'))?.services?.router?.environment ?? {};
  for (const [key, want] of [['AUTO_SCALE_DOWN_AFTER', '10m'], ['DOCKER_TIMEOUT', '120s']]) {
    if (String(env[key]) !== want) errors.push(`docker-compose.yml: router ${key} must be "${want}", got ${JSON.stringify(env[key])}`);
  }

  // ecosystem.config.js: per-app env (evaluated, so comments are ignored)
  const mod = { exports: {} };
  vm.runInNewContext(read('ecosystem.config.js'), { module: mod, process: { env: {} } });
  const appEnv = (name) => mod.exports.apps?.find((a) => a.name === name)?.env ?? {};
  const api = appEnv('mcctl-api');
  const con = appEnv('mcctl-console');
  if (String(api.PORT) !== '5001') errors.push(`ecosystem.config.js: mcctl-api PORT must be 5001, got ${api.PORT}`);
  if (String(con.PORT) !== '5000') errors.push(`ecosystem.config.js: mcctl-console PORT must be 5000, got ${con.PORT}`);
  if (con.MCCTL_API_URL !== 'http://localhost:5001') {
    errors.push(`ecosystem.config.js: mcctl-console MCCTL_API_URL must be http://localhost:5001, got ${con.MCCTL_API_URL}`);
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cliRoot = resolve(import.meta.dirname, '..');
  const errors = checkTemplates(resolve(cliRoot, 'templates'), resolve(cliRoot, '..', '..', '..'));
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('check:templates OK');
}
