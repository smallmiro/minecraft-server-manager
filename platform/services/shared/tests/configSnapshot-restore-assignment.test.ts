/**
 * Restoring a config snapshot may not bypass the world assignment rules
 * (#670, Codex review #2): a restored config.env is checked as a proposed
 * snapshot, and an assignment change on a running server is refused even
 * with force.
 */
import { describe, test, expect, vi } from 'vitest';
import { ConfigSnapshotUseCaseImpl } from '../src/application/use-cases/ConfigSnapshotUseCase.js';
import { WorldAssignmentError, type WorldAssignmentSnapshot } from '../src/domain/services/worldAssignment.js';
import { ConfigSnapshot } from '../src/domain/entities/ConfigSnapshot.js';
import { ServerName } from '../src/domain/value-objects/ServerName.js';
import type {
  IConfigSnapshotRepository,
  IConfigSnapshotStorage,
  IConfigFileCollector,
  IContainerRuntimePort,
  IWorldAssignmentPort,
} from '../src/application/ports/index.js';

/** server -> LEVEL; preview parses `LEVEL=` from the proposed content. */
function setup(opts: {
  levels: Record<string, string>;
  files: Record<string, string>;
  status?: string;
  noPort?: boolean;
  undetermined?: string[];
}) {
  const snapshotOf = (levels: Record<string, string>): WorldAssignmentSnapshot => ({
    assignments: Object.entries(levels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([server, world]) => ({ server, world, internal: false })),
    undetermined: opts.undetermined ?? [],
  });
  const port: IWorldAssignmentPort = {
    listAssignments: vi.fn(async () => snapshotOf(opts.levels)),
    preview: vi.fn(async (server: string, content: string) =>
      snapshotOf({ ...opts.levels, [server]: /^LEVEL=(.*)$/m.exec(content)?.[1] ?? 'world' })
    ),
    assign: vi.fn(),
    release: vi.fn(),
  };
  const snapshot = ConfigSnapshot.create(ServerName.fromExisting('alpha'), [], 'test');
  const repository = { findById: vi.fn().mockResolvedValue(snapshot) } as unknown as IConfigSnapshotRepository;
  const storage = {
    retrieve: vi.fn().mockResolvedValue(new Map(Object.entries(opts.files))),
  } as unknown as IConfigSnapshotStorage;
  const collector = { writeFileContent: vi.fn() } as unknown as IConfigFileCollector;
  const runtime = { getStatus: vi.fn(() => opts.status ?? 'exited') } as unknown as IContainerRuntimePort;
  const useCase = new ConfigSnapshotUseCaseImpl(
    repository,
    storage,
    collector,
    opts.noPort ? undefined : port,
    runtime
  );
  return { useCase, collector, runtime, snapshotId: snapshot.id };
}

async function rejection(promise: Promise<unknown>): Promise<WorldAssignmentError> {
  const error = await promise.then(() => undefined, (e: unknown) => e);
  expect(error).toBeInstanceOf(WorldAssignmentError);
  return error as WorldAssignmentError;
}

describe('ConfigSnapshotUseCase.restore - world assignment (#670)', () => {
  test('refuses a config.env that points at a world another server uses, writing nothing', async () => {
    const { useCase, collector, snapshotId } = setup({
      levels: { alpha: 'alpha', beta: 'held' },
      files: { 'config.env': 'LEVEL=held\n', 'server.properties': 'x' },
    });

    const error = await rejection(useCase.restore(snapshotId));

    expect(error.code).toBe('conflict');
    expect(error.servers).toEqual(['beta']);
    expect(collector.writeFileContent).not.toHaveBeenCalled();
  });

  test('refuses an assignment change on a running server, even with force', async () => {
    const { useCase, collector, snapshotId } = setup({
      levels: { alpha: 'alpha' },
      files: { 'config.env': 'LEVEL=other\n' },
      status: 'running',
    });

    expect((await rejection(useCase.restore(snapshotId, true))).code).toBe('server_running');
    expect(collector.writeFileContent).not.toHaveBeenCalled();
  });

  test('restores a running server when its assignment does not change', async () => {
    const { useCase, collector, snapshotId } = setup({
      levels: { alpha: 'alpha' },
      files: { 'config.env': 'LEVEL=alpha\nMOTD=x\n' },
      status: 'running',
    });

    await useCase.restore(snapshotId, true);

    expect(collector.writeFileContent).toHaveBeenCalledTimes(1);
  });

  test('refuses while another server is undetermined', async () => {
    const { useCase, snapshotId } = setup({
      levels: { alpha: 'alpha' },
      files: { 'config.env': 'LEVEL=other\n' },
      undetermined: ['broken'],
    });

    expect((await rejection(useCase.restore(snapshotId))).code).toBe('undetermined');
  });

  test('restores files without config.env with no assignment check', async () => {
    const { useCase, collector, snapshotId } = setup({
      levels: {},
      files: { 'server.properties': 'x' },
      noPort: true,
    });

    await useCase.restore(snapshotId);

    expect(collector.writeFileContent).toHaveBeenCalledTimes(1);
  });

  test('fails closed for a config.env without an assignment port', async () => {
    const { useCase, collector, snapshotId } = setup({
      levels: {},
      files: { 'config.env': 'LEVEL=alpha\n' },
      noPort: true,
    });

    expect((await rejection(useCase.restore(snapshotId))).code).toBe('undetermined');
    expect(collector.writeFileContent).not.toHaveBeenCalled();
  });
});

