import {
  RuntimeQueryTimeoutError,
  RuntimeUnavailableError,
  type IContainerRuntimePort,
  type RuntimeActionResult,
  type WorkloadState,
} from '../application/ports/outbound/IContainerRuntimePort.js';
import type { ServerName } from '../domain/value-objects/ServerName.js';
import { workloadNameOf } from '../infrastructure/adapters/workloadNames.js';
import type { ContainerStats, ContainerStatus, HealthStatus } from '../types/index.js';

/** One workload as the runtime holds it. */
export interface WorkloadFixture {
  /** Runtime workload name: `mc-<server>`, `mc-router`, ... */
  name: string;
  status: ContainerStatus;
  /** io.mcctl.role label (#674); absent or '' is a container created before the labels. */
  role?: string;
  /** Compose project, for the pre-label fallback. */
  project?: string;
  /** Compose service, for the pre-label fallback. */
  service?: string;
  /** Healthcheck state while running; absent is no healthcheck. */
  health?: HealthStatus;
  /** mc-router.host label. */
  hostname?: string;
  logs?: string[];
}

/** 'unavailable': the runtime cannot be asked. 'hang': queries time out. */
export type RuntimeFailure = 'unavailable' | 'hang';

export type LifecycleMethod = 'start' | 'stop' | 'restart' | 'recreate' | 'remove';

/**
 * In-memory IContainerRuntimePort (#666). Passes runtimeContract, so a use
 * case tested against it sees what it would see from Docker. Lifecycle calls
 * change the state and are recorded in `calls`; set `failure` to make the
 * runtime unreachable or hung. Stats and uptime are always null.
 */
export class FakeContainerRuntime implements IContainerRuntimePort {
  readonly workloads = new Map<string, WorkloadFixture>();
  readonly calls: Array<{ method: LifecycleMethod; name: string }> = [];
  failure: RuntimeFailure | undefined;
  private readonly project: string;

  /** @param options.project the platform's compose project (pre-label discovery); default 'minecraft'. */
  constructor(workloads: WorkloadFixture[] = [], options: { failure?: RuntimeFailure; project?: string } = {}) {
    for (const workload of workloads) this.workloads.set(workload.name, { ...workload });
    this.failure = options.failure;
    this.project = options.project ?? 'minecraft';
  }

  /** Workload names `method` was called with, in order. */
  callsOf(method: LifecycleMethod): string[] {
    return this.calls.filter((c) => c.method === method).map((c) => c.name);
  }

  getStatus(name: ServerName | string): ContainerStatus {
    return (this.failure ? undefined : this.find(name))?.status ?? 'not_found';
  }

  async getStatusAsync(name: ServerName | string): Promise<ContainerStatus> {
    this.ask();
    return this.find(name)?.status ?? 'not_found';
  }

  getHealth(name: ServerName | string): HealthStatus {
    const workload = this.failure ? undefined : this.find(name);
    return workload ? healthOf(workload) : 'unknown';
  }

  exists(name: ServerName | string): boolean {
    return !this.failure && this.find(name) !== undefined;
  }

  list(options?: { running?: boolean; strict?: boolean }): string[] {
    if (this.failure) {
      if (options?.strict) throw new RuntimeUnavailableError('fake runtime unavailable');
      return [];
    }
    return this.servers(options);
  }

  async listAsync(options?: { running?: boolean; strict?: boolean }): Promise<string[]> {
    if (this.failure === 'hang' || options?.strict) this.ask();
    return this.failure ? [] : this.servers(options);
  }

  async listStates(): Promise<Map<string, WorkloadState>> {
    this.ask();
    const states = new Map<string, WorkloadState>();
    for (const workload of this.workloads.values()) {
      if (workload.name !== 'mc-router' && !this.isServer(workload)) continue;
      states.set(workload.name, {
        status: workload.status,
        health: workload.status === 'running' ? healthOf(workload) : 'none',
        hostname: workload.hostname || '-',
      });
    }
    return states;
  }

  getLogs(name: ServerName | string, lines = 50): string {
    return this.failure ? '' : this.tail(name, lines).join('\n');
  }

  async getLogsAsync(name: ServerName | string, lines = 50): Promise<string> {
    if (this.failure === 'hang') this.ask();
    return this.getLogs(name, lines);
  }

  getStats(): ContainerStats | null {
    return null;
  }

  async getStatsAsync(): Promise<ContainerStats | null> {
    return null;
  }

  getUptime(): { uptime: string; seconds: number } | null {
    return null;
  }

  async getUptimeAsync(): Promise<{ uptime: string; seconds: number } | null> {
    if (this.failure === 'hang') this.ask();
    return null;
  }

  async start(name: ServerName | string): Promise<RuntimeActionResult> {
    return this.act('start', name, (workload, container) => {
      if (workload) workload.status = 'running';
      else this.create(container, 'running');
      return true;
    });
  }

  async stop(name: ServerName | string): Promise<RuntimeActionResult> {
    return this.act('stop', name, (workload) => {
      if (workload) workload.status = 'exited';
      return workload !== undefined;
    });
  }

  async restart(name: ServerName | string): Promise<RuntimeActionResult> {
    return this.act('restart', name, (workload) => {
      if (workload) workload.status = 'running';
      return workload !== undefined;
    });
  }

  /** A running workload runs again; any other is created without starting (#671). */
  async recreate(name: ServerName | string): Promise<RuntimeActionResult> {
    return this.act('recreate', name, (workload, container) => {
      if (workload) workload.status = workload.status === 'running' ? 'running' : 'created';
      else this.create(container, 'created');
      return true;
    });
  }

  async remove(name: ServerName | string): Promise<RuntimeActionResult> {
    return this.act('remove', name, (_workload, container) => {
      this.workloads.delete(container);
      return true;
    });
  }

  async readLogs(name: ServerName | string, options: { since: string; tail: number }): Promise<string[]> {
    this.ask();
    return this.tail(name, options.tail);
  }

  /** Emits the last `tail` lines; follow (the default) then waits for `signal`, as a stream with no new output. */
  async followLogs(
    name: ServerName | string,
    onChunk: (chunk: string) => void,
    signal: AbortSignal,
    options?: { tail?: number; follow?: boolean; onExit?: (code: number | null, error?: Error) => void }
  ): Promise<void> {
    const lines = this.failure ? [] : this.tail(name, options?.tail ?? 0);
    if (lines.length > 0) onChunk(`${lines.join('\n')}\n`);
    if (options?.follow !== false && !signal.aborted) {
      await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
    }
    options?.onExit?.(this.failure ? 1 : options?.follow === false ? 0 : null);
  }

  private find(name: ServerName | string): WorkloadFixture | undefined {
    return this.workloads.get(workloadNameOf(name));
  }

  /** Throws as the adapter's queries do when the runtime cannot be asked. */
  private ask(): void {
    if (this.failure === 'hang') throw new RuntimeQueryTimeoutError('fake runtime did not answer');
    if (this.failure) throw new RuntimeUnavailableError('fake runtime unavailable');
  }

  /** Labelled io.mcctl.role=server, or a pre-label mc-* service of the compose project (#674). */
  private isServer(w: WorkloadFixture): boolean {
    if (w.role) return w.role === 'server';
    return (
      w.project === this.project && w.name.startsWith('mc-') && !!w.service?.startsWith('mc-') && w.name !== 'mc-router'
    );
  }

  private servers(options?: { running?: boolean }): string[] {
    return [...this.workloads.values()]
      .filter((w) => this.isServer(w) && (!options?.running || w.status === 'running'))
      .map((w) => w.name)
      .sort();
  }

  private tail(name: ServerName | string, lines: number): string[] {
    const logs = this.find(name)?.logs ?? [];
    return lines > 0 ? logs.slice(-lines) : [];
  }

  /** A workload created from its definition: a labelled server of the project. */
  private create(container: string, status: ContainerStatus): void {
    this.workloads.set(container, { name: container, status, role: 'server', project: this.project, service: container });
  }

  /** Records the call; `change` applies it and returns false when the workload it needs is missing. */
  private act(
    method: LifecycleMethod,
    name: ServerName | string,
    change: (workload: WorkloadFixture | undefined, container: string) => boolean
  ): RuntimeActionResult {
    const container = workloadNameOf(name);
    this.calls.push({ method, name: container });
    if (this.failure) return { success: false, error: `fake runtime ${this.failure}` };
    if (!change(this.workloads.get(container), container)) {
      return { success: false, error: `No such container: ${container}` };
    }
    return { success: true };
  }
}

function healthOf(workload: WorkloadFixture): HealthStatus {
  return workload.health ?? 'none';
}
