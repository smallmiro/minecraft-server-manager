import { Paths, ServerName, log, workloadNameOf, type IContainerRuntimePort } from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/index.js';

export interface LogsCommandOptions {
  root?: string;
  serverName?: string;
  /** Raw flag value: `-n` without a value arrives as `true`. */
  lines?: string | boolean;
  follow?: boolean;
  json?: boolean;
  runtime?: IContainerRuntimePort;
  write?: (text: string) => void | Promise<void>;
  /** Abort to end follow (SIGINT also aborts it). */
  signal?: AbortSignal;
}

const DEFAULT_LINES = 50;
const ROUTER = 'mc-router';

/**
 * View server (or router) logs through the container runtime port.
 */
export async function logsCommand(options: LogsCommandOptions): Promise<number> {
  // Resolve on the write callback so process.exit() cannot truncate piped output.
  const write =
    options.write ??
    ((s: string) => new Promise<void>((resolve) => void process.stdout.write(s, () => resolve())));

  if (!options.runtime && !new Paths(options.root).isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }
  if (!options.serverName) {
    log.error('Server name is required');
    log.info('Usage: mcctl logs <server|router> [-n <lines>] [-f] [--json]');
    return 1;
  }

  let lines = DEFAULT_LINES;
  if (options.lines !== undefined) {
    lines = typeof options.lines === 'string' && /^[1-9]\d*$/.test(options.lines) ? Number(options.lines) : NaN;
  }
  if (!Number.isInteger(lines)) {
    log.error(`Invalid --lines value: ${options.lines}`);
    return 1;
  }
  if (options.follow && options.json) {
    log.error('--json cannot be combined with --follow');
    return 1;
  }

  // A server by name (the adapter picks its container); the router by its container name
  let workload: ServerName | string;
  if (options.serverName === 'router' || options.serverName === ROUTER) {
    workload = ROUTER;
  } else {
    try {
      workload = ServerName.fromExisting(options.serverName);
    } catch (e) {
      log.error(e instanceof Error ? e.message : String(e));
      return 1;
    }
  }

  const runtime = options.runtime ?? getContainer(options.root).runtimePort;
  if (!runtime.exists(workload)) {
    log.error(`'${options.serverName}' (container: ${workloadNameOf(workload)}) not found`);
    return 1;
  }

  // One streaming path for both modes: docker logs merges stdout and stderr (getLogs drops stderr).
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  process.once('SIGINT', abort);
  const chunks: string[] = [];
  const pending: Array<void | Promise<void>> = [];
  let failed = false;
  try {
    await runtime.followLogs(
      workload,
      options.follow ? (c) => void pending.push(write(c)) : (c) => void chunks.push(c),
      controller.signal,
      {
        follow: options.follow === true,
        tail: lines,
        onExit: (code, error) => {
          if (!controller.signal.aborted && (error || code !== 0)) {
            failed = true;
            log.error(`docker logs failed${error ? `: ${error.message}` : ` (exit ${code})`}`);
          }
        },
      }
    );
  } finally {
    options.signal?.removeEventListener('abort', abort);
    process.off('SIGINT', abort);
  }
  await Promise.all(pending);
  if (failed) return 1;
  if (options.follow) return 0;

  const text = chunks.join('').replace(/\r?\n$/, '');
  const all = text === '' ? [] : text.split(/\r?\n/);
  await write(options.json ? JSON.stringify(all, null, 2) + '\n' : text === '' ? '' : text + '\n');
  return 0;
}
