import { exec, ExecOptions } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execPromise = promisify(exec);

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
 * Platform directory path.
 * In production, this should be configured via environment variable.
 */
function getPlatformPath(): string {
  return process.env['PLATFORM_PATH'] ?? path.resolve(process.cwd(), '../../');
}

// ============================================================
// Server Name Validation
// ============================================================

/**
 * Server name validation regex.
 * Allows alphanumeric characters, hyphens, and underscores.
 * Must start with a letter or number.
 */
const SERVER_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

export function isValidServerName(name: string): boolean {
  if (!name || name.length === 0 || name.length > 64) {
    return false;
  }
  return SERVER_NAME_REGEX.test(name);
}

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
  const platformPath = getPlatformPath();
  const serviceName = `mc-${serverName}`;

  let command: string;
  switch (action) {
    case 'start':
      command = `docker compose up -d ${serviceName}`;
      break;
    case 'stop':
      command = `docker compose stop ${serviceName}`;
      break;
    case 'restart':
      command = `docker compose restart ${serviceName}`;
      break;
    default:
      return {
        success: false,
        error: `Unknown action: ${action}`,
      };
  }

  const options: ExecOptions = {
    cwd: platformPath,
    timeout: 60000, // 60 second timeout
    env: {
      ...process.env,
      // Ensure Docker Compose uses the correct compose file
      COMPOSE_FILE: 'docker-compose.yml',
    },
  };

  try {
    const { stdout, stderr } = await execPromise(command, options);
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
