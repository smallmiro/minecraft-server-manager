import {
  colors,
  log,
  ServerSpecError,
  WorldAssignmentError,
  type FileServerSpecRepository,
} from '@minecraft-docker/shared';

export interface MigrateSpecOptions {
  serverName?: string;
  all?: boolean;
  dryRun?: boolean;
  force?: boolean;
  json?: boolean;
}

interface MigrateSpecResult {
  server: string;
  status: 'imported' | 'would import' | 'synced' | 'would sync' | 'refused' | 'error';
  warnings: string[];
  reason?: string;
}

/**
 * `mcctl migrate spec [<name>|--all] [--dry-run] [--force]` (#675, ADR-0003 §4):
 * import a server into servers/<n>/server.yaml (or absorb hand edits of its
 * generated files) and render config.env, docker-compose.yml and the
 * servers/compose.yml entry. Idempotent. --force re-renders from server.yaml
 * over hand edits, keeping .bak files. Exit 1 when any server fails.
 */
export async function migrateSpec(repo: FileServerSpecRepository, options: MigrateSpecOptions): Promise<number> {
  if (!options.serverName && !options.all) {
    log.error('Usage: mcctl migrate spec <server> | --all [--dry-run] [--force] [--json]');
    return 1;
  }
  const names = options.all ? (await repo.list()).map((s) => s.name) : [options.serverName!];
  const results: MigrateSpecResult[] = [];
  for (const name of names) results.push(await migrateOne(repo, name, options));

  if (options.json) {
    console.log(JSON.stringify({ servers: results }, null, 2));
  } else {
    print(results, options);
  }
  return results.some((r) => r.status === 'refused' || r.status === 'error') ? 1 : 0;
}

async function migrateOne(
  repo: FileServerSpecRepository,
  server: string,
  options: MigrateSpecOptions
): Promise<MigrateSpecResult> {
  try {
    const loaded = (options.force && (await repo.loadFile(server))) || (await repo.load(server));
    if (!loaded) return { server, status: 'error', warnings: [], reason: `Server '${server}' not found` };
    const imported = loaded.revision === null;
    if (options.dryRun) return { server, status: imported ? 'would import' : 'would sync', warnings: loaded.warnings };
    await repo.write(loaded.document, { expectedRevision: loaded.revision, force: options.force });
    return { server, status: imported ? 'imported' : 'synced', warnings: loaded.warnings };
  } catch (err) {
    if (err instanceof ServerSpecError) {
      const status = err.code === 'undetermined' ? 'refused' : 'error';
      return { server, status, warnings: [], reason: err.message };
    }
    // ADR-0003 R4: a changed world.level checked against ADR-0002
    if (err instanceof WorldAssignmentError) return { server, status: 'error', warnings: [], reason: err.message };
    throw err;
  }
}

function print(results: MigrateSpecResult[], options: MigrateSpecOptions): void {
  console.log('');
  console.log(colors.bold(`ServerSpec import${options.dryRun ? ' (dry run)' : ''}:`));
  if (results.length === 0) console.log('  No servers found.');
  for (const r of results) {
    const target = `servers/${r.server}/server.yaml`;
    const status =
      r.status === 'imported'
        ? colors.green(`imported → ${target}, generated files rendered`)
        : r.status === 'synced'
          ? colors.green('synced (generated files match server.yaml)')
          : r.status === 'would import'
            ? colors.cyan(`would import → ${target} and render the generated files`)
            : r.status === 'would sync'
              ? colors.cyan('would render the generated files from server.yaml')
              : colors.red(`${r.status}: ${r.reason}`);
    console.log(`  ${colors.cyan(r.server)}: ${status}`);
    for (const w of r.warnings) console.log(`    ${colors.yellow('!')} ${w}`);
  }
  console.log('');
}
