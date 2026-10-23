/**
 * #665 widened the runtime, console, router and RCON ports to `ServerName | string`
 * and deprecated members instead of removing them (#715: v2.x never breaks a
 * shared export or signature). This compiles v2 consumer code against src.
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const V2_CONSUMER = `
import type {
  IContainerRuntimePort, IServerConsolePort, IRouterStatusPort, IRconPort, IShellPort,
  IPromptPort, IServerRepository, ContainerStatus, HealthStatus, ContainerStats,
  PlayerListResult, RuntimeActionResult, ConsoleCommandResult, ConsoleEndpoint, ShellResult,
} from '../src/index.js';
import {
  ServerName, Server, Paths, ServerRepository, WorldRepository, CreateServerUseCase,
  DockerComposeRuntimeAdapter, DockerServerConsoleAdapter, RconCliAdapter, ConfigEnvWorldAssignmentAdapter,
} from '../src/index.js';

// v2 implementations, declared with container-name strings, still satisfy the ports
export class V2Runtime implements IContainerRuntimePort {
  getStatus(name: string): ContainerStatus { return name ? 'running' : 'not_found'; }
  getHealth(name: string): HealthStatus { return name ? 'none' : 'unknown'; }
  exists(name: string): boolean { return !!name; }
  list(options?: { running?: boolean }): string[] { return options ? [] : []; }
  getLogs(name: string, lines?: number): string { return name + lines; }
  getStats(name: string): ContainerStats | null { return name ? null : null; }
  getUptime(name: string): { uptime: string; seconds: number } | null { return name ? null : null; }
  async start(name: string): Promise<RuntimeActionResult> { return { success: !!name }; }
  async stop(name: string): Promise<RuntimeActionResult> { return { success: !!name }; }
  async restart(name: string): Promise<RuntimeActionResult> { return { success: !!name }; }
  async readLogs(name: string, options: { since: string; tail: number }): Promise<string[]> { return [name, options.since]; }
  async followLogs(name: string, onChunk: (chunk: string) => void, signal: AbortSignal): Promise<void> { if (!signal.aborted) onChunk(name); }
}
export class V2Console implements IServerConsolePort {
  async listPlayers(name: string): Promise<PlayerListResult | null> { return name ? null : null; }
  async command(name: string, args: string[]): Promise<ConsoleCommandResult> { return { exitCode: 0, stdout: name + args.join(' '), stderr: '' }; }
  async getEndpoint(name: string): Promise<ConsoleEndpoint | null> { return name ? null : null; }
}
export class V2Router implements IRouterStatusPort {
  getHealth(): HealthStatus { return 'unknown'; }
  getHostnames(name: string): string { return name; }
}
export class V2Rcon implements IRconPort {
  async getEntityPosition(container: string, player: string) { return container && player ? null : null; }
}

// v2 callers: container-name strings, deprecated getters and members, old constructors
export async function use(
  runtime: IContainerRuntimePort, console: IServerConsolePort, router: IRouterStatusPort,
  rcon: IRconPort, shell: IShellPort, prompt: IPromptPort, repo: IServerRepository, server: Server
): Promise<void> {
  const status: ContainerStatus = runtime.getStatus('mc-a');
  const started: RuntimeActionResult = await runtime.start('mc-a');
  const players: PlayerListResult | null = await console.listPlayers('mc-a');
  const hosts: string = router.getHostnames('mc-a');
  const pos = await rcon.getEntityPosition('mc-a', 'Steve');
  const ran: ShellResult = await shell.exec('mcctl.sh', ['status']);
  const code: number = await shell.execInteractive('mcctl.sh');
  const name = ServerName.create('a');
  const names: string[] = [name.containerName, name.hostname, server.containerName, server.hostname];
  const paths = new Paths('/srv/mc');
  new ServerRepository(paths);
  new WorldRepository(paths, new ConfigEnvWorldAssignmentAdapter(paths));
  new CreateServerUseCase(prompt, shell, repo, paths);
  new CreateServerUseCase(prompt, shell, repo);
  new DockerComposeRuntimeAdapter().getStatus('mc-a');
  await new DockerServerConsoleAdapter().command('mc-a', ['list']);
  await new RconCliAdapter().getEntityPosition('mc-a', 'Steve');
  void status; void started; void players; void hosts; void pos; void ran; void code; void names;
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
