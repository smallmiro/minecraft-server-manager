import { describe, it, expect, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createApiContainer } from '../src/plugins/container.js';

describe('container plugin (#667)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('decorates fastify.container with the production members', async () => {
    app = await buildApp({ logger: false });
    expect(typeof app.container.worldInfoUseCase).toBe('function');
    expect(typeof app.container.createServerUseCase).toBe('function');
  });

  it('services share the container handles for config-snapshots.db and audit.db (#673)', async () => {
    app = await buildApp({ logger: false });
    const { getConfigSnapshotUseCase } = await import('../src/services/config-snapshot-service.js');
    const { getAuditLogRepository } = await import('../src/services/audit-log-service.js');
    expect(getConfigSnapshotUseCase()).toBe(app.container.configSnapshotUseCase());
    expect(getAuditLogRepository()).toBe(app.container.auditLogRepository());
  });

  it('replaces only the members passed to buildApp({ container })', async () => {
    const fake = { getWorldInfo: async () => null } as never;
    app = await buildApp({ logger: false, container: { worldInfoUseCase: () => fake } });
    expect(app.container.worldInfoUseCase()).toBe(fake);
    expect(typeof app.container.worldStatsUseCase).toBe('function');
  });
});

describe('createApiContainer (#667)', () => {
  it('builds one-per-app members once and per-call members each time', () => {
    const container = createApiContainer();
    try {
      expect(container.playerSessionUseCase()).toBe(container.playerSessionUseCase());
      expect(container.backupScheduleUseCase()).toBe(container.backupScheduleUseCase());
      expect(container.configSnapshotRepository()).toBe(container.configSnapshotRepository());
      expect(container.configSnapshotUseCase()).toBe(container.configSnapshotUseCase());
      expect(container.auditLogRepository()).toBe(container.auditLogRepository());
      expect(container.worldInfoUseCase()).not.toBe(container.worldInfoUseCase());
    } finally {
      container.close();
    }
  });

  it('close() is safe when nothing was opened', () => {
    expect(() => createApiContainer().close()).not.toThrow();
  });
});
