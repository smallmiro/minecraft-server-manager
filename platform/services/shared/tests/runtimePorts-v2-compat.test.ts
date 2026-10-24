/**
 * #665 widened the runtime, console, router and RCON ports to `ServerName | string`
 * and deprecated members instead of removing them (#715: v2.x never breaks a
 * shared export or signature). This compiles v2 consumer code against src.
 * The runtime contract of the released IRconPort is in rconPort-v2-contract.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const V2_CONSUMER = `
import type {
  IContainerRuntimePort, IServerConsolePort, IRouterStatusPort, IRconPort,
  ContainerStatus,
  PlayerListResult, RuntimeActionResult,
} from '../src/index.js';
import {
  ServerName, Server, Paths, ServerRepository, WorldRepository,
  DockerComposeRuntimeAdapter, DockerServerConsoleAdapter, RconCliAdapter, ConfigEnvWorldAssignmentAdapter,
} from '../src/index.js';

// IRconPort shipped in v2.33.0: an implementation declared with a container-name
// string still satisfies it. IContainerRuntimePort, IServerConsolePort and
// IRouterStatusPort were added after v2.33.0 (#654), so no released code
// implements them and they are only exercised as callers below.
export class V2Rcon implements IRconPort {
  async getEntityPosition(container: string, player: string) { return container && player ? null : null; }
}

// v2 callers: container-name strings, deprecated getters and members, old constructors
export async function use(
  runtime: IContainerRuntimePort, console: IServerConsolePort, router: IRouterStatusPort,
  rcon: IRconPort, server: Server
): Promise<void> {
  const status: ContainerStatus = runtime.getStatus('mc-a');
  const started: RuntimeActionResult = await runtime.start('mc-a');
  const players: PlayerListResult | null = await console.listPlayers('mc-a');
  const hosts: string = router.getHostnames('mc-a');
  const pos = await rcon.getEntityPosition('mc-a', 'Steve');
  const name = ServerName.create('a');
  const names: string[] = [name.containerName, name.hostname, server.containerName, server.hostname];
  const paths = new Paths('/srv/mc');
  new ServerRepository(paths);
  new WorldRepository(paths, new ConfigEnvWorldAssignmentAdapter(paths));
  new DockerComposeRuntimeAdapter().getStatus('mc-a');
  await new DockerServerConsoleAdapter().command('mc-a', ['list']);
  await new RconCliAdapter().getEntityPosition('mc-a', 'Steve');
  void status; void started; void players; void hosts; void pos; void names;
}
`;

describe('runtime ports v2 contract (#665)', () => {
  it('v2 consumer code still type-checks', () => {
    const testsDir = dirname(fileURLToPath(import.meta.url));
    const file = join(testsDir, `.runtime-ports-compat-${process.pid}.ts`);
    writeFileSync(file, V2_CONSUMER);
    try {
      const { options } = ts.parseJsonConfigFileContent(
        { extends: '../tsconfig.json', compilerOptions: { noEmit: true, rootDir: '..', noUnusedParameters: false } },
        ts.sys,
        testsDir
      );
      const program = ts.createProgram([file], options);
      const errors = ts
        .getPreEmitDiagnostics(program)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
      expect(errors).toEqual([]);
    } finally {
      rmSync(file, { force: true });
    }
  });
});
