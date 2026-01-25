import { spawn } from 'node:child_process';

/**
 * Result of an RCON command execution
 */
export interface RconResult {
  exitCode: number;
  output: string;
}

/**
 * Get container name from server name
 * Ensures the container name has the 'mc-' prefix
 */
export function getContainerName(serverName: string): string {
  return serverName.startsWith('mc-') ? serverName : `mc-${serverName}`;
}

/**
 * Execute RCON command and capture output
 * Uses docker exec to run rcon-cli inside the container
 */
export async function execRcon(
  containerName: string,
  command: string
): Promise<RconResult> {
  // Split command into parts for rcon-cli
  // Note: rcon-cli accepts the full command as a single argument
  const normalizedContainer = getContainerName(containerName);

  return new Promise((resolve) => {
    const child = spawn('docker', ['exec', normalizedContainer, 'rcon-cli', command], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code: number | null) => {
      resolve({
        exitCode: code ?? 1,
        output: stdout || stderr,
      });
    });

    child.on('error', (err: Error) => {
      resolve({
        exitCode: 1,
        output: err.message,
      });
    });
  });
}

/**
 * Check if a Docker container is running
 */
export async function isContainerRunning(containerName: string): Promise<boolean> {
  const normalizedContainer = getContainerName(containerName);

  return new Promise((resolve) => {
    const child = spawn('docker', ['inspect', '-f', '{{.State.Running}}', normalizedContainer], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    child.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    child.on('close', (code: number | null) => {
      resolve(code === 0 && output.trim() === 'true');
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}
