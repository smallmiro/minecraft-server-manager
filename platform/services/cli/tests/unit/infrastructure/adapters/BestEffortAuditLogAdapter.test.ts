import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuditActionEnum, type IAuditLogPort, type AuditLogData } from '@minecraft-docker/shared';

const entry: AuditLogData = {
  action: AuditActionEnum.SERVER_START,
  actor: 'cli:local',
  targetType: 'server',
  targetName: 'factory',
  status: 'success',
  details: null,
  errorMessage: null,
};

const ABI_MESSAGE =
  "The module '/x/better_sqlite3.node' was compiled against a different Node.js version using " +
  'NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 147.';

function createRepo(overrides: Partial<IAuditLogPort> = {}): IAuditLogPort {
  return {
    log: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn().mockResolvedValue([]),
    findByTarget: vi.fn().mockResolvedValue([]),
    findByAction: vi.fn().mockResolvedValue([]),
    findByActor: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    deleteOlderThan: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

describe('BestEffortAuditLogAdapter', () => {
  let BestEffortAuditLogAdapter: typeof import('../../../../src/infrastructure/adapters/BestEffortAuditLogAdapter.js').BestEffortAuditLogAdapter;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // The warn-once flag is process-wide, so load a fresh module per test
    vi.resetModules();
    ({ BestEffortAuditLogAdapter } = await import(
      '../../../../src/infrastructure/adapters/BestEffortAuditLogAdapter.js'
    ));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('does not create the repository until first use', () => {
    const factory = vi.fn(() => createRepo());
    new BestEffortAuditLogAdapter(factory);
    expect(factory).not.toHaveBeenCalled();
  });

  it('delegates log() to the repository on success without warning', async () => {
    const repo = createRepo();
    const adapter = new BestEffortAuditLogAdapter(() => repo);

    await adapter.log(entry);

    expect(repo.log).toHaveBeenCalledWith(entry);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('creates the repository only once across calls', async () => {
    const factory = vi.fn(() => createRepo());
    const adapter = new BestEffortAuditLogAdapter(factory);

    await adapter.log(entry);
    await adapter.log(entry);

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('swallows repository creation errors in log()', async () => {
    const adapter = new BestEffortAuditLogAdapter(() => {
      throw new Error('db is locked');
    });

    await expect(adapter.log(entry)).resolves.toBeUndefined();
  });

  it('swallows errors thrown by repository.log()', async () => {
    const repo = createRepo({ log: vi.fn().mockRejectedValue(new Error('disk full')) });
    const adapter = new BestEffortAuditLogAdapter(() => repo);

    await expect(adapter.log(entry)).resolves.toBeUndefined();
  });

  it('warns with the cause for generic errors', async () => {
    const adapter = new BestEffortAuditLogAdapter(() => {
      throw new Error('db is locked');
    });

    await adapter.log(entry);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = errorSpy.mock.calls[0].join(' ');
    expect(output).toContain('[WARN]');
    expect(output).toContain('Audit log unavailable');
    expect(output).toContain('db is locked');
  });

  it('adds rebuild guidance for Node ABI mismatch errors', async () => {
    const adapter = new BestEffortAuditLogAdapter(() => {
      throw new Error(ABI_MESSAGE);
    });

    await adapter.log(entry);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = errorSpy.mock.calls[0].join(' ');
    expect(output).toContain('better-sqlite3 was built for a different Node.js version');
    expect(output).toContain('npm install -g @minecraft-docker/mcctl');
    expect(output).not.toContain('NODE_MODULE_VERSION');
  });

  it('warns only once per process even across adapter instances', async () => {
    const failing = () => {
      throw new Error('db is locked');
    };
    const a = new BestEffortAuditLogAdapter(failing);
    const b = new BestEffortAuditLogAdapter(failing);

    await a.log(entry);
    await a.log(entry);
    await b.log(entry);

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  describe('query methods are not best-effort', () => {
    it('delegates findAll/count/deleteOlderThan and returns results', async () => {
      const repo = createRepo({
        count: vi.fn().mockResolvedValue(3),
        deleteOlderThan: vi.fn().mockResolvedValue(2),
      });
      const adapter = new BestEffortAuditLogAdapter(() => repo);
      const date = new Date();

      expect(await adapter.findAll({ limit: 5 })).toEqual([]);
      expect(await adapter.count()).toBe(3);
      expect(await adapter.deleteOlderThan(date)).toBe(2);
      expect(repo.findAll).toHaveBeenCalledWith({ limit: 5 });
      expect(repo.deleteOlderThan).toHaveBeenCalledWith(date);
    });

    it('delegates findByTarget/findByAction/findByActor', async () => {
      const repo = createRepo();
      const adapter = new BestEffortAuditLogAdapter(() => repo);

      await adapter.findByTarget('server', 'factory');
      await adapter.findByAction(AuditActionEnum.SERVER_START);
      await adapter.findByActor('cli:local');

      expect(repo.findByTarget).toHaveBeenCalledWith('server', 'factory');
      expect(repo.findByAction).toHaveBeenCalledWith(AuditActionEnum.SERVER_START);
      expect(repo.findByActor).toHaveBeenCalledWith('cli:local');
    });

    it('propagates repository errors from queries without warning', async () => {
      const repo = createRepo({ findAll: vi.fn().mockRejectedValue(new Error('corrupt db')) });
      const adapter = new BestEffortAuditLogAdapter(() => repo);

      await expect(adapter.findAll()).rejects.toThrow('corrupt db');
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('propagates repository creation errors from queries', async () => {
      const adapter = new BestEffortAuditLogAdapter(() => {
        throw new Error(ABI_MESSAGE);
      });

      await expect(adapter.findAll()).rejects.toThrow('NODE_MODULE_VERSION');
      await expect(adapter.count()).rejects.toThrow('NODE_MODULE_VERSION');
      await expect(adapter.deleteOlderThan(new Date())).rejects.toThrow('NODE_MODULE_VERSION');
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
