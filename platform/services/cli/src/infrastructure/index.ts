// CLI-specific adapters
export { ClackPromptAdapter } from './adapters/ClackPromptAdapter.js';
export { Pm2ServiceManagerAdapter } from './adapters/Pm2ServiceManagerAdapter.js';

// Re-export shared adapters for backward compatibility
export {
  ShellAdapter,
  ServerRepository,
  WorldRepository,
  DocsAdapter,
} from '@minecraft-docker/shared';

// DI Container (CLI-specific)
export { Container, getContainer, resetContainer } from './di/index.js';
