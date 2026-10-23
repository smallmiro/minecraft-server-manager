import { Paths, ServerName, log, type IContainerRuntimePort } from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/index.js';

export interface LogsCommandOptions {
  root?: string;
  serverName?: string;
  lines?: string;
  follow?: boolean;
  json?: boolean;
  runtime?: IContainerRuntimePort;
  write?: (text: string) => void;
  /** Abort to end follow (SIGINT also aborts it). */
  signal?: AbortSignal;
}

const DEFAULT_LINES = 50;
const ROUTER = 'mc-router';

/**
 * View server (or router) logs through the container runtime port.
 */
export async function logsCommand(options: LogsCommandOptions): Promise<number> {
  const write = options.write ?? ((s: string) => void process.stdout.write(s));

  if (!options.runtime && !new Paths(options.root).isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }
  if (!options.serverName) {
    log.error('Server name is required');
    log.info('Usage: mcctl logs <server|router> [-n <lines>] [-f] [--json]');
    return 1;
  }

  const lines = options.lines === undefined ? DEFAULT_LINES : Number(options.lines);
  if (!Number.isInteger(lines) || lines < 0) {
    log.error(`Invalid --lines value: ${options.lines}`);
    return 1;
  }
  if (options.follow && options.json) {
    log.error('--json cannot be combined with --follow');
    return 1;
  }

  let workload: string;
  if (options.serverName === 'router' || options.serverName === ROUTER) {
    workload = ROUTER;
  } else {
    try {
      workload = ServerName.fromExisting(options.serverName).containerName;
    } catch (e) {
      log.error(e instanceof Error ? e.message : String(e));
      return 1;
    }
  }

  const runtime = options.runtime ?? getContainer(options.root).runtimePort;
  if (!runtime.exists(workload)) {
    log.error(`'${options.serverName}' (container: ${workload}) not found`);
    return 1;
  }

  // One streaming path for both modes: docker logs merges stdout and stderr (getLogs drops stderr).
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  process.once('SIGINT', abort);
  const chunks: string[] = [];
  try {
    await runtime.followLogs(workload, options.follow ? write : (c) => void chunks.push(c), controller.signal, {
      follow: options.follow === true,
      tail: lines,
    });
  } finally {
    options.signal?.removeEventListener('abort', abort);
    process.off('SIGINT', abort);
  }
  if (options.follow) return 0;

  const text = chunks.join('').replace(/\r?\n$/, '');
  const all = text === '' ? [] : text.split(/\r?\n/);
  write(options.json ? JSON.stringify(all, null, 2) + '\n' : text === '' ? '' : text + '\n');
  return 0;
}
