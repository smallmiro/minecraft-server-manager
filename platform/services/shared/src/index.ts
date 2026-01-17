// Re-export all types
export * from './types/index.js';

// Re-export utilities
export { Paths, Config, colors, log, getPackageRoot } from './utils/index.js';

// Re-export docker utilities
export {
  checkDocker,
  checkDockerCompose,
  getContainerStatus,
  getContainerHealth,
  containerExists,
  getContainerHostname,
  getMcContainers,
  getRunningMcContainers,
  getServerInfo,
  getRouterInfo,
  getAvahiStatus,
  getPlatformStatus,
  startContainer,
  stopContainer,
  getContainerLogs,
  execScript,
  execScriptInteractive,
} from './docker/index.js';
