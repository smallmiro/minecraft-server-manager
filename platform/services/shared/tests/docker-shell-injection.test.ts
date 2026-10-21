import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  containerExists,
  startContainer,
  stopContainer,
  getOnlinePlayers,
} from '../src/docker/index.js';

// A fake `docker` first on PATH records the argv it receives (NUL-separated).
// If a helper goes through a shell, the name gets split, substituted or chained,
// so the recorded argv differs from the name and injected commands run.
const FAKE_DOCKER = `#!/bin/sh
printf '%s\\0' "$@" > "$FAKE_DOCKER_ARGS"
printf '%s' "$FAKE_DOCKER_STDOUT"
exit "\${FAKE_DOCKER_EXIT:-1}"
`;

const NAMES = ['a;id', '$(id)', 'a b', '`id`', 'a&&b', 'a|b'];

const HELPERS = [
  { name: 'containerExists', run: (c: string) => containerExists(c), argv: (c: string) => ['inspect', c] },
  { name: 'startContainer', run: (c: string) => startContainer(c), argv: (c: string) => ['start', c] },
  { name: 'stopContainer', run: (c: string) => stopContainer(c), argv: (c: string) => ['stop', c] },
  { name: 'getOnlinePlayers', run: (c: string) => getOnlinePlayers(c), argv: (c: string) => ['exec', c, 'rcon-cli', 'list'] },
];

describe('docker helpers do not pass container names through a shell (#720)', () => {
  let dir: string;
  let argsFile: string;

  const recordedArgv = (): string[] => readFileSync(argsFile, 'utf-8').split('\0').slice(0, -1);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'docker-shell-injection-'));
    argsFile = join(dir, 'argv');
    writeFileSync(join(dir, 'docker'), FAKE_DOCKER, { mode: 0o755 });
    vi.stubEnv('PATH', `${dir}:${process.env.PATH}`);
    vi.stubEnv('FAKE_DOCKER_ARGS', argsFile);
    vi.stubEnv('FAKE_DOCKER_STDOUT', '');
    vi.stubEnv('FAKE_DOCKER_EXIT', '1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  for (const helper of HELPERS) {
    describe(helper.name, () => {
      it.each(NAMES)('passes %s to docker as one verbatim argument', async (container) => {
        await helper.run(container);
        expect(recordedArgv()).toEqual(helper.argv(container));
      });

      it('does not run commands embedded in the name', async () => {
        const marker = join(dir, 'pwned');
        // `#` comments out the rest of the line so the payload stays self-contained under a shell
        const payloads = [`a;touch ${marker} #`, `$(touch ${marker})`, `\`touch ${marker}\``, `a|touch ${marker} #`];
        for (const payload of payloads) {
          await helper.run(payload);
        }
        expect(existsSync(marker)).toBe(false);
      });
    });
  }

  describe('keeps the existing results', () => {
    it('reports success when docker exits 0', () => {
      vi.stubEnv('FAKE_DOCKER_EXIT', '0');
      expect(containerExists('mc-survival')).toBe(true);
      expect(startContainer('mc-survival')).toBe(true);
      expect(stopContainer('mc-survival')).toBe(true);
    });

    it('reports failure when docker exits non-zero', () => {
      expect(containerExists('mc-survival')).toBe(false);
      expect(startContainer('mc-survival')).toBe(false);
      expect(stopContainer('mc-survival')).toBe(false);
    });

    it('parses the rcon-cli player list', async () => {
      vi.stubEnv('FAKE_DOCKER_EXIT', '0');
      vi.stubEnv('FAKE_DOCKER_STDOUT', 'There are 2 of a max of 20 players online: Steve, Alex\n');
      expect(await getOnlinePlayers('mc-survival')).toEqual({ online: 2, max: 20, players: ['Steve', 'Alex'] });
    });

    it('returns null when rcon-cli fails', async () => {
      expect(await getOnlinePlayers('mc-survival')).toBeNull();
    });
  });
});
