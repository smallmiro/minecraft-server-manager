import { config as loadEnv } from 'dotenv';

// Load .env file
loadEnv();

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: 'development' | 'production' | 'test';
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
}

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getNodeEnv(): AppConfig['nodeEnv'] {
  const env = process.env['NODE_ENV'];
  if (env === 'production' || env === 'test') {
    return env;
  }
  return 'development';
}

function getLogLevel(): AppConfig['logLevel'] {
  const level = process.env['LOG_LEVEL'];
  const validLevels: AppConfig['logLevel'][] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
  if (level && validLevels.includes(level as AppConfig['logLevel'])) {
    return level as AppConfig['logLevel'];
  }
  // Default based on NODE_ENV
  return getNodeEnv() === 'production' ? 'info' : 'debug';
}

export const config: AppConfig = {
  port: getEnvNumber('PORT', 3001),
  host: getEnv('HOST', '0.0.0.0'),
  nodeEnv: getNodeEnv(),
  logLevel: getLogLevel(),
};

export default config;
