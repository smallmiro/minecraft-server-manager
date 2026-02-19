import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import multipart from '@fastify/multipart';
import { resolve, join, basename, dirname } from 'path';
import { existsSync, statSync, readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, realpathSync, createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { serverExists, AuditActionEnum } from '@minecraft-docker/shared';
import { writeAuditLog } from '../../services/audit-log-service.js';
import { ErrorResponseSchema, ServerNameParamsSchema, type ServerNameParams } from '../../schemas/server.js';
import { config } from '../../config/index.js';

// ============================================================
// Types
// ============================================================

interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
}

interface FileListRoute {
  Params: ServerNameParams;
  Querystring: { path?: string };
}

interface FileReadRoute {
  Params: ServerNameParams;
  Querystring: { path: string };
}

interface FileWriteRoute {
  Params: ServerNameParams;
  Querystring: { path: string };
  Body: { content: string };
}

interface FileDeleteRoute {
  Params: ServerNameParams;
  Querystring: { path: string };
}

interface FileMkdirRoute {
  Params: ServerNameParams;
  Querystring: { path: string };
}

interface FileRenameRoute {
  Params: ServerNameParams;
  Body: { oldPath: string; newPath: string };
}

interface FileUploadRoute {
  Params: ServerNameParams;
  Querystring: { path: string };
}

interface FileDownloadRoute {
  Params: ServerNameParams;
  Querystring: { path: string };
}

// ============================================================
// Helpers
// ============================================================

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for text editing
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB for file upload

/**
 * Get the base data directory for a server
 */
function getServerDataDir(serverName: string): string {
  return join(config.platformPath, 'servers', serverName, 'data');
}

/**
 * Validate path to prevent path traversal attacks (including symlink escape).
 * Returns the resolved absolute path or null if invalid.
 */
function validatePath(baseDir: string, userPath: string): string | null {
  const resolved = resolve(baseDir, userPath.replace(/^\/+/, ''));
  if (!resolved.startsWith(baseDir + '/') && resolved !== baseDir) {
    return null;
  }
  // If path exists, resolve symlinks and re-check
  if (existsSync(resolved)) {
    try {
      const realResolved = realpathSync(resolved);
      const realBase = realpathSync(baseDir);
      if (!realResolved.startsWith(realBase + '/') && realResolved !== realBase) {
        return null;
      }
    } catch {
      return null;
    }
  }
  return resolved;
}

/**
 * Get actor string from request headers
 */
function getActor(request: FastifyRequest): string {
  const user = request.headers['x-user'];
  return typeof user === 'string' && user ? `api:${user}` : 'api:console';
}

// ============================================================
// Plugin Definition
// ============================================================

const filesPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Register multipart for file uploads
  await fastify.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_SIZE },
  });

  /**
   * GET /api/servers/:name/files
   * List directory contents
   */
  fastify.get<FileListRoute>('/api/servers/:name/files', {
    schema: {
      description: 'List files in a server directory',
      tags: ['servers', 'files'],
      params: ServerNameParamsSchema,
      response: {
        404: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<FileListRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const userPath = request.query.path || '/';

    try {
      if (!serverExists(name)) {
        return reply.code(404).send({ error: 'NotFound', message: `Server '${name}' not found` });
      }

      const baseDir = getServerDataDir(name);
      const targetPath = validatePath(baseDir, userPath);
      if (!targetPath) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Path traversal detected' });
      }

      if (!existsSync(targetPath)) {
        return reply.code(404).send({ error: 'NotFound', message: `Path '${userPath}' not found` });
      }

      const stat = statSync(targetPath);
      if (!stat.isDirectory()) {
        return reply.code(400).send({ error: 'BadRequest', message: 'Path is not a directory' });
      }

      const entries = readdirSync(targetPath, { withFileTypes: true });
      const files: FileEntry[] = entries
        .filter(entry => !entry.name.startsWith('.'))
        .map(entry => {
          const entryPath = join(targetPath, entry.name);
          try {
            const entryStat = statSync(entryPath);
            return {
              name: entry.name,
              type: entry.isDirectory() ? 'directory' as const : 'file' as const,
              size: entry.isDirectory() ? 0 : entryStat.size,
              modifiedAt: entryStat.mtime.toISOString(),
            };
          } catch {
            return {
              name: entry.name,
              type: entry.isDirectory() ? 'directory' as const : 'file' as const,
              size: 0,
              modifiedAt: new Date().toISOString(),
            };
          }
        })
        .sort((a, b) => {
          // Directories first, then alphabetical
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      return reply.send({ path: userPath, files });
    } catch (error) {
      fastify.log.error(error, 'Failed to list files');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to list files' });
    }
  });

  /**
   * GET /api/servers/:name/files/read
   * Read file contents
   */
  fastify.get<FileReadRoute>('/api/servers/:name/files/read', {
    schema: {
      description: 'Read a file from server data directory',
      tags: ['servers', 'files'],
      params: ServerNameParamsSchema,
      response: {
        404: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<FileReadRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const userPath = request.query.path;

    try {
      if (!serverExists(name)) {
        return reply.code(404).send({ error: 'NotFound', message: `Server '${name}' not found` });
      }

      if (!userPath) {
        return reply.code(400).send({ error: 'BadRequest', message: 'path query parameter is required' });
      }

      const baseDir = getServerDataDir(name);
      const targetPath = validatePath(baseDir, userPath);
      if (!targetPath) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Path traversal detected' });
      }

      if (!existsSync(targetPath)) {
        return reply.code(404).send({ error: 'NotFound', message: `File '${userPath}' not found` });
      }

      const stat = statSync(targetPath);
      if (stat.isDirectory()) {
        return reply.code(400).send({ error: 'BadRequest', message: 'Path is a directory, not a file' });
      }

      if (stat.size > MAX_FILE_SIZE) {
        return reply.code(413).send({ error: 'PayloadTooLarge', message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` });
      }

      const content = readFileSync(targetPath, 'utf-8');

      return reply.send({
        path: userPath,
        content,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to read file');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to read file' });
    }
  });

  /**
   * PUT /api/servers/:name/files/write
   * Write file contents
   */
  fastify.put<FileWriteRoute>('/api/servers/:name/files/write', {
    schema: {
      description: 'Write content to a file in server data directory',
      tags: ['servers', 'files'],
      params: ServerNameParamsSchema,
      response: {
        404: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<FileWriteRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const userPath = request.query.path;
    const { content } = request.body;

    try {
      if (!serverExists(name)) {
        return reply.code(404).send({ error: 'NotFound', message: `Server '${name}' not found` });
      }

      if (!userPath) {
        return reply.code(400).send({ error: 'BadRequest', message: 'path query parameter is required' });
      }

      const baseDir = getServerDataDir(name);
      const targetPath = validatePath(baseDir, userPath);
      if (!targetPath) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Path traversal detected' });
      }

      if (typeof content !== 'string') {
        return reply.code(400).send({ error: 'BadRequest', message: 'content field is required' });
      }

      if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_SIZE) {
        return reply.code(413).send({ error: 'PayloadTooLarge', message: `Content exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` });
      }

      if (existsSync(targetPath) && statSync(targetPath).isDirectory()) {
        return reply.code(400).send({ error: 'BadRequest', message: 'Cannot write to a directory' });
      }

      writeFileSync(targetPath, content, 'utf-8');

      const actor = getActor(request);
      await writeAuditLog({
        action: AuditActionEnum.FILE_WRITE,
        actor,
        targetType: 'server',
        targetName: name,
        details: { path: userPath },
        status: 'success',
      });

      fastify.log.info({ server: name, path: userPath, actor }, 'File written');

      const stat = statSync(targetPath);
      return reply.send({
        success: true,
        path: userPath,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    } catch (error) {
      const actor = getActor(request);
      await writeAuditLog({
        action: AuditActionEnum.FILE_WRITE,
        actor,
        targetType: 'server',
        targetName: name,
        details: { path: userPath },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      fastify.log.error(error, 'Failed to write file');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to write file' });
    }
  });

  /**
   * DELETE /api/servers/:name/files
   * Delete a file or directory
   */
  fastify.delete<FileDeleteRoute>('/api/servers/:name/files', {
    schema: {
      description: 'Delete a file or directory from server data',
      tags: ['servers', 'files'],
      params: ServerNameParamsSchema,
      response: {
        404: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<FileDeleteRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const userPath = request.query.path;

    try {
      if (!serverExists(name)) {
        return reply.code(404).send({ error: 'NotFound', message: `Server '${name}' not found` });
      }

      if (!userPath || userPath === '/') {
        return reply.code(400).send({ error: 'BadRequest', message: 'Cannot delete root directory' });
      }

      const baseDir = getServerDataDir(name);
      const targetPath = validatePath(baseDir, userPath);
      if (!targetPath) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Path traversal detected' });
      }

      if (!existsSync(targetPath)) {
        return reply.code(404).send({ error: 'NotFound', message: `Path '${userPath}' not found` });
      }

      const stat = statSync(targetPath);
      const isDirectory = stat.isDirectory();

      rmSync(targetPath, { recursive: true, force: true });

      const actor = getActor(request);
      await writeAuditLog({
        action: AuditActionEnum.FILE_DELETE,
        actor,
        targetType: 'server',
        targetName: name,
        details: { path: userPath, type: isDirectory ? 'directory' : 'file' },
        status: 'success',
      });

      fastify.log.info({ server: name, path: userPath, type: isDirectory ? 'directory' : 'file', actor }, 'File deleted');

      return reply.send({ success: true, path: userPath });
    } catch (error) {
      const actor = getActor(request);
      await writeAuditLog({
        action: AuditActionEnum.FILE_DELETE,
        actor,
        targetType: 'server',
        targetName: name,
        details: { path: userPath },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      fastify.log.error(error, 'Failed to delete file');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to delete file' });
    }
  });

  /**
   * POST /api/servers/:name/files/mkdir
   * Create a directory
   */
  fastify.post<FileMkdirRoute>('/api/servers/:name/files/mkdir', {
    schema: {
      description: 'Create a directory in server data',
      tags: ['servers', 'files'],
      params: ServerNameParamsSchema,
      response: {
        404: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<FileMkdirRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const userPath = request.query.path;

    try {
      if (!serverExists(name)) {
        return reply.code(404).send({ error: 'NotFound', message: `Server '${name}' not found` });
      }

      if (!userPath) {
        return reply.code(400).send({ error: 'BadRequest', message: 'path query parameter is required' });
      }

      const baseDir = getServerDataDir(name);
      const targetPath = validatePath(baseDir, userPath);
      if (!targetPath) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Path traversal detected' });
      }

      if (existsSync(targetPath)) {
        return reply.code(409).send({ error: 'Conflict', message: `Path '${userPath}' already exists` });
      }

      mkdirSync(targetPath, { recursive: true });

      const actor = getActor(request);
      await writeAuditLog({
        action: AuditActionEnum.FILE_MKDIR,
        actor,
        targetType: 'server',
        targetName: name,
        details: { path: userPath },
        status: 'success',
      });

      fastify.log.info({ server: name, path: userPath, actor }, 'Directory created');

      return reply.send({ success: true, path: userPath });
    } catch (error) {
      const actor = getActor(request);
      await writeAuditLog({
        action: AuditActionEnum.FILE_MKDIR,
        actor,
        targetType: 'server',
        targetName: name,
        details: { path: userPath },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      fastify.log.error(error, 'Failed to create directory');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to create directory' });
    }
  });

  /**
   * POST /api/servers/:name/files/rename
   * Rename a file or directory
   */
  fastify.post<FileRenameRoute>('/api/servers/:name/files/rename', {
    schema: {
      description: 'Rename a file or directory in server data',
      tags: ['servers', 'files'],
      params: ServerNameParamsSchema,
      response: {
        404: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<FileRenameRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { oldPath, newPath } = request.body;

    try {
      if (!serverExists(name)) {
        return reply.code(404).send({ error: 'NotFound', message: `Server '${name}' not found` });
      }

      if (!oldPath || !newPath) {
        return reply.code(400).send({ error: 'BadRequest', message: 'oldPath and newPath are required' });
      }

      if (oldPath === '/' || newPath === '/') {
        return reply.code(400).send({ error: 'BadRequest', message: 'Cannot rename root directory' });
      }

      const baseDir = getServerDataDir(name);
      const resolvedOld = validatePath(baseDir, oldPath);
      const resolvedNew = validatePath(baseDir, newPath);
      if (!resolvedOld || !resolvedNew) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Path traversal detected' });
      }

      if (!existsSync(resolvedOld)) {
        return reply.code(404).send({ error: 'NotFound', message: `Path '${oldPath}' not found` });
      }

      if (existsSync(resolvedNew)) {
        return reply.code(409).send({ error: 'Conflict', message: `Path '${newPath}' already exists` });
      }

      renameSync(resolvedOld, resolvedNew);

      const actor = getActor(request);
      await writeAuditLog({
        action: AuditActionEnum.FILE_RENAME,
        actor,
        targetType: 'server',
        targetName: name,
        details: { oldPath, newPath },
        status: 'success',
      });

      fastify.log.info({ server: name, oldPath, newPath, actor }, 'File renamed');

      return reply.send({ success: true, oldPath, newPath });
    } catch (error) {
      const actor = getActor(request);
      await writeAuditLog({
        action: AuditActionEnum.FILE_RENAME,
        actor,
        targetType: 'server',
        targetName: name,
        details: { oldPath, newPath: request.body.newPath },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      fastify.log.error(error, 'Failed to rename file');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to rename file' });
    }
  });
  /**
   * POST /api/servers/:name/files/upload
   * Upload a file via multipart form data
   */
  fastify.post<FileUploadRoute>('/api/servers/:name/files/upload', {
    schema: {
      description: 'Upload a file to server data directory (multipart)',
      tags: ['servers', 'files'],
      params: ServerNameParamsSchema,
      response: {
        404: ErrorResponseSchema,
        403: ErrorResponseSchema,
        413: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<FileUploadRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const userPath = request.query.path;

    try {
      if (!serverExists(name)) {
        return reply.code(404).send({ error: 'NotFound', message: `Server '${name}' not found` });
      }

      if (!userPath) {
        return reply.code(400).send({ error: 'BadRequest', message: 'path query parameter is required' });
      }

      const baseDir = getServerDataDir(name);
      const targetPath = validatePath(baseDir, userPath);
      if (!targetPath) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Path traversal detected' });
      }

      if (!existsSync(targetPath) || !statSync(targetPath).isDirectory()) {
        return reply.code(404).send({ error: 'NotFound', message: 'Upload directory not found' });
      }

      const parts = request.parts();
      const uploaded: string[] = [];

      for await (const part of parts) {
        if (part.type === 'file') {
          const fileName = basename(part.filename);
          if (!fileName) continue;

          // Validate the resolved file path stays within base directory
          const resolvedFilePath = validatePath(baseDir, join(userPath.replace(/^\/+/, ''), fileName));
          if (!resolvedFilePath) {
            continue; // Skip files with traversal in filename
          }

          await pipeline(part.file, createWriteStream(resolvedFilePath));

          if (part.file.truncated) {
            // File exceeded size limit — remove the partial file and any previously uploaded files
            rmSync(resolvedFilePath, { force: true });
            for (const prev of uploaded) {
              const prevPath = validatePath(baseDir, join(userPath.replace(/^\/+/, ''), prev));
              if (prevPath) rmSync(prevPath, { force: true });
            }
            return reply.code(413).send({ error: 'PayloadTooLarge', message: `File "${fileName}" exceeds ${MAX_UPLOAD_SIZE / 1024 / 1024}MB limit` });
          }

          uploaded.push(fileName);
        }
      }

      const actor = getActor(request);
      await writeAuditLog({
        action: AuditActionEnum.FILE_UPLOAD,
        actor,
        targetType: 'server',
        targetName: name,
        details: { path: userPath, files: uploaded },
        status: 'success',
      });

      fastify.log.info({ server: name, path: userPath, files: uploaded, actor }, 'Files uploaded');

      return reply.send({ success: true, path: userPath, files: uploaded });
    } catch (error) {
      const actor = getActor(request);
      await writeAuditLog({
        action: AuditActionEnum.FILE_UPLOAD,
        actor,
        targetType: 'server',
        targetName: name,
        details: { path: userPath },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      fastify.log.error(error, 'Failed to upload file');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to upload file' });
    }
  });

  /**
   * GET /api/servers/:name/files/download
   * Download a file as streaming response
   */
  fastify.get<FileDownloadRoute>('/api/servers/:name/files/download', {
    schema: {
      description: 'Download a file from server data directory',
      tags: ['servers', 'files'],
      params: ServerNameParamsSchema,
      response: {
        404: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<FileDownloadRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const userPath = request.query.path;

    try {
      if (!serverExists(name)) {
        return reply.code(404).send({ error: 'NotFound', message: `Server '${name}' not found` });
      }

      if (!userPath) {
        return reply.code(400).send({ error: 'BadRequest', message: 'path query parameter is required' });
      }

      const baseDir = getServerDataDir(name);
      const targetPath = validatePath(baseDir, userPath);
      if (!targetPath) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Path traversal detected' });
      }

      if (!existsSync(targetPath)) {
        return reply.code(404).send({ error: 'NotFound', message: `File '${userPath}' not found` });
      }

      const stat = statSync(targetPath);
      if (stat.isDirectory()) {
        return reply.code(400).send({ error: 'BadRequest', message: 'Cannot download a directory' });
      }

      const fileName = basename(targetPath);
      const stream = createReadStream(targetPath);

      const actor = getActor(request);
      await writeAuditLog({
        action: AuditActionEnum.FILE_DOWNLOAD,
        actor,
        targetType: 'server',
        targetName: name,
        details: { path: userPath },
        status: 'success',
      });

      return reply
        .header('Content-Type', 'application/octet-stream')
        .header('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
        .header('Content-Length', stat.size)
        .send(stream);
    } catch (error) {
      const actor = getActor(request);
      await writeAuditLog({
        action: AuditActionEnum.FILE_DOWNLOAD,
        actor,
        targetType: 'server',
        targetName: name,
        details: { path: userPath },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      fastify.log.error(error, 'Failed to download file');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to download file' });
    }
  });
};

// ============================================================
// Export
// ============================================================

export default fp(filesPlugin, {
  name: 'server-files-routes',
  fastify: '5.x',
});

export { filesPlugin };
