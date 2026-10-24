import {
  DockerComposeRuntimeAdapter,
  FileServerSpecRepository,
  Paths,
  setEnvKeys,
  updateServerSpec,
  type ServerSpecDocument,
  type ServerSpecError,
  type SpecEnvChanges,
} from '@minecraft-docker/shared';
import { childProcessEnv } from '../config/index.js';

/** How the API writers build their ServerSpec repository (#675); tests replace `create`. */
export const serverSpecRepositories = {
  /** With a runtime for the world checks of a changed LEVEL (ADR-0003 R4). */
  create: (mcctlRoot: string): FileServerSpecRepository =>
    new FileServerSpecRepository(
      new Paths(mcctlRoot),
      undefined,
      new DockerComposeRuntimeAdapter({ root: mcctlRoot, env: () => childProcessEnv() })
    ),
};

/**
 * Change config.env-style settings of a server through its ServerSpec
 * (ADR-0003 §6): server.yaml is updated and config.env / the compose are
 * rendered from it. Throws ServerSpecError / WorldAssignmentError.
 */
export function writeServerConfig(
  mcctlRoot: string,
  server: string,
  changes: SpecEnvChanges
): Promise<ServerSpecDocument> {
  return updateServerSpec(serverSpecRepositories.create(mcctlRoot), server, (doc) => setEnvKeys(doc, changes));
}

/** Change a server's spec with `mutate` (routing, image, ...) and render it. */
export function updateServer(
  mcctlRoot: string,
  server: string,
  mutate: (doc: ServerSpecDocument) => ServerSpecDocument
): Promise<ServerSpecDocument> {
  return updateServerSpec(serverSpecRepositories.create(mcctlRoot), server, mutate);
}

/**
 * HTTP status and body for a refused ServerSpec write (#675): invalid_spec ->
 * 400, every other code (conflict, locked, undetermined, compose_edited, ...)
 * -> 409.
 */
export function serverSpecFailure(
  error: Pick<ServerSpecError, 'code' | 'message'>,
  message: string = error.message
): { status: 400 | 409; body: { error: string; message: string } } {
  return error.code === 'invalid_spec'
    ? { status: 400, body: { error: 'BadRequest', message } }
    : { status: 409, body: { error: 'Conflict', message } };
}
