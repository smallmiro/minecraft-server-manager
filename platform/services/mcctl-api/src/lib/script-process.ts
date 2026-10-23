import { spawn, type ChildProcess } from 'node:child_process';

/**
 * Create/delete scripts run in their own process group, so stopping one also
 * stops what it started (docker compose up, image pulls) (#656).
 *
 * stop() sends SIGTERM to the group and SIGKILL after graceMs. `settled`
 * resolves once the script exits (true), or graceMs after SIGKILL when it
 * still has not (false: a child holds its pipes). The script is stopped when
 * timeoutMs passes.
 */
export interface ScriptGroup {
  child: ChildProcess;
  /** Exit code, once the script exits (null when killed by a signal). */
  exit: Promise<number | null>;
  settled: Promise<boolean>;
  stop: () => void;
  readonly timedOut: boolean;
}

export interface ScriptLimits {
  timeoutMs: number;
  graceMs: number;
}

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms).unref());

function signalGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (!pid) return;
  try {
    process.kill(-pid, signal);
  } catch {
    // Already gone
  }
}

export function startScriptGroup(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
  limits: ScriptLimits,
): ScriptGroup {
  const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  // A spawn failure emits 'error' and then 'close'; callers read it from 'close'.
  child.on('error', () => undefined);
  let exited = false;
  let stopping = false;
  let timedOut = false;
  const exit = new Promise<number | null>((resolve) => child.on('close', (code: number | null) => {
    exited = true;
    resolve(code);
  }));

  let giveUp!: () => void;
  const gaveUp = new Promise<void>((resolve) => { giveUp = resolve; });
  const stop = () => {
    if (stopping || exited) return;
    stopping = true;
    signalGroup(child.pid, 'SIGTERM');
    void delay(limits.graceMs)
      .then(() => {
        if (!exited) signalGroup(child.pid, 'SIGKILL');
        return delay(limits.graceMs);
      })
      .then(giveUp);
  };

  const timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, limits.timeoutMs);
  const settled = Promise.race([exit.then(() => true), gaveUp.then(() => false)]);
  void settled.then(() => clearTimeout(timer));

  return {
    child, exit, settled, stop,
    get timedOut() { return timedOut; },
  };
}

/** Error from runScript, shaped like an execFile error. */
export interface ScriptError extends Error {
  stdout: string;
  stderr: string;
  code: number | null;
  killed: boolean;
}

/**
 * Run a script to completion in its own process group and collect its output,
 * like promisified execFile. Rejects with a ScriptError on a non-zero exit or
 * when it times out (the group is stopped first).
 */
export async function runScript(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
  limits: ScriptLimits,
): Promise<{ stdout: string; stderr: string }> {
  const run = startScriptGroup(command, args, options, limits);
  let stdout = '';
  let stderr = '';
  let spawnError: Error | undefined;
  run.child.stdout?.on('data', (data) => { stdout += data; });
  run.child.stderr?.on('data', (data) => { stderr += data; });
  run.child.on('error', (err) => { spawnError = err; });

  const exited = await run.settled;
  const code = exited ? await run.exit : null;
  if (code === 0 && !run.timedOut) return { stdout, stderr };

  const message = run.timedOut
    ? `timed out after ${Math.round(limits.timeoutMs / 1000)}s`
    : spawnError?.message ?? `exited with code ${code}`;
  if (run.timedOut) stderr = stderr ? `${stderr.trimEnd()}\n${message}` : message;
  throw Object.assign(new Error(message), { stdout, stderr, code, killed: run.timedOut }) as ScriptError;
}
