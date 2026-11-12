/**
 * IContainerRuntimePort contract (#666): one suite every runtime adapter must
 * pass. Run it against an adapter with a factory that builds the runtime over
 * the given scenario:
 *
 *   runtimeContract('MyRuntime', (scenario) => new MyRuntime(...));
 *
 * FakeContainerRuntime and DockerComposeRuntimeAdapter (with a fake docker on
 * PATH) pass it in shared/tests/runtime-contract.test.ts; a k8s adapter
 * should pass it too before it replaces Docker.
 */
import { describe, it, expect } from 'vitest';
import {
  RuntimeQueryTimeoutError,
  RuntimeUnavailableError,
  type IContainerRuntimePort,
} from '../application/ports/outbound/IContainerRuntimePort.js';
import { ServerName } from '../domain/value-objects/ServerName.js';
import type { ContainerStatus } from '../types/index.js';
import type { RuntimeFailure, WorkloadFixture } from './FakeContainerRuntime.js';

/** The compose project the runtime under test belongs to (the pre-label fallback, #674). */
export const CONTRACT_PROJECT = 'minecraft';

export interface RuntimeScenario {
  workloads: WorkloadFixture[];
  /** 'unavailable': every runtime call fails. 'hang': no query answers before the adapter's timeout. */
  failure?: RuntimeFailure;
}

export type RuntimeFactory = (scenario: RuntimeScenario) => IContainerRuntimePort;

/** A labelled server workload of CONTRACT_PROJECT. */
export const serverWorkload = (
  server: string,
  status: ContainerStatus,
  extra: Partial<WorkloadFixture> = {}
): WorkloadFixture => ({
  name: `mc-${server}`,
  status,
  role: 'server',
  project: CONTRACT_PROJECT,
  service: `mc-${server}`,
  ...extra,
});

/** A host with mcctl servers and other containers whose names contain `mc-` (#674). */
const HOST: WorkloadFixture[] = [
  serverWorkload('beta', 'exited'),
  serverWorkload('alpha', 'running', { health: 'healthy', hostname: 'alpha.local,alpha.example.com' }),
  { name: 'mc-router', status: 'running', role: 'router', project: CONTRACT_PROJECT, service: 'router' },
  // created before the labels: compose project + mc-* service
  { name: 'mc-legacy', status: 'running', project: CONTRACT_PROJECT, service: 'mc-legacy' },
  { name: 'mc-web', status: 'running', project: 'shop', service: 'mc-web' }, // another compose project
  { name: 'postgres-mc-1', status: 'running', project: 'billing', service: 'db' }, // name merely contains mc-
  { name: 'mc-scratch', status: 'running' }, // docker run --name mc-scratch: no compose, no label
  { name: 'mc-agent', status: 'running', role: 'playit', project: CONTRACT_PROJECT, service: 'mc-agent' },
];

const alpha = ServerName.fromExisting('alpha');

export function runtimeContract(label: string, makeRuntime: RuntimeFactory): void {
  const host = (failure?: RuntimeFailure) => makeRuntime({ workloads: HOST, failure });
  const unavailable = () => host('unavailable');
  const hung = () => host('hang');

  describe(`IContainerRuntimePort contract: ${label}`, () => {
    describe('status', () => {
      it('getStatusAsync reports the state of a workload, by ServerName or workload name', async () => {
        expect(await host().getStatusAsync(alpha)).toBe('running');
        expect(await host().getStatusAsync('mc-beta')).toBe('exited');
        expect(await host().getStatusAsync('mc-router')).toBe('running');
      });

      it("getStatusAsync is 'not_found' when the runtime answers without the workload", async () => {
        expect(await host().getStatusAsync(ServerName.fromExisting('ghost'))).toBe('not_found');
        expect(await makeRuntime({ workloads: [] }).getStatusAsync(alpha)).toBe('not_found');
      });

      it('getStatusAsync rejects with RuntimeUnavailableError when the runtime cannot be asked (#669)', async () => {
        await expect(unavailable().getStatusAsync(alpha)).rejects.toBeInstanceOf(RuntimeUnavailableError);
      });

      it('getStatusAsync rejects with RuntimeQueryTimeoutError, a RuntimeUnavailableError, when the runtime does not answer (#672)', async () => {
        const error = await hung().getStatusAsync(alpha).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(RuntimeQueryTimeoutError);
        expect(error).toBeInstanceOf(RuntimeUnavailableError);
      });

      it("the synchronous queries keep the D1 sentinels: 'not_found' and false when absent or unreachable", () => {
        expect(host().getStatus(alpha)).toBe('running');
        expect(host().getStatus('mc-ghost')).toBe('not_found');
        expect(unavailable().getStatus(alpha)).toBe('not_found');
        expect(host().exists(alpha)).toBe(true);
        expect(host().exists('mc-ghost')).toBe(false);
        expect(unavailable().exists(alpha)).toBe(false);
      });
    });

    describe('server discovery (#674)', () => {
      const SERVERS = ['mc-alpha', 'mc-beta', 'mc-legacy'];

      it('list and listAsync select labelled servers and pre-label mc-* services of the compose project, sorted', async () => {
        expect(host().list()).toEqual(SERVERS);
        expect(await host().listAsync()).toEqual(SERVERS);
      });

      it('running: true keeps the running servers only', async () => {
        expect(host().list({ running: true })).toEqual(['mc-alpha', 'mc-legacy']);
        expect(await host().listAsync({ running: true })).toEqual(['mc-alpha', 'mc-legacy']);
      });

      it('a failed query is [] by default and RuntimeUnavailableError with strict (#732)', async () => {
        expect(unavailable().list()).toEqual([]);
        expect(await unavailable().listAsync()).toEqual([]);
        expect(() => unavailable().list({ strict: true })).toThrow(RuntimeUnavailableError);
        await expect(unavailable().listAsync({ strict: true })).rejects.toBeInstanceOf(RuntimeUnavailableError);
        expect(makeRuntime({ workloads: [] }).list({ strict: true })).toEqual([]);
      });

      it('listAsync rejects with RuntimeQueryTimeoutError when the runtime does not answer, strict or not (#672)', async () => {
        await expect(hung().listAsync()).rejects.toBeInstanceOf(RuntimeQueryTimeoutError);
        await expect(hung().listAsync({ strict: true })).rejects.toBeInstanceOf(RuntimeQueryTimeoutError);
      });
    });

    describe('listStates (#672)', () => {
      it('reports every server and mc-router, nothing else', async () => {
        const states = await host().listStates();
        expect([...states.keys()].sort()).toEqual(['mc-alpha', 'mc-beta', 'mc-legacy', 'mc-router']);
        expect(states.get('mc-alpha')).toEqual({
          status: 'running',
          health: 'healthy',
          hostname: 'alpha.local,alpha.example.com',
        });
        expect(states.get('mc-beta')).toEqual({ status: 'exited', health: 'none', hostname: '-' });
        expect(states.get('mc-legacy')).toEqual({ status: 'running', health: 'none', hostname: '-' });
      });

      it('is an empty map only when the runtime answers with no workloads', async () => {
        expect((await makeRuntime({ workloads: [] }).listStates()).size).toBe(0);
      });

      it('rejects, never an empty map, when the runtime cannot be asked or does not answer (#669)', async () => {
        await expect(unavailable().listStates()).rejects.toBeInstanceOf(RuntimeUnavailableError);
        await expect(hung().listStates()).rejects.toBeInstanceOf(RuntimeQueryTimeoutError);
      });
    });

    describe('logs', () => {
      const withLogs = () =>
        makeRuntime({ workloads: [serverWorkload('alpha', 'running', { logs: ['one', 'two', 'three'] })] });

      it('getLogsAsync returns the last lines', async () => {
        expect(await withLogs().getLogsAsync(alpha, 2)).toBe('two\nthree');
      });

      it("getLogsAsync is '' when the runtime cannot be asked and rejects when it does not answer", async () => {
        expect(await unavailable().getLogsAsync(alpha)).toBe('');
        await expect(hung().getLogsAsync(alpha)).rejects.toBeInstanceOf(RuntimeQueryTimeoutError);
      });
    });

    describe('lifecycle', () => {
      const one = (status: ContainerStatus) => makeRuntime({ workloads: [serverWorkload('alpha', status)] });

      it('start runs a stopped workload', async () => {
        const runtime = one('exited');
        expect((await runtime.start(alpha)).success).toBe(true);
        expect(await runtime.getStatusAsync(alpha)).toBe('running');
      });

      it('start creates a missing workload, then runs it', async () => {
        const runtime = makeRuntime({ workloads: [] });
        expect((await runtime.start(alpha)).success).toBe(true);
        expect(await runtime.getStatusAsync(alpha)).toBe('running');
        expect(runtime.list()).toEqual(['mc-alpha']);
      });

      it('stop stops a running workload; restart runs it again', async () => {
        const runtime = one('running');
        expect((await runtime.stop(alpha)).success).toBe(true);
        expect(await runtime.getStatusAsync(alpha)).toBe('exited');
        expect((await runtime.restart(alpha)).success).toBe(true);
        expect(await runtime.getStatusAsync(alpha)).toBe('running');
      });

      it('recreate keeps a running workload running and only creates a stopped one (#671)', async () => {
        const running = one('running');
        expect((await running.recreate(alpha)).success).toBe(true);
        expect(await running.getStatusAsync(alpha)).toBe('running');

        const stopped = one('exited');
        expect((await stopped.recreate(alpha)).success).toBe(true);
        expect(await stopped.getStatusAsync(alpha)).toBe('created');
      });

      it('remove deletes the workload; an absent workload is success', async () => {
        const runtime = one('running');
        expect((await runtime.remove(alpha)).success).toBe(true);
        expect(await runtime.getStatusAsync(alpha)).toBe('not_found');
        expect((await runtime.remove(alpha)).success).toBe(true);
      });

      it('never rejects: an unreachable runtime is success false, never "absent" (#669, #735)', async () => {
        const runtime = unavailable();
        for (const action of ['start', 'stop', 'restart', 'recreate', 'remove'] as const) {
          const result = await runtime[action](alpha);
          expect(result.success, action).toBe(false);
          expect(result.error, action).toBeTruthy();
        }
      });
    });
  });
}
