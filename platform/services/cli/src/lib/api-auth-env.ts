import type { ApiAccessMode } from './admin-config.js';

const LOOPBACK_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

/**
 * Translate a `console init` access mode into the env vars mcctl-api understands
 * (AUTH_MODE: disabled | api-key | ip-whitelist | basic | combined).
 */
export function toApiAuthEnv(
  mode: ApiAccessMode,
  apiKey: string | null,
  allowedIps: string[]
): Record<string, string> {
  const authMode = { internal: 'ip-whitelist', 'api-key-ip': 'combined', open: 'disabled' }[mode as string] ?? mode;
  const ips = mode === 'internal' ? LOOPBACK_IPS : allowedIps;
  const env: Record<string, string> = { AUTH_MODE: authMode };
  if (apiKey) env.AUTH_API_KEY = apiKey;
  if (ips.length > 0) env.AUTH_IP_WHITELIST = ips.join(',');
  return env;
}
