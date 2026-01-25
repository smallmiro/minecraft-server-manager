import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from './config/index.js';
import authPlugin from './plugins/auth.js';
import swaggerPlugin from './plugins/swagger.js';
import serversRoutes from './routes/servers.js';
import serverActionsRoutes from './routes/servers/actions.js';
import consoleRoutes from './routes/console.js';

export interface BuildAppOptions {
  logger?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? config.nodeEnv !== 'test' ? {
      level: config.logLevel,
    } : false,
  });

  // Register security plugins
  await app.register(cors, {
    origin: true, // Allow all origins in development, configure for production
    credentials: true,
  });

  await app.register(helmet, {
    // Helmet default security headers
    contentSecurityPolicy: config.nodeEnv === 'production',
  });

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

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });


  // Register API routes
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
