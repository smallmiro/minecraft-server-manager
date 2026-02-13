import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { serverExists, AuditActionEnum, ModSourceFactory } from '@minecraft-docker/shared';
import '@minecraft-docker/mod-source-modrinth';
import { writeAuditLog } from '../../services/audit-log-service.js';
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

// ============================================================
// Helpers
// ============================================================

function getConfigPath(serverName: string): string {
  return join(config.platformPath, 'servers', serverName, 'config.env');
}

function parseEnvFile(content: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      result.set(line.substring(0, eqIndex).trim(), line.substring(eqIndex + 1).trim());
    }
  }
  return result;
}

function updateEnvFile(content: string, key: string, value: string): string {
  const lines = content.split('\n');
  let found = false;
  const result = lines.map((line) => {
    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      const lineKey = line.substring(0, eqIndex).trim();
      if (lineKey === key) {
        found = true;
        return `${key}=${value}`;
      }
    }
    return line;
  });
  if (!found) {
    result.push(`${key}=${value}`);
  }
  return result.join('\n');
}

function parseModList(value: string | undefined): string[] {
  if (!value || !value.trim()) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

// ============================================================
// Plugin Definition
// ============================================================

const modsPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
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

      const configPath = getConfigPath(name);
      if (!existsSync(configPath)) {
        return reply.send({ mods: {} });
      }

      const content = readFileSync(configPath, 'utf-8');
      const envMap = parseEnvFile(content);

      const mods: Record<string, string[]> = {};

      // Check all registered sources for their env keys
      for (const adapter of ModSourceFactory.getAllAdapters()) {
        const envKey = adapter.getEnvKey();
        const value = envMap.get(envKey);
        if (value) {
          mods[adapter.sourceName] = parseModList(value);
        }
      }

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

      const sourceName = source || ModSourceFactory.getDefaultSource();
      const adapter = ModSourceFactory.get(sourceName);
      const envKey = adapter.getEnvKey();

      const configPath = getConfigPath(name);
      if (!existsSync(configPath)) {
        return reply.code(404).send({ error: 'NotFound', message: `Configuration for server '${name}' not found` });
      }

      const content = readFileSync(configPath, 'utf-8');
      const envMap = parseEnvFile(content);
      const existing = parseModList(envMap.get(envKey));

      // Add new slugs (deduplicate)
      const added: string[] = [];
      for (const slug of slugs) {
        if (!existing.includes(slug)) {
          existing.push(slug);
          added.push(slug);
        }
      }

      const updatedContent = updateEnvFile(content, envKey, existing.join(','));
      writeFileSync(configPath, updatedContent, 'utf-8');

      await writeAuditLog({
        action: AuditActionEnum.MOD_ADD,
        actor: 'api:console',
        targetType: 'server',
        targetName: name,
        details: { slugs: added, source: sourceName },
        status: 'success',
      });

      fastify.log.info({ server: name, added, source: sourceName }, 'Mods added');

      return reply.send({ success: true, added, mods: existing });
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

      const configPath = getConfigPath(name);
      if (!existsSync(configPath)) {
        return reply.code(404).send({ error: 'NotFound', message: `Configuration for server '${name}' not found` });
      }

      const content = readFileSync(configPath, 'utf-8');
      const envMap = parseEnvFile(content);

      let removed = false;
      let updatedContent = content;
      let sourceName = 'unknown';

      // Search across all registered sources
      for (const adapter of ModSourceFactory.getAllAdapters()) {
        const envKey = adapter.getEnvKey();
        const value = envMap.get(envKey);
        if (!value) continue;

        const mods = parseModList(value);
        const index = mods.indexOf(slug);
        if (index !== -1) {
          mods.splice(index, 1);
          updatedContent = updateEnvFile(updatedContent, envKey, mods.join(','));
          removed = true;
          sourceName = adapter.sourceName;
          break;
        }
      }

      if (!removed) {
        return reply.code(404).send({ error: 'NotFound', message: `Mod '${slug}' not found in server configuration` });
      }

      writeFileSync(configPath, updatedContent, 'utf-8');

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
