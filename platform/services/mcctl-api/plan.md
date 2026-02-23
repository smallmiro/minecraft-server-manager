# Implementation Plan: mcctl-api

## Parent Document
- [Project Plan](../../../plan.md) - Phase 8

## Agent Assignment

| Role | Agent | Label |
|------|-------|-------|
| **Owner** | 🖥️ Backend Agent | `agent:backend` |
| **Spec File** | [.claude/agents/backend-agent.md](../../../.claude/agents/backend-agent.md) | - |

## Overview

Implementation plan for mcctl-api REST API service.

## Phase 1: Project Foundation

### 1.1 Package Setup
- [ ] Create `package.json` (`@minecraft-docker/mcctl-api`)
- [ ] Configure `tsconfig.json`
- [ ] Install dependencies (fastify, @fastify/swagger)
- [ ] Add package to pnpm-workspace.yaml

### 1.2 Basic Server Structure
- [ ] `src/index.ts` - Entry point
- [ ] `src/server.ts` - Fastify server setup
- [ ] `src/config.ts` - Environment variable loader

### 1.3 DI Container
- [ ] `src/di/container.ts` - Dependency injection container
- [ ] Connect shared package Use Cases and Repositories

## Phase 2: Authentication Plugin

### 2.1 Access Mode Implementation
- [ ] `src/plugins/auth.ts` - Authentication plugin
- [ ] `internal` mode - Docker network verification
- [ ] `api-key` mode - X-API-Key header verification
- [ ] `ip-whitelist` mode - IP whitelist
- [ ] `api-key-ip` mode - Combined authentication
- [ ] `open` mode - No authentication (development only)

### 2.2 Error Handling
- [ ] `src/plugins/error-handler.ts` - Unified error handler
- [ ] Standard error response format

## Phase 3: API Route Implementation

### 3.1 Server Management API
- [ ] `src/routes/servers.ts`
- [ ] `GET /api/servers` - Server list
- [ ] `GET /api/servers/:name` - Server details
- [ ] `POST /api/servers` - Create server
- [ ] `DELETE /api/servers/:name` - Delete server
- [ ] `POST /api/servers/:name/start` - Start server
- [ ] `POST /api/servers/:name/stop` - Stop server
- [ ] `POST /api/servers/:name/restart` - Restart server
- [ ] `GET /api/servers/:name/logs` - Server logs
- [ ] `POST /api/servers/:name/exec` - RCON command execution

### 3.2 World Management API
- [ ] `src/routes/worlds.ts`
- [ ] `GET /api/worlds` - World list
- [ ] `POST /api/worlds` - Create world
- [ ] `POST /api/worlds/:name/assign` - Assign world
- [ ] `POST /api/worlds/:name/release` - Release world

### 3.3 Player Management API
- [ ] `src/routes/players.ts`
- [ ] Whitelist, ban, OP, kick APIs

### 3.4 Backup API
- [ ] `src/routes/backup.ts`
- [ ] Backup status, push, history, restore APIs

### 3.5 System API
- [ ] `src/routes/health.ts`
- [ ] Health check, mc-router status APIs

## Phase 4: Swagger/OpenAPI

- [ ] `src/plugins/swagger.ts` - Swagger plugin
- [ ] Schema definitions
- [ ] `/docs` endpoint setup

## Phase 5: Docker Setup

- [ ] Create `Dockerfile`
- [ ] Multi-stage build
- [ ] GitHub Actions CI/CD

## Phase 6: Testing

- [ ] Unit tests (vitest)
- [ ] Integration tests (supertest)

## Completion Criteria

1. All API endpoints implemented and tests passing
2. All 5 access modes working correctly
3. OpenAPI documentation auto-generated
4. Docker image builds successfully

## Issue #396: Backup Retention Policy Pruning

**Status**: Completed (2026-02-23)

### Implemented

- `applyRetentionPolicy()` in `backup-scheduler.ts`
  - `getCommitCount()`: count git commits via `git rev-list --count HEAD`
  - `getOldestCommitDate()`: get oldest commit timestamp via `git log --reverse --format=%aI -1`
  - `truncateHistory()`: orphan branch rewrite strategy (safe for linear histories)
    - `git rev-list --ancestry-path HEAD~N..HEAD` to find commits to keep
    - `git checkout --orphan tempBranch sha` to create disconnected root
    - `git cherry-pick` to replay kept commits
    - `git push --force origin branch` to sync remote
  - `getCurrentBranch()`: get branch name via `git rev-parse --abbrev-ref HEAD`
  - `extractStdout()`: normalize execFilePromise result (string vs {stdout, stderr})
  - `writeRetentionAuditLog()`: write audit log via injected AuditLogWriter
  - `AuditLogWriter` type exported for DI
  - `auditLogWriter` optional constructor parameter

### Key Design Decisions

- Re-count after maxCount prune prevents double-truncation for maxAgeDays
- Pruning errors wrapped in try-catch; backup itself does NOT fail
- `writeAuditLog` injected via constructor (avoids singleton coupling)
- `extractStdout()` handles both real execFile (returns `{stdout}`) and mock (returns string)

### Tests

- 22 unit tests in `tests/backup-scheduler.test.ts` (all passing)
- Coverage: no prune, prune by maxCount, prune by maxAgeDays, re-count after prune, error recovery, audit log

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-25 | - | Initial plan |
| 1.1.0 | 2026-02-23 | backend-agent | Add Issue #396 backup retention pruning |
