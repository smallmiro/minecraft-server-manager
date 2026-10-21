import { describe, test, expect } from 'vitest';
import { ConfigSnapshot } from '../src/domain/entities/ConfigSnapshot.js';
import { ConfigSnapshotSchedule } from '../src/domain/entities/ConfigSnapshotSchedule.js';
import { ConfigSnapshotUseCaseImpl } from '../src/application/use-cases/ConfigSnapshotUseCase.js';
import { ConfigSnapshotScheduleUseCaseImpl } from '../src/application/use-cases/ConfigSnapshotScheduleUseCase.js';
import type { IConfigSnapshotRepository } from '../src/application/ports/outbound/IConfigSnapshotRepository.js';
import type { IConfigSnapshotScheduleRepository } from '../src/application/ports/outbound/IConfigSnapshotScheduleRepository.js';
import type { IConfigSnapshotStorage } from '../src/application/ports/outbound/IConfigSnapshotStorage.js';
import type { IConfigFileCollector } from '../src/application/ports/outbound/IConfigFileCollector.js';

// Servers created before #649 may carry uppercase letters or underscores.
const LEGACY = 'My_Server';

describe('config snapshots of servers named before the strict rule (#721)', () => {
  test('ConfigSnapshot.fromRaw restores a legacy server name unchanged', () => {
    const snapshot = ConfigSnapshot.fromRaw({
      id: 'snap-1',
      server_name: LEGACY,
      created_at: '2025-01-01T00:00:00.000Z',
      description: '',
      files: '[]',
      schedule_id: null,
    });
    expect(snapshot.serverName.value).toBe(LEGACY);
  });

  test('ConfigSnapshotSchedule.fromRaw restores a legacy server name unchanged', () => {
    const schedule = ConfigSnapshotSchedule.fromRaw({
      id: 'sched-1',
      server_name: LEGACY,
      name: 'Daily',
      cron_expression: '0 3 * * *',
      enabled: 1,
      retention_count: 5,
      last_run_at: null,
      last_run_status: null,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    });
    expect(schedule.serverName.value).toBe(LEGACY);
  });

  function snapshotUseCase(): ConfigSnapshotUseCaseImpl {
    const repository = { save: async () => {} } as unknown as IConfigSnapshotRepository;
    const storage = { store: async () => {} } as unknown as IConfigSnapshotStorage;
    const collector = { collectFiles: async () => [] } as unknown as IConfigFileCollector;
    return new ConfigSnapshotUseCaseImpl(repository, storage, collector);
  }

  test('ConfigSnapshotUseCase.create snapshots a legacy server', async () => {
    const snapshot = await snapshotUseCase().create(LEGACY);
    expect(snapshot.serverName.value).toBe(LEGACY);
  });

  test('ConfigSnapshotUseCase.create still rejects a path-unsafe name', async () => {
    await expect(snapshotUseCase().create('../etc')).rejects.toThrow();
  });

  test('ConfigSnapshotScheduleUseCase.create schedules a legacy server', async () => {
    const repository = { save: async () => {} } as unknown as IConfigSnapshotScheduleRepository;
    const schedule = await new ConfigSnapshotScheduleUseCaseImpl(repository).create(
      LEGACY,
      'Daily',
      '0 3 * * *'
    );
    expect(schedule.serverName.value).toBe(LEGACY);
  });
});
