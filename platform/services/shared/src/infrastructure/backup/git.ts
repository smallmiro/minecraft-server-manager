/**
 * Git process runner for the world backup adapter (ADR-0001 "Backup Port", B3).
 * argv arrays only (no shell). The token travels in the environment, never in argv.
 */
import { execFile } from 'node:child_process';
import type { WorldBackupErrorCode } from '../../application/ports/outbound/IWorldBackupPort.js';

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface GitOptions {
  cwd?: string;
  /** Network command: adds the Authorization header for this token. */
  token?: string;
  /** Extra variables, e.g. commit identity. */
  env?: Record<string, string>;
  timeoutMs?: number;
}

export const BACKUP_IDENTITY = {
  GIT_AUTHOR_NAME: 'Minecraft Backup',
  GIT_AUTHOR_EMAIL: 'minecraft-backup@localhost',
  GIT_COMMITTER_NAME: 'Minecraft Backup',
  GIT_COMMITTER_EMAIL: 'minecraft-backup@localhost',
};

const WALL_CLOCK_MS = 4 * 3600_000;
const MIN_VERSION = [2, 31];

/** Fallback for `git rev-parse --local-env-vars` (git 2.43). */
const DEFAULT_LOCAL_VARS = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CONFIG', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_IMPLICIT_WORK_TREE', 'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE', 'GIT_NO_REPLACE_OBJECTS', 'GIT_REPLACE_REF_BASE', 'GIT_PREFIX',
  'GIT_SHALLOW_FILE', 'GIT_COMMON_DIR',
];

export class GitRunner {
  private localVars?: string[];
  private versionOk?: boolean;

  constructor(private readonly remoteBase: string) {}

  run(args: string[], options: GitOptions = {}): Promise<GitResult> {
    return this.exec(args, options, this.localVars ?? DEFAULT_LOCAL_VARS);
  }

  /** Checks git >= 2.31 once (GIT_CONFIG_COUNT) and loads the local env var list. */
  async ensureVersion(): Promise<boolean> {
    if (this.versionOk !== undefined) return this.versionOk;
    const v = await this.exec(['--version'], {}, DEFAULT_LOCAL_VARS);
    const m = /(\d+)\.(\d+)/.exec(v.stdout);
    const [major, minor] = m ? [Number(m[1]), Number(m[2])] : [0, 0];
    this.versionOk = major > MIN_VERSION[0]! || (major === MIN_VERSION[0] && minor >= MIN_VERSION[1]!);
    if (this.versionOk) {
      const vars = await this.exec(['rev-parse', '--local-env-vars'], {}, DEFAULT_LOCAL_VARS);
      if (vars.code === 0) this.localVars = vars.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
    }
    return this.versionOk;
  }

  private env(options: GitOptions, localVars: string[]): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const key of Object.keys(env)) {
      if (localVars.includes(key) || key.startsWith('GIT_CONFIG')) delete env[key];
    }
    const config: Array<[string, string]> = [['commit.gpgSign', 'false']];
    if (options.token !== undefined) {
      const basic = Buffer.from(`x-access-token:${options.token}`).toString('base64');
      config.push(
        [`http.${this.remoteBase}.extraHeader`, ''], // reset any configured header
        [`http.${this.remoteBase}.extraHeader`, `Authorization: Basic ${basic}`],
        ['credential.helper', '']
      );
    }
    env.GIT_CONFIG_COUNT = String(config.length);
    config.forEach(([key, value], i) => {
      env[`GIT_CONFIG_KEY_${i}`] = key;
      env[`GIT_CONFIG_VALUE_${i}`] = value;
    });
    Object.assign(env, {
      GIT_TERMINAL_PROMPT: '0',
      GCM_INTERACTIVE: 'never',
      LC_ALL: 'C',
      GIT_HTTP_LOW_SPEED_LIMIT: '1000',
      GIT_HTTP_LOW_SPEED_TIME: '300',
      ...options.env,
    });
    return env;
  }

  private exec(args: string[], options: GitOptions, localVars: string[]): Promise<GitResult> {
    return new Promise((resolve) => {
      execFile(
        'git',
        args,
        {
          cwd: options.cwd,
          env: this.env(options, localVars),
          timeout: options.timeoutMs ?? WALL_CLOCK_MS,
          maxBuffer: 256 * 1024 * 1024,
          encoding: 'utf8',
        },
        (error, stdout, stderr) => {
          const err = error as (NodeJS.ErrnoException & { killed?: boolean; code?: number | string }) | null;
          resolve({
            code: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
            stdout,
            stderr: stderr || (err && typeof err.code !== 'number' ? err.message : ''),
            timedOut: Boolean(err?.killed),
          });
        }
      );
    });
  }
}

/** Error code for a failed network command. */
export function networkErrorCode(result: GitResult): WorldBackupErrorCode {
  if (result.timedOut) return 'timeout';
  if (/Repository not found|repository '.*' not found|\b404\b/i.test(result.stderr)) return 'repo_not_found';
  if (/Authentication failed|could not read Username|terminal prompts disabled|\b40[13]\b/i.test(result.stderr)) {
    return 'auth_failed';
  }
  return 'git_failed';
}
