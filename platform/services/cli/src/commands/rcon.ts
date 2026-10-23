import * as readline from 'node:readline';
import { Rcon } from 'rcon-client';
import {
  Paths,
  ServerName,
  log,
  type ConsoleEndpoint,
  type IContainerRuntimePort,
  type IServerConsolePort,
} from '@minecraft-docker/shared';
import { getContainer } from '../infrastructure/index.js';

/** The part of an RCON connection the session uses. */
export interface RconSession {
  send(command: string): Promise<string>;
  end(): Promise<unknown>;
  /** rcon-client emits 'end' when the server closes the connection and 'error' on a reset. */
  on(event: 'end' | 'error', listener: (error?: Error) => void): unknown;
}

export interface RconCommandOptions {
  serverName?: string;
  root?: string;
  /** The command name for messages: `mcctl rcon` (default) or `mcctl console` (#734). */
  command?: 'rcon' | 'console';
  runtime?: Pick<IContainerRuntimePort, 'getStatus'>;
  console?: Pick<IServerConsolePort, 'getEndpoint'>;
  connect?: (endpoint: ConsoleEndpoint) => Promise<RconSession>;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
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
  const command = options.command ?? 'rcon';

  if (!options.runtime && !new Paths(options.root).isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  if (!options.serverName) {
    log.error('Server name is required');
    log.info(`Usage: mcctl ${command} <server>`);
    log.info('');
    log.info('Opens an interactive RCON console for the specified server.');
    log.info('Type "help" to see available commands, "exit" or Ctrl+C to quit.');
    log.info('');
    log.info('For single command execution, use: mcctl exec <server> <command>');
    return 1;
  }

  let server: ServerName;
  try {
    server = ServerName.fromExisting(options.serverName);
  } catch (e) {
    log.error(e instanceof Error ? e.message : String(e));
    return 1;
  }

  const container = options.runtime && options.console ? undefined : getContainer(options.root);
  const runtime = options.runtime ?? container!.containerRuntime;
  const consolePort = options.console ?? container!.serverConsolePort;

  if (runtime.getStatus(server) !== 'running') {
    log.error(`Server '${options.serverName}' is not running`);
    log.info(`Start the server first: mcctl start ${options.serverName}`);
    return 1;
  }

  // Address and RCON password from the container (TCP, not docker exec)
  const rconConfig = await consolePort.getEndpoint(server);
  if (!rconConfig) {
    log.error('Failed to get RCON configuration from container');
    return 1;
  }

  if (!rconConfig.password) {
    log.error('RCON_PASSWORD not set in container');
    return 1;
  }

  log.info(`Connecting to RCON console for '${options.serverName}'...`);

  const connect = options.connect ?? ((e: ConsoleEndpoint) => Rcon.connect(e));
  let rcon: RconSession;
  try {
    rcon = await connect(rconConfig);
  } catch (err) {
    log.error(`Failed to connect to RCON: ${(err as Error).message}`);
    log.info('Make sure the server is fully started and RCON is enabled.');
    return 1;
  }

  const output = options.output ?? process.stdout;
  log.info('Connected! Type "help" for commands, "exit" or Ctrl+C to quit.');
  output.write('\n');

  const rl = readline.createInterface({
    input: options.input ?? process.stdin,
    output,
    prompt: '> ',
  });

  return new Promise((resolve) => {
    let done = false;
    // After EOF the queue still drains, but the closed readline cannot prompt
    let inputClosed = false;
    // Lines run one at a time, in order; EOF waits for the queue (piped input)
    let queue: Promise<void> = Promise.resolve();

    const finish = async (code: number, connectionOpen = true) => {
      if (done) return;
      done = true;
      rl.close();
      output.write('\n');
      if (connectionOpen) {
        log.info('Disconnecting from RCON...');
        try {
          await rcon.end();
        } catch {
          // Ignore disconnect errors
        }
      }
      resolve(code);
    };

    const run = async (line: string) => {
      if (done) return;
      const cmd = line.trim();
      if (cmd === 'exit' || cmd === 'quit') return finish(0);
      if (cmd) {
        try {
          const response = await rcon.send(cmd);
          if (response) output.write(formatRconResponse(response) + '\n');
        } catch (err) {
          log.error(`Command failed: ${(err as Error).message}`);
        }
      }
      if (!done && !inputClosed) rl.prompt();
    };

    rl.on('line', (line) => {
      queue = queue.then(() => run(line));
    });
    // EOF (Ctrl+D, end of a pipe): finish the queued commands first
    rl.on('close', () => {
      inputClosed = true;
      void queue.then(() => finish(0));
    });
    // Ctrl+C: leave now
    rl.on('SIGINT', () => void finish(0));

    rcon.on('end', () => {
      if (done) return;
      log.info('RCON connection closed by the server.');
      void finish(0, false);
    });
    rcon.on('error', (error) => {
      if (done) return;
      log.error(`RCON connection error: ${error?.message ?? 'unknown error'}`);
      void finish(1, false);
    });

    rl.prompt();
  });
}
