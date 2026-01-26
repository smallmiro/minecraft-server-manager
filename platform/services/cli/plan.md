# Implementation Plan: mcctl CLI

## Parent Document
- [Project Plan](../../../plan.md) - Phase 6, 7

## Agent Assignment

| Role | Agent | Label |
|------|-------|-------|
| **Owner** | 💻 CLI Agent | `agent:cli` |
| **Spec File** | [.claude/agents/cli-agent.md](../../../.claude/agents/cli-agent.md) | - |

## Overview

Implementation plan for the mcctl CLI tool. Currently fully implemented.

## Implementation Status

### Phase 1: Foundation ✅
- [x] Create `package.json` (`@minecraft-docker/mcctl`)
- [x] Configure `tsconfig.json`
- [x] CLI entry point (`src/index.ts`)
- [x] DI container (`src/di/container.ts`)

### Phase 2: Basic Commands ✅
- [x] `mcctl init` - Platform initialization
- [x] `mcctl status` - Server status
- [x] `mcctl create` - Server creation
- [x] `mcctl delete` - Server deletion
- [x] `mcctl start/stop` - Server start/stop
- [x] `mcctl logs` - Log viewing

### Phase 3: Interactive Mode ✅
- [x] `@clack/prompts` integration
- [x] `ClackPromptAdapter` implementation
- [x] Interactive server creation
- [x] Interactive server deletion

### Phase 4: World Management ✅
- [x] `mcctl world list`
- [x] `mcctl world new`
- [x] `mcctl world assign`
- [x] `mcctl world release`

### Phase 5: Player Management ✅
- [x] `mcctl player` - Unified interactive management
- [x] `mcctl whitelist`
- [x] `mcctl ban`
- [x] `mcctl op`
- [x] `mcctl kick`
- [x] Mojang API integration
- [x] Player cache system

### Phase 6: Backup ✅
- [x] `mcctl backup status`
- [x] `mcctl backup push`
- [x] `mcctl backup history`
- [x] `mcctl backup restore`
- [x] `mcctl server-backup`
- [x] `mcctl server-restore`

### Phase 7: Infrastructure Management ✅
- [x] `mcctl up` - Start all
- [x] `mcctl down` - Stop all
- [x] `mcctl router start/stop/restart`

## Future Plans

### Phase 8: Admin Commands (Planned)
- [ ] `mcctl admin init` - Admin service initialization
- [ ] `mcctl admin start/stop` - Service management
- [ ] `mcctl admin user` - User management
- [ ] `mcctl admin api` - API settings

→ Detailed plans: [mcctl-api Plan](../mcctl-api/plan.md), [mcctl-console Plan](../mcctl-console/plan.md)

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-25 | - | Initial plan |
