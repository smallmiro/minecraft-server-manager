import { ServerSpecError, type ServerSpecDocument } from './ServerSpecDocument.js';
import { universeLocation, withoutUniverse } from './extraArgs.js';

export interface SpecEnvChanges {
  set?: Record<string, string>;
  remove?: string[];
}

/**
 * `doc` with config.env-style changes applied (ADR-0003 §6), so the generic
 * config writers need no key list: TYPE, VERSION, MEMORY, LEVEL and
 * PLAYIT_DOMAIN go to their typed fields, EXTRA_ARGS to world.storage plus
 * env.EXTRA_ARGS, every other key to env. An empty VERSION, MEMORY or
 * PLAYIT_DOMAIN, like a removed one, clears the field. Pure; the input is not
 * changed. An EXTRA_ARGS that puts the world elsewhere is 'undetermined'.
 */
export function setEnvKeys(doc: ServerSpecDocument, changes: SpecEnvChanges): ServerSpecDocument {
  const next: ServerSpecDocument = structuredClone(doc);
  const optional = (field: 'version' | 'memory', value: string | undefined) => {
    if (value === undefined || value === '') delete next[field];
    else next[field] = value;
  };
  const playit = (value: string | undefined) => {
    if (value === undefined || value === '') delete next.routing.playitDomain;
    else next.routing.playitDomain = value;
  };

  for (const [key, value] of Object.entries(changes.set ?? {})) {
    switch (key) {
      case 'TYPE':
        next.type = value;
        break;
      case 'VERSION':
        optional('version', value);
        break;
      case 'MEMORY':
        optional('memory', value);
        break;
      case 'LEVEL':
        next.world.level = value.trim() || 'world';
        break;
      case 'PLAYIT_DOMAIN':
        playit(value);
        break;
      case 'EXTRA_ARGS': {
        const location = universeLocation(value);
        if (!location) {
          throw new ServerSpecError(
            'undetermined',
            `EXTRA_ARGS '${value}' puts the world somewhere other than /worlds or /data; use --universe /worlds/ or none`,
            doc.name
          );
        }
        next.world.storage = location === 'worlds' ? 'universe' : 'data';
        const rest = withoutUniverse(value);
        if (rest) next.env['EXTRA_ARGS'] = rest;
        else delete next.env['EXTRA_ARGS'];
        break;
      }
      default:
        next.env[key] = value;
    }
  }
  for (const key of changes.remove ?? []) {
    switch (key) {
      case 'TYPE':
        next.type = 'VANILLA'; // itzg's default
        break;
      case 'VERSION':
      case 'MEMORY':
        optional(key === 'VERSION' ? 'version' : 'memory', undefined);
        break;
      case 'LEVEL':
        next.world.level = 'world'; // itzg's default
        break;
      case 'PLAYIT_DOMAIN':
        playit(undefined);
        break;
      default:
        delete next.env[key];
    }
  }
  return next;
}
