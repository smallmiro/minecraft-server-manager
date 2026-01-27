# @minecraft-docker/mcctl-api

REST API server for managing Docker Minecraft servers.

## Installation

### Native Execution (Recommended)

The recommended way to run mcctl-api is natively with Node.js and PM2.

#### Prerequisites

- Node.js 20+
- pnpm (or npm/yarn)
- PM2 (for production deployment)
- Docker and Docker Compose (for managing Minecraft servers)

#### Setup

```bash
# From the project root
pnpm install
pnpm --filter @minecraft-docker/mcctl-api build

# Start in development mode
cd platform/services/mcctl-api
pnpm dev

# Or start in production mode
pnpm start
```

#### PM2 Deployment

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
cd platform/services/mcctl-api
pnpm start:pm2

# Other PM2 commands
pnpm stop:pm2      # Stop the service
pnpm restart:pm2   # Restart the service
pnpm logs:pm2      # View logs
```

### Docker (Legacy)

Docker deployment is deprecated but still supported for legacy installations.

```bash
# From project root
docker build -f platform/services/mcctl-api/docker/Dockerfile -t mcctl-api .

docker run -d \
  --name mcctl-api \
  -p 3001:3001 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/minecraft-servers:/data \
  -e MCCTL_ROOT=/data \
  mcctl-api
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3001` |
| `HOST` | Bind address | `0.0.0.0` |
| `NODE_ENV` | Environment (`development`, `production`, `test`) | `development` |
| `LOG_LEVEL` | Log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`) | `debug` (dev) / `info` (prod) |
| `MCCTL_ROOT` | Root directory for mcctl data | `~/minecraft-servers` |
| `PLATFORM_PATH` | Platform directory with docker-compose.yml | Same as `MCCTL_ROOT` |
| `AUTH_MODE` | Authentication mode | `disabled` (dev) / `api-key` (prod) |
| `AUTH_API_KEY` | API key for authentication | - |
| `AUTH_IP_WHITELIST` | Comma-separated IP whitelist | - |
| `SWAGGER_ENABLED` | Enable Swagger UI in production | `false` |

### Authentication Modes

- `disabled`: No authentication (development only)
- `api-key`: Require X-API-Key header
- `ip-whitelist`: Restrict access by IP address
- `basic`: HTTP Basic authentication
- `combined`: Require both API key and IP whitelist

### Example .env

```env
PORT=3001
HOST=0.0.0.0
NODE_ENV=production
LOG_LEVEL=info
MCCTL_ROOT=/home/user/minecraft-servers
AUTH_MODE=api-key
AUTH_API_KEY=your-secret-api-key
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/servers` - List all servers
- `GET /api/servers/:name` - Get server details
- `POST /api/servers/:name/start` - Start server
- `POST /api/servers/:name/stop` - Stop server
- `POST /api/servers/:name/restart` - Restart server
- `GET /api/servers/:name/logs` - Get server logs
- `POST /api/servers/:name/exec` - Execute RCON command
- `GET /api/worlds` - List all worlds
- `POST /api/console/exec` - Execute RCON command

## Graceful Shutdown

The API server handles graceful shutdown for:
- `SIGTERM` - Sent by PM2 and container orchestrators
- `SIGINT` - Sent by Ctrl+C

This ensures:
- Active requests are completed
- Connections are properly closed
- Resources are cleaned up

## Development

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Start development server with hot reload
pnpm dev
```

## Documentation

API documentation is available at `/docs` when running in development mode or when `SWAGGER_ENABLED=true`.
