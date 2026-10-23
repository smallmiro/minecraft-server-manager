import {
  colors,
  log,
  ServerSpecError,
  type FileServerSpecRepository,
  type ServerSpecDocument,
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
  status: 'imported' | 'would import' | 'already imported' | 'refused' | 'error';
  warnings: string[];
  reason?: string;
}

/**
 * `mcctl migrate spec [<name>|--all] [--dry-run] [--force]` (#675, ADR-0003 §4):
 * import existing servers into servers/<n>/server.yaml. A server that
 * already has one is left alone unless --force re-imports it from
 * config.env and docker-compose.yml. Exit 1 when any server is refused.
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
    let document: ServerSpecDocument;
    let warnings: string[];
    let expectedRevision: null | undefined;
    if (options.force) {
      const result = await repo.importServer(server);
      if (result.status === 'refused') return { server, status: 'refused', warnings: result.warnings, reason: result.reason };
      ({ document, warnings } = result);
      expectedRevision = undefined;
    } else {
      const loaded = await repo.load(server);
      if (!loaded) return { server, status: 'error', warnings: [], reason: `Server '${server}' not found` };
      if (loaded.revision !== null) return { server, status: 'already imported', warnings: [] };
      ({ document, warnings } = loaded);
      expectedRevision = null;
    }
    if (options.dryRun) return { server, status: 'would import', warnings };
    await repo.write(document, { expectedRevision });
    return { server, status: 'imported', warnings };
  } catch (err) {
    if (err instanceof ServerSpecError) {
      const status = err.code === 'undetermined' ? 'refused' : 'error';
      return { server, status, warnings: [], reason: err.message };
    }
    throw err;
  }
}

function print(results: MigrateSpecResult[], options: MigrateSpecOptions): void {
  console.log('');
  console.log(colors.bold(`ServerSpec import${options.dryRun ? ' (dry run)' : ''}:`));
  if (results.length === 0) console.log('  No servers found.');
  for (const r of results) {
    const status =
      r.status === 'imported'
        ? colors.green(`imported → servers/${r.server}/server.yaml`)
        : r.status === 'would import'
          ? colors.cyan(`would import → servers/${r.server}/server.yaml`)
          : r.status === 'already imported'
            ? colors.dim('already imported (--force re-imports from config.env and docker-compose.yml)')
            : colors.red(`${r.status}: ${r.reason}`);
    console.log(`  ${colors.cyan(r.server)}: ${status}`);
    for (const w of r.warnings) console.log(`    ${colors.yellow('!')} ${w}`);
  }
  console.log('');
}
