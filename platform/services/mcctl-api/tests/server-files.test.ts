/**
 * Server Files Route Tests
 * Tests for file browser API: list, read, write, delete, mkdir, rename
 * with path traversal prevention and audit logging verification
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, writeFileSync, rmSync, existsSync, symlinkSync } from 'fs';
import { join } from 'path';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-server-files-test');

// Set env vars BEFORE any imports
process.env.PLATFORM_PATH = TEST_PLATFORM_PATH;
process.env.AUTH_ACCESS_MODE = 'open';
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

// Mock audit-log-service
vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock Docker functions
vi.mock('@minecraft-docker/shared', async () => {
  const actual = await vi.importActual('@minecraft-docker/shared');
  return {
    ...actual,
    containerExists: vi.fn((containerName: string) => {
      const serverName = containerName.replace('mc-', '');
      const serverPath = join(TEST_PLATFORM_PATH, 'servers', serverName, 'docker-compose.yml');
      return existsSync(serverPath);
    }),
    serverExists: vi.fn((serverName: string) => {
      const serverPath = join(TEST_PLATFORM_PATH, 'servers', serverName, 'docker-compose.yml');
      return existsSync(serverPath);
    }),
    getContainerStatus: vi.fn(() => 'stopped'),
  };
});

function setupServer(serverName: string, opts: { dataFiles?: Record<string, string>; dataDirs?: string[] } = {}) {
  const serverDir = join(TEST_PLATFORM_PATH, 'servers', serverName);
  const dataDir = join(serverDir, 'data');
  mkdirSync(dataDir, { recursive: true });

  writeFileSync(
    join(serverDir, 'docker-compose.yml'),
    'services:\n  minecraft:\n    image: itzg/minecraft-server',
    'utf-8'
  );

  if (opts.dataFiles) {
    for (const [filename, content] of Object.entries(opts.dataFiles)) {
      const filePath = join(dataDir, filename);
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      if (dir !== dataDir) mkdirSync(dir, { recursive: true });
      writeFileSync(filePath, content, 'utf-8');
    }
  }

  if (opts.dataDirs) {
    for (const dirName of opts.dataDirs) {
      mkdirSync(join(dataDir, dirName), { recursive: true });
    }
  }
}

describe('Server Files API', () => {
  let app: FastifyInstance;
  let writeAuditLog: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
    mkdirSync(TEST_PLATFORM_PATH, { recursive: true });

    const { config } = await import('../src/config/index.js');
    (config as any).platformPath = TEST_PLATFORM_PATH;

    const auditModule = await import('../src/services/audit-log-service.js');
    writeAuditLog = auditModule.writeAuditLog as ReturnType<typeof vi.fn>;
    writeAuditLog.mockClear();

    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
  });

  // ==================== LIST ====================

  describe('GET /api/servers/:name/files', () => {
    it('should list files in root directory', async () => {
      setupServer('srv1', {
        dataFiles: { 'server.properties': 'motd=Test', 'eula.txt': 'eula=true' },
        dataDirs: ['world'],
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/servers/srv1/files',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.path).toBe('/');
      expect(body.files).toBeInstanceOf(Array);
      expect(body.files.length).toBe(3);
      // Directories first
      expect(body.files[0].name).toBe('world');
      expect(body.files[0].type).toBe('directory');
    });

    it('should list files in subdirectory', async () => {
      setupServer('srv1', {
        dataFiles: { 'world/level.dat': 'data' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/servers/srv1/files?path=/world',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.files.some((f: any) => f.name === 'level.dat')).toBe(true);
    });

    it('should hide dot files', async () => {
      setupServer('srv1', {
        dataFiles: { '.hidden': 'secret', 'visible.txt': 'hello' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/servers/srv1/files',
      });

      const body = res.json();
      expect(body.files.length).toBe(1);
      expect(body.files[0].name).toBe('visible.txt');
    });

    it('should return 404 for non-existent server', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/servers/nonexistent/files',
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 403 for path traversal attempt', async () => {
      setupServer('srv1');

      const res = await app.inject({
        method: 'GET',
        url: '/api/servers/srv1/files?path=../../etc',
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe('Forbidden');
    });

    it('should return 404 for non-existent path', async () => {
      setupServer('srv1');

      const res = await app.inject({
        method: 'GET',
        url: '/api/servers/srv1/files?path=/nonexistent',
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ==================== READ ====================

  describe('GET /api/servers/:name/files/read', () => {
    it('should read file contents', async () => {
      setupServer('srv1', {
        dataFiles: { 'server.properties': 'motd=Hello World' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/servers/srv1/files/read?path=/server.properties',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.content).toBe('motd=Hello World');
      expect(body.path).toBe('/server.properties');
      expect(body.size).toBeGreaterThan(0);
    });

    it('should return 400 when path is missing', async () => {
      setupServer('srv1');

      const res = await app.inject({
        method: 'GET',
        url: '/api/servers/srv1/files/read',
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for directory read', async () => {
      setupServer('srv1', { dataDirs: ['world'] });

      const res = await app.inject({
        method: 'GET',
        url: '/api/servers/srv1/files/read?path=/world',
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 403 for path traversal', async () => {
      setupServer('srv1');

      const res = await app.inject({
        method: 'GET',
        url: '/api/servers/srv1/files/read?path=/../../../etc/passwd',
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ==================== WRITE ====================

  describe('PUT /api/servers/:name/files/write', () => {
    it('should write file contents', async () => {
      setupServer('srv1', {
        dataFiles: { 'server.properties': 'motd=Old' },
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/servers/srv1/files/write?path=/server.properties',
        payload: { content: 'motd=New Server' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
    });

    it('should log audit on write', async () => {
      setupServer('srv1', {
        dataFiles: { 'test.txt': 'old' },
      });

      await app.inject({
        method: 'PUT',
        url: '/api/servers/srv1/files/write?path=/test.txt',
        payload: { content: 'new content' },
      });

      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'file.write',
          targetType: 'server',
          targetName: 'srv1',
          status: 'success',
        })
      );
    });

    it('should return 400 when writing to a directory', async () => {
      setupServer('srv1', { dataDirs: ['world'] });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/servers/srv1/files/write?path=/world',
        payload: { content: 'some content' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe('Cannot write to a directory');
    });

    it('should return 403 for path traversal on write', async () => {
      setupServer('srv1');

      const res = await app.inject({
        method: 'PUT',
        url: '/api/servers/srv1/files/write?path=/../../../tmp/evil',
        payload: { content: 'hacked' },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ==================== DELETE ====================

  describe('DELETE /api/servers/:name/files', () => {
    it('should delete a file', async () => {
      setupServer('srv1', {
        dataFiles: { 'test.txt': 'delete me' },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/servers/srv1/files?path=/test.txt',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it('should delete a directory recursively', async () => {
      setupServer('srv1', {
        dataFiles: { 'mydir/file1.txt': 'content' },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/servers/srv1/files?path=/mydir',
      });

      expect(res.statusCode).toBe(200);
    });

    it('should not allow deleting root directory', async () => {
      setupServer('srv1');

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/servers/srv1/files?path=/',
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe('Cannot delete root directory');
    });

    it('should log audit on delete', async () => {
      setupServer('srv1', {
        dataFiles: { 'test.txt': 'delete me' },
      });

      await app.inject({
        method: 'DELETE',
        url: '/api/servers/srv1/files?path=/test.txt',
      });

      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'file.delete',
          targetType: 'server',
          targetName: 'srv1',
          status: 'success',
        })
      );
    });

    it('should return 403 for path traversal on delete', async () => {
      setupServer('srv1');

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/servers/srv1/files?path=/../../../tmp/important',
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ==================== MKDIR ====================

  describe('POST /api/servers/:name/files/mkdir', () => {
    it('should create a directory', async () => {
      setupServer('srv1');

      const res = await app.inject({
        method: 'POST',
        url: '/api/servers/srv1/files/mkdir?path=/newdir',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(existsSync(join(TEST_PLATFORM_PATH, 'servers', 'srv1', 'data', 'newdir'))).toBe(true);
    });

    it('should return 409 if directory already exists', async () => {
      setupServer('srv1', { dataDirs: ['existing'] });

      const res = await app.inject({
        method: 'POST',
        url: '/api/servers/srv1/files/mkdir?path=/existing',
      });

      expect(res.statusCode).toBe(409);
    });

    it('should log audit on mkdir', async () => {
      setupServer('srv1');

      await app.inject({
        method: 'POST',
        url: '/api/servers/srv1/files/mkdir?path=/newdir',
      });

      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'file.mkdir',
          targetType: 'server',
          targetName: 'srv1',
          status: 'success',
        })
      );
    });

    it('should return 403 for path traversal on mkdir', async () => {
      setupServer('srv1');

      const res = await app.inject({
        method: 'POST',
        url: '/api/servers/srv1/files/mkdir?path=/../../../tmp/evildir',
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ==================== RENAME ====================

  describe('POST /api/servers/:name/files/rename', () => {
    it('should rename a file', async () => {
      setupServer('srv1', {
        dataFiles: { 'old.txt': 'content' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/servers/srv1/files/rename',
        payload: { oldPath: '/old.txt', newPath: '/new.txt' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(existsSync(join(TEST_PLATFORM_PATH, 'servers', 'srv1', 'data', 'new.txt'))).toBe(true);
      expect(existsSync(join(TEST_PLATFORM_PATH, 'servers', 'srv1', 'data', 'old.txt'))).toBe(false);
    });

    it('should not allow renaming root directory', async () => {
      setupServer('srv1');

      const res = await app.inject({
        method: 'POST',
        url: '/api/servers/srv1/files/rename',
        payload: { oldPath: '/', newPath: '/renamed' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe('Cannot rename root directory');
    });

    it('should return 409 if target already exists', async () => {
      setupServer('srv1', {
        dataFiles: { 'file1.txt': 'a', 'file2.txt': 'b' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/servers/srv1/files/rename',
        payload: { oldPath: '/file1.txt', newPath: '/file2.txt' },
      });

      expect(res.statusCode).toBe(409);
    });

    it('should log audit on rename', async () => {
      setupServer('srv1', {
        dataFiles: { 'old.txt': 'content' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/servers/srv1/files/rename',
        payload: { oldPath: '/old.txt', newPath: '/new.txt' },
      });

      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'file.rename',
          targetType: 'server',
          targetName: 'srv1',
          status: 'success',
        })
      );
    });

    it('should return 403 for path traversal on rename', async () => {
      setupServer('srv1', {
        dataFiles: { 'test.txt': 'content' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/servers/srv1/files/rename',
        payload: { oldPath: '/test.txt', newPath: '/../../../tmp/stolen' },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ==================== SYMLINK PROTECTION ====================

  describe('Symlink path traversal protection', () => {
    it('should block symlink that escapes server data directory', async () => {
      setupServer('srv1');

      // Create a symlink inside data dir that points outside
      const dataDir = join(TEST_PLATFORM_PATH, 'servers', 'srv1', 'data');
      const secretDir = join(TEST_PLATFORM_PATH, 'secret');
      mkdirSync(secretDir, { recursive: true });
      writeFileSync(join(secretDir, 'password.txt'), 'super-secret', 'utf-8');

      try {
        symlinkSync(secretDir, join(dataDir, 'escape-link'));
      } catch {
        // Skip test on systems that don't support symlinks
        return;
      }

      const res = await app.inject({
        method: 'GET',
        url: '/api/servers/srv1/files?path=/escape-link',
      });

      // Should be blocked by symlink validation
      expect(res.statusCode).toBe(403);
    });

    it('should block reading files through symlink', async () => {
      setupServer('srv1');

      const dataDir = join(TEST_PLATFORM_PATH, 'servers', 'srv1', 'data');
      const secretFile = join(TEST_PLATFORM_PATH, 'secret.txt');
      writeFileSync(secretFile, 'top-secret-data', 'utf-8');

      try {
        symlinkSync(secretFile, join(dataDir, 'sneaky-link.txt'));
      } catch {
        return;
      }

      const res = await app.inject({
        method: 'GET',
        url: '/api/servers/srv1/files/read?path=/sneaky-link.txt',
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
