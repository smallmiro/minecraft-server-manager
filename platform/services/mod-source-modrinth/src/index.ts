/**
 * @minecraft-docker/mod-source-modrinth
 *
 * Modrinth adapter for the mod source system.
 * Auto-registers with ModSourceFactory on import.
 *
 * @example
 * ```typescript
 * // Just import to register
 * import '@minecraft-docker/mod-source-modrinth';
 *
 * // Then use via factory
 * import { ModSourceFactory } from '@minecraft-docker/shared';
 * const modrinth = ModSourceFactory.get('modrinth');
 * ```
 */

import { ModSourceFactory } from '@minecraft-docker/shared';
import { ModrinthAdapter } from './ModrinthAdapter.js';

// Export the adapter class for direct use if needed
export { ModrinthAdapter } from './ModrinthAdapter.js';

// Export raw types for advanced usage
export type * from './types.js';

// Auto-register with factory
const adapter = new ModrinthAdapter();
ModSourceFactory.register(adapter);

// Export the registered instance
export { adapter as modrinthAdapter };
