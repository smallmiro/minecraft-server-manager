export { MockPromptAdapter, MockCancelError, type MockPromptValues } from './MockPromptAdapter.js';
// The in-memory repositories are shared test doubles (#666); the old names stay for the CLI tests.
export {
  InMemoryServerRepository as MockServerRepository,
  InMemoryWorldRepository as MockWorldRepository,
  InMemoryWorldAssignmentPort as MockWorldAssignmentPort,
  type InMemoryServerData as MockServerData,
  type InMemoryWorldData as MockWorldData,
} from '@minecraft-docker/shared/testing';
