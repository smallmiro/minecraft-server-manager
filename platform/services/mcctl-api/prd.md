# PRD: mcctl-api - REST API Service

## Parent Document
- [Project PRD](../../../prd.md) - Section 10

## 1. Overview

### 1.1 Purpose
Internal REST API service for Minecraft server management. Provides the same functionality as mcctl CLI via HTTP API.

### 1.2 Scope
- Server management API (create, delete, start, stop)
- World management API (list, assign, release)
- Player management API (whitelist, ban, kick, OP)
- Backup API (push, restore, history)
- Health check API

### 1.3 Non-Goals
- User interface (handled by mcctl-console)
- User session management (handled by mcctl-console)
- Direct client access (uses BFF pattern)

## 2. Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 18+ |
| Framework | Fastify | 4.x |
| Language | TypeScript | 5.x |
| API Docs | @fastify/swagger | 8.x |
| Shared | @minecraft-docker/shared | workspace |

## 3. Architecture

### 3.1 Hexagonal Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│              Fastify Routes (REST API)                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   APPLICATION LAYER                          │
│   Use Cases: CreateServer, DeleteServer, WorldManagement     │
│   (imported from @minecraft-docker/shared)                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    DOMAIN LAYER                              │
│   Entities, Value Objects                                    │
│   (imported from @minecraft-docker/shared)                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                         │
│   ApiPromptAdapter, ShellAdapter, Repositories               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Directory Structure

```
platform/services/mcctl-api/
├── prd.md                      # This document
├── plan.md                     # Implementation plan
├── package.json                # @minecraft-docker/mcctl-api
├── tsconfig.json
├── src/
│   ├── index.ts                # Entry point
│   ├── server.ts               # Fastify server setup
│   ├── config.ts               # Configuration loader
│   ├── routes/
│   │   ├── index.ts            # Route registration
│   │   ├── servers.ts          # /api/servers/*
│   │   ├── worlds.ts           # /api/worlds/*
│   │   ├── players.ts          # /api/players/*
│   │   ├── backup.ts           # /api/backup/*
│   │   └── health.ts           # /api/health
│   ├── plugins/
│   │   ├── auth.ts             # API Key/IP authentication
│   │   ├── swagger.ts          # OpenAPI documentation
│   │   └── error-handler.ts    # Error handling
│   ├── adapters/
│   │   └── ApiPromptAdapter.ts # Non-interactive IPromptPort
│   └── di/
│       └── container.ts        # DI container
├── tests/
│   ├── routes/
│   └── plugins/
└── Dockerfile
```

## 4. API Access Modes

### 4.1 Access Mode Types

| Mode | Port Exposure | Authentication | Use Case |
|------|---------------|----------------|----------|
| `internal` | None (Docker network only) | None | Default, mcctl-console only |
| `api-key` | 3001 exposed | X-API-Key header | External tool integration |
| `ip-whitelist` | 3001 exposed | IP verification | Trusted networks |
| `api-key-ip` | 3001 exposed | Both | Maximum security |
| `open` | 3001 exposed | None | Development only |

### 4.2 Authentication Plugin Implementation

```typescript
// plugins/auth.ts
export interface AuthPluginOptions {
  accessMode: 'internal' | 'api-key' | 'ip-whitelist' | 'api-key-ip' | 'open';
  apiKey?: string;
  apiKeyHeader?: string;
  ipWhitelist?: string[];
}

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (fastify, options) => {
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip health checks
    if (request.url === '/api/health') return;

    switch (options.accessMode) {
      case 'internal':
        if (!isDockerNetwork(request.ip)) {
          return reply.status(403).send({ error: 'Internal access only' });
        }
        break;

      case 'api-key':
        if (request.headers[options.apiKeyHeader!] !== options.apiKey) {
          return reply.status(401).send({ error: 'Invalid API key' });
        }
        break;

      case 'ip-whitelist':
        if (!isIpAllowed(request.ip, options.ipWhitelist!)) {
          return reply.status(403).send({ error: 'IP not whitelisted' });
        }
        break;

      case 'api-key-ip':
        // Both checks required
        break;

      case 'open':
        // No restrictions
        break;
    }
  });
};
```

## 5. API Endpoints

### 5.1 Server Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servers` | List servers |
| GET | `/api/servers/:name` | Server details |
| POST | `/api/servers` | Create server |
| DELETE | `/api/servers/:name` | Delete server |
| POST | `/api/servers/:name/start` | Start server |
| POST | `/api/servers/:name/stop` | Stop server |
| POST | `/api/servers/:name/restart` | Restart server |
| GET | `/api/servers/:name/logs` | Server logs |
| POST | `/api/servers/:name/exec` | Execute RCON command |

### 5.2 World Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/worlds` | List worlds |
| POST | `/api/worlds` | Create world |
| POST | `/api/worlds/:name/assign` | Assign world |
| POST | `/api/worlds/:name/release` | Release world |

### 5.3 Player Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servers/:name/players` | Online players |
| GET | `/api/players/:username` | Player info |
| GET | `/api/servers/:name/whitelist` | Whitelist |
| POST | `/api/servers/:name/whitelist` | Add to whitelist |
| DELETE | `/api/servers/:name/whitelist/:player` | Remove from whitelist |
| GET | `/api/servers/:name/bans` | Ban list |
| POST | `/api/servers/:name/bans` | Ban player |
| DELETE | `/api/servers/:name/bans/:player` | Unban player |
| POST | `/api/servers/:name/kick` | Kick player |
| GET | `/api/servers/:name/ops` | OP list |
| POST | `/api/servers/:name/ops` | Add OP |
| DELETE | `/api/servers/:name/ops/:player` | Remove OP |

### 5.4 Backup

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/backup/status` | Backup status |
| POST | `/api/backup/push` | Push backup |
| GET | `/api/backup/history` | Backup history |
| POST | `/api/backup/restore` | Restore backup |

### 5.5 System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/router/status` | mc-router status |

## 6. Response Format

### 6.1 Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### 6.2 Error Response

```json
{
  "success": false,
  "error": {
    "code": "SERVER_NOT_FOUND",
    "message": "Server 'myserver' not found"
  }
}
```

### 6.3 Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Authentication failed |
| `FORBIDDEN` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., deleting running server) |
| `INTERNAL_ERROR` | 500 | Internal error |

## 7. Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCCTL_ROOT` | Data directory | `/data` |
| `API_ACCESS_MODE` | Access mode | `internal` |
| `API_KEY` | API key (api-key mode) | - |
| `API_KEY_HEADER` | API key header name | `X-API-Key` |
| `API_IP_WHITELIST` | IP whitelist (comma-separated) | - |
| `API_PORT` | Listening port | `3001` |
| `USER_STORE_TYPE` | User storage type | `yaml` |

## 8. Dependencies

### 8.1 Internal Dependencies

```json
{
  "dependencies": {
    "@minecraft-docker/shared": "workspace:*"
  }
}
```

### 8.2 External Dependencies

```json
{
  "dependencies": {
    "fastify": "^4.x",
    "@fastify/swagger": "^8.x",
    "@fastify/swagger-ui": "^2.x",
    "@fastify/cors": "^8.x"
  }
}
```

## 9. Test Plan

### 9.1 Unit Tests
- Route handler tests
- Authentication plugin tests
- Error handler tests

### 9.2 Integration Tests
- API endpoint tests with supertest
- Access mode authentication tests

### 9.3 Manual Tests

```bash
# Health check
curl http://localhost:3001/api/health

# Server list (api-key mode)
curl -H "X-API-Key: mctk_xxx" http://localhost:3001/api/servers

# Create server
curl -X POST -H "Content-Type: application/json" \
  -H "X-API-Key: mctk_xxx" \
  -d '{"name":"myserver","type":"PAPER","version":"1.21.1"}' \
  http://localhost:3001/api/servers
```

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-25 | - | Initial PRD |
