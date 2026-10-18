/**
 * Platform settings (<MCCTL_ROOT>/.env) types (#683).
 * Mirrors platform/services/mcctl-api/src/schemas/platform-settings.ts.
 * Secret values never appear in responses: secrets expose only `configured`.
 */

export type SettingType =
  | 'string'
  | 'secret'
  | 'boolean'
  | 'enum'
  | 'integer'
  | 'port'
  | 'ipv4'
  | 'ipv4-list'
  | 'tz'
  | 'repo';

export type SettingStatus = 'supported' | 'readonly' | 'shadowed' | 'legacy' | 'unknown';

export type SettingSource = 'platform-env' | 'shadowed' | 'legacy' | 'unknown';

export type RestartScope = 'none' | 'next-create' | 'router' | 'servers' | 'playit' | 'api' | 'console';

export interface PlatformSetting {
  key: string;
  label: string;
  description: string;
  group: string;
  type: SettingType;
  status: SettingStatus;
  source: SettingSource;
  editable: boolean;
  secret: boolean;
  value?: string;
  configured?: boolean;
  choices?: string[];
  restartScope: RestartScope;
  applied?: boolean;
  differsFromEnv?: boolean;
}

export interface PlatformRuntimeItem {
  key: string;
  source: 'pm2-ecosystem';
  value?: string;
  configured?: boolean;
}

export interface PlatformSettingsResponse {
  revision: string;
  settings: PlatformSetting[];
  runtime: PlatformRuntimeItem[];
}

export interface PlatformSettingsUpdateRequest {
  revision: string;
  set: Record<string, string>;
  remove: string[];
}

export interface PlatformSettingsUpdateResponse {
  revision: string;
  changedKeys: string[];
  removedKeys: string[];
  restartScopes: RestartScope[];
}

export interface PlatformSettingsFieldError {
  key: string;
  message: string;
}

/** Body of a 400 response */
export interface PlatformSettingsValidationError {
  error: string;
  message: string;
  errors: PlatformSettingsFieldError[];
}

/** Body of a 409 response */
export interface PlatformSettingsConflict {
  error: string;
  message: string;
  currentRevision: string;
}
