// CLI-specific adapters
export { ClackPromptAdapter } from './ClackPromptAdapter.js';
export { Pm2ServiceManagerAdapter } from './Pm2ServiceManagerAdapter.js';

// Re-export shared adapters for backward compatibility
export {
  ShellAdapter,
  ServerRepository,
  WorldRepository,
  DocsAdapter,
} from '@minecraft-docker/shared';
