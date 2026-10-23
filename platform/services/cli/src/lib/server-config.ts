import {
  DockerComposeRuntimeAdapter,
  FileServerSpecRepository,
  setEnvKeys,
  updateServerSpec,
  type Paths,
  type ServerSpecDocument,
  type SpecEnvChanges,
} from '@minecraft-docker/shared';

/** How the CLI writers build their ServerSpec repository; tests replace `create` (fake runtime). */
export const serverSpecRepositories = {
  /** With a runtime for the world checks of a changed LEVEL (ADR-0003 R4). */
  create: (paths: Paths): FileServerSpecRepository =>
    new FileServerSpecRepository(paths, undefined, new DockerComposeRuntimeAdapter({ root: paths.root })),
};

export function serverSpecRepository(paths: Paths): FileServerSpecRepository {
  return serverSpecRepositories.create(paths);
}

/**
 * Change config.env-style settings of a server through its ServerSpec
 * (#675, ADR-0003 §6): server.yaml is updated and config.env / the compose
 * are rendered from it. Throws ServerSpecError / WorldAssignmentError.
 */
export function writeServerConfig(
  paths: Paths,
  server: string,
  changes: SpecEnvChanges,
  options: { allowStorageChange?: boolean } = {}
): Promise<ServerSpecDocument> {
  return updateServerSpec(serverSpecRepository(paths), server, (doc) => setEnvKeys(doc, changes), options);
}

/** Change a server's spec with `mutate` (routing, image, ...) and render it. */
export function updateServer(
  paths: Paths,
  server: string,
  mutate: (doc: ServerSpecDocument) => ServerSpecDocument
): Promise<ServerSpecDocument> {
  return updateServerSpec(serverSpecRepository(paths), server, mutate);
}

/**
 * Render every server again without changing its spec (#675, ADR-0003 §6):
 * after a new HOST_IP the nip.io router hosts are re-derived, custom hosts
 * and the playit domain stay. A compose with edits outside the spec is left
 * alone (its rendered output did not change for the spec). Servers that
 * cannot be read are reported, not fatal.
 */
export async function rerenderServers(paths: Paths): Promise<{ updated: string[]; failed: Array<{ server: string; reason: string }> }> {
  const repo = serverSpecRepository(paths);
  const updated: string[] = [];
  const failed: Array<{ server: string; reason: string }> = [];
  for (const { name } of await repo.list()) {
    try {
      await updateServerSpec(repo, name, (doc) => doc);
      updated.push(name);
    } catch (error) {
      failed.push({ server: name, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { updated, failed };
}

export interface ServerSpecStatus {
  server: string;
  /** imported: has server.yaml; pending: imports cleanly on the next write; refused: cannot be imported. */
  status: 'imported' | 'pending' | 'refused';
  reason?: string;
  warnings: string[];
}

/**
 * Which servers have no server.yaml yet and what their import would report
 * (`mcctl upgrade`, ADR-0003 decision 4). Reads only: never imports.
 */
export async function serverSpecReport(paths: Paths): Promise<ServerSpecStatus[]> {
  const repo = serverSpecRepository(paths);
  const report: ServerSpecStatus[] = [];
  for (const { name } of await repo.list()) {
    try {
      if (await repo.loadFile(name)) {
        report.push({ server: name, status: 'imported', warnings: [] });
        continue;
      }
      const loaded = await repo.load(name);
      report.push({ server: name, status: 'pending', warnings: loaded?.warnings ?? [] });
    } catch (error) {
      report.push({ server: name, status: 'refused', reason: error instanceof Error ? error.message : String(error), warnings: [] });
    }
  }
  return report;
}
