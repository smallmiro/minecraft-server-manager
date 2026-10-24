/**
 * #665 widened the runtime, console, router and RCON ports to `ServerName | string`.
 * The container-name string form stays until its callers move (the router and
 * playit agent until #641; see ADR-0001 "Callers still on the string form").
 * This compiles string-form callers against src. The runtime contract of the
 * released IRconPort is in rconPort-v2-contract.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const STRING_FORM_CALLER = `
import type {
  IContainerRuntimePort, IServerConsolePort, IRouterStatusPort, IRconPort,
  ContainerStatus,
  PlayerListResult, RuntimeActionResult,
} from '../src/index.js';
import {
  Paths, ServerRepository, WorldRepository,
  DockerComposeRuntimeAdapter, DockerServerConsoleAdapter, RconCliAdapter, ConfigEnvWorldAssignmentAdapter,
} from '../src/index.js';

// IRconPort shipped in v2.33.0: an implementation declared with a container-name
// string still satisfies it. IContainerRuntimePort, IServerConsolePort and
// IRouterStatusPort were added after v2.33.0 (#654), so no released code
// implements them and they are only exercised as callers below.
export class V2Rcon implements IRconPort {
  async getEntityPosition(container: string, player: string) { return container && player ? null : null; }
}

// Callers that pass container-name strings
export async function use(
  runtime: IContainerRuntimePort, console: IServerConsolePort, router: IRouterStatusPort,
  rcon: IRconPort
): Promise<void> {
  const status: ContainerStatus = runtime.getStatus('mc-a');
  const started: RuntimeActionResult = await runtime.start('mc-a');
  const players: PlayerListResult | null = await console.listPlayers('mc-a');
  const hosts: string = router.getHostnames('mc-a');
  const pos = await rcon.getEntityPosition('mc-a', 'Steve');
  const paths = new Paths('/srv/mc');
  new ServerRepository(paths);
  new WorldRepository(paths, new ConfigEnvWorldAssignmentAdapter(paths));
  new DockerComposeRuntimeAdapter().getStatus('mc-a');
  await new DockerServerConsoleAdapter().command('mc-a', ['list']);
  await new RconCliAdapter().getEntityPosition('mc-a', 'Steve');
  void status; void started; void players; void hosts; void pos;
}
`;

describe('runtime ports accept a container-name string (#665)', () => {
  it('string-form callers type-check', () => {
    const testsDir = dirname(fileURLToPath(import.meta.url));
    const file = join(testsDir, `.runtime-ports-compat-${process.pid}.ts`);
    writeFileSync(file, STRING_FORM_CALLER);
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
