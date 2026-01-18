// CLI-specific adapter
export { ClackPromptAdapter } from './adapters/ClackPromptAdapter.js';

// Re-export shared adapters for backward compatibility
export {
  ShellAdapter,
  ServerRepository,
  WorldRepository,
  DocsAdapter,
} from '@minecraft-docker/shared';

// DI Container (CLI-specific)
export { Container, getContainer, resetContainer } from './di/index.js';
