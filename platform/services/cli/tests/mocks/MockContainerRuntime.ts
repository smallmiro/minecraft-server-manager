import type { ContainerStatus, IContainerRuntimePort, RuntimeActionResult } from '@minecraft-docker/shared';

/**
 * Minimal IContainerRuntimePort for use-case tests: a fixed status and a recorded start().
 */
export function createMockContainerRuntime(status: ContainerStatus = 'exited') {
  const started: string[] = [];
  const runtime = {
    getStatus: (): ContainerStatus => status,
    start: async (name: string): Promise<RuntimeActionResult> => {
      started.push(name);
      return { success: true };
    },
  } as unknown as IContainerRuntimePort;
  return { runtime, started };
}
