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
  /** Overwrite hand-edited generated files after writing a .bak (edit_conflict, compose_edited, refused import). */
  force?: boolean;
  /** Allow a world.storage change (only `mcctl migrate worlds`); otherwise 'storage_change'. */
  allowStorageChange?: boolean;
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
  /** #735: removes the include entry (exact name) and the definition files; data/ and worlds/ are the use case's. */
  delete(name: string): Promise<void>;
  /** Imports in memory when server.yaml is missing ('undetermined' when refused); absorbs hand edits. No writes. */
  load(name: string): Promise<LoadedServerSpec | null>;
  /** Writes server.yaml and renders the generated files ('not_found' when the server directory does not exist). */
  write(doc: ServerSpecDocument, options?: WriteServerSpecOptions): Promise<void>;
}
