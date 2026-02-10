import { Type, Static } from '@sinclair/typebox';

// ============================================================
// Hostname Management Schemas
// ============================================================

/**
 * Hostname type classification
 */
export const HostnameTypeSchema = Type.Union([
  Type.Literal('system'),
  Type.Literal('custom'),
]);

/**
 * Single hostname info with classification
 */
export const HostnameInfoSchema = Type.Object({
  hostname: Type.String(),
  type: HostnameTypeSchema,
  description: Type.Optional(Type.String()),
});

/**
 * Full hostname data for a server
 */
export const HostnameDataSchema = Type.Object({
  serverName: Type.String(),
  hostnames: Type.Array(Type.String(), { description: 'All hostnames (raw from docker-compose)' }),
  systemHostnames: Type.Array(HostnameInfoSchema, { description: 'System-managed hostnames (read-only)' }),
  customHostnames: Type.Array(Type.String(), { description: 'User-managed custom domains' }),
});

/**
 * Request schema for updating custom hostnames
 */
export const UpdateCustomHostnamesRequestSchema = Type.Object({
  customHostnames: Type.Array(
    Type.String({
      minLength: 1,
      maxLength: 253,
      pattern: '^[a-zA-Z0-9]([a-zA-Z0-9\\-\\.]*[a-zA-Z0-9])?$',
    }),
    { description: 'Custom domain hostnames to set (replaces all existing custom hostnames)' }
  ),
});

/**
 * Response schema for GET hostname
 */
export const HostnameResponseSchema = Type.Object({
  serverName: Type.String(),
  hostnames: Type.Array(Type.String()),
  systemHostnames: Type.Array(HostnameInfoSchema),
  customHostnames: Type.Array(Type.String()),
});

/**
 * Response schema for PUT hostname update
 */
export const UpdateHostnamesResponseSchema = Type.Object({
  success: Type.Boolean(),
  serverName: Type.String(),
  hostnames: Type.Array(Type.String()),
  systemHostnames: Type.Array(HostnameInfoSchema),
  customHostnames: Type.Array(Type.String()),
  recreateRequired: Type.Boolean({ description: 'Whether container recreation is needed' }),
});

// ============================================================
// Type Exports
// ============================================================

export type HostnameType = Static<typeof HostnameTypeSchema>;
export type HostnameInfo = Static<typeof HostnameInfoSchema>;
export type HostnameData = Static<typeof HostnameDataSchema>;
export type UpdateCustomHostnamesRequest = Static<typeof UpdateCustomHostnamesRequestSchema>;
export type HostnameResponse = Static<typeof HostnameResponseSchema>;
export type UpdateHostnamesResponse = Static<typeof UpdateHostnamesResponseSchema>;
