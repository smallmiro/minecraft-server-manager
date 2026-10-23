import {
  workloadNameOf,
  type ContainerStatus,
  type IContainerRuntimePort,
  type RuntimeActionResult,
  type ServerName,
} from '@minecraft-docker/shared';

/**
 * Minimal IContainerRuntimePort for use-case tests: a fixed status and a recorded start()
 * (recorded as the container name; use cases pass a ServerName since #665).
 */
export function createMockContainerRuntime(status: ContainerStatus = 'exited') {
  const started: string[] = [];
  const runtime = {
    getStatus: (): ContainerStatus => status,
    list: (): string[] => [],
    start: async (name: ServerName | string): Promise<RuntimeActionResult> => {
      started.push(workloadNameOf(name));
      return { success: true };
    },
  } as unknown as IContainerRuntimePort;
  return { runtime, started };
}
