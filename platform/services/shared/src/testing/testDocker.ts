import { afterAll } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

// Read-only queries answer as docker 27 / compose 2.29 would (mcctl init checks them).
const EMPTY_DAEMON = `#!/bin/sh
case "$*" in
  ps|ps\\ *) exit 0 ;;
  --version) echo "Docker version 27.0.0, build test" ; exit 0 ;;
  "version --format {{.Server.Version}}") echo 27.0.0 ; exit 0 ;;
  version) printf 'Client:\\n Version: 27.0.0\\n\\nServer:\\n Engine:\\n  Version: 27.0.0\\n' ; exit 0 ;;
  info|info\\ *) printf 'Containers: 0\\n Running: 0\\nServer Version: 27.0.0\\n' ; exit 0 ;;
  "compose version --short") echo 2.29.0 ; exit 0 ;;
  "compose version") echo "Docker Compose version v2.29.0" ; exit 0 ;;
esac
echo "docker $*: real docker is not used in unit tests (#666)" >&2
exit 1
`;

/**
 * Puts a stand-in docker first on PATH for the rest of the test file (#666):
 * a daemon with no containers. `ps` answers empty, `info` and the version
 * queries answer as docker 27 with compose 2.29, and every other command
 * fails. Call it from a vitest setup file so no unit test reaches the host's
 * Docker; a test that needs workloads prepends its own fake docker.
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
