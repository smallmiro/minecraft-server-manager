import { spawn, spawnSync } from 'node:child_process';

/**
 * Execute a command and return stdout
 * Uses spawnSync to properly handle arguments with special characters
 * Docker helpers put '--' before container names so a name like '--help' is never read as an option
 */
export function execCommand(command: string, args: string[]): string {
  try {
    const result = spawnSync(command, args, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.error || result.status !== 0) {
      return '';
    }
    return (result.stdout ?? '').trim();
  } catch {
    return '';
  }
}

/**
 * Execute a command asynchronously and return result
 * For docker commands that need async/await pattern
 */
export function execCommandAsync(
  command: string,
  args: string[],
  options?: { cwd?: string }
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: options?.cwd,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() });
    });

    child.on('error', () => {
      resolve({ code: 1, stdout: '', stderr: 'Failed to execute command' });
    });
  });
}

/**
 * Execute shell script with environment variables
 */
export function execScript(
  scriptPath: string,
  args: string[],
  env: Record<string, string> = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('bash', [scriptPath, ...args], {
      env: { ...process.env, ...env },
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });

    child.on('error', () => {
      resolve({ code: 1, stdout, stderr: 'Failed to execute script' });
    });
  });
}

/**
 * Execute shell script with inherited stdio (interactive)
 */
export function execScriptInteractive(
  scriptPath: string,
  args: string[],
  env: Record<string, string> = {}
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('bash', [scriptPath, ...args], {
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      resolve(code ?? 1);
    });

    child.on('error', () => {
      resolve(1);
    });
  });
}
