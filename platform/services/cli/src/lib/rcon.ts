import { spawn } from 'node:child_process';

/**
 * Result of an RCON command execution
 */
export interface RconResult {
  code: number;
  output: string;
}

/**
 * Check if a Docker container is running
 */
export async function isContainerRunning(containerName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('docker', ['inspect', '-f', '{{.State.Running}}', containerName], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      resolve(code === 0 && output.trim() === 'true');
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Execute RCON command and capture output
 */
export async function execRconWithOutput(
  containerName: string,
  command: string[]
): Promise<RconResult> {
  return new Promise((resolve) => {
    const child = spawn('docker', ['exec', containerName, 'rcon-cli', ...command], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, output: output || errorOutput });
    });

    child.on('error', (err) => {
      resolve({ code: 1, output: err.message });
    });
  });
}

/**
 * Get container name from server name
 * Ensures the container name has the 'mc-' prefix
 */
export function getContainerName(serverName: string): string {
  return serverName.startsWith('mc-') ? serverName : `mc-${serverName}`;
}
