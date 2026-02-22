import { BackupSchedule } from '../../domain/entities/BackupSchedule.js';
import type {
  IBackupScheduleUseCase,
  CreateBackupScheduleParams,
  UpdateBackupScheduleParams,
} from '../ports/inbound/IBackupScheduleUseCase.js';
import type { IBackupScheduleRepository } from '../ports/outbound/IBackupScheduleRepository.js';

/**
 * BackupScheduleUseCase
 * Implements backup schedule CRUD operations
 */
export class BackupScheduleUseCase implements IBackupScheduleUseCase {
  constructor(
    private readonly repository: IBackupScheduleRepository
  ) {}

  async create(params: CreateBackupScheduleParams): Promise<BackupSchedule> {
    const schedule = BackupSchedule.create({
      name: params.name,
      cronExpression: params.cron,
      retentionPolicy: {
        maxCount: params.maxCount,
        maxAgeDays: params.maxAgeDays,
      },
      enabled: params.enabled,
    });

    await this.repository.save(schedule);
    return schedule;
  }

  async findAll(): Promise<BackupSchedule[]> {
    return this.repository.findAll();
  }

  async findById(id: string): Promise<BackupSchedule | null> {
    return this.repository.findById(id);
  }

  async update(
    id: string,
    params: UpdateBackupScheduleParams
  ): Promise<BackupSchedule> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error(`Backup schedule not found: ${id}`);
    }

    // Rebuild schedule with updated fields
    const updated = BackupSchedule.create({
      id: existing.id,
      name: params.name ?? existing.name,
      cronExpression: params.cron ?? existing.cronExpression.expression,
      retentionPolicy: {
        maxCount: params.maxCount ?? existing.retentionPolicy.maxCount,
        maxAgeDays: params.maxAgeDays ?? existing.retentionPolicy.maxAgeDays,
      },
      enabled: existing.enabled,
      lastRunAt: existing.lastRunAt,
      lastRunStatus: existing.lastRunStatus,
      lastRunMessage: existing.lastRunMessage,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    await this.repository.save(updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error(`Backup schedule not found: ${id}`);
    }
    await this.repository.delete(id);
  }

  async enable(id: string): Promise<BackupSchedule> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error(`Backup schedule not found: ${id}`);
    }

    const enabled = existing.enable();
    await this.repository.save(enabled);
    return enabled;
  }

  async disable(id: string): Promise<BackupSchedule> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error(`Backup schedule not found: ${id}`);
    }

    const disabled = existing.disable();
    await this.repository.save(disabled);
    return disabled;
  }

  async recordRun(
    id: string,
    status: 'success' | 'failure',
    message?: string
  ): Promise<BackupSchedule> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error(`Backup schedule not found: ${id}`);
    }

    const updated = existing.recordRun(status, message);
    await this.repository.save(updated);
    return updated;
  }
}
