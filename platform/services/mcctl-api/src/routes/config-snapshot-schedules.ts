import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { join } from 'path';
import {
  ConfigSnapshotScheduleUseCaseImpl,
  SqliteConfigSnapshotScheduleRepository,
  SqliteConfigSnapshotRepository,
  ConfigSnapshotDatabase,
  ConfigSnapshotSchedulerService,
  type IConfigSnapshotScheduleUseCase,
} from '@minecraft-docker/shared';
import { AuditActionEnum } from '@minecraft-docker/shared';
import { config } from '../config/index.js';
import { writeAuditLog } from '../services/audit-log-service.js';
import { getConfigSnapshotUseCase } from '../services/config-snapshot-service.js';
import {
  ConfigSnapshotScheduleSchema,
  ConfigSnapshotScheduleListResponseSchema,
  ScheduleIdParamsSchema,
  ListSchedulesQuerySchema,
  CreateConfigSnapshotScheduleRequestSchema,
  UpdateConfigSnapshotScheduleRequestSchema,
  ToggleConfigSnapshotScheduleRequestSchema,
  ErrorResponseSchema,
  type ScheduleIdParams,
  type ListSchedulesQuery,
  type CreateConfigSnapshotScheduleRequest,
  type UpdateConfigSnapshotScheduleRequest,
  type ToggleConfigSnapshotScheduleRequest,
} from '../schemas/config-snapshot-schedule.js';

// Route generic interfaces
interface ListSchedulesRoute {
  Querystring: ListSchedulesQuery;
}

interface GetScheduleRoute {
  Params: ScheduleIdParams;
}

interface CreateScheduleRoute {
  Body: CreateConfigSnapshotScheduleRequest;
}

interface UpdateScheduleRoute {
  Params: ScheduleIdParams;
  Body: UpdateConfigSnapshotScheduleRequest;
}

interface ToggleScheduleRoute {
  Params: ScheduleIdParams;
  Body: ToggleConfigSnapshotScheduleRequest;
}

interface DeleteScheduleRoute {
  Params: ScheduleIdParams;
}

/**
 * Config snapshot schedule management routes plugin
 */
const configSnapshotSchedulesPlugin: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Initialize repository and use case via shared ConfigSnapshotDatabase
  const dbPath = join(config.mcctlRoot, 'data', 'config-snapshots.db');
  const database = new ConfigSnapshotDatabase(dbPath);
  const scheduleRepository = new SqliteConfigSnapshotScheduleRepository(database);
  const snapshotRepository = new SqliteConfigSnapshotRepository(database);
  const useCase: IConfigSnapshotScheduleUseCase =
    new ConfigSnapshotScheduleUseCaseImpl(scheduleRepository);

  // Initialize config snapshot scheduler service
  const snapshotUseCase = getConfigSnapshotUseCase();
  const scheduler = new ConfigSnapshotSchedulerService(
    snapshotUseCase,
    useCase,
    snapshotRepository,
    fastify.log
  );
  await scheduler.initialize();

  fastify.addHook('onClose', async () => {
    scheduler.shutdown();
    database.close();
  });

  /**
   * GET /api/config-snapshot-schedules
   * List all config snapshot schedules (optionally filter by server)
   */
  fastify.get<ListSchedulesRoute>(
    '/api/config-snapshot-schedules',
    {
      schema: {
        description: 'List all config snapshot schedules',
        tags: ['config-snapshot-schedules'],
        querystring: ListSchedulesQuerySchema,
        response: {
          200: ConfigSnapshotScheduleListResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<ListSchedulesRoute>,
      reply: FastifyReply
    ) => {
      try {
        const { serverName } = request.query;

        const schedules = serverName
          ? await useCase.findByServer(serverName)
          : await useCase.findAll();

        return reply.send({
          schedules: schedules.map((s) => s.toJSON()),
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to list config snapshot schedules');
        return reply.code(500).send({
          error: 'InternalServerError',
          message: 'Failed to list config snapshot schedules',
        });
      }
    }
  );

  /**
   * POST /api/config-snapshot-schedules
   * Create a new config snapshot schedule
   */
  fastify.post<CreateScheduleRoute>(
    '/api/config-snapshot-schedules',
    {
      schema: {
        description: 'Create a new config snapshot schedule',
        tags: ['config-snapshot-schedules'],
        body: CreateConfigSnapshotScheduleRequestSchema,
        response: {
          201: ConfigSnapshotScheduleSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<CreateScheduleRoute>,
      reply: FastifyReply
    ) => {
      const { serverName, name, cronExpression, retentionCount, enabled } =
        request.body;

      try {
        const schedule = await useCase.create(
          serverName,
          name,
          cronExpression,
          retentionCount
        );

        // If enabled is explicitly false, disable after creation
        let finalSchedule = schedule;
        if (enabled === false) {
          await useCase.disable(schedule.id);
          // Re-fetch to get updated entity
          const all = await useCase.findAll();
          const updated = all.find((s) => s.id === schedule.id);
          if (updated) {
            finalSchedule = updated;
          }
        }

        // Register schedule with scheduler
        scheduler.addSchedule(finalSchedule);

        await writeAuditLog({
          action: AuditActionEnum.CONFIG_SNAPSHOT_SCHEDULE_CREATE,
          actor: 'api:console',
          targetType: 'config-snapshot-schedule',
          targetName: name,
          status: 'success',
          details: {
            serverName,
            cronExpression,
            retentionCount: finalSchedule.retentionCount,
          },
        });

        return reply.code(201).send(finalSchedule.toJSON());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        fastify.log.error(error, 'Failed to create config snapshot schedule');

        await writeAuditLog({
          action: AuditActionEnum.CONFIG_SNAPSHOT_SCHEDULE_CREATE,
          actor: 'api:console',
          targetType: 'config-snapshot-schedule',
          targetName: name ?? 'unknown',
          status: 'failure',
          details: null,
          errorMessage: message,
        });

        if (
          message.includes('Invalid') ||
          message.includes('cannot be empty') ||
          message.includes('must be')
        ) {
          return reply.code(400).send({
            error: 'BadRequest',
            message,
          });
        }

        return reply.code(500).send({
          error: 'InternalServerError',
          message: 'Failed to create config snapshot schedule',
        });
      }
    }
  );

  /**
   * GET /api/config-snapshot-schedules/:id
   * Get a specific config snapshot schedule
   */
  fastify.get<GetScheduleRoute>(
    '/api/config-snapshot-schedules/:id',
    {
      schema: {
        description: 'Get a config snapshot schedule by ID',
        tags: ['config-snapshot-schedules'],
        params: ScheduleIdParamsSchema,
        response: {
          200: ConfigSnapshotScheduleSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<GetScheduleRoute>,
      reply: FastifyReply
    ) => {
      try {
        const schedules = await useCase.findAll();
        const schedule = schedules.find((s) => s.id === request.params.id);

        if (!schedule) {
          return reply.code(404).send({
            error: 'NotFound',
            message: `Schedule not found: ${request.params.id}`,
          });
        }

        return reply.send(schedule.toJSON());
      } catch (error) {
        fastify.log.error(error, 'Failed to get config snapshot schedule');
        return reply.code(500).send({
          error: 'InternalServerError',
          message: 'Failed to get config snapshot schedule',
        });
      }
    }
  );

  /**
   * PUT /api/config-snapshot-schedules/:id
   * Update a config snapshot schedule
   */
  fastify.put<UpdateScheduleRoute>(
    '/api/config-snapshot-schedules/:id',
    {
      schema: {
        description: 'Update a config snapshot schedule',
        tags: ['config-snapshot-schedules'],
        params: ScheduleIdParamsSchema,
        body: UpdateConfigSnapshotScheduleRequestSchema,
        response: {
          200: ConfigSnapshotScheduleSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<UpdateScheduleRoute>,
      reply: FastifyReply
    ) => {
      try {
        const schedule = await useCase.update(request.params.id, {
          name: request.body.name,
          cronExpression: request.body.cronExpression as unknown as undefined,
          retentionCount: request.body.retentionCount,
        });

        // Update scheduler with modified schedule
        scheduler.updateSchedule(schedule);

        await writeAuditLog({
          action: AuditActionEnum.CONFIG_SNAPSHOT_SCHEDULE_UPDATE,
          actor: 'api:console',
          targetType: 'config-snapshot-schedule',
          targetName: schedule.name,
          status: 'success',
          details: { scheduleId: request.params.id },
        });

        return reply.send(schedule.toJSON());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        await writeAuditLog({
          action: AuditActionEnum.CONFIG_SNAPSHOT_SCHEDULE_UPDATE,
          actor: 'api:console',
          targetType: 'config-snapshot-schedule',
          targetName: request.params.id,
          status: 'failure',
          details: null,
          errorMessage: message,
        });

        if (message.includes('not found') || message.includes('Schedule not found')) {
          return reply.code(404).send({
            error: 'NotFound',
            message,
          });
        }

        if (
          message.includes('Invalid') ||
          message.includes('cannot be empty') ||
          message.includes('must be')
        ) {
          return reply.code(400).send({
            error: 'BadRequest',
            message,
          });
        }

        fastify.log.error(error, 'Failed to update config snapshot schedule');
        return reply.code(500).send({
          error: 'InternalServerError',
          message: 'Failed to update config snapshot schedule',
        });
      }
    }
  );

  /**
   * PATCH /api/config-snapshot-schedules/:id/toggle
   * Enable or disable a config snapshot schedule
   */
  fastify.patch<ToggleScheduleRoute>(
    '/api/config-snapshot-schedules/:id/toggle',
    {
      schema: {
        description: 'Enable or disable a config snapshot schedule',
        tags: ['config-snapshot-schedules'],
        params: ScheduleIdParamsSchema,
        body: ToggleConfigSnapshotScheduleRequestSchema,
        response: {
          200: ConfigSnapshotScheduleSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<ToggleScheduleRoute>,
      reply: FastifyReply
    ) => {
      const { enabled } = request.body;

      try {
        // Verify schedule exists first
        const schedules = await useCase.findAll();
        const existing = schedules.find((s) => s.id === request.params.id);

        if (!existing) {
          return reply.code(404).send({
            error: 'NotFound',
            message: `Schedule not found: ${request.params.id}`,
          });
        }

        if (enabled) {
          await useCase.enable(request.params.id);
        } else {
          await useCase.disable(request.params.id);
        }

        // Fetch updated schedule
        const updatedSchedules = await useCase.findAll();
        const updated = updatedSchedules.find((s) => s.id === request.params.id);

        // Update scheduler: add or remove cron job based on toggle
        if (updated) {
          scheduler.updateSchedule(updated);
        }

        await writeAuditLog({
          action: enabled
            ? AuditActionEnum.CONFIG_SNAPSHOT_SCHEDULE_ENABLE
            : AuditActionEnum.CONFIG_SNAPSHOT_SCHEDULE_DISABLE,
          actor: 'api:console',
          targetType: 'config-snapshot-schedule',
          targetName: existing.name,
          status: 'success',
          details: { enabled },
        });

        return reply.send(updated!.toJSON());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        await writeAuditLog({
          action: enabled
            ? AuditActionEnum.CONFIG_SNAPSHOT_SCHEDULE_ENABLE
            : AuditActionEnum.CONFIG_SNAPSHOT_SCHEDULE_DISABLE,
          actor: 'api:console',
          targetType: 'config-snapshot-schedule',
          targetName: request.params.id,
          status: 'failure',
          details: null,
          errorMessage: message,
        });

        if (message.includes('not found')) {
          return reply.code(404).send({
            error: 'NotFound',
            message,
          });
        }

        fastify.log.error(error, 'Failed to toggle config snapshot schedule');
        return reply.code(500).send({
          error: 'InternalServerError',
          message: 'Failed to toggle config snapshot schedule',
        });
      }
    }
  );

  /**
   * DELETE /api/config-snapshot-schedules/:id
   * Delete a config snapshot schedule
   * Note: Does NOT delete associated snapshots (they remain as orphans)
   */
  fastify.delete<DeleteScheduleRoute>(
    '/api/config-snapshot-schedules/:id',
    {
      schema: {
        description:
          'Delete a config snapshot schedule. Associated snapshots are not deleted.',
        tags: ['config-snapshot-schedules'],
        params: ScheduleIdParamsSchema,
        response: {
          204: { type: 'null' },
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<DeleteScheduleRoute>,
      reply: FastifyReply
    ) => {
      try {
        // Verify schedule exists and get name for audit log
        const schedules = await useCase.findAll();
        const existing = schedules.find((s) => s.id === request.params.id);

        if (!existing) {
          return reply.code(404).send({
            error: 'NotFound',
            message: `Schedule not found: ${request.params.id}`,
          });
        }

        const scheduleName = existing.name;

        // Remove schedule from scheduler before deleting
        scheduler.removeSchedule(request.params.id);

        await useCase.delete(request.params.id);

        await writeAuditLog({
          action: AuditActionEnum.CONFIG_SNAPSHOT_SCHEDULE_DELETE,
          actor: 'api:console',
          targetType: 'config-snapshot-schedule',
          targetName: scheduleName,
          status: 'success',
          details: { scheduleId: request.params.id },
        });

        return reply.code(204).send();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        await writeAuditLog({
          action: AuditActionEnum.CONFIG_SNAPSHOT_SCHEDULE_DELETE,
          actor: 'api:console',
          targetType: 'config-snapshot-schedule',
          targetName: request.params.id,
          status: 'failure',
          details: null,
          errorMessage: message,
        });

        fastify.log.error(error, 'Failed to delete config snapshot schedule');
        return reply.code(500).send({
          error: 'InternalServerError',
          message: 'Failed to delete config snapshot schedule',
        });
      }
    }
  );
};

export default fp(configSnapshotSchedulesPlugin, {
  name: 'config-snapshot-schedules-routes',
  fastify: '5.x',
});

export { configSnapshotSchedulesPlugin };
