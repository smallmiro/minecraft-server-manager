import type { IConfigSnapshotScheduleUseCase } from '../ports/inbound/IConfigSnapshotScheduleUseCase.js';
import type { IConfigSnapshotScheduleRepository } from '../ports/outbound/IConfigSnapshotScheduleRepository.js';
import {
  ConfigSnapshotSchedule,
} from '../../domain/entities/ConfigSnapshotSchedule.js';
import { ServerName } from '../../domain/value-objects/ServerName.js';

/**
 * ConfigSnapshotScheduleUseCaseImpl
 * Implements IConfigSnapshotScheduleUseCase for managing config snapshot schedules.
 * Provides CRUD operations with validation through domain entities.
 */
export class ConfigSnapshotScheduleUseCaseImpl
  implements IConfigSnapshotScheduleUseCase
{
  constructor(
    private readonly repository: IConfigSnapshotScheduleRepository
  ) {}

  /**
   * Create a new config snapshot schedule
   */
  async create(
    serverName: string,
    name: string,
    cronExpression: string,
    retentionCount?: number
  ): Promise<ConfigSnapshotSchedule> {
    const schedule = ConfigSnapshotSchedule.create({
      serverName: ServerName.create(serverName),
      name,
      cronExpression,
      retentionCount,
    });

    await this.repository.save(schedule);
    return schedule;
  }

  /**
   * Update a config snapshot schedule
   * Only name, cronExpression, and retentionCount can be updated
   */
  async update(
    id: string,
    updates: Partial<
      Pick<ConfigSnapshotSchedule, 'name' | 'cronExpression' | 'retentionCount'>
    >
  ): Promise<ConfigSnapshotSchedule> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error(`Schedule not found: ${id}`);
    }

    // Reconstruct with updates applied
    const updated = ConfigSnapshotSchedule.create({
      id: existing.id,
      serverName: existing.serverName,
      name: updates.name ?? existing.name,
      cronExpression:
        updates.cronExpression?.toString() ??
        existing.cronExpression.expression,
      enabled: existing.enabled,
      retentionCount: updates.retentionCount ?? existing.retentionCount,
      lastRunAt: existing.lastRunAt,
      lastRunStatus: existing.lastRunStatus,
      createdAt: existing.createdAt,
    });

    await this.repository.update(updated);
    return updated;
  }

  /**
   * Enable a config snapshot schedule
   */
  async enable(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error(`Schedule not found: ${id}`);
    }

    const enabled = existing.enable();
    await this.repository.update(enabled);
  }

  /**
   * Disable a config snapshot schedule
   */
  async disable(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error(`Schedule not found: ${id}`);
    }

    const disabled = existing.disable();
    await this.repository.update(disabled);
  }

  /**
   * Delete a config snapshot schedule
   */
  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * Find all config snapshot schedules (both enabled and disabled)
   */
  async findAll(): Promise<ConfigSnapshotSchedule[]> {
    return this.repository.findAll();
  }

  /**
   * Find config snapshot schedules by server name
   */
  async findByServer(
    serverName: string
  ): Promise<ConfigSnapshotSchedule[]> {
    return this.repository.findByServer(serverName);
  }
}
