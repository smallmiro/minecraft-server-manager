import { spawn } from 'node:child_process';
import * as readline from 'node:readline';
import { Rcon } from 'rcon-client';
import { Paths, log } from '@minecraft-docker/shared';
import { getContainerName, isContainerRunning } from '../lib/rcon.js';

export interface RconCommandOptions {
  serverName?: string;
  root?: string;
}

interface ContainerRconConfig {
  host: string;
  port: number;
  password: string;
}

/**
 * Get RCON configuration from Docker container
 */
async function getContainerRconConfig(containerName: string): Promise<ContainerRconConfig | null> {
  return new Promise((resolve) => {
    // Get container IP
    const ipProcess = spawn('docker', [
      'inspect', containerName,
      '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let ip = '';
    ipProcess.stdout.on('data', (data) => { ip += data.toString(); });

    ipProcess.on('close', (code) => {
      if (code !== 0 || !ip.trim()) {
        resolve(null);
        return;
      }

      // Get RCON env vars
      const envProcess = spawn('docker', [
        'inspect', containerName,
        '--format', '{{range .Config.Env}}{{println .}}{{end}}'
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      let envOutput = '';
      envProcess.stdout.on('data', (data) => { envOutput += data.toString(); });

      envProcess.on('close', (envCode) => {
        if (envCode !== 0) {
          resolve(null);
          return;
        }

        const env: Record<string, string> = {};
        envOutput.split('\n').forEach(line => {
          const [key, ...valueParts] = line.split('=');
          if (key) env[key] = valueParts.join('=');
        });

        resolve({
          host: ip.trim(),
          port: parseInt(env['RCON_PORT'] || '25575', 10),
          password: env['RCON_PASSWORD'] || '',
        });
      });
    });
  });
}

// ANSI color codes
const colors = {
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  reset: '\x1b[0m',
};

/**
 * Format RCON response for better readability
 * - Adds newline before each `/command` pattern (help output)
 * - Removes leading `/` from commands (RCON doesn't need it)
 * - Highlights command names in color
 * - Formats error messages with proper line breaks
 */
function formatRconResponse(response: string): string {
  let formatted = response;

  // Handle error messages: "See below for error<command>" -> "See below for error\n<command>"
  if (formatted.includes('See below for error')) {
    formatted = formatted.replace(/See below for error/g, 'See below for error\n');
  }

  // Handle help command output: add newline before each `/command`
  // Example: "/advancement (grant|revoke)/attribute <target>..."
  if (formatted.match(/\/[a-z]/)) {
    // Add newline before every `/command` pattern
    formatted = formatted.replace(/\/([a-z])/g, '\n$1');

    // Remove the first newline if the response starts with it
    if (formatted.startsWith('\n')) {
      formatted = formatted.substring(1);
    }

    // Highlight command names at the start of each line
    // Pattern: start of line, command name, then space or special chars
    formatted = formatted.replace(/^([a-z]+)(\s|$|\(|<|\[)/gm,
      `${colors.cyan}$1${colors.reset}$2`);

    // Highlight alias references like "-> msg" or "-> experience"
    formatted = formatted.replace(/-> ([a-z]+)/g,
      `-> ${colors.yellow}$1${colors.reset}`);

    // Highlight keywords inside parentheses (get|base|modifier) -> green
    formatted = formatted.replace(/\(([^)]+)\)/g, (match, inner) => {
      // Color each word inside parentheses
      const coloredInner = inner.replace(/([a-z_]+)/gi,
        `${colors.green}$1${colors.reset}`);
      return `(${coloredInner})`;
    });
  }

  return formatted;
}

/**
 * Connect to interactive RCON console for a Minecraft server
 *
 * This command opens an interactive RCON session where you can
 * execute multiple commands in sequence. Use 'exit' or Ctrl+C to quit.
 *
 * For single command execution, use `mcctl exec <server> <cmd>` instead.
 */
export async function rconCommand(options: RconCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  if (!options.serverName) {
    log.error('Server name is required');
    log.info('Usage: mcctl rcon <server>');
    log.info('');
    log.info('Opens an interactive RCON console for the specified server.');
    log.info('Type "help" to see available commands, "exit" or Ctrl+C to quit.');
    log.info('');
    log.info('For single command execution, use: mcctl exec <server> <command>');
    return 1;
  }

  const containerName = getContainerName(options.serverName);

  if (!(await isContainerRunning(containerName))) {
    log.error(`Server '${options.serverName}' is not running`);
    log.info(`Start the server first: mcctl start ${options.serverName}`);
    return 1;
  }

  // Get RCON config from container
  const rconConfig = await getContainerRconConfig(containerName);
  if (!rconConfig) {
    log.error('Failed to get RCON configuration from container');
    return 1;
  }

  if (!rconConfig.password) {
    log.error('RCON_PASSWORD not set in container');
    return 1;
  }

  log.info(`Connecting to RCON console for '${options.serverName}'...`);

  let rcon: Rcon;
  try {
    rcon = await Rcon.connect({
      host: rconConfig.host,
      port: rconConfig.port,
      password: rconConfig.password,
    });
  } catch (err) {
    log.error(`Failed to connect to RCON: ${(err as Error).message}`);
    log.info('Make sure the server is fully started and RCON is enabled.');
    return 1;
  }

  log.info('Connected! Type "help" for commands, "exit" or Ctrl+C to quit.');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  rl.prompt();

  return new Promise((resolve) => {
    rl.on('line', async (line) => {
      const cmd = line.trim();

      if (cmd === 'exit' || cmd === 'quit') {
        rl.close();
        return;
      }

      if (!cmd) {
        rl.prompt();
        return;
      }

      try {
        const response = await rcon.send(cmd);
        if (response) {
          console.log(formatRconResponse(response));
        }
      } catch (err) {
        log.error(`Command failed: ${(err as Error).message}`);
      }

      rl.prompt();
    });

    rl.on('close', async () => {
      console.log('');
      log.info('Disconnecting from RCON...');
      try {
        await rcon.end();
      } catch {
        // Ignore disconnect errors
      }
      resolve(0);
    });

    // Handle Ctrl+C
    rl.on('SIGINT', () => {
      rl.close();
    });
  });
}
