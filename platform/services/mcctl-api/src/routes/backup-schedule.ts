import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { join } from 'path';
import {
  BackupScheduleUseCase,
  SqliteBackupScheduleRepository,
  type IBackupScheduleUseCase,
} from '@minecraft-docker/shared';
import { config } from '../config/index.js';
import { BackupSchedulerService } from '../services/backup-scheduler.js';
import {
  BackupScheduleListResponseSchema,
  BackupScheduleSchema,
  CreateBackupScheduleRequestSchema,
  UpdateBackupScheduleRequestSchema,
  ToggleBackupScheduleRequestSchema,
  ScheduleIdParamsSchema,
  ErrorResponseSchema,
  type CreateBackupScheduleRequest,
  type UpdateBackupScheduleRequest,
  type ToggleBackupScheduleRequest,
  type ScheduleIdParams,
} from '../schemas/backup-schedule.js';

// Route interfaces
interface CreateScheduleRoute {
  Body: CreateBackupScheduleRequest;
}

interface UpdateScheduleRoute {
  Body: UpdateBackupScheduleRequest;
  Params: ScheduleIdParams;
}

interface ToggleScheduleRoute {
  Body: ToggleBackupScheduleRequest;
  Params: ScheduleIdParams;
}

interface ScheduleIdRoute {
  Params: ScheduleIdParams;
}

/**
 * Backup schedule management routes plugin
 */
const backupSchedulePlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Initialize repository and use case
  const dbPath = join(config.mcctlRoot, 'data', 'backup-schedules.db');
  const repository = new SqliteBackupScheduleRepository(dbPath);
  const useCase: IBackupScheduleUseCase = new BackupScheduleUseCase(repository);

  // Initialize backup scheduler service
  const scheduler = new BackupSchedulerService(
    useCase,
    config.platformPath,
    fastify.log
  );
  await scheduler.initialize();

  // Store scheduler on fastify instance for graceful shutdown
  fastify.addHook('onClose', async () => {
    scheduler.shutdown();
    repository.close();
  });

  /**
   * GET /api/backup/schedules
   * List all backup schedules
   */
  fastify.get('/api/backup/schedules', {
    schema: {
      description: 'List all backup schedules',
      tags: ['backup'],
      response: {
        200: BackupScheduleListResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (_request, reply) => {
    try {
      const schedules = await useCase.findAll();
      return reply.send({
        schedules: schedules.map((s) => s.toJSON()),
        total: schedules.length,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to list backup schedules');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to list backup schedules',
      });
    }
  });

  /**
   * GET /api/backup/schedules/:id
   * Get a specific backup schedule
   */
  fastify.get<ScheduleIdRoute>('/api/backup/schedules/:id', {
    schema: {
      description: 'Get a backup schedule by ID',
      tags: ['backup'],
      params: ScheduleIdParamsSchema,
      response: {
        200: BackupScheduleSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const schedule = await useCase.findById(request.params.id);
      if (!schedule) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Schedule not found: ${request.params.id}`,
        });
      }
      return reply.send(schedule.toJSON());
    } catch (error) {
      fastify.log.error(error, 'Failed to get backup schedule');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to get backup schedule',
      });
    }
  });

  /**
   * POST /api/backup/schedules
   * Create a new backup schedule
   */
  fastify.post<CreateScheduleRoute>('/api/backup/schedules', {
    schema: {
      description: 'Create a new backup schedule',
      tags: ['backup'],
      body: CreateBackupScheduleRequestSchema,
      response: {
        201: BackupScheduleSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<CreateScheduleRoute>, reply: FastifyReply) => {
    try {
      const schedule = await useCase.create(request.body);

      // Register cron task if enabled
      if (schedule.enabled) {
        scheduler.registerTask(schedule);
      }

      return reply.code(201).send(schedule.toJSON());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fastify.log.error(error, 'Failed to create backup schedule');

      if (message.includes('Invalid') || message.includes('cannot be empty')) {
        return reply.code(400).send({
          error: 'BadRequest',
          message,
        });
      }

      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to create backup schedule',
      });
    }
  });

  /**
   * PUT /api/backup/schedules/:id
   * Update a backup schedule
   */
  fastify.put<UpdateScheduleRoute>('/api/backup/schedules/:id', {
    schema: {
      description: 'Update a backup schedule',
      tags: ['backup'],
      params: ScheduleIdParamsSchema,
      body: UpdateBackupScheduleRequestSchema,
      response: {
        200: BackupScheduleSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<UpdateScheduleRoute>, reply: FastifyReply) => {
    try {
      const schedule = await useCase.update(request.params.id, request.body);

      // Reload scheduler to pick up changes
      await scheduler.reload();

      return reply.send(schedule.toJSON());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('not found')) {
        return reply.code(404).send({
          error: 'NotFound',
          message,
        });
      }

      fastify.log.error(error, 'Failed to update backup schedule');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to update backup schedule',
      });
    }
  });

  /**
   * PATCH /api/backup/schedules/:id/toggle
   * Enable or disable a backup schedule
   */
  fastify.patch<ToggleScheduleRoute>('/api/backup/schedules/:id/toggle', {
    schema: {
      description: 'Enable or disable a backup schedule',
      tags: ['backup'],
      params: ScheduleIdParamsSchema,
      body: ToggleBackupScheduleRequestSchema,
      response: {
        200: BackupScheduleSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<ToggleScheduleRoute>, reply: FastifyReply) => {
    try {
      const { enabled } = request.body;
      const schedule = enabled
        ? await useCase.enable(request.params.id)
        : await useCase.disable(request.params.id);

      // Update scheduler
      if (enabled) {
        scheduler.registerTask(schedule);
      } else {
        scheduler.unregisterTask(schedule.id);
      }

      return reply.send(schedule.toJSON());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('not found')) {
        return reply.code(404).send({
          error: 'NotFound',
          message,
        });
      }

      fastify.log.error(error, 'Failed to toggle backup schedule');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to toggle backup schedule',
      });
    }
  });

  /**
   * DELETE /api/backup/schedules/:id
   * Delete a backup schedule
   */
  fastify.delete<ScheduleIdRoute>('/api/backup/schedules/:id', {
    schema: {
      description: 'Delete a backup schedule',
      tags: ['backup'],
      params: ScheduleIdParamsSchema,
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' } } },
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<ScheduleIdRoute>, reply: FastifyReply) => {
    try {
      // Unregister cron task
      scheduler.unregisterTask(request.params.id);

      await useCase.remove(request.params.id);

      return reply.send({
        success: true,
        message: 'Schedule deleted',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('not found')) {
        return reply.code(404).send({
          error: 'NotFound',
          message,
        });
      }

      fastify.log.error(error, 'Failed to delete backup schedule');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to delete backup schedule',
      });
    }
  });
};

export default fp(backupSchedulePlugin, {
  name: 'backup-schedule-routes',
  fastify: '5.x',
});

export { backupSchedulePlugin };
