# Issue: mcctl-api Authentication Plugin

## Phase
8.3.2 - mcctl-api Service

## Title
feat(mcctl-api): Implement authentication plugin with 5 access modes

## Description
Implement a Fastify authentication plugin supporting 5 access modes.

## Prerequisites
- #8.3.1 mcctl-api project foundation

## Tasks
- [ ] Create `src/plugins/auth.ts`
- [ ] `internal` mode - Docker network verification
- [ ] `api-key` mode - X-API-Key header verification
- [ ] `ip-whitelist` mode - IP whitelist
- [ ] `api-key-ip` mode - Combined authentication
- [ ] `open` mode - No authentication (development only)
- [ ] `src/plugins/error-handler.ts` - Error handler
- [ ] Unit tests

## Access Mode Details

| Mode | Port Exposure | Authentication |
|------|---------------|----------------|
| `internal` | None | Docker network only |
| `api-key` | 3001 | X-API-Key header |
| `ip-whitelist` | 3001 | IP verification |
| `api-key-ip` | 3001 | Both |
| `open` | 3001 | None (dev only) |

## Implementation Example

```typescript
export interface AuthPluginOptions {
  accessMode: 'internal' | 'api-key' | 'ip-whitelist' | 'api-key-ip' | 'open';
  apiKey?: string;
  apiKeyHeader?: string;
  ipWhitelist?: string[];
}
```

## Related Documents
- [mcctl-api PRD](../../platform/services/mcctl-api/prd.md) - Section 4

## Labels
- `phase:8-admin`
- `type:feature`
- `package:mcctl-api`
