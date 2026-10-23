import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkTemplates } from './check-templates.mjs';

const realSrc = resolve(import.meta.dirname, '..', 'templates');
const realRoot = resolve(import.meta.dirname, '..', '..', '..', '..');

// Temp repo: copy of the templates with the platform links pointing at the copy.
function fixture(mutate) {
  const root = mkdtempSync(join(tmpdir(), 'check-templates-'));
  const src = join(root, 'platform/services/cli/templates');
  cpSync(realSrc, src, { recursive: true });
  mkdirSync(join(root, 'platform/servers'), { recursive: true });
  symlinkSync(join(src, 'docker-compose.yml'), join(root, 'platform/docker-compose.yml'));
  symlinkSync(join(src, '.env.example'), join(root, 'platform/.env.example'));
  symlinkSync(join(src, 'servers/_template'), join(root, 'platform/servers/_template'));
  symlinkSync(join(src, 'servers/global.env'), join(root, 'platform/servers/global.env'));
  mutate?.(src);
  const errors = checkTemplates(src, root);
  rmSync(root, { recursive: true, force: true });
  return errors;
}
const edit = (file, fn) => (src) => writeFileSync(join(src, file), fn(readFileSync(join(src, file), 'utf8')));

test('the real tree passes', () => assert.deepEqual(checkTemplates(realSrc, realRoot), []));
test('pristine copy passes', () => assert.deepEqual(fixture(), []));

test('swapped API/console ports are rejected', () => {
  const e = fixture(edit('ecosystem.config.js', (s) => s.replace('PORT: 5001', 'PORT: X').replace('PORT: 5000', 'PORT: 5001').replace('PORT: X', 'PORT: 5000')));
  assert.ok(e.some((m) => m.includes('mcctl-api PORT')));
  assert.ok(e.some((m) => m.includes('mcctl-console PORT')));
});

test('mcctl-api without the auto-backup kill_timeout is rejected (#734)', () => {
  const e = fixture(edit('ecosystem.config.js', (s) => s.replace(/^\s*kill_timeout: .*\n/m, '')));
  assert.ok(e.some((m) => m.includes('mcctl-api kill_timeout')));
});

test('expected value only in a comment + wrong active value is rejected', () => {
  const e = fixture((src) => {
    edit('docker-compose.yml', (s) => s.replace('DOCKER_TIMEOUT: "120s"', '# DOCKER_TIMEOUT: "120s"\n      DOCKER_TIMEOUT: "120"'))(src);
    edit('servers/_template/config.env', (s) => s.replace(/^EXTRA_ARGS=.*$/m, '# EXTRA_ARGS=--universe /worlds/'))(src);
    edit('ecosystem.config.js', (s) => s.replace("PORT: 5001,", "// PORT: 5001,\n        PORT: 3001,"))(src);
  });
  assert.ok(e.some((m) => m.includes('DOCKER_TIMEOUT')));
  assert.ok(e.some((m) => m.includes('EXTRA_ARGS')));
  assert.ok(e.some((m) => m.includes('mcctl-api PORT')));
});

test('a plain copy instead of a symlink is rejected', () => {
  const root = mkdtempSync(join(tmpdir(), 'check-templates-'));
  const src = join(root, 'platform/services/cli/templates');
  cpSync(realSrc, src, { recursive: true });
  mkdirSync(join(root, 'platform'), { recursive: true });
  cpSync(join(src, 'docker-compose.yml'), join(root, 'platform/docker-compose.yml'));
  const e = checkTemplates(src, root);
  rmSync(root, { recursive: true, force: true });
  assert.ok(e.some((m) => m.startsWith('platform/docker-compose.yml')));
});
