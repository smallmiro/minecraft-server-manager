import { afterAll } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const EMPTY_DAEMON = `#!/bin/sh
[ "$1" = ps ] && exit 0
echo "docker $*: real docker is not used in unit tests (#666)" >&2
exit 1
`;

/**
 * Puts a stand-in docker first on PATH for the rest of the test file (#666):
 * a daemon with no containers, where `ps` answers empty and every other
 * command fails. Call it from a vitest setup file so no unit test reaches the
 * host's Docker; a test that needs workloads prepends its own fake docker.
 */
export function installTestDocker(): void {
  const dir = mkdtempSync(join(tmpdir(), 'mcctl-test-docker-'));
  writeFileSync(join(dir, 'docker'), EMPTY_DAEMON);
  chmodSync(join(dir, 'docker'), 0o755);
  const saved = process.env['PATH'];
  process.env['PATH'] = `${dir}${delimiter}${saved ?? ''}`;
  afterAll(() => {
    process.env['PATH'] = saved;
    rmSync(dir, { recursive: true, force: true });
  });
}
