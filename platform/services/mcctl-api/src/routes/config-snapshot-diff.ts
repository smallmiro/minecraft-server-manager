import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import {
  SnapshotDiffParamsSchema,
  SnapshotDiffResponseSchema,
  ErrorResponseSchema,
  type SnapshotDiffParams,
} from '../schemas/config-snapshot.js';
import {
  diffSnapshots,
  getSnapshotById,
} from '../services/config-snapshot-service.js';

// Route generic interface
interface DiffRoute {
  Params: SnapshotDiffParams;
}

/**
 * Config snapshot diff route plugin
 * Separate from server-scoped routes because diff compares across snapshots
 */
const configSnapshotDiffPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /api/config-snapshots/:id1/diff/:id2
   * Compare two config snapshots
   */
  fastify.get<DiffRoute>('/api/config-snapshots/:id1/diff/:id2', {
    schema: {
      description: 'Compare two config snapshots and show differences',
      tags: ['config-snapshots'],
      params: SnapshotDiffParamsSchema,
      response: {
        200: SnapshotDiffResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<DiffRoute>, reply: FastifyReply) => {
    const { id1, id2 } = request.params;

    try {
      // Verify both snapshots exist
      const snap1 = await getSnapshotById(id1);
      if (!snap1) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Config snapshot '${id1}' not found`,
        });
      }

      const snap2 = await getSnapshotById(id2);
      if (!snap2) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Config snapshot '${id2}' not found`,
        });
      }

      const diff = await diffSnapshots(id1, id2);
      return reply.send(diff.toJSON());
    } catch (error) {
      fastify.log.error(error, 'Failed to diff config snapshots');
      return reply.code(500).send({
        error: 'InternalServerError',
        message: 'Failed to compare config snapshots',
      });
    }
  });
};

export default fp(configSnapshotDiffPlugin, {
  name: 'config-snapshot-diff-routes',
  fastify: '5.x',
});

export { configSnapshotDiffPlugin };
