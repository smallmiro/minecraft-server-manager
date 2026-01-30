/**
 * @minecraft-docker/mod-source-modrinth
 *
 * Modrinth adapter for the mod source system.
 * Auto-registers with ModSourceFactory on import.
 *
 * Architecture:
 * ```
 * mod-source-modrinth/src/
 * ├── infrastructure/
 * │   ├── api/
 * │   │   └── ModrinthApiClient.ts   # HTTP client (single responsibility)
 * │   └── mappers/
 * │       └── ModrinthMapper.ts      # Raw → Domain transformation
 * │
 * ├── types.ts                       # Raw Modrinth API types
 * ├── ModrinthAdapter.ts             # IModSourcePort implementation (composition)
 * └── index.ts                       # Auto-registration & exports
 * ```
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
 *
 * @example
 * ```typescript
 * // Or use components directly for testing
 * import { ModrinthApiClient, ModrinthMapper, ModrinthAdapter } from '@minecraft-docker/mod-source-modrinth';
 *
 * const mockClient = new MockModrinthApiClient();
 * const adapter = new ModrinthAdapter(mockClient, new ModrinthMapper());
 * ```
 */

import { ModSourceFactory } from '@minecraft-docker/shared';
import { ModrinthAdapter } from './ModrinthAdapter.js';

// Export the adapter class for direct use if needed
export { ModrinthAdapter } from './ModrinthAdapter.js';

// Export infrastructure components for advanced usage and testing
export { ModrinthApiClient, ModrinthMapper } from './infrastructure/index.js';
export type { ModrinthSearchParams, ModrinthVersionParams } from './infrastructure/index.js';

// Export raw types for advanced usage
export type * from './types.js';

// Auto-register with factory
const adapter = new ModrinthAdapter();
ModSourceFactory.register(adapter);

// Export the registered instance
export { adapter as modrinthAdapter };
