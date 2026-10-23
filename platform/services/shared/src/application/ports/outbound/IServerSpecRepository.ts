/**
 * Placeholder for the server definition. D5 (#675) defines the schema (hardening plan §9.2).
 */
export interface ServerSpec {
  name: string;
}

/**
 * Server Spec Repository - Outbound Port (ADR-0001, reserved)
 *
 * Provisional: D5 (#675) settles the shape. No implementation or caller yet.
 */
export interface IServerSpecRepository {
  list(): Promise<ServerSpec[]>;
  get(name: string): Promise<ServerSpec | null>;
  save(spec: ServerSpec): Promise<void>;
  delete(name: string): Promise<void>;
}
