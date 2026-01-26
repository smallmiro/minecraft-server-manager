# Implementation Plan: mcctl-console

## Parent Document
- [Project Plan](../../../plan.md) - Phase 8

## Agent Assignment

| Role | Agent | Label |
|------|-------|-------|
| **Owner** | 🎨 Frontend Agent | `agent:frontend` |
| **Spec File** | [.claude/agents/frontend-agent.md](../../../.claude/agents/frontend-agent.md) | - |

## Overview

Implementation plan for mcctl-console management console service.

## Phase 1: Project Foundation

### 1.1 Package Setup
- [ ] Create `package.json` (`@minecraft-docker/mcctl-console`)
- [ ] Configure `tsconfig.json`
- [ ] Configure `next.config.js`
- [ ] Configure `tailwind.config.js`

### 1.2 Basic Layout
- [ ] `src/app/layout.tsx` - Root layout
- [ ] `src/components/layout/Sidebar.tsx` - Sidebar
- [ ] `src/components/layout/Header.tsx` - Header

### 1.3 UI Components
- [ ] Setup shadcn/ui
- [ ] Add base components

## Phase 2: Authentication System

- [ ] NextAuth configuration
- [ ] Login page
- [ ] Session management

## Phase 3: BFF Proxy

- [ ] API proxy routes
- [ ] API client
- [ ] React Query setup

## Phase 4: Dashboard

- [ ] Dashboard page
- [ ] Stats widgets
- [ ] Server overview

## Phase 5: Server Management

- [ ] Server list
- [ ] Server details
- [ ] RCON console

## Phase 6: World/Player/Backup Management

- [ ] World management page
- [ ] Player management page
- [ ] Backup management page

## Phase 7: Docker Setup

- [ ] Create Dockerfile
- [ ] CI/CD setup

## Phase 8: Testing

- [ ] Component tests
- [ ] E2E tests

## Completion Criteria

1. All pages implemented and working correctly
2. NextAuth authentication working
3. BFF proxy API calls successful
4. Responsive design (mobile support)
5. Docker image builds successfully

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-25 | - | Initial plan |
