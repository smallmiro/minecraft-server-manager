import { ServerSpecError, type ServerSpecDocument } from '../../domain/server-spec/ServerSpecDocument.js';
import type {
  IServerSpecRepository,
  WriteServerSpecOptions,
} from '../ports/outbound/IServerSpecRepository.js';

/**
 * Change one server's spec (ADR-0003 §6): load (hand edits absorbed, or an
 * import), apply `mutate` to a copy, write with the loaded revision. A
 * revision conflict (another writer in between) is retried once with a fresh
 * load. Every config writer goes through this, so server.yaml stays the one
 * definition. Returns the written document.
 */
export async function updateServerSpec(
  repo: IServerSpecRepository,
  name: string,
  mutate: (doc: ServerSpecDocument) => ServerSpecDocument,
  options: Omit<WriteServerSpecOptions, 'expectedRevision' | 'create'> = {}
): Promise<ServerSpecDocument> {
  for (let attempt = 0; ; attempt++) {
    const loaded = await repo.load(name);
    if (!loaded) throw new ServerSpecError('not_found', `Server '${name}' not found`, name);
    const next = mutate(structuredClone(loaded.document));
    try {
      await repo.write(next, { ...options, expectedRevision: loaded.revision });
      return next;
    } catch (error) {
      if (attempt === 0 && error instanceof ServerSpecError && error.code === 'conflict') continue;
      throw error;
    }
  }
}
