import {
  Paths,
  log,
  colors,
  getPlayitAgentStatus,
  startPlayitAgent,
  stopPlayitAgent,
  getServerPlayitDomain,
  getConfiguredServers,
} from '@minecraft-docker/shared';
import * as p from '@clack/prompts';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface PlayitCommandOptions {
  root?: string;
  subCommand?: 'start' | 'stop' | 'status' | 'setup';
  json?: boolean;
}

/**
 * Read .mcctl.json to check if playit is enabled
 */
function isPlayitEnabled(paths: Paths): boolean {
  const configPath = join(paths.root, '.mcctl.json');
  if (!existsSync(configPath)) {
    return false;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return config.playitEnabled === true;
  } catch {
    return false;
  }
}

/**
 * Update PLAYIT_SECRET_KEY in .env file
 */
function updateSecretKey(paths: Paths, secretKey: string): void {
  const envPath = join(paths.root, '.env');
  let envContent = '';

  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, 'utf-8');
  }

  // Replace or add PLAYIT_SECRET_KEY
  if (envContent.includes('PLAYIT_SECRET_KEY=')) {
    envContent = envContent.replace(
      /^PLAYIT_SECRET_KEY=.*$/m,
      `PLAYIT_SECRET_KEY=${secretKey}`
    );
  } else {
    envContent += `\nPLAYIT_SECRET_KEY=${secretKey}\n`;
  }

  writeFileSync(envPath, envContent, 'utf-8');
}

/**
 * Ensure playit service exists in docker-compose.yml
 */
function ensurePlayitService(paths: Paths): void {
  const composePath = join(paths.root, 'docker-compose.yml');
  if (!existsSync(composePath)) return;

  const content = readFileSync(composePath, 'utf-8');

  // Check if playit service already defined
  if (content.includes('playit-cloud/playit-agent')) return;

  const playitService = `
  # ===========================================================================
  # External Access - playit.gg Tunnel Agent
  # ===========================================================================
  playit:
    image: ghcr.io/playit-cloud/playit-agent:0.16
    container_name: playit-agent
    network_mode: host
    environment:
      - SECRET_KEY=\${PLAYIT_SECRET_KEY:?PLAYIT_SECRET_KEY must be set in .env}
    restart: unless-stopped
    profiles:
      - playit
`;

  // Insert before 'networks:' section if it exists, otherwise append before end
  if (content.includes('\nnetworks:')) {
    const updated = content.replace('\nnetworks:', playitService + '\nnetworks:');
    writeFileSync(composePath, updated, 'utf-8');
  } else {
    writeFileSync(composePath, content + playitService, 'utf-8');
  }
}

/**
 * Update playitEnabled flag in .mcctl.json
 */
function updatePlayitEnabled(paths: Paths, enabled: boolean): void {
  const configPath = join(paths.root, '.mcctl.json');
  let config: any = {};

  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      // Ignore parse errors
    }
  }

  config.playitEnabled = enabled;
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Start playit-agent container
 */
async function handleStart(paths: Paths): Promise<number> {
  const status = await getPlayitAgentStatus();

  // Check if playit is enabled and key is configured
  if (!status.secretKeyConfigured) {
    log.error('PLAYIT_SECRET_KEY is not configured');
    console.log(`Run: ${colors.cyan('mcctl playit setup')}`);
    return 1;
  }

  if (!status.enabled) {
    log.error('playit.gg is not enabled');
    console.log(`Run: ${colors.cyan('mcctl init --reconfigure')} or ${colors.cyan('mcctl playit setup')}`);
    return 1;
  }

  if (status.agentRunning) {
    log.warn('playit-agent is already running');
    return 0;
  }

  // Start the agent
  const result = await startPlayitAgent();
  if (!result.success) {
    log.error('Failed to start playit-agent');
    if (result.error) {
      console.log(`  ${colors.dim(result.error)}`);
    }
    return 1;
  }

  log.info('playit-agent started successfully');
  return 0;
}

/**
 * Stop playit-agent container
 */
async function handleStop(): Promise<number> {
  const success = await stopPlayitAgent();
  if (!success) {
    log.error('Failed to stop playit-agent');
    return 1;
  }

  log.info('playit-agent stopped successfully');
  return 0;
}

/**
 * Show playit-agent status
 */
async function handleStatus(paths: Paths, json: boolean): Promise<number> {
  const status = await getPlayitAgentStatus();
  const servers = getConfiguredServers();

  // Collect server playit domains
  const serverDomains = servers.map((serverName) => ({
    serverName,
    playitDomain: getServerPlayitDomain(serverName),
  })).filter((s) => s.playitDomain !== null);

  if (json) {
    console.log(JSON.stringify({
      agentStatus: status.containerStatus,
      agentRunning: status.agentRunning,
      secretKeyConfigured: status.secretKeyConfigured,
      enabled: status.enabled,
      uptime: status.uptime,
      servers: serverDomains,
    }, null, 2));
    return 0;
  }

  // Human-readable output
  console.log('');
  console.log(colors.bold('=== playit.gg Agent Status ==='));
  console.log('');

  const statusColor = status.agentRunning ? colors.green : colors.red;
  console.log(`  Agent:      ${statusColor(status.agentRunning ? 'running' : 'stopped')}`);
  console.log(`  SECRET_KEY: ${status.secretKeyConfigured ? colors.green('configured ✓') : colors.red('not configured')}`);

  if (status.uptime) {
    console.log(`  Uptime:     ${status.uptime}`);
  }

  console.log('');
  console.log(colors.cyan('REGISTERED SERVERS'));
  console.log('');

  if (serverDomains.length === 0) {
    console.log('  No servers with playit.gg domains configured');
  } else {
    console.log(`  ${'SERVER'.padEnd(20)} EXTERNAL DOMAIN`);
    console.log(`  ${'------'.padEnd(20)} ---------------`);
    for (const { serverName, playitDomain } of serverDomains) {
      console.log(`  ${serverName.padEnd(20)} ${playitDomain}`);
    }
  }

  console.log('');
  console.log(`  Dashboard: ${colors.cyan('https://playit.gg/account/tunnels')}`);
  console.log('');

  return 0;
}

/**
 * Setup/reconfigure PLAYIT_SECRET_KEY
 */
async function handleSetup(paths: Paths): Promise<number> {
  const status = await getPlayitAgentStatus();

  p.intro(colors.bold('playit.gg Setup'));

  console.log('');
  console.log('  Current status:');
  const statusColor = status.agentRunning ? colors.green : colors.red;
  console.log(`    Agent:      ${statusColor(status.agentRunning ? 'running' : 'stopped')}`);
  console.log(`    SECRET_KEY: ${status.secretKeyConfigured ? colors.green('configured ✓') : colors.red('not configured')}`);
  console.log('');

  const secretKey = await p.password({
    message: 'Enter playit.gg SECRET_KEY',
    mask: '•',
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'SECRET_KEY is required';
      }
      return undefined;
    },
  });

  if (p.isCancel(secretKey)) {
    p.cancel('Setup cancelled');
    return 1;
  }

  // Update .env file
  updateSecretKey(paths, secretKey as string);

  // Update .mcctl.json to enable playit
  updatePlayitEnabled(paths, true);

  // Ensure playit service exists in docker-compose.yml
  ensurePlayitService(paths);

  p.outro(colors.green('playit.gg configuration updated successfully'));

  console.log('');
  console.log(`  ${colors.cyan('Next steps:')}`);
  console.log(`    1. Start agent: ${colors.bold('mcctl playit start')}`);
  if (status.agentRunning) {
    console.log(`    2. Restart agent for changes to take effect: ${colors.bold('mcctl playit stop && mcctl playit start')}`);
  }
  console.log('');

  return 0;
}

/**
 * Main playit command handler
 */
export async function playitCommand(options: PlayitCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  // Check if initialized
  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  const subCommand = options.subCommand;

  switch (subCommand) {
    case 'start':
      return handleStart(paths);

    case 'stop':
      return handleStop();

    case 'status':
      return handleStatus(paths, options.json || false);

    case 'setup':
      return handleSetup(paths);

    default:
      log.error('Usage: mcctl playit <start|stop|status|setup>');
      return 1;
  }
}
