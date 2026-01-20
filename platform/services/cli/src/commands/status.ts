import {
  Paths,
  colors,
  log,
  checkDocker,
  getPlatformStatus,
  getDetailedServerInfoWithPlayers,
  getRouterDetailInfo,
  formatBytes,
  getMcContainers,
  containerExists,
} from '@minecraft-docker/shared';
import type {
  PlatformStatus,
  DetailedServerInfo,
  RouterDetailInfo,
} from '@minecraft-docker/shared';
import { ShellExecutor } from '../lib/shell.js';

export interface StatusCommandOptions {
  json?: boolean;
  root?: string;
  detail?: boolean;
  watch?: boolean;
  interval?: number;
  serverName?: string;
}

/**
 * Format status output as JSON
 */
function formatJson(status: PlatformStatus): string {
  return JSON.stringify(status, null, 2);
}

/**
 * Format basic status output as human-readable table
 */
function formatTable(status: PlatformStatus): void {
  console.log('');
  console.log(colors.bold('=== Server Status (mc-router Managed) ==='));
  console.log('');

  // Infrastructure section
  console.log(colors.cyan('INFRASTRUCTURE'));
  console.log(
    `${'SERVICE'.padEnd(20)} ${'STATUS'.padEnd(12)} ${'HEALTH'.padEnd(10)} PORT/INFO`
  );
  console.log(
    `${'-------'.padEnd(20)} ${'------'.padEnd(12)} ${'------'.padEnd(10)} ---------`
  );

  // Router
  const routerColor = status.router.status === 'running' ? colors.green : colors.red;
  console.log(
    `${'mc-router'.padEnd(20)} ${routerColor(status.router.status.padEnd(12))} ${status.router.health.padEnd(10)} :${status.router.port} (hostname routing)`
  );

  // Avahi
  const avahiColor = status.avahi_daemon.status === 'running' ? colors.green : colors.red;
  console.log(
    `${'avahi-daemon'.padEnd(20)} ${avahiColor(status.avahi_daemon.status.padEnd(12))} ${'(system)'.padEnd(10)} mDNS broadcast`
  );

  console.log('');

  // Servers section
  console.log(colors.cyan('MINECRAFT SERVERS'));
  console.log(
    `${'SERVER'.padEnd(20)} ${'STATUS'.padEnd(12)} ${'HEALTH'.padEnd(10)} HOSTNAME`
  );
  console.log(
    `${'------'.padEnd(20)} ${'------'.padEnd(12)} ${'------'.padEnd(10)} --------`
  );

  if (status.servers.length === 0) {
    console.log('  No Minecraft servers configured');
  } else {
    for (const server of status.servers) {
      let statusColor = colors.red;
      if (server.status === 'running') statusColor = colors.green;
      if (server.status === 'exited') statusColor = colors.yellow;

      console.log(
        `${server.name.padEnd(20)} ${statusColor(server.status.padEnd(12))} ${server.health.padEnd(10)} ${server.hostname}`
      );
    }
  }

  console.log('');
}

/**
 * Format detailed server info
 */
function formatDetailedServer(info: DetailedServerInfo): void {
  const statusColor = info.status === 'running' ? colors.green : colors.red;

  console.log(`  ${colors.bold(info.name)}`);
  console.log(`    Container: ${info.container}`);
  console.log(`    Status:    ${statusColor(info.status)} (${info.health})`);
  console.log(`    Hostname:  ${info.hostname}`);

  if (info.type) {
    console.log(`    Type:      ${info.type}`);
  }
  if (info.version) {
    console.log(`    Version:   ${info.version}`);
  }
  if (info.memory) {
    console.log(`    Memory:    ${info.memory}`);
  }
  if (info.uptime) {
    console.log(`    Uptime:    ${info.uptime}`);
  }

  if (info.stats) {
    const memUsed = formatBytes(info.stats.memoryUsage);
    const memLimit = formatBytes(info.stats.memoryLimit);
    const memPercent = info.stats.memoryPercent.toFixed(1);
    const cpuPercent = info.stats.cpuPercent.toFixed(1);
    console.log(`    Resources: ${memUsed} / ${memLimit} (${memPercent}%) | CPU: ${cpuPercent}%`);
  }

  if (info.players) {
    const playerList =
      info.players.players.length > 0
        ? info.players.players.join(', ')
        : 'none';
    console.log(
      `    Players:   ${colors.cyan(String(info.players.online))}/${info.players.max} - ${playerList}`
    );
  }

  console.log('');
}

/**
 * Format detailed status output
 */
async function formatDetailedTable(
  status: PlatformStatus,
  shell: ShellExecutor
): Promise<void> {
  console.log('');
  console.log(colors.bold('=== Detailed Server Status ==='));
  console.log('');

  // Infrastructure section
  console.log(colors.cyan('INFRASTRUCTURE'));
  console.log('');

  // Router
  const routerInfo = getRouterDetailInfo();
  const routerColor = routerInfo.status === 'running' ? colors.green : colors.red;
  console.log(`  ${colors.bold('mc-router')}`);
  console.log(`    Status:    ${routerColor(routerInfo.status)} (${routerInfo.health})`);
  console.log(`    Port:      ${routerInfo.port}`);
  console.log(`    Mode:      ${routerInfo.mode || 'unknown'}`);
  if (routerInfo.uptime) {
    console.log(`    Uptime:    ${routerInfo.uptime}`);
  }
  if (routerInfo.routes.length > 0) {
    console.log(`    Routes:    ${routerInfo.routes.length} configured`);
    for (const route of routerInfo.routes) {
      const targetColor = route.serverStatus === 'running' ? colors.green : colors.yellow;
      console.log(`      - ${route.hostname} → ${targetColor(route.target)}`);
    }
  }
  console.log('');

  // Avahi
  const avahiColor = status.avahi_daemon.status === 'running' ? colors.green : colors.red;
  console.log(`  ${colors.bold('avahi-daemon')}`);
  console.log(`    Status:    ${avahiColor(status.avahi_daemon.status)}`);
  console.log(`    Type:      ${status.avahi_daemon.type}`);
  console.log('');

  // Servers section
  console.log(colors.cyan('MINECRAFT SERVERS'));
  console.log('');

  if (status.servers.length === 0) {
    console.log('  No Minecraft servers configured');
  } else {
    for (const server of status.servers) {
      // Get config.env for type/version/memory
      const configEnv = shell.readConfig(server.name);
      const envMap: Record<string, string> = {};
      if (configEnv) {
        if (configEnv.TYPE) envMap['TYPE'] = configEnv.TYPE;
        if (configEnv.VERSION) envMap['VERSION'] = configEnv.VERSION;
        if (configEnv.MEMORY) envMap['MEMORY'] = configEnv.MEMORY;
      }

      const detailedInfo = await getDetailedServerInfoWithPlayers(
        server.container,
        envMap
      );
      formatDetailedServer(detailedInfo);
    }
  }
}

/**
 * Format single server status
 */
async function formatSingleServerStatus(
  serverName: string,
  shell: ShellExecutor,
  json: boolean
): Promise<number> {
  const containerName = `mc-${serverName}`;

  if (!containerExists(containerName)) {
    log.error(`Server '${serverName}' not found`);
    return 1;
  }

  // Get config.env for type/version/memory
  const configEnv = shell.readConfig(serverName);
  const envMap: Record<string, string> = {};
  if (configEnv) {
    if (configEnv.TYPE) envMap['TYPE'] = configEnv.TYPE;
    if (configEnv.VERSION) envMap['VERSION'] = configEnv.VERSION;
    if (configEnv.MEMORY) envMap['MEMORY'] = configEnv.MEMORY;
  }

  const detailedInfo = await getDetailedServerInfoWithPlayers(containerName, envMap);

  if (json) {
    console.log(JSON.stringify(detailedInfo, null, 2));
  } else {
    console.log('');
    console.log(colors.bold(`=== Server: ${serverName} ===`));
    console.log('');
    formatDetailedServer(detailedInfo);
  }

  return 0;
}

/**
 * Format router status
 */
function formatRouterStatus(json: boolean): number {
  const routerInfo = getRouterDetailInfo();

  if (json) {
    console.log(JSON.stringify(routerInfo, null, 2));
    return 0;
  }

  console.log('');
  console.log(colors.bold('=== mc-router Status ==='));
  console.log('');

  const statusColor = routerInfo.status === 'running' ? colors.green : colors.red;
  console.log(`  Status:    ${statusColor(routerInfo.status)} (${routerInfo.health})`);
  console.log(`  Port:      ${routerInfo.port}`);
  console.log(`  Mode:      ${routerInfo.mode || 'unknown'}`);

  if (routerInfo.uptime) {
    console.log(`  Uptime:    ${routerInfo.uptime}`);
  }

  console.log('');
  console.log(colors.cyan('ROUTING TABLE'));
  console.log('');

  if (routerInfo.routes.length === 0) {
    console.log('  No routes configured');
  } else {
    console.log(
      `  ${'HOSTNAME'.padEnd(40)} ${'TARGET'.padEnd(25)} STATUS`
    );
    console.log(
      `  ${'--------'.padEnd(40)} ${'------'.padEnd(25)} ------`
    );

    for (const route of routerInfo.routes) {
      const statusColor = route.serverStatus === 'running' ? colors.green : colors.yellow;
      console.log(
        `  ${route.hostname.padEnd(40)} ${route.target.padEnd(25)} ${statusColor(route.serverStatus)}`
      );
    }
  }

  console.log('');
  return 0;
}

/**
 * Clear screen and move cursor to top
 */
function clearScreen(): void {
  process.stdout.write('\x1B[2J\x1B[H');
}

/**
 * Watch mode with periodic refresh
 */
async function watchMode(
  options: StatusCommandOptions,
  paths: Paths,
  shell: ShellExecutor
): Promise<number> {
  const intervalMs = (options.interval || 5) * 1000;

  const refresh = async (): Promise<void> => {
    clearScreen();

    const timestamp = new Date().toLocaleTimeString();
    console.log(colors.dim(`Last update: ${timestamp} (interval: ${options.interval || 5}s, press Ctrl+C to exit)`));

    if (options.serverName === 'router') {
      formatRouterStatus(false);
    } else if (options.serverName) {
      await formatSingleServerStatus(options.serverName, shell, false);
    } else {
      const status = getPlatformStatus();
      if (options.detail) {
        await formatDetailedTable(status, shell);
      } else {
        formatTable(status);
      }
    }
  };

  // Initial display
  await refresh();

  // Set up periodic refresh
  const intervalId = setInterval(refresh, intervalMs);

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    clearInterval(intervalId);
    console.log('\n');
    log.info('Watch mode stopped');
    process.exit(0);
  });

  // Keep running indefinitely
  return new Promise(() => {
    // Never resolves - runs until SIGINT
  });
}

/**
 * Status command
 */
export async function statusCommand(options: StatusCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  // Check if initialized
  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  // Check Docker
  if (!checkDocker()) {
    log.error('Docker is not available');
    return 1;
  }

  const shell = new ShellExecutor(paths);

  // Watch mode
  if (options.watch) {
    return watchMode(options, paths, shell);
  }

  // Single router status
  if (options.serverName === 'router') {
    return formatRouterStatus(options.json || false);
  }

  // Single server status
  if (options.serverName) {
    return formatSingleServerStatus(options.serverName, shell, options.json || false);
  }

  // Get platform status
  const status = getPlatformStatus();

  // Output
  if (options.json) {
    if (options.detail) {
      // For detailed JSON, include all the extra info
      const detailedServers: DetailedServerInfo[] = [];
      for (const server of status.servers) {
        const configEnv = shell.readConfig(server.name);
        const envMap: Record<string, string> = {};
        if (configEnv) {
          if (configEnv.TYPE) envMap['TYPE'] = configEnv.TYPE;
          if (configEnv.VERSION) envMap['VERSION'] = configEnv.VERSION;
          if (configEnv.MEMORY) envMap['MEMORY'] = configEnv.MEMORY;
        }
        const detailed = await getDetailedServerInfoWithPlayers(server.container, envMap);
        detailedServers.push(detailed);
      }
      const routerDetail = getRouterDetailInfo();
      console.log(
        JSON.stringify(
          {
            router: routerDetail,
            avahi_daemon: status.avahi_daemon,
            servers: detailedServers,
          },
          null,
          2
        )
      );
    } else {
      console.log(formatJson(status));
    }
  } else {
    if (options.detail) {
      await formatDetailedTable(status, shell);
    } else {
      formatTable(status);
    }
  }

  return 0;
}
