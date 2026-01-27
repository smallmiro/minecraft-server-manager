# mcctl-console

Web management console for Docker Minecraft servers built with Next.js 14.

## Features

- Server status dashboard
- Start/stop/restart servers
- View server logs
- User authentication via NextAuth.js
- Dark theme optimized for server management

## Requirements

- Node.js >= 18.0.0
- mcctl-api running on port 3001

## Installation

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.local.example .env.local

# Edit configuration
vim .env.local
```

## Development

```bash
# Start development server
pnpm dev

# Run linting
pnpm lint

# Run type checking
pnpm typecheck
```

## Production Build

### Option 1: Standard Next.js Start

```bash
# Build the application
pnpm build

# Start with Next.js
pnpm start
```

### Option 2: Standalone Build (Recommended for PM2)

The standalone build creates a self-contained output that includes only the necessary dependencies.

```bash
# Build the application
pnpm build

# Start standalone server
pnpm start:standalone

# Or directly with node
node .next/standalone/platform/services/mcctl-console/server.js
```

### Running with PM2

```bash
# Build first
pnpm build

# Start with PM2 (note: monorepo path in standalone)
pm2 start .next/standalone/platform/services/mcctl-console/server.js --name mcctl-console

# Or with environment variables
PORT=3000 HOSTNAME=0.0.0.0 pm2 start .next/standalone/platform/services/mcctl-console/server.js --name mcctl-console

# View logs
pm2 logs mcctl-console

# Monitor
pm2 monit
```

### PM2 Ecosystem Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'mcctl-console',
    script: '.next/standalone/platform/services/mcctl-console/server.js',
    cwd: '/path/to/mcctl-console',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOSTNAME: '0.0.0.0',
      NEXTAUTH_SECRET: 'your-secret-key',
      NEXTAUTH_URL: 'http://localhost:3000',
      MCCTL_API_URL: 'http://localhost:3001',
    },
  }],
};
```

Then start with:

```bash
pm2 start ecosystem.config.js
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXTAUTH_SECRET` | Yes | - | JWT encryption secret |
| `NEXTAUTH_URL` | Yes | `http://localhost:3000` | Base URL for auth callbacks |
| `MCCTL_API_URL` | No | `http://localhost:3001` | Backend API URL |
| `INTERNAL_API_KEY` | No | `internal-dev-key` | API key for console-to-API auth |
| `NODE_ENV` | No | `development` | Environment mode |
| `PORT` | No | `3000` | Server port |
| `HOSTNAME` | No | `0.0.0.0` | Hostname binding |

## Health Check

The application provides a health check endpoint for monitoring:

```bash
curl http://localhost:3000/api/health
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-27T10:00:00.000Z",
  "service": "mcctl-console",
  "version": "0.1.0",
  "uptime": {
    "seconds": 3600,
    "formatted": "1h 0m 0s"
  },
  "environment": "production",
  "node": "v20.10.0"
}
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── auth/           # NextAuth.js routes
│   │   ├── health/         # Health check endpoint
│   │   └── proxy/          # BFF proxy to mcctl-api
│   ├── login/              # Login page
│   ├── servers/            # Server management pages
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Dashboard
├── components/             # React components
│   ├── providers/          # Context providers
│   ├── server/             # Server-related components
│   └── ui/                 # UI primitives
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities and configs
│   ├── api-client.ts       # API client wrapper
│   ├── auth.ts             # NextAuth configuration
│   └── utils.ts            # Helper functions
└── types/                  # TypeScript definitions
```

## License

Apache-2.0
