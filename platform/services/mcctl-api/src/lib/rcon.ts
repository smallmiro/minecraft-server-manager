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

/**
 * Execute RCON command by server name (convenience wrapper)
 */
export async function execRconCommand(serverName: string, command: string): Promise<string> {
  const result = await execRcon(serverName, command);
  return result.output.trim();
}

/**
 * Parse player list from RCON response
 * Handles: "There are X of a max of Y players online: player1, player2"
 */
export function parsePlayerList(response: string): { online: number; max: number; players: string[] } {
  const match = response.match(/There are (\d+)(?:\s+of a max of\s+|\/)(\d+) players? online/i);

  if (!match || !match[1] || !match[2]) {
    return { online: 0, max: 20, players: [] };
  }

  const online = parseInt(match[1], 10);
  const max = parseInt(match[2], 10);

  // Extract player names after the colon
  const playersMatch = response.match(/:\s*(.*)$/);
  let players: string[] = [];
  if (playersMatch && playersMatch[1]) {
    players = playersMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  }

  return { online, max, players };
}
