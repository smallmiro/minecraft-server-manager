#!/usr/bin/env node

const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

const port = process.env.PORT || '5000';
const hostname = process.env.HOSTNAME || '0.0.0.0';

const packageRoot = path.join(__dirname, '..');

// Next.js standalone in monorepo preserves the full project path structure
// Try monorepo path first, then flat path for non-monorepo builds
const monoRepoServerPath = path.join(
  packageRoot,
  '.next',
  'standalone',
  'platform',
  'services',
  'mcctl-console',
  'server.js',
);
const flatServerPath = path.join(packageRoot, '.next', 'standalone', 'server.js');

const serverPath = fs.existsSync(monoRepoServerPath)
  ? monoRepoServerPath
  : flatServerPath;

if (!fs.existsSync(serverPath)) {
  console.error('Error: server.js not found. Searched paths:');
  console.error('  -', monoRepoServerPath);
  console.error('  -', flatServerPath);
  console.error('Run "next build" first to generate the standalone output.');
  process.exit(1);
}

const child = fork(serverPath, {
  env: {
    ...process.env,
    PORT: port,
    HOSTNAME: hostname,
  },
  cwd: path.dirname(serverPath),
  stdio: 'inherit',
});

child.on('error', (err) => {
  console.error('Failed to start mcctl-console:', err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
