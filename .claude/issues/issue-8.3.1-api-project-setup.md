# Issue: mcctl-api Project Foundation

## Phase
8.3.1 - mcctl-api Service

## Title
feat(mcctl-api): Setup project foundation

## Description
Set up the basic project structure for the mcctl-api REST API service.

## Tasks
- [ ] Create `package.json` (`@minecraft-docker/mcctl-api`)
- [ ] Configure `tsconfig.json`
- [ ] `src/index.ts` - Entry point
- [ ] `src/server.ts` - Fastify server setup
- [ ] `src/config.ts` - Environment variable loader
- [ ] `src/di/container.ts` - DI container
- [ ] Add package to pnpm-workspace.yaml
- [ ] Build test

## Dependencies

```json
{
  "dependencies": {
    "@minecraft-docker/shared": "workspace:*",
    "fastify": "^4.x",
    "@fastify/cors": "^8.x"
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCCTL_ROOT` | Data directory | `/data` |
| `API_PORT` | Listening port | `3001` |
| `API_ACCESS_MODE` | Access mode | `internal` |

## Related Documents
- [mcctl-api PRD](../../platform/services/mcctl-api/prd.md)
- [mcctl-api Plan](../../platform/services/mcctl-api/plan.md) - Phase 1

## Labels
- `phase:8-admin`
- `type:feature`
- `package:mcctl-api`
