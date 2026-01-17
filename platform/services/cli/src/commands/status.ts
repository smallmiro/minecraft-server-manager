import {
  Paths,
  colors,
  log,
  checkDocker,
  getPlatformStatus,
} from '@minecraft-docker/shared';
import type { PlatformStatus } from '@minecraft-docker/shared';

/**
 * Format status output as JSON
 */
function formatJson(status: PlatformStatus): string {
  return JSON.stringify(status, null, 2);
}

/**
 * Format status output as human-readable table
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
 * Status command
 */
export async function statusCommand(options: {
  json?: boolean;
  root?: string;
}): Promise<number> {
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

  // Get platform status
  const status = getPlatformStatus();

  // Output
  if (options.json) {
    console.log(formatJson(status));
  } else {
    formatTable(status);
  }

  return 0;
}
