/**
 * Server and world name rules for browsers (`@minecraft-docker/shared/naming`).
 * The domain barrel pulls in node:* modules, so client components import the
 * rules from here; keep this graph free of node:* and package imports.
 */
export {
  ServerName,
  SERVER_NAME_PATTERN,
  SERVER_NAME_MIN_LENGTH,
  SERVER_NAME_MAX_LENGTH,
  RESERVED_SERVER_NAMES,
  EXISTING_SERVER_NAME_PATTERN,
} from '../domain/value-objects/ServerName.js';
export { WorldName, WORLD_NAME_PATTERN } from '../domain/value-objects/WorldName.js';
