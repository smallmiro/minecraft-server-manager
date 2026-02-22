import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from './config/index.js';
import authPlugin from './plugins/auth.js';
import swaggerPlugin from './plugins/swagger.js';
import serversRoutes from './routes/servers.js';
import serverActionsRoutes from './routes/servers/actions.js';
import serverConfigRoutes from './routes/servers/config.js';
import serverHostnameRoutes from './routes/servers/hostnames.js';
import serverModsRoutes from './routes/servers/mods.js';
import serverFilesRoutes from './routes/servers/files.js';
import consoleRoutes from './routes/console.js';
import worldsRoutes from './routes/worlds.js';
import authRoutes from './routes/auth.js';
import routerRoutes from './routes/router.js';
import playersRoutes from './routes/players.js';
import backupRoutes from './routes/backup.js';
import backupScheduleRoutes from './routes/backup-schedule.js';
import auditLogsRoutes from './routes/audit-logs.js';
import playitRoutes from './routes/playit.js';
import configSnapshotsRoutes from './routes/servers/config-snapshots.js';
import configSnapshotDiffRoutes from './routes/config-snapshot-diff.js';
import { closeConfigSnapshotDatabase } from './services/config-snapshot-service.js';

export interface BuildAppOptions {
  logger?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? config.nodeEnv !== 'test' ? {
      level: config.logLevel,
    } : false,
  });

  // Register CORS - allow all origins
  await app.register(cors, {
    origin: '*',
  });

  // Only enable Helmet in production to avoid HTTPS issues in development
  if (config.nodeEnv === 'production') {
    await app.register(helmet, {
      contentSecurityPolicy: true,
    });
  }

  // Register authentication plugin
  await app.register(authPlugin, {
    config: config.auth,
  });

  // Register Swagger documentation (only in non-production or if explicitly enabled)
  if (config.nodeEnv !== 'production' || process.env['SWAGGER_ENABLED'] === 'true') {
    await app.register(swaggerPlugin, {
      title: 'mcctl-api',
      description: 'REST API for managing Docker Minecraft servers',
      version: '0.1.0',
      routePrefix: '/docs',
    });
  }

  // Register server routes
  await app.register(serversRoutes);
  await app.register(serverActionsRoutes);
  await app.register(serverConfigRoutes);
  await app.register(serverHostnameRoutes);
  await app.register(serverModsRoutes);
  await app.register(serverFilesRoutes);

  // Register router routes
  await app.register(routerRoutes);

  // Register player routes
  await app.register(playersRoutes);

  // Register backup routes
  await app.register(backupRoutes);
  await app.register(backupScheduleRoutes);

  // Register world routes
  await app.register(worldsRoutes);

  // Register audit log routes
  await app.register(auditLogsRoutes);

  // Register playit routes
  await app.register(playitRoutes);

  // Register config snapshot routes
  await app.register(configSnapshotsRoutes);
  await app.register(configSnapshotDiffRoutes);

  // Register onClose hook for config snapshot database cleanup
  app.addHook('onClose', async () => {
    closeConfigSnapshotDatabase();
  });

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });


  // Register API routes
  await app.register(authRoutes);
  await app.register(consoleRoutes);

  // Graceful shutdown handler
  const gracefulShutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await app.close();
      app.log.info('Server closed successfully');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return app;
}

export default buildApp;
