import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { config } from '../config/index.js';
import {
  BackupStatusResponseSchema,
  BackupPushRequestSchema,
  BackupPushResponseSchema,
  BackupHistoryResponseSchema,
  BackupRestoreRequestSchema,
  BackupRestoreResponseSchema,
  ErrorResponseSchema,
  type BackupPushRequest,
  type BackupRestoreRequest,
  type BackupCommit,
} from '../schemas/backup.js';

const execFilePromise = promisify(execFile);

/**
 * The git backup cache directory used by backup.sh.
 * backup.sh uses $HOME/.minecraft-backup as the git repository,
 * NOT platform/worlds/ which is only the source data directory.
 */
const BACKUP_CACHE_DIR = join(os.homedir(), '.minecraft-backup');

// Route interfaces
interface BackupPushRoute {
  Body: BackupPushRequest;
}

interface BackupRestoreRoute {
  Body: BackupRestoreRequest;
}

/**
 * Backup management routes plugin
 */
const backupPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const platformPath = config.platformPath;
  const worldsPath = join(platformPath, 'worlds');

  // Helper to check if backup is configured
  const isBackupConfigured = (): { configured: boolean; repository?: string; branch?: string } => {
    const repo = process.env['BACKUP_GITHUB_REPO'];
    const token = process.env['BACKUP_GITHUB_TOKEN'];

    if (!repo || !token) {
      return { configured: false };
    }

    return {
      configured: true,
      repository: repo,
      branch: process.env['BACKUP_GITHUB_BRANCH'] || 'main',
    };
  };

  /**
   * GET /api/backup/status
   * Get backup configuration status
   */
  fastify.get('/api/backup/status', {
    schema: {
      description: 'Get backup configuration status',
      tags: ['backup'],
      response: {
        200: BackupStatusResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (_request, reply) => {
    try {
      const status = isBackupConfigured();

      // Get last backup date from the backup cache directory (not from worlds/)
      // backup.sh uses $HOME/.minecraft-backup as the git repository
      let lastBackup: string | undefined;
      if (status.configured && existsSync(join(BACKUP_CACHE_DIR, '.git'))) {
        try {
          const { stdout } = await execFilePromise(
            'git',
            ['log', '-1', '--format=%cI'],
            { cwd: BACKUP_CACHE_DIR, timeout: 5000 }
          );
          lastBackup = stdout.trim() || undefined;
        } catch {
          // Git not initialized or no commits
        }
      }

      return reply.send({
        configured: status.configured,
        repository: status.repository,
        branch: status.branch,
        lastBackup,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to get backup status');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to get backup status' });
    }
  });

  /**
   * POST /api/backup/push
   * Push backup to GitHub
   */
  fastify.post<BackupPushRoute>('/api/backup/push', {
    schema: {
      description: 'Push worlds backup to GitHub',
      tags: ['backup'],
      body: BackupPushRequestSchema,
      response: {
        200: BackupPushResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<BackupPushRoute>, reply: FastifyReply) => {
    const { message } = request.body;

    try {
      const status = isBackupConfigured();
      if (!status.configured) {
        return reply.code(400).send({
          error: 'BadRequest',
          message: 'Backup not configured. Set BACKUP_GITHUB_REPO and BACKUP_GITHUB_TOKEN environment variables.',
        });
      }

      if (!existsSync(worldsPath)) {
        return reply.code(400).send({
          error: 'BadRequest',
          message: 'Worlds directory not found',
        });
      }

      const execOptions = {
        cwd: platformPath,
        timeout: 120000, // 2 minute timeout
        env: {
          ...process.env,
          MCCTL_ROOT: platformPath,
        },
      };

      // Run backup script (safe from injection: args passed as array)
      const scriptPath = join(platformPath, 'scripts', 'backup.sh');

      if (existsSync(scriptPath)) {
        // Use execFile with array args to prevent shell injection
        const args = message
          ? [scriptPath, 'push', '--message', message]
          : [scriptPath, 'push', '--auto'];
        await execFilePromise('bash', args, execOptions);
      } else {
        // Fallback: run git commands directly against the backup cache directory
        // (not worlds/ which is not a git repository)
        const commitMessage = message || `Backup ${new Date().toISOString()}`;
        const gitOptions = { ...execOptions, cwd: BACKUP_CACHE_DIR };
        await execFilePromise('git', ['add', '-A'], gitOptions);
        await execFilePromise('git', ['commit', '-m', commitMessage], gitOptions);
        await execFilePromise('git', ['push'], gitOptions);
      }

      // Get commit hash from the backup cache directory
      let commitHash: string | undefined;
      try {
        const { stdout: hashOut } = await execFilePromise(
          'git',
          ['rev-parse', '--short', 'HEAD'],
          { cwd: BACKUP_CACHE_DIR }
        );
        commitHash = hashOut.trim();
      } catch {
        // Ignore
      }

      return reply.send({
        success: true,
        commitHash,
        message: 'Backup pushed successfully',
      });
    } catch (error) {
      const execError = error as { stderr?: string; message?: string };
      fastify.log.error(error, 'Failed to push backup');

      // Check for "nothing to commit" which is not an error
      if (execError.stderr?.includes('nothing to commit') || execError.message?.includes('nothing to commit')) {
        return reply.send({
          success: true,
          message: 'No changes to backup',
        });
      }

      return reply.code(500).send({
        error: 'InternalServerError',
        message: execError.stderr || execError.message || 'Failed to push backup',
      });
    }
  });

  /**
   * GET /api/backup/history
   * Get backup history (git commits) from $HOME/.minecraft-backup
   */
  fastify.get('/api/backup/history', {
    schema: {
      description: 'Get backup history (git commits)',
      tags: ['backup'],
      response: {
        200: BackupHistoryResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (_request, reply) => {
    try {
      const status = isBackupConfigured();
      if (!status.configured) {
        return reply.code(400).send({
          error: 'BadRequest',
          message: 'Backup not configured',
        });
      }

      // Check the backup cache directory, not worlds/
      if (!existsSync(BACKUP_CACHE_DIR)) {
        return reply.send({ commits: [], total: 0 });
      }

      // Get git log from the backup cache directory
      const { stdout } = await execFilePromise(
        'git',
        ['log', '--format=%H|%s|%cI|%an', '-n', '20'],
        { cwd: BACKUP_CACHE_DIR, timeout: 10000 }
      );

      const commits: BackupCommit[] = stdout.trim().split('\n')
        .filter(Boolean)
        .map(line => {
          const [hash, message, date, author] = line.split('|');
          return {
            hash: hash?.substring(0, 7) || '',
            message: message || '',
            date: date || '',
            author,
          };
        });

      return reply.send({ commits, total: commits.length });
    } catch (error) {
      const execError = error as { stderr?: string; message?: string };

      // Check for "not a git repository"
      if (execError.stderr?.includes('not a git repository')) {
        return reply.send({ commits: [], total: 0 });
      }

      fastify.log.error(error, 'Failed to get backup history');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to get backup history' });
    }
  });

  /**
   * POST /api/backup/restore
   * Restore from backup
   */
  fastify.post<BackupRestoreRoute>('/api/backup/restore', {
    schema: {
      description: 'Restore worlds from a backup commit',
      tags: ['backup'],
      body: BackupRestoreRequestSchema,
      response: {
        200: BackupRestoreResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<BackupRestoreRoute>, reply: FastifyReply) => {
    const { commitHash } = request.body;

    try {
      const status = isBackupConfigured();
      if (!status.configured) {
        return reply.code(400).send({
          error: 'BadRequest',
          message: 'Backup not configured',
        });
      }

      if (!existsSync(worldsPath)) {
        return reply.code(400).send({
          error: 'BadRequest',
          message: 'Worlds directory not found',
        });
      }

      const execOptions = {
        cwd: platformPath,
        timeout: 120000,
        env: {
          ...process.env,
          MCCTL_ROOT: platformPath,
        },
      };

      // Run backup restore script (safe from injection: args passed as array)
      const scriptPath = join(platformPath, 'scripts', 'backup.sh');

      if (existsSync(scriptPath)) {
        // Use execFile with array args to prevent shell injection
        await execFilePromise('bash', [scriptPath, 'restore', commitHash], execOptions);
      } else {
        // Fallback: git checkout from backup cache directory
        await execFilePromise(
          'git',
          ['checkout', commitHash, '--', 'worlds/'],
          { ...execOptions, cwd: BACKUP_CACHE_DIR }
        );
      }

      return reply.send({
        success: true,
        message: `Restored to commit ${commitHash}`,
      });
    } catch (error) {
      const execError = error as { stderr?: string; message?: string };
      fastify.log.error(error, 'Failed to restore backup');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: execError.stderr || execError.message || 'Failed to restore backup',
      });
    }
  });
};

export default fp(backupPlugin, {
  name: 'backup-routes',
  fastify: '5.x',
});

export { backupPlugin };
