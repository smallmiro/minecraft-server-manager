import { ServerStatus } from '../../domain/index.js';
import type {
  IServerStatusUseCase,
  ServerStatusResult,
  IPromptPort,
  IShellPort,
  IServerRepository,
} from '../ports/index.js';

/**
 * Server Status Use Case
 * Displays server status information
 */
export class ServerStatusUseCase implements IServerStatusUseCase {
  constructor(
    private readonly prompt: IPromptPort,
    private readonly shell: IShellPort,
    private readonly serverRepo: IServerRepository
  ) {}

  /**
   * Get status of all servers
   */
  async execute(): Promise<ServerStatusResult[]> {
    const servers = await this.serverRepo.findAll();

    return servers.map((server) => ({
      name: server.name.value,
      containerName: server.containerName,
      hostname: server.hostname,
      status: server.status,
      type: server.type.label,
      version: server.version.value,
      playerCount: server.playerCount,
      memory: server.memory.value,
    }));
  }

  /**
   * Get status of a specific server
   */
  async executeForServer(name: string): Promise<ServerStatusResult> {
    const server = await this.serverRepo.findByName(name);

    if (!server) {
      throw new Error(`Server '${name}' not found`);
    }

    return {
      name: server.name.value,
      containerName: server.containerName,
      hostname: server.hostname,
      status: server.status,
      type: server.type.label,
      version: server.version.value,
      playerCount: server.playerCount,
      memory: server.memory.value,
    };
  }

  /**
   * Get status in JSON format
   */
  async executeAsJson(): Promise<string> {
    const result = await this.shell.status(true);

    if (!result.success) {
      throw new Error(result.stderr || 'Failed to get status');
    }

    return result.stdout;
  }

  /**
   * Display status with formatting
   */
  async displayStatus(): Promise<void> {
    const servers = await this.execute();

    if (servers.length === 0) {
      this.prompt.warn('No servers found');
      return;
    }

    // Display header
    console.log('\n');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│                    Server Status                            │');
    console.log('├─────────────────────────────────────────────────────────────┤');

    for (const server of servers) {
      const statusIcon = this.getStatusIcon(server.status);
      const statusColor = this.getStatusColor(server.status);

      console.log(
        `│ ${statusIcon} ${server.name.padEnd(20)} ${server.type.padEnd(10)} ${server.version.padEnd(10)} │`
      );

      if (server.status === ServerStatus.RUNNING) {
        console.log(
          `│   └─ Players: ${server.playerCount}  Memory: ${server.memory || 'N/A'}`.padEnd(64) + '│'
        );
      }
    }

    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('\n');
  }

  private getStatusIcon(status: ServerStatus): string {
    switch (status) {
      case ServerStatus.RUNNING:
        return '🟢';
      case ServerStatus.STOPPED:
        return '🔴';
      case ServerStatus.STARTING:
        return '🟡';
      case ServerStatus.STOPPING:
        return '🟠';
      case ServerStatus.ERROR:
        return '❌';
      default:
        return '⚪';
    }
  }

  private getStatusColor(status: ServerStatus): string {
    switch (status) {
      case ServerStatus.RUNNING:
        return 'green';
      case ServerStatus.STOPPED:
        return 'red';
      case ServerStatus.STARTING:
      case ServerStatus.STOPPING:
        return 'yellow';
      case ServerStatus.ERROR:
        return 'red';
      default:
        return 'gray';
    }
  }
}
