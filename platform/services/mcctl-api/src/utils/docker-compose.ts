import { execFile, ExecFileOptions } from 'child_process';
import { promisify } from 'util';
import { config, childProcessEnv } from '../config/index.js';

const execFilePromise = promisify(execFile);

// ============================================================
// Types
// ============================================================

export interface DockerComposeResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export type ServerAction = 'start' | 'stop' | 'restart';

// ============================================================
// Configuration
// ============================================================

/**
 * Platform directory path (config.mcctlRoot, the mcctl root).
 */
function getPlatformPath(): string {
  return config.mcctlRoot;
}

// ============================================================
// Server Name Handling
// ============================================================

export function sanitizeServerName(name: string): string {
  // Decode URI component if encoded
  try {
    name = decodeURIComponent(name);
  } catch {
    // If decoding fails, use as-is
  }
  return name.trim();
}

// ============================================================
// Docker Compose Commands
// ============================================================

/**
 * Execute a docker compose command for a specific server action.
 */
export async function executeServerAction(
  serverName: string,
  action: ServerAction
): Promise<DockerComposeResult> {
  const mcctlRoot = getPlatformPath();
  const serviceName = `mc-${serverName}`;

  let args: string[];
  switch (action) {
    case 'start':
      args = ['compose', 'up', '-d', serviceName];
      break;
    case 'stop':
      args = ['compose', 'stop', serviceName];
      break;
    case 'restart':
      args = ['compose', 'restart', serviceName];
      break;
    default:
      return {
        success: false,
        error: `Unknown action: ${action}`,
      };
  }

  const options: ExecFileOptions = {
    cwd: mcctlRoot,
    timeout: 60000, // 60 second timeout
    // Ensure Docker Compose uses the correct compose file
    env: childProcessEnv({ COMPOSE_FILE: 'docker-compose.yml' }),
  };

  try {
    const { stdout, stderr } = await execFilePromise('docker', args, options);
    return {
      success: true,
      stdout: typeof stdout === 'string' ? stdout.trim() : stdout?.toString().trim(),
      stderr: typeof stderr === 'string' ? stderr.trim() : stderr?.toString().trim(),
    };
  } catch (error) {
    const execError = error as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
    return {
      success: false,
      stdout: typeof execError.stdout === 'string' ? execError.stdout.trim() : execError.stdout?.toString().trim(),
      stderr: typeof execError.stderr === 'string' ? execError.stderr.trim() : execError.stderr?.toString().trim(),
      error: execError.message ?? 'Unknown error',
    };
  }
}

// ============================================================
// Export for Testing
// ============================================================

export { getPlatformPath };
