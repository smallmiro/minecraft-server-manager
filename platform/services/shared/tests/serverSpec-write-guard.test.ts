/**
 * Write guard (#675, ADR-0003 §6): from PR 3 on, servers/<n>/config.env and
 * the server docker-compose.yml are written only by the ServerSpec repository
 * (rendered from server.yaml). A source file that names one of them and also
 * writes files must be on the allow-list below with the reason.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVICES = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOTS = ['shared/src', 'cli/src', 'mcctl-api/src', 'mcctl-console/src'];

/** Files allowed to name config.env / docker-compose.yml and write files, and why. */
const ALLOWED: Record<string, string> = {
  'shared/src/infrastructure/adapters/server-spec/FileServerSpecRepository.ts': 'the repository: renders the generated files',
  'shared/src/infrastructure/adapters/server-spec/DockerComposeRenderer.ts': 'renders file contents; writes nothing itself',
  'cli/src/lib/server-env-migration.ts': 'repoints env_file of never-imported servers; kept until v3.0.0 (#736)',
  'shared/src/infrastructure/adapters/FileSystemConfigFileCollector.ts':
    'config snapshot restore writes a consistent set (server.yaml with its generated files), or a pre-#675 set that load() absorbs',
  // Name config.env / docker-compose.yml only to read them, or name the platform docker-compose.yml /
  // the bundled servers/_template copies; the files they write are other files.
  'shared/src/infrastructure/adapters/GitWorldBackupAdapter.ts': 'reads config.env (LEVEL); writes the backup repository',
  'shared/src/utils/index.ts': 'Paths.composeFile is the platform docker-compose.yml; writes .env and .mcctl.json',
  'cli/src/commands/init.ts': 'writes the platform docker-compose.yml, .env and the servers/_template copy',
  'cli/src/commands/upgrade.ts': 'patches the platform docker-compose.yml and the servers/_template copy',
  'cli/src/commands/playit.ts': 'adds the playit service to the platform docker-compose.yml; domains go through the ServerSpec',
  'cli/src/commands/migrate.ts': 'copies world directories; config changes go through the ServerSpec',
  'cli/src/commands/server-backup.ts': 'reads config.env / docker-compose.yml into the backup; writes the manifest',
  'mcctl-api/src/services/PlayerFileService.ts': 'reads config.env; writes the player JSON files; ENABLE_WHITELIST goes through the ServerSpec',
};

/** File writes (fs and the atomic writer). */
const WRITE = /\b(writeFile|writeFileSync|atomicWriteFile|atomicWriteFileSync|appendFile|appendFileSync|copyFile|copyFileSync)\s*\(/;
/** A string literal naming a generated server file. */
const NAMES = /['"`][^'"`\n]*(config\.env|docker-compose\.yml)[^'"`\n]*['"`]/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('generated server files are written only through the ServerSpec repository (#675)', () => {
  it('has no other writer of config.env or a server docker-compose.yml', () => {
    const offenders = ROOTS.flatMap((root) => sources(join(SERVICES, root)))
      .map((path) => relative(SERVICES, path))
      .filter((path) => !(path in ALLOWED))
      .filter((path) => {
        const code = withoutComments(readFileSync(join(SERVICES, path), 'utf-8'));
        return WRITE.test(code) && NAMES.test(code);
      });
    expect(offenders).toEqual([]);
  });
});
