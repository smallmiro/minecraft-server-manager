// CLI-specific adapter
export { ClackPromptAdapter } from './ClackPromptAdapter.js';

// Re-export shared adapters for backward compatibility
export {
  ShellAdapter,
  ServerRepository,
  WorldRepository,
  DocsAdapter,
} from '@minecraft-docker/shared';
