import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node:fs - need writeFileSync for tag update tests
const mockExistsSync = vi.fn().mockReturnValue(false);
const mockReaddirSync = vi.fn().mockReturnValue([]);
const mockReadFileSync = vi.fn().mockReturnValue('');
const mockWriteFileSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  readdirSync: (...args: any[]) => mockReaddirSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
  writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
}));

// Mock node:path (passthrough)
vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path');
  return {
    ...actual,
    join: (...args: string[]) => actual.join(...args),
  };
});

// Mock @minecraft-docker/shared - include real McVersion so version parsing works
vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual<typeof import('@minecraft-docker/shared')>('@minecraft-docker/shared');
  return {
    ...actual,
    log: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
    colors: {
      bold: (s: string) => s,
      cyan: (s: string) => s,
      yellow: (s: string) => s,
      green: (s: string) => s,
      dim: (s: string) => s,
      red: (s: string) => s,
    },
    Paths: vi.fn().mockImplementation((root?: string) => ({
      root: root ?? '/tmp/test-root',
      servers: (root ?? '/tmp/test-root') + '/servers',
    })),
  };
});

// Mock child_process (needed for update.ts imports)
vi.mock('child_process', () => ({
  spawnSync: vi.fn().mockReturnValue({ status: 0, stdout: '', stderr: '' }),
}));

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
  log: { warn: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

// Mock update-checker
vi.mock('../../../src/lib/update-checker.js', () => ({
  getInstalledVersion: vi.fn().mockReturnValue('1.0.0'),
  fetchLatestVersionForced: vi.fn().mockResolvedValue('1.0.0'),
  getCachedVersion: vi.fn().mockReturnValue('1.0.0'),
  clearCache: vi.fn(),
  isUpdateAvailable: vi.fn().mockReturnValue(false),
}));

// Mock pm2-utils
vi.mock('../../../src/lib/pm2-utils.js', () => ({
  checkServiceAvailability: vi.fn().mockReturnValue({
    api: { available: false },
    console: { available: false },
  }),
  PM2_SERVICE_NAMES: {
    API: 'mcctl-api',
    CONSOLE: 'mcctl-console',
  },
}));

// Mock Pm2ServiceManagerAdapter
vi.mock('../../../src/infrastructure/adapters/Pm2ServiceManagerAdapter.js', () => ({
  Pm2ServiceManagerAdapter: vi.fn().mockImplementation(() => ({
    restart: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
  })),
}));

import { upgradeServerImageTags } from '../../../src/commands/update.js';

describe('upgradeServerImageTags', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should return 0 when servers directory does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await upgradeServerImageTags('/tmp/no-such-dir/servers');

    expect(result).toBe(0);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should return 0 when no server directories exist', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);

    const result = await upgradeServerImageTags('/tmp/servers');

    expect(result).toBe(0);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should skip _template directory', async () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['_template'] as any);

    const result = await upgradeServerImageTags('/tmp/servers');

    expect(result).toBe(0);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should skip server with no config.env', async () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (p === '/tmp/servers/myserver/config.env') return false;
      return false;
    });
    mockReaddirSync.mockReturnValue(['myserver'] as any);

    const result = await upgradeServerImageTags('/tmp/servers');

    expect(result).toBe(0);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should skip server with no VERSION in config.env', async () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (p === '/tmp/servers/myserver/config.env') return true;
      if (p === '/tmp/servers/myserver/docker-compose.yml') return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['myserver'] as any);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers/myserver/config.env') {
        return 'EULA=TRUE\nMEMORY=4G\n';
      }
      if (p === '/tmp/servers/myserver/docker-compose.yml') {
        return 'services:\n  mc-myserver:\n    image: itzg/minecraft-server:java21\n';
      }
      return '';
    });

    const result = await upgradeServerImageTags('/tmp/servers');

    expect(result).toBe(0);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should skip server with no docker-compose.yml', async () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (p === '/tmp/servers/myserver/config.env') return true;
      if (p === '/tmp/servers/myserver/docker-compose.yml') return false;
      return false;
    });
    mockReaddirSync.mockReturnValue(['myserver'] as any);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers/myserver/config.env') {
        return 'VERSION=LATEST\n';
      }
      return '';
    });

    const result = await upgradeServerImageTags('/tmp/servers');

    expect(result).toBe(0);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should update image tag from java21 to java25 when VERSION=LATEST', async () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (p === '/tmp/servers/myserver/config.env') return true;
      if (p === '/tmp/servers/myserver/docker-compose.yml') return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['myserver'] as any);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers/myserver/config.env') {
        return 'EULA=TRUE\nVERSION=LATEST\nMEMORY=4G\n';
      }
      if (p === '/tmp/servers/myserver/docker-compose.yml') {
        return 'services:\n  mc-myserver:\n    image: itzg/minecraft-server:java21\n';
      }
      return '';
    });

    const result = await upgradeServerImageTags('/tmp/servers');

    expect(result).toBe(1);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/tmp/servers/myserver/docker-compose.yml',
      'services:\n  mc-myserver:\n    image: itzg/minecraft-server:java25\n'
    );
  });

  it('should not update image tag when VERSION=LATEST and tag is already java25', async () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (p === '/tmp/servers/myserver/config.env') return true;
      if (p === '/tmp/servers/myserver/docker-compose.yml') return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['myserver'] as any);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers/myserver/config.env') {
        return 'VERSION=LATEST\n';
      }
      if (p === '/tmp/servers/myserver/docker-compose.yml') {
        return 'services:\n  mc-myserver:\n    image: itzg/minecraft-server:java25\n';
      }
      return '';
    });

    const result = await upgradeServerImageTags('/tmp/servers');

    expect(result).toBe(0);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should update image tag based on MC version (1.21.1 -> java21)', async () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (p === '/tmp/servers/myserver/config.env') return true;
      if (p === '/tmp/servers/myserver/docker-compose.yml') return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['myserver'] as any);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers/myserver/config.env') {
        return 'VERSION=1.21.1\n';
      }
      if (p === '/tmp/servers/myserver/docker-compose.yml') {
        return 'services:\n  mc-myserver:\n    image: itzg/minecraft-server:java17\n';
      }
      return '';
    });

    const result = await upgradeServerImageTags('/tmp/servers');

    expect(result).toBe(1);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/tmp/servers/myserver/docker-compose.yml',
      'services:\n  mc-myserver:\n    image: itzg/minecraft-server:java21\n'
    );
  });

  it('should not update when MC version is compatible with current tag (1.21.1 + java21)', async () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (p === '/tmp/servers/myserver/config.env') return true;
      if (p === '/tmp/servers/myserver/docker-compose.yml') return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['myserver'] as any);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers/myserver/config.env') {
        return 'VERSION=1.21.1\n';
      }
      if (p === '/tmp/servers/myserver/docker-compose.yml') {
        return 'services:\n  mc-myserver:\n    image: itzg/minecraft-server:java21\n';
      }
      return '';
    });

    const result = await upgradeServerImageTags('/tmp/servers');

    expect(result).toBe(0);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should handle truly unparseable VERSION strings gracefully (e.g. "snapshot", "custom")', async () => {
    // Note: 26.1.1 is actually parseable by McVersion (major=26, minor=1),
    // so it returns a tag (java8 for minor < 18). When McVersion gains proper
    // 26.x support, it will automatically return the correct tag.
    // This test covers genuinely unparseable strings like "snapshot" or "custom".
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (p === '/tmp/servers/myserver/config.env') return true;
      if (p === '/tmp/servers/myserver/docker-compose.yml') return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['myserver'] as any);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers/myserver/config.env') {
        // "snapshot" is not a valid semver - McVersion.create will throw
        return 'VERSION=SNAPSHOT\n';
      }
      if (p === '/tmp/servers/myserver/docker-compose.yml') {
        return 'services:\n  mc-myserver:\n    image: itzg/minecraft-server:java21\n';
      }
      return '';
    });

    const result = await upgradeServerImageTags('/tmp/servers');

    expect(result).toBe(0);
    // Should NOT write anything - version parsing failed, skip gracefully
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should skip server when image line does not match itzg/minecraft-server: pattern', async () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (p === '/tmp/servers/myserver/config.env') return true;
      if (p === '/tmp/servers/myserver/docker-compose.yml') return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['myserver'] as any);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers/myserver/config.env') {
        return 'VERSION=LATEST\n';
      }
      if (p === '/tmp/servers/myserver/docker-compose.yml') {
        // Custom image - not itzg/minecraft-server
        return 'services:\n  mc-myserver:\n    image: custom/my-server:latest\n';
      }
      return '';
    });

    const result = await upgradeServerImageTags('/tmp/servers');

    expect(result).toBe(0);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should handle multiple servers and update only those that need it', async () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (
        p === '/tmp/servers/server1/config.env' ||
        p === '/tmp/servers/server1/docker-compose.yml' ||
        p === '/tmp/servers/server2/config.env' ||
        p === '/tmp/servers/server2/docker-compose.yml'
      ) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['server1', 'server2'] as any);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers/server1/config.env') {
        return 'VERSION=LATEST\n';
      }
      if (p === '/tmp/servers/server1/docker-compose.yml') {
        return 'services:\n  mc-server1:\n    image: itzg/minecraft-server:java21\n';
      }
      if (p === '/tmp/servers/server2/config.env') {
        return 'VERSION=1.21.1\n';
      }
      if (p === '/tmp/servers/server2/docker-compose.yml') {
        return 'services:\n  mc-server2:\n    image: itzg/minecraft-server:java21\n';
      }
      return '';
    });

    const result = await upgradeServerImageTags('/tmp/servers');

    expect(result).toBe(1);
    // Only server1 (VERSION=LATEST, java21 -> java25) should be updated
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/tmp/servers/server1/docker-compose.yml',
      'services:\n  mc-server1:\n    image: itzg/minecraft-server:java25\n'
    );
  });

  it('should return count of updated servers', async () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (
        p === '/tmp/servers/server1/config.env' ||
        p === '/tmp/servers/server1/docker-compose.yml'
      ) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['server1'] as any);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers/server1/config.env') {
        return 'VERSION=LATEST\n';
      }
      if (p === '/tmp/servers/server1/docker-compose.yml') {
        return 'services:\n  mc-server1:\n    image: itzg/minecraft-server:java21\n';
      }
      return '';
    });

    const result = await upgradeServerImageTags('/tmp/servers');

    // result is number of updated servers
    expect(result).toBe(1);
  });

  it('should handle VERSION with surrounding quotes in config.env', async () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (p === '/tmp/servers/myserver/config.env') return true;
      if (p === '/tmp/servers/myserver/docker-compose.yml') return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['myserver'] as any);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers/myserver/config.env') {
        return 'VERSION="LATEST"\n';
      }
      if (p === '/tmp/servers/myserver/docker-compose.yml') {
        return 'services:\n  mc-myserver:\n    image: itzg/minecraft-server:java21\n';
      }
      return '';
    });

    const result = await upgradeServerImageTags('/tmp/servers');

    expect(result).toBe(1);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/tmp/servers/myserver/docker-compose.yml',
      'services:\n  mc-myserver:\n    image: itzg/minecraft-server:java25\n'
    );
  });
});
