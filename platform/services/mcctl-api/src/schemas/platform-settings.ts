import { Type, type Static } from '@sinclair/typebox';

/**
 * Platform settings (<MCCTL_ROOT>/.env) schemas (#683).
 * Secret values never appear in any response: secrets expose only `configured`.
 */

export const SettingTypeSchema = Type.Union([
  Type.Literal('string'),
  Type.Literal('secret'),
  Type.Literal('boolean'),
  Type.Literal('enum'),
  Type.Literal('integer'),
  Type.Literal('port'),
  Type.Literal('ipv4'),
  Type.Literal('ipv4-list'),
  Type.Literal('tz'),
  Type.Literal('repo'),
]);

export const SettingStatusSchema = Type.Union([
  Type.Literal('supported'),
  Type.Literal('readonly'),
  Type.Literal('shadowed'),
  Type.Literal('legacy'),
  Type.Literal('unknown'),
]);

export const SettingSourceSchema = Type.Union([
  Type.Literal('platform-env'),
  Type.Literal('pm2-ecosystem'),
  Type.Literal('shadowed'),
  Type.Literal('legacy'),
  Type.Literal('unknown'),
]);

export const RestartScopeSchema = Type.Union([
  Type.Literal('none'),
  Type.Literal('next-create'),
  Type.Literal('router'),
  Type.Literal('servers'),
  Type.Literal('playit'),
  Type.Literal('api'),
  Type.Literal('console'),
]);

export const PlatformSettingSchema = Type.Object({
  key: Type.String(),
  label: Type.String(),
  description: Type.String(),
  group: Type.String(),
  type: SettingTypeSchema,
  status: SettingStatusSchema,
  source: SettingSourceSchema,
  editable: Type.Boolean(),
  secret: Type.Boolean(),
  value: Type.Optional(Type.String()),
  configured: Type.Optional(Type.Boolean()),
  choices: Type.Optional(Type.Array(Type.String())),
  restartScope: RestartScopeSchema,
  applied: Type.Optional(Type.Boolean()),
  differsFromEnv: Type.Optional(Type.Boolean()),
});

export const PlatformRuntimeItemSchema = Type.Object({
  key: Type.String(),
  source: Type.Literal('pm2-ecosystem'),
  value: Type.Optional(Type.String()),
  configured: Type.Optional(Type.Boolean()),
});

export const PlatformSettingsResponseSchema = Type.Object({
  revision: Type.String(),
  settings: Type.Array(PlatformSettingSchema),
  runtime: Type.Array(PlatformRuntimeItemSchema),
});

export const PlatformSettingsUpdateRequestSchema = Type.Object({
  revision: Type.String(),
  set: Type.Record(Type.String(), Type.String()),
  remove: Type.Array(Type.String()),
});

export const PlatformSettingsUpdateResponseSchema = Type.Object({
  revision: Type.String(),
  changedKeys: Type.Array(Type.String()),
  removedKeys: Type.Array(Type.String()),
  restartScopes: Type.Array(RestartScopeSchema),
});

export const PlatformSettingsValidationErrorSchema = Type.Object({
  error: Type.String(),
  message: Type.String(),
  // Absent when the request body itself is malformed (framework-level 400).
  errors: Type.Optional(Type.Array(Type.Object({ key: Type.String(), message: Type.String() }))),
});

export const PlatformSettingsConflictSchema = Type.Object({
  error: Type.String(),
  message: Type.String(),
  currentRevision: Type.String(),
  /** Servers whose world location the change would move against the assignment rules (#670). */
  servers: Type.Optional(Type.Array(Type.String())),
});

export const PlatformSettingsErrorSchema = Type.Object({
  error: Type.String(),
  message: Type.String(),
});

export type PlatformSetting = Static<typeof PlatformSettingSchema>;
export type PlatformRuntimeItem = Static<typeof PlatformRuntimeItemSchema>;
export type PlatformSettingsResponse = Static<typeof PlatformSettingsResponseSchema>;
export type PlatformSettingsUpdateRequest = Static<typeof PlatformSettingsUpdateRequestSchema>;
export type PlatformSettingsUpdateResponse = Static<typeof PlatformSettingsUpdateResponseSchema>;
export type RestartScope = Static<typeof RestartScopeSchema>;
export type SettingType = Static<typeof SettingTypeSchema>;
