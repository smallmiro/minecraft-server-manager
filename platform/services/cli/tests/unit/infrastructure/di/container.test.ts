import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuditActionEnum } from '@minecraft-docker/shared';

const { mockRepoCtor } = vi.hoisted(() => ({ mockRepoCtor: vi.fn() }));

vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual<typeof import('@minecraft-docker/shared')>(
    '@minecraft-docker/shared'
  );
  return { ...actual, SqliteAuditLogRepository: mockRepoCtor };
});

import { Container } from '../../../../src/infrastructure/di/container.js';

const entry = {
  action: AuditActionEnum.SERVER_STOP,
  actor: 'cli:local',
  targetType: 'server',
  targetName: 'factory',
  status: 'success' as const,
  details: null,
  errorMessage: null,
};

describe('Container.auditLogPort', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockRepoCtor.mockReset();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('does not throw on access or construct the repository when it fails to load', () => {
    mockRepoCtor.mockImplementation(() => {
      throw new Error('NODE_MODULE_VERSION 127');
    });
    const container = new Container('/tmp/mcctl-test-root');

    expect(() => container.auditLogPort).not.toThrow();
    expect(mockRepoCtor).not.toHaveBeenCalled();
  });

  it('log() resolves when the repository fails to load', async () => {
    mockRepoCtor.mockImplementation(() => {
      throw new Error('NODE_MODULE_VERSION 127');
    });
    const container = new Container('/tmp/mcctl-test-root');

    await expect(container.auditLogPort.log(entry)).resolves.toBeUndefined();
  });

  it('queries still surface the load error', async () => {
    mockRepoCtor.mockImplementation(() => {
      throw new Error('NODE_MODULE_VERSION 127');
    });
    const container = new Container('/tmp/mcctl-test-root');

    await expect(container.auditLogPort.findAll()).rejects.toThrow('NODE_MODULE_VERSION');
  });

  it('delegates to the repository built with <root>/data/audit.db and returns a stable instance', async () => {
    const repo = { log: vi.fn().mockResolvedValue(undefined) };
    mockRepoCtor.mockImplementation(() => repo);
    const container = new Container('/tmp/mcctl-test-root');

    await container.auditLogPort.log(entry);

    expect(container.auditLogPort).toBe(container.auditLogPort);
    expect(repo.log).toHaveBeenCalledWith(entry);
    expect(mockRepoCtor).toHaveBeenCalledWith('/tmp/mcctl-test-root/data/audit.db');
  });
});

describe('Container.worldBackupPort (#732)', () => {
  it('builds a GitWorldBackupAdapter and the backup use case runs on it', async () => {
    const { GitWorldBackupAdapter } = await import('@minecraft-docker/shared');
    const container = new Container('/tmp/mcctl-test-root');
    expect(container.worldBackupPort).toBeInstanceOf(GitWorldBackupAdapter);
    expect(container.worldBackupPort).toBe(container.worldBackupPort);
    // status goes through the port: an empty root is "not configured", not a shell failure
    const status = await container.backupUseCase.status();
    expect(status.configured).toBe(false);
  });
});

describe('Container use case wiring (#736)', () => {
  let root: string;

  beforeEach(async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    root = mkdtempSync(join(tmpdir(), 'mcctl-container-'));
  });

  afterEach(async () => {
    const { rmSync } = await import('node:fs');
    rmSync(root, { recursive: true, force: true });
  });

  it('deletes through the runtime and ServerSpec repository (the plan runs before any container call)', async () => {
    const container = new Container(root);
    await expect(container.deleteServerUseCase.deprovision('ghost')).rejects.toThrow(
      "Server 'ghost' not found (no servers/ghost directory)"
    );
  });

  it('gives the world use case the assignment port', async () => {
    const container = new Container(root);
    await expect(container.worldManagementUseCase.getAssignmentReport()).resolves.toEqual({
      duplicates: [],
      undetermined: [],
    });
  });
});
