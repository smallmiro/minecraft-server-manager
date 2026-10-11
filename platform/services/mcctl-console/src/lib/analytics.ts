import { isTelemetryEnabled, type Config } from '@minecraft-docker/shared/utils';
import pkg from '../../package.json';

export const GA_MEASUREMENT_ID = 'G-3T4LVXK44Y';
export interface AnalyticsSettings {
  installId: string;
  version: string;
}

export function getAnalyticsSettings(
  env: NodeJS.ProcessEnv,
  config: Pick<Config, 'load' | 'getOrCreateInstallId'>
): AnalyticsSettings | null {
  if (env.NODE_ENV !== 'production') return null;
  if (!isTelemetryEnabled(config.load(), env)) return null;
  const installId = config.getOrCreateInstallId();
  return installId ? { installId, version: pkg.version } : null;
}
