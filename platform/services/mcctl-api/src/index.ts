#!/usr/bin/env node

import { buildApp } from './app.js';
import { config } from './config/index.js';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({
      port: config.port,
      host: config.host,
    });

    app.log.info(`Server listening on http://${config.host}:${config.port}`);
    app.log.info(`Health check: http://${config.host}:${config.port}/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
