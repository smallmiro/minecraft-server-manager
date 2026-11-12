/**
 * Test doubles and port contracts (#666): `@minecraft-docker/shared/testing`.
 * Test code only: the contracts import vitest, and no runtime module may import this.
 */
export {
  FakeContainerRuntime,
  type WorkloadFixture,
  type RuntimeFailure,
  type LifecycleMethod,
} from './FakeContainerRuntime.js';
export {
  runtimeContract,
  serverWorkload,
  CONTRACT_PROJECT,
  type RuntimeScenario,
  type RuntimeFactory,
} from './runtimeContract.js';
export { InMemoryServerRepository, type InMemoryServerData } from './InMemoryServerRepository.js';
export { InMemoryWorldRepository, type InMemoryWorldData } from './InMemoryWorldRepository.js';
export { InMemoryWorldAssignmentPort } from './InMemoryWorldAssignmentPort.js';
