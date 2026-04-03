import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node:fs
const mockExistsSync = vi.fn().mockReturnValue(false);
const mockReaddirSync = vi.fn().mockReturnValue([]);
const mockReadFileSync = vi.fn().mockReturnValue('');
vi.mock('node:fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  readdirSync: (...args: any[]) => mockReaddirSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
}));

// Mock node:path
vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path');
  return {
    ...actual,
    join: (...args: string[]) => actual.join(...args),
  };
});

// Mock @minecraft-docker/shared
vi.mock('@minecraft-docker/shared', () => ({
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
}));

import { scanDockerImages } from '../../../src/commands/update.js';

describe('scanDockerImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when servers directory does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const images = scanDockerImages('/tmp/no-such-dir/servers');

    expect(images).toEqual([]);
  });

  it('should return empty array when there are no server subdirectories', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);

    const images = scanDockerImages('/tmp/servers');

    expect(images).toEqual([]);
  });

  it('should extract image from a docker-compose.yml file', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (p === '/tmp/servers/myserver/docker-compose.yml') return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['myserver'] as any);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers/myserver/docker-compose.yml') {
        return 'services:\n  mc-myserver:\n    image: itzg/minecraft-server:java21\n';
      }
      return '';
    });

    const images = scanDockerImages('/tmp/servers');

    expect(images).toEqual(['itzg/minecraft-server:java21']);
  });

  it('should skip directories without docker-compose.yml', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (p === '/tmp/servers/myserver/docker-compose.yml') return false;
      return true;
    });
    mockReaddirSync.mockReturnValue(['myserver'] as any);

    const images = scanDockerImages('/tmp/servers');

    expect(images).toEqual([]);
  });

  it('should deduplicate identical images across multiple servers', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (
        p === '/tmp/servers/server1/docker-compose.yml' ||
        p === '/tmp/servers/server2/docker-compose.yml'
      ) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['server1', 'server2'] as any);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('docker-compose.yml')) {
        return 'services:\n  mc-server:\n    image: itzg/minecraft-server:java21\n';
      }
      return '';
    });

    const images = scanDockerImages('/tmp/servers');

    expect(images).toEqual(['itzg/minecraft-server:java21']);
    expect(images.length).toBe(1);
  });

  it('should collect different images from multiple servers', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (
        p === '/tmp/servers/server1/docker-compose.yml' ||
        p === '/tmp/servers/server2/docker-compose.yml'
      ) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['server1', 'server2'] as any);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('server1/docker-compose.yml')) {
        return 'services:\n  mc-server1:\n    image: itzg/minecraft-server:java21\n';
      }
      if (p.includes('server2/docker-compose.yml')) {
        return 'services:\n  mc-server2:\n    image: itzg/minecraft-server:java17\n';
      }
      return '';
    });

    const images = scanDockerImages('/tmp/servers');

    expect(images).toContain('itzg/minecraft-server:java21');
    expect(images).toContain('itzg/minecraft-server:java17');
    expect(images.length).toBe(2);
  });

  it('should skip the _template directory', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/servers') return true;
      if (p === '/tmp/servers/_template/docker-compose.yml') return true;
      if (p === '/tmp/servers/realserver/docker-compose.yml') return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['_template', 'realserver'] as any);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('docker-compose.yml')) {
        return 'services:\n  mc-server:\n    image: itzg/minecraft-server:java21\n';
      }
      return '';
    });

    const images = scanDockerImages('/tmp/servers');

    expect(images).toEqual(['itzg/minecraft-server:java21']);
    expect(images.length).toBe(1);
  });
});
