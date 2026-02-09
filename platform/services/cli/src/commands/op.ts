import { Paths, log, colors, AuditActionEnum, OpLevel, Operator } from '@minecraft-docker/shared';
import { ShellExecutor } from '../lib/shell.js';
import { isContainerRunning, execRconWithOutput, getContainerName } from '../lib/rcon.js';
import { getContainer } from '../infrastructure/di/container.js';
import { OpsJsonAdapter } from '../infrastructure/adapters/OpsJsonAdapter.js';
import { selectOpLevel } from '../lib/prompts/level-select.js';
import path from 'node:path';
import { MojangApiClient } from '../lib/mojang-api.js';

export interface OpCommandOptions {
  root?: string;
  serverName?: string;
  subCommand?: 'add' | 'remove' | 'list' | 'set-level';
  playerName?: string;
  level?: number; // OP level (1-4)
  json?: boolean;
}

/**
 * Manage server operators
 */
export async function opCommand(options: OpCommandOptions): Promise<number> {
  const paths = new Paths(options.root);

  if (!paths.isInitialized()) {
    log.error('Platform not initialized. Run: mcctl init');
    return 1;
  }

  if (!options.serverName) {
    log.error('Server name is required');
    log.info('Usage: mcctl op <server> <add|remove|list> [player]');
    return 1;
  }

  if (!options.subCommand) {
    log.error('Action is required: add, remove, list, or set-level');
    log.info('Usage: mcctl op <server> <add|remove|list|set-level> [player] [--level <1-4>]');
    return 1;
  }

  const shell = new ShellExecutor(paths);
  const config = shell.readConfig(options.serverName);

  if (config === null) {
    log.error(`Server '${options.serverName}' not found`);
    return 1;
  }

  const containerName = getContainerName(options.serverName);
  const isRunning = await isContainerRunning(containerName);

  // Get ops.json path
  const serverDir = path.join(paths.servers, options.serverName);
  const dataDir = path.join(serverDir, 'data');
  const opsJsonPath = path.join(dataDir, 'ops.json');
  const opsAdapter = new OpsJsonAdapter(opsJsonPath);

  switch (options.subCommand) {
    case 'list': {
      return await listOps(shell, options, config, containerName, isRunning, opsAdapter);
    }

    case 'add': {
      if (!options.playerName) {
        log.error('Player name is required for add');
        log.info('Usage: mcctl op <server> add <player> [--level <1-4>]');
        return 1;
      }
      return await addOp(shell, options, config, containerName, isRunning, opsAdapter);
    }

    case 'remove': {
      if (!options.playerName) {
        log.error('Player name is required for remove');
        log.info('Usage: mcctl op <server> remove <player>');
        return 1;
      }
      return await removeOp(shell, options, config, containerName, isRunning, opsAdapter);
    }

    case 'set-level': {
      if (!options.playerName) {
        log.error('Player name is required for set-level');
        log.info('Usage: mcctl op <server> set-level <player> <level>');
        return 1;
      }
      if (options.level === undefined) {
        log.error('Level is required for set-level');
        log.info('Usage: mcctl op <server> set-level <player> <level>');
        return 1;
      }
      return await setOpLevel(options, containerName, isRunning, opsAdapter);
    }

    default:
      log.error(`Unknown action: ${options.subCommand}`);
      log.info('Valid actions: add, remove, list, set-level');
      return 1;
  }
}

/**
 * List current operators with level information
 */
async function listOps(
  shell: ShellExecutor,
  options: OpCommandOptions,
  config: Record<string, string>,
  containerName: string,
  isRunning: boolean,
  opsAdapter: OpsJsonAdapter
): Promise<number> {
  // Try to get OPs from ops.json first (if server has been started)
  const operators = await opsAdapter.read();

  if (options.json) {
    const jsonData = operators.map((op: Operator) => ({
      name: op.name,
      uuid: op.uuid,
      level: op.level.value,
      role: op.level.label,
      bypassesPlayerLimit: op.bypassesPlayerLimit,
    }));

    console.log(
      JSON.stringify({
        server: options.serverName,
        running: isRunning,
        operators: jsonData,
        source: operators.length > 0 ? 'ops.json' : 'config.env',
      })
    );
  } else {
    console.log(colors.bold(`\nOperators for ${options.serverName}:\n`));

    if (operators.length === 0) {
      console.log('  (none)');
      if (!isRunning) {
        log.warn('Server has not been started yet. Start the server to see operator levels.');
      }
    } else {
      // Display table header
      console.log(
        `  ${colors.bold('Player').padEnd(20)} ${colors.bold('Level').padEnd(25)} ${colors.bold('Role')}`
      );
      console.log('  ' + '-'.repeat(60));

      for (const op of operators) {
        const levelStr = `${op.level.value}`.padEnd(3);
        const roleStr = op.level.label.padEnd(20);
        console.log(`  ${colors.cyan(op.name.padEnd(20))} ${levelStr} ${roleStr}`);
      }
    }
    console.log('');

    if (!isRunning) {
      log.warn('Server is not running.');
    }
  }

  return 0;
}

/**
 * Add an operator with level support and interactive mode
 */
async function addOp(
  shell: ShellExecutor,
  options: OpCommandOptions,
  config: Record<string, string>,
  containerName: string,
  isRunning: boolean,
  opsAdapter: OpsJsonAdapter
): Promise<number> {
  const playerName = options.playerName!;

  // Get current OPs from config
  const currentOps = config['OPS']
    ? config['OPS'].split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Check if already an OP
  if (currentOps.some((op) => op.toLowerCase() === playerName.toLowerCase())) {
    if (options.json) {
      console.log(
        JSON.stringify({
          success: false,
          error: 'already_op',
          player: playerName,
          server: options.serverName,
        })
      );
    } else {
      log.warn(`${playerName} is already an operator`);
    }
    return 0;
  }

  // Determine OP level
  let opLevel: OpLevel;
  if (options.level !== undefined) {
    // Level provided via flag
    try {
      opLevel = OpLevel.from(options.level);
    } catch (error) {
      log.error(`Invalid OP level: ${options.level}. Must be between 1 and 4.`);
      return 1;
    }
  } else if (!options.json) {
    // Interactive mode: prompt for level
    const selectedLevel = await selectOpLevel({
      message: `Select OP level for ${colors.cyan(playerName)}:`,
    });

    if (selectedLevel === null) {
      log.warn('Operation cancelled');
      return 0;
    }

    opLevel = selectedLevel;
  } else {
    // Default to level 4 in non-interactive mode
    opLevel = OpLevel.OWNER;
  }

  let rconSuccess = false;
  let rconMessage = '';

  // Execute RCON if server is running
  if (isRunning) {
    const result = await execRconWithOutput(containerName, ['op', playerName]);
    rconSuccess = result.code === 0;
    rconMessage = result.output.trim();

    // If RCON succeeded, update ops.json with level
    if (rconSuccess) {
      try {
        // Look up player UUID
        const mojangApi = new MojangApiClient();
        const playerInfo = await mojangApi.lookupByUsername(playerName);
        if (playerInfo) {
          const operator = Operator.create({
            uuid: playerInfo.uuid,
            name: playerInfo.name,
            level: opLevel,
            bypassesPlayerLimit: false,
          });

          await opsAdapter.add(operator);
        }
      } catch (error) {
        // Non-critical error, just log
        log.warn('Failed to update ops.json with level information');
      }
    }
  }

  // Update config.env
  const newOps = [...currentOps, playerName].join(',');
  const configSuccess = shell.writeConfigValue(options.serverName!, 'OPS', newOps);

  // Log audit
  const container = getContainer({ rootDir: options.root });
  await container.auditLogPort.log({
    action: AuditActionEnum.PLAYER_OP,
    actor: 'cli:local',
    targetType: 'player',
    targetName: playerName,
    status: 'success',
    details: {
      server: options.serverName,
      level: opLevel.value,
      role: opLevel.label,
    },
    errorMessage: null,
  });

  if (options.json) {
    console.log(
      JSON.stringify({
        success: true,
        player: playerName,
        level: opLevel.value,
        role: opLevel.label,
        server: options.serverName,
        rcon: isRunning ? { success: rconSuccess, message: rconMessage } : null,
        config: { success: configSuccess },
        running: isRunning,
      })
    );
  } else {
    if (isRunning && rconSuccess) {
      console.log(
        colors.green(
          `✓ ${playerName} is now an operator with level ${opLevel.value} (${opLevel.label}) - applied immediately`
        )
      );
    } else if (isRunning && !rconSuccess) {
      console.log(colors.yellow(`⚠ RCON failed: ${rconMessage}`));
      if (configSuccess) {
        console.log(
          colors.green(`✓ Config updated with level ${opLevel.value}. Will apply on server restart.`)
        );
      }
    } else {
      console.log(colors.yellow(`⚠ Server is not running.`));
      if (configSuccess) {
        console.log(
          colors.green(
            `✓ Config updated with level ${opLevel.value} (${opLevel.label}). Changes will apply on next start.`
          )
        );
      }
    }
  }

  return 0;
}

/**
 * Remove an operator
 */
async function removeOp(
  shell: ShellExecutor,
  options: OpCommandOptions,
  config: Record<string, string>,
  containerName: string,
  isRunning: boolean,
  opsAdapter: OpsJsonAdapter
): Promise<number> {
  const playerName = options.playerName!;

  // Get current OPs from config
  const currentOps = config['OPS']
    ? config['OPS'].split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Check if is an OP
  const opIndex = currentOps.findIndex((op) => op.toLowerCase() === playerName.toLowerCase());
  if (opIndex === -1) {
    if (options.json) {
      console.log(
        JSON.stringify({
          success: false,
          error: 'not_an_op',
          player: playerName,
          server: options.serverName,
        })
      );
    } else {
      log.warn(`${playerName} is not an operator`);
    }
    return 0;
  }

  let rconSuccess = false;
  let rconMessage = '';

  // Execute RCON if server is running
  if (isRunning) {
    const result = await execRconWithOutput(containerName, ['deop', playerName]);
    rconSuccess = result.code === 0;
    rconMessage = result.output.trim();

    // If RCON succeeded, also remove from ops.json
    if (rconSuccess) {
      try {
        await opsAdapter.remove(playerName);
      } catch (error) {
        // Non-critical error
        log.warn('Failed to remove from ops.json');
      }
    }
  }

  // Update config.env
  currentOps.splice(opIndex, 1);
  const newOps = currentOps.join(',');
  const configSuccess = newOps
    ? shell.writeConfigValue(options.serverName!, 'OPS', newOps)
    : shell.writeConfigValue(options.serverName!, 'OPS', '');

  // Log audit
  const container = getContainer({ rootDir: options.root });
  await container.auditLogPort.log({
    action: AuditActionEnum.PLAYER_DEOP,
    actor: 'cli:local',
    targetType: 'player',
    targetName: playerName,
    status: 'success',
    details: { server: options.serverName },
    errorMessage: null,
  });

  if (options.json) {
    console.log(
      JSON.stringify({
        success: true,
        player: playerName,
        server: options.serverName,
        rcon: isRunning ? { success: rconSuccess, message: rconMessage } : null,
        config: { success: configSuccess },
        running: isRunning,
      })
    );
  } else {
    if (isRunning && rconSuccess) {
      console.log(colors.green(`✓ ${playerName} is no longer an operator (applied immediately)`));
    } else if (isRunning && !rconSuccess) {
      console.log(colors.yellow(`⚠ RCON failed: ${rconMessage}`));
      if (configSuccess) {
        console.log(colors.green(`✓ Config updated. Will apply on server restart.`));
      }
    } else {
      console.log(colors.yellow(`⚠ Server is not running.`));
      if (configSuccess) {
        console.log(colors.green(`✓ Config updated. Changes will apply on next start.`));
      }
    }
  }

  return 0;
}

/**
 * Set operator level
 */
async function setOpLevel(
  options: OpCommandOptions,
  containerName: string,
  isRunning: boolean,
  opsAdapter: OpsJsonAdapter
): Promise<number> {
  const playerName = options.playerName!;

  // Validate level
  let newLevel: OpLevel;
  try {
    newLevel = OpLevel.from(options.level!);
  } catch (error) {
    log.error(`Invalid OP level: ${options.level}. Must be between 1 and 4.`);
    return 1;
  }

  // Check if server is running
  if (!isRunning) {
    log.error('Server must be running to set OP level');
    log.info('Start the server first, or add the operator with the desired level');
    return 1;
  }

  // Check if player is an operator
  const operator = await opsAdapter.find(playerName);
  if (!operator) {
    log.error(`${playerName} is not an operator. Add them first with: mcctl op ${options.serverName} add ${playerName}`);
    return 1;
  }

  // Update level in ops.json
  try {
    await opsAdapter.updateLevel(playerName, newLevel);

    // Log audit
    const container = getContainer({ rootDir: options.root });
    await container.auditLogPort.log({
      action: AuditActionEnum.PLAYER_OP,
      actor: 'cli:local',
      targetType: 'player',
      targetName: playerName,
      status: 'success',
      details: {
        server: options.serverName,
        action: 'set-level',
        oldLevel: operator.level.value,
        newLevel: newLevel.value,
      },
      errorMessage: null,
    });

    if (options.json) {
      console.log(
        JSON.stringify({
          success: true,
          player: playerName,
          oldLevel: operator.level.value,
          newLevel: newLevel.value,
          server: options.serverName,
        })
      );
    } else {
      console.log(
        colors.green(
          `✓ ${playerName}'s OP level updated from ${operator.level.value} (${operator.level.label}) to ${newLevel.value} (${newLevel.label})`
        )
      );
      log.info('Note: Server restart required for level changes to take effect');
    }

    return 0;
  } catch (error) {
    log.error(`Failed to update OP level: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
