import { spawn, SpawnOptions } from 'child_process';
import { join } from 'path';

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const CLI_PATH = join(__dirname, '../../dist/index.js');

/**
 * Execute mcctl CLI command and capture output
 */
export async function runCli(
  args: string[],
  options: SpawnOptions = {}
): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      ...options,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...options.env,
        // Disable interactive prompts in tests
        CI: 'true',
        NO_COLOR: '1',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code: number | null) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });

    child.on('error', (err: Error) => {
      resolve({
        exitCode: 1,
        stdout,
        stderr: err.message,
      });
    });
  });
}

/**
 * Execute mcctl CLI command with timeout
 */
export async function runCliWithTimeout(
  args: string[],
  timeoutMs: number = 10000,
  options: SpawnOptions = {}
): Promise<CliResult> {
  return Promise.race([
    runCli(args, options),
    new Promise<CliResult>((resolve) =>
      setTimeout(
        () =>
          resolve({
            exitCode: 124, // timeout exit code
            stdout: '',
            stderr: `Command timed out after ${timeoutMs}ms`,
          }),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Parse JSON output from CLI
 */
export function parseJsonOutput<T>(stdout: string): T | null {
  try {
    // Find JSON in output (may have other text before/after)
    const jsonMatch = stdout.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if CLI is built
 */
export async function isCliBuild(): Promise<boolean> {
  const { existsSync } = await import('fs');
  return existsSync(CLI_PATH);
}
