import type { ServerSpec, ServerSpecDocument } from '../../../domain/server-spec/ServerSpecDocument.js';

/** v2 (D1) export, unchanged: `{ name: string }`. The full definition is ServerSpecDocument (#675). */
export type { ServerSpec };

export interface LoadedServerSpec {
  document: ServerSpecDocument;
  /** sha256 of server.yaml as read; null = imported in memory, no server.yaml yet. */
  revision: string | null;
  /** Import notes (pinned EXTRA_ARGS, compose environment clashes, ...). */
  warnings: string[];
}

export interface WriteServerSpecOptions {
  /** Revision from load(); a mismatch rejects with ServerSpecError 'conflict'. Omit to write unconditionally. */
  expectedRevision?: string | null;
  /**
   * A new server: claim servers/<n> with mkdir ('already_exists'), strict
   * create rules, the bundled template's other config.env keys, data/ and
   * logs/, the include entry; rolled back on any failure (#657).
   */
  create?: boolean;
  /** Overwrite hand-edited generated files after writing a .bak (edit_conflict, compose_edited, refused import). */
  force?: boolean;
  /** Allow a world.storage change (only `mcctl migrate worlds`); otherwise 'storage_change'. */
  allowStorageChange?: boolean;
}

export interface DeleteServerSpecOptions {
  /** Delete the world inside the server (data/<LEVEL>, _nether, _the_end) with it instead of moving it to worlds/. */
  deleteWorld?: boolean;
  /** Check and plan only, write nothing: run it before the workload is stopped. */
  dryRun?: boolean;
}

/** What delete did (dryRun: would do) with the server's world (#652). */
export interface ServerSpecDeleteResult {
  /** The server's LEVEL; undefined when it could not be determined (only possible with deleteWorld). */
  level?: string;
  /** Folders moved from servers/<n>/data/ to worlds/. */
  movedWorlds: string[];
  /** Folders under servers/<n>/data/ deleted with the server (deleteWorld). */
  deletedWorlds: string[];
  /** worlds/<level> exists and was left alone; it is no longer assigned. */
  keptWorld?: string;
}

/**
 * Server Spec Repository - Outbound Port (ADR-0001, settled by ADR-0003, #675)
 *
 * `servers/<n>/server.yaml` is the server definition. The four v2 (D1)
 * methods keep their signatures until v3.0.0 (#715, #736); #675 adds
 * load/write. Errors are ServerSpecError (domain).
 */
export interface IServerSpecRepository {
  /** One `{ name }` per server directory with server.yaml or config.env. */
  list(): Promise<ServerSpec[]>;
  /** The document, typed as the v2 ServerSpec. @deprecated Use load(). Removed in v3.0.0 (#736). */
  get(name: string): Promise<ServerSpec | null>;
  /** write(spec) after checking that `spec` is a full document; a bare `{ name }` → 'invalid_spec' listing the missing fields. */
  save(spec: ServerSpec): Promise<void>;
  /**
   * #735: remove the server. Its world inside the server moves to worlds/
   * (unless deleteWorld), then its servers/compose.yml entry (exact name, #660)
   * and servers/<n> are removed under the servers/compose.yml lock. Refuses,
   * changing nothing, when a world could be lost (#652): ServerSpecError
   * 'undetermined' (cannot tell where a world is) or 'conflict' (worlds/<w>
   * exists). The caller removes the workload first.
   */
  delete(name: string, options?: DeleteServerSpecOptions): Promise<ServerSpecDeleteResult>;
  /** Imports in memory when server.yaml is missing ('undetermined' when refused); absorbs hand edits. No writes. */
  load(name: string): Promise<LoadedServerSpec | null>;
  /**
   * Writes server.yaml and renders the generated files ('not_found' when the server directory does not exist).
   * All or nothing per file: on failure the files it changed are put back; the ones it could not put back
   * are on the error (unrestoredFiles).
   */
  write(doc: ServerSpecDocument, options?: WriteServerSpecOptions): Promise<void>;
}
