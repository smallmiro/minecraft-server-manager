import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { serverExists, AuditActionEnum, ModSourceFactory } from '@minecraft-docker/shared';
import '@minecraft-docker/mod-source-modrinth';
import { writeAuditLog } from '../../services/audit-log-service.js';
import { createModConfigService } from '../../services/ModConfigService.js';
import { ErrorResponseSchema, ServerNameParamsSchema, type ServerNameParams } from '../../schemas/server.js';
import { config } from '../../config/index.js';

// ============================================================
// Types
// ============================================================

interface ModListRoute {
  Params: ServerNameParams;
}

interface AddModsRoute {
  Params: ServerNameParams;
  Body: { slugs: string[]; source?: string };
}

interface RemoveModRoute {
  Params: ServerNameParams & { slug: string };
}

interface SearchModsRoute {
  Querystring: { q: string; limit?: number; offset?: number };
}

interface GetProjectsRoute {
  Querystring: { slugs: string; source?: string };
}

// ============================================================
// Plugin Definition
// ============================================================

const modsPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const modConfigService = createModConfigService(config.platformPath);

  /**
   * GET /api/servers/:name/mods
   * List installed mods from config.env
   */
  fastify.get<ModListRoute>('/api/servers/:name/mods', {
    schema: {
      description: 'List installed mods for a server',
      tags: ['servers', 'mods'],
      params: ServerNameParamsSchema,
      response: {
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<ModListRoute>, reply: FastifyReply) => {
    const { name } = request.params;

    try {
      if (!serverExists(name)) {
        return reply.code(404).send({ error: 'NotFound', message: `Server '${name}' not found` });
      }

      const mods = modConfigService.getInstalledMods(name);
      return reply.send({ mods });
    } catch (error) {
      fastify.log.error(error, 'Failed to list mods');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to list mods' });
    }
  });

  /**
   * POST /api/servers/:name/mods
   * Add mods to server config
   */
  fastify.post<AddModsRoute>('/api/servers/:name/mods', {
    schema: {
      description: 'Add mods to a server',
      tags: ['servers', 'mods'],
      params: ServerNameParamsSchema,
      response: {
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<AddModsRoute>, reply: FastifyReply) => {
    const { name } = request.params;
    const { slugs, source } = request.body;

    try {
      if (!serverExists(name)) {
        return reply.code(404).send({ error: 'NotFound', message: `Server '${name}' not found` });
      }

      if (!slugs || !Array.isArray(slugs) || slugs.length === 0) {
        return reply.code(400).send({ error: 'BadRequest', message: 'slugs array is required and must not be empty' });
      }

      if (!modConfigService.configExists(name)) {
        return reply.code(404).send({ error: 'NotFound', message: `Configuration for server '${name}' not found` });
      }

      const sourceName = source || ModSourceFactory.getDefaultSource();
      const { added, mods } = modConfigService.addMods(name, slugs, sourceName);

      await writeAuditLog({
        action: AuditActionEnum.MOD_ADD,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        details: { slugs: added, source: sourceName },
        status: 'success',
      });

      fastify.log.info({ server: name, added, source: sourceName }, 'Mods added');

      return reply.send({ success: true, added, mods });
    } catch (error) {
      await writeAuditLog({
        action: AuditActionEnum.MOD_ADD,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        details: { slugs, source },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      fastify.log.error(error, 'Failed to add mods');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to add mods' });
    }
  });

  /**
   * DELETE /api/servers/:name/mods/:slug
   * Remove a mod from server config
   */
  fastify.delete<RemoveModRoute>('/api/servers/:name/mods/:slug', {
    schema: {
      description: 'Remove a mod from a server',
      tags: ['servers', 'mods'],
      response: {
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<RemoveModRoute>, reply: FastifyReply) => {
    const { name, slug } = request.params;

    try {
      if (!serverExists(name)) {
        return reply.code(404).send({ error: 'NotFound', message: `Server '${name}' not found` });
      }

      if (!modConfigService.configExists(name)) {
        return reply.code(404).send({ error: 'NotFound', message: `Configuration for server '${name}' not found` });
      }

      const { removed, sourceName } = modConfigService.removeMod(name, slug);

      if (!removed) {
        return reply.code(404).send({ error: 'NotFound', message: `Mod '${slug}' not found in server configuration` });
      }

      await writeAuditLog({
        action: AuditActionEnum.MOD_REMOVE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        details: { slug, source: sourceName },
        status: 'success',
      });

      fastify.log.info({ server: name, slug, source: sourceName }, 'Mod removed');

      return reply.send({ success: true, removed: slug });
    } catch (error) {
      await writeAuditLog({
        action: AuditActionEnum.MOD_REMOVE,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        details: { slug },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      fastify.log.error(error, 'Failed to remove mod');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to remove mod' });
    }
  });

  /**
   * GET /api/mods/projects
   * Get project details for multiple slugs (batch)
   */
  fastify.get<GetProjectsRoute>('/api/mods/projects', {
    schema: {
      description: 'Get project details for multiple mod slugs',
      tags: ['mods'],
      response: {
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<GetProjectsRoute>, reply: FastifyReply) => {
    const { slugs: slugsParam, source: sourceName } = request.query;

    try {
      if (!slugsParam || !slugsParam.trim()) {
        return reply.code(400).send({ error: 'BadRequest', message: 'Query parameter "slugs" is required' });
      }

      const slugs = slugsParam.split(',').map(s => s.trim()).filter(Boolean);
      if (slugs.length === 0) {
        return reply.code(400).send({ error: 'BadRequest', message: 'At least one slug is required' });
      }

      const source = ModSourceFactory.get(sourceName || 'modrinth');

      // Use batch getProjects if available, otherwise fallback to individual getProject
      const projects: Record<string, {
        slug: string;
        title: string;
        description: string;
        downloads: number;
        iconUrl: string | null;
        author: string;
        categories: string[];
        sourceUrl: string;
      } | null> = {};

      if (typeof source.getProjects === 'function') {
        const projectMap = await source.getProjects(slugs);
        for (const slug of slugs) {
          const p = projectMap.get(slug);
          projects[slug] = p ? {
            slug: p.slug,
            title: p.title,
            description: p.description,
            downloads: p.downloads,
            iconUrl: p.iconUrl,
            author: p.author,
            categories: p.categories,
            sourceUrl: `https://modrinth.com/mod/${p.slug}`,
          } : null;
        }
      } else {
        const results = await Promise.all(
          slugs.map(async (slug) => {
            const p = await source.getProject(slug);
            return { slug, project: p };
          })
        );
        for (const { slug, project: p } of results) {
          projects[slug] = p ? {
            slug: p.slug,
            title: p.title,
            description: p.description,
            downloads: p.downloads,
            iconUrl: p.iconUrl,
            author: p.author,
            categories: p.categories,
            sourceUrl: `https://modrinth.com/mod/${p.slug}`,
          } : null;
        }
      }

      return reply.send({ projects });
    } catch (error) {
      fastify.log.error(error, 'Failed to get mod projects');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to get mod projects' });
    }
  });

  /**
   * GET /api/mods/search
   * Search mods via Modrinth
   */
  fastify.get<SearchModsRoute>('/api/mods/search', {
    schema: {
      description: 'Search for mods on Modrinth',
      tags: ['mods'],
      response: {
        500: ErrorResponseSchema,
      },
    },
  }, async (request: FastifyRequest<SearchModsRoute>, reply: FastifyReply) => {
    const { q, limit, offset } = request.query;

    try {
      if (!q || !q.trim()) {
        return reply.code(400).send({ error: 'BadRequest', message: 'Query parameter "q" is required' });
      }

      const source = ModSourceFactory.get('modrinth');
      const result = await source.search(q, {
        limit: limit != null ? Number(limit) : 10,
        offset: offset != null ? Number(offset) : 0,
      });

      return reply.send(result);
    } catch (error) {
      fastify.log.error(error, 'Failed to search mods');
      return reply.code(500).send({ error: 'InternalServerError', message: 'Failed to search mods' });
    }
  });
};

// ============================================================
// Export
// ============================================================

export default fp(modsPlugin, {
  name: 'server-mods-routes',
  fastify: '5.x',
});

export { modsPlugin };
