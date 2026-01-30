# Architecture: Minecraft Server Manager

This document describes the overall architecture of the Minecraft Server Manager project, with a focus on the Admin Service (Phase 8).

## Table of Contents

1. [System Overview](#system-overview)
2. [Current Architecture (v1.x)](#current-architecture-v1x)
3. [Admin Service Architecture (v2.0)](#admin-service-architecture-v20)
4. [Package Structure](#package-structure)
5. [Implementation Phases](#implementation-phases)
6. [API Reference](#api-reference)
7. [Security Model](#security-model)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Minecraft Server Manager                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────────────────────────────────────────┐  │
│  │   mcctl      │     │              Admin Service (v2.0)                │  │
│  │   (CLI)      │     │  ┌─────────────┐       ┌─────────────────────┐  │  │
│  │              │     │  │ mcctl-api   │ ◄───► │   mcctl-console     │  │  │
│  │  Terminal    │     │  │ (REST API)  │       │   (Web UI + BFF)    │  │  │
│  │  Interface   │     │  │ :3001       │       │   :3000             │  │  │
│  └──────┬───────┘     │  └──────┬──────┘       └─────────────────────┘  │  │
│         │             │         │                                        │  │
│         │             └─────────┼────────────────────────────────────────┘  │
│         │                       │                                            │
│         ▼                       ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    @minecraft-docker/shared                           │   │
│  │                 (Domain, Use Cases, Ports, Adapters)                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Docker Platform                               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │ mc-router  │  │ mc-server1 │  │ mc-server2 │  │ mc-server3 │     │   │
│  │  │  :25565    │  │   (auto)   │  │   (auto)   │  │   (auto)   │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Current Architecture (v1.x)

### CLI-First Design

The current system is CLI-based, using the `mcctl` command for all operations.

```
┌─────────────────────────────────────────────────────────────┐
│                         mcctl CLI                            │
│                  @minecraft-docker/mcctl                     │
├─────────────────────────────────────────────────────────────┤
│  Commands:                                                   │
│  • mcctl create <server>     - Create new server            │
│  • mcctl delete <server>     - Delete server                │
│  • mcctl start/stop <server> - Server lifecycle             │
│  • mcctl world list/assign   - World management             │
│  • mcctl whitelist/ban/op    - Player management            │
│  • mcctl backup push/restore - Backup to GitHub             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   @minecraft-docker/shared                   │
├─────────────────────────────────────────────────────────────┤
│  Domain Layer:                                               │
│  • Value Objects: ServerName, ServerType, McVersion, Memory │
│  • Entities: Server, World                                  │
│                                                              │
│  Application Layer:                                          │
│  • Use Cases: CreateServerUseCase, DeleteServerUseCase...   │
│  • Ports: IPromptPort, IShellPort, IServerRepository        │
│                                                              │
│  Infrastructure Layer:                                       │
│  • Adapters: ClackPromptAdapter, ShellAdapter               │
└─────────────────────────────────────────────────────────────┘
```

### Hexagonal Architecture

```
                    ┌─────────────────────┐
                    │    CLI Commands     │
                    │   (Entry Points)    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Application Layer  │
                    │     (Use Cases)      │
                    │                      │
                    │  ┌────────────────┐  │
                    │  │   Inbound      │  │
                    │  │   Ports        │  │
         ┌──────────┤  │  (IPromptPort) │  ├──────────┐
         │          │  └────────────────┘  │          │
         │          │                      │          │
         │          │  ┌────────────────┐  │          │
         │          │  │   Outbound     │  │          │
         │          │  │   Ports        │  │          │
         │          │  │ (IShellPort)   │  │          │
         │          │  └────────────────┘  │          │
         │          └──────────────────────┘          │
         │                                            │
         ▼                                            ▼
┌─────────────────┐                        ┌─────────────────┐
│ ClackPromptAdapter │                    │   ShellAdapter    │
│ (Interactive UI) │                       │  (Bash scripts)  │
└─────────────────┘                        └─────────────────┘
```

---

## Admin Service Architecture (v2.0)

### MSA Structure

Two independent microservices following the Backend-For-Frontend (BFF) pattern:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Browser                                     │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ HTTPS
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         mcctl-console (:3000)                            │
│                    @minecraft-docker/mcctl-console                       │
├─────────────────────────────────────────────────────────────────────────┤
│  Tech Stack:                                                             │
│  • Next.js 14 (App Router)                                              │
│  • NextAuth.js v5 (Session auth)                                        │
│  • Tailwind CSS + shadcn/ui                                             │
│  • React Query (Data fetching)                                          │
│                                                                          │
│  Responsibilities:                                                       │
│  • User authentication (login/logout)                                   │
│  • Session management                                                    │
│  • BFF proxy to mcctl-api                                               │
│  • Server-side rendering                                                │
│  • Web UI                                                                │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ HTTP (internal network)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          mcctl-api (:3001)                               │
│                     @minecraft-docker/mcctl-api                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Tech Stack:                                                             │
│  • Fastify 4.x                                                          │
│  • TypeScript                                                            │
│  • OpenAPI/Swagger                                                       │
│                                                                          │
│  Responsibilities:                                                       │
│  • REST API endpoints                                                   │
│  • 5 authentication modes                                               │
│  • Server/World/Player management                                       │
│  • Docker container orchestration                                       │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       @minecraft-docker/shared                           │
│                    (Shared domain and use cases)                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌──────────┐      ┌──────────────┐      ┌─────────────┐      ┌───────────┐
│  Browser │      │ mcctl-console│      │ User Store  │      │ mcctl-api │
└────┬─────┘      └──────┬───────┘      └──────┬──────┘      └─────┬─────┘
     │                   │                     │                   │
     │ 1. POST /login    │                     │                   │
     │──────────────────►│                     │                   │
     │                   │                     │                   │
     │                   │ 2. Validate User    │                   │
     │                   │────────────────────►│                   │
     │                   │                     │                   │
     │                   │ 3. User Data        │                   │
     │                   │◄────────────────────│                   │
     │                   │                     │                   │
     │ 4. Set Session    │                     │                   │
     │    Cookie         │                     │                   │
     │◄──────────────────│                     │                   │
     │                   │                     │                   │
     │                   │                     │                   │
     │ [ 비즈니스 로직 요청 : App Key 인증 구간 ]  │                   │
     │                   │                     │                   │
     │ 5. GET /data      │                     │                   │
     │   (with Cookie)   │                     │                   │
     │──────────────────►│                     │                   │
     │                   │                     │                   │
     │                   │ 6. API Call         │                   │
     │                   │    Header: X-App-Key│                   │
     │                   │────────────────────────────────────────►│
     │                   │                     │                   │
     │                   │                     │ 7. Validate Key   │
     │                   │                     │    & Process Logic│
     │                   │                     │                   │
     │                   │ 8. Business Data    │                   │
     │                   │◄────────────────────────────────────────│
     │                   │                     │                   │
     │ 9. Response       │                     │                   │
     │◄──────────────────│                     │                   │
     └                   └                     └                   └
```

### 5 API Access Modes

| Mode | Port Exposure | Authentication | Use Case |
|------|---------------|----------------|----------|
| `internal` | None (Docker only) | Network origin | Default, secure |
| `api-key` | 3001 | X-API-Key header | External scripts |
| `ip-whitelist` | 3001 | Client IP check | Trusted networks |
| `api-key-ip` | 3001 | Both required | High security |
| `open` | 3001 | None | Development only |

```yaml
# .mcctl-admin.yml
api:
  access_mode: api-key
  port: 3001
  api_key:
    key: "mctk_xxxxxxxxxxxx"
    header: "X-API-Key"
  ip_whitelist:
    - "192.168.1.0/24"
    - "10.0.0.0/8"
```

---

## Package Structure

### Monorepo Layout

```
minecraft/
├── package.json                 # Root workspace
├── pnpm-workspace.yaml
├── tsconfig.base.json
│
├── platform/
│   ├── docker-compose.yml       # Main orchestration
│   ├── docker-compose.admin.yml # Admin services
│   │
│   ├── services/
│   │   ├── cli/                 # @minecraft-docker/mcctl
│   │   │   ├── package.json
│   │   │   └── src/
│   │   │       ├── commands/
│   │   │       │   ├── create.ts
│   │   │       │   ├── delete.ts
│   │   │       │   ├── admin/        # NEW: Admin commands
│   │   │       │   │   ├── init.ts
│   │   │       │   │   ├── user.ts
│   │   │       │   │   ├── api.ts
│   │   │       │   │   └── service.ts
│   │   │       │   └── ...
│   │   │       └── ...
│   │   │
│   │   ├── shared/              # @minecraft-docker/shared
│   │   │   ├── package.json
│   │   │   └── src/
│   │   │       ├── domain/
│   │   │       │   └── value-objects/
│   │   │       ├── application/
│   │   │       │   ├── use-cases/
│   │   │       │   └── ports/
│   │   │       │       ├── inbound/
│   │   │       │       │   └── IPromptPort.ts
│   │   │       │       └── outbound/
│   │   │       │           ├── IShellPort.ts
│   │   │       │           └── IUserRepository.ts  # NEW
│   │   │       └── infrastructure/
│   │   │           └── adapters/
│   │   │               ├── ClackPromptAdapter.ts
│   │   │               ├── ApiPromptAdapter.ts     # NEW
│   │   │               ├── YamlUserRepository.ts   # NEW
│   │   │               └── SqliteUserRepository.ts # NEW
│   │   │
│   │   ├── mcctl-api/           # @minecraft-docker/mcctl-api (NEW)
│   │   │   ├── package.json
│   │   │   ├── Dockerfile
│   │   │   └── src/
│   │   │       ├── index.ts
│   │   │       ├── server.ts
│   │   │       ├── config.ts
│   │   │       ├── di/
│   │   │       │   └── container.ts
│   │   │       ├── plugins/
│   │   │       │   ├── auth.ts
│   │   │       │   ├── swagger.ts
│   │   │       │   └── error-handler.ts
│   │   │       └── routes/
│   │   │           ├── servers/
│   │   │           ├── worlds/
│   │   │           └── players/
│   │   │
│   │   └── mcctl-console/       # @minecraft-docker/mcctl-console (NEW)
│   │       ├── package.json
│   │       ├── Dockerfile
│   │       ├── next.config.js
│   │       ├── tailwind.config.js
│   │       └── src/
│   │           ├── app/
│   │           │   ├── layout.tsx
│   │           │   ├── page.tsx
│   │           │   ├── login/
│   │           │   ├── dashboard/
│   │           │   ├── servers/
│   │           │   └── api/
│   │           │       ├── auth/
│   │           │       └── proxy/
│   │           ├── components/
│   │           │   ├── layout/
│   │           │   └── ui/
│   │           ├── hooks/
│   │           └── lib/
│   │               ├── auth.ts
│   │               └── api-client.ts
│   │
│   ├── servers/                 # Server configurations
│   ├── worlds/                  # World storage
│   └── scripts/                 # Bash scripts
│
└── e2e/                         # E2E tests (NEW)
    ├── playwright.config.ts
    └── tests/
```

### Package Dependencies

```
┌──────────────────────────────────────────────────────────┐
│                    mcctl-console                          │
│                (Next.js + NextAuth.js)                   │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP
                         ▼
┌──────────────────────────────────────────────────────────┐
│                      mcctl-api                            │
│                     (Fastify)                            │
└────────────────────────┬─────────────────────────────────┘
                         │
           ┌─────────────┴─────────────┐
           ▼                           ▼
┌──────────────────┐        ┌──────────────────┐
│      mcctl       │        │      shared      │
│      (CLI)       │───────►│   (Domain)       │
└──────────────────┘        └──────────────────┘
```

---

## API Reference

### mcctl-api Endpoints

#### Servers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servers` | List all servers |
| GET | `/api/servers/:name` | Get server details |
| POST | `/api/servers` | Create new server |
| DELETE | `/api/servers/:name` | Delete server |
| POST | `/api/servers/:name/start` | Start server |
| POST | `/api/servers/:name/stop` | Stop server |
| POST | `/api/servers/:name/restart` | Restart server |
| GET | `/api/servers/:name/logs` | Get server logs |
| POST | `/api/servers/:name/exec` | Execute RCON command |

#### Worlds

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/worlds` | List all worlds |
| GET | `/api/worlds/:name` | Get world details |
| POST | `/api/worlds` | Create new world |
| DELETE | `/api/worlds/:name` | Delete world |
| POST | `/api/worlds/:name/assign` | Assign to server |
| POST | `/api/worlds/:name/release` | Release from server |

#### Players

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servers/:name/players` | List online players |
| GET | `/api/servers/:name/whitelist` | Get whitelist |
| POST | `/api/servers/:name/whitelist` | Add to whitelist |
| DELETE | `/api/servers/:name/whitelist/:player` | Remove from whitelist |
| GET | `/api/servers/:name/bans` | Get ban list |
| POST | `/api/servers/:name/bans` | Ban player |
| DELETE | `/api/servers/:name/bans/:player` | Unban player |
| POST | `/api/servers/:name/kick` | Kick player |

---

## Security Model

### Role-Based Access Control

| Role | Servers | Worlds | Players | Backup | Users |
|------|---------|--------|---------|--------|-------|
| **admin** | Full | Full | Full | Full | Full |
| **operator** | Full | Full | Full | View | - |
| **viewer** | View | View | View | View | - |

### Data Flow Security

```
┌──────────┐     HTTPS      ┌─────────────┐    Internal     ┌───────────┐
│  Browser │ ──────────────► │   Console   │ ─────────────► │    API    │
│          │   (TLS 1.3)    │   (:3000)   │  (Docker net)  │  (:3001)  │
└──────────┘                └─────────────┘                └───────────┘
     │                            │                              │
     │ Session Cookie             │ NextAuth JWT                 │ API Key
     │ (HttpOnly, Secure)         │                              │ (internal)
     │                            │                              │
     ▼                            ▼                              ▼
  User Auth                  Session Mgmt                   Access Control
```

### Configuration Security

```yaml
# .mcctl-admin.yml permissions: 600 (owner only)
api:
  api_key:
    key: "mctk_xxxx..."  # Never logged, masked in UI

console:
  session:
    secret: "xxxx..."    # Auto-generated, 32+ chars
```

---

## Related Documents

- [PRD](prd.md) - Product Requirements Document
- [Plan](plan.md) - Implementation Plan
- [mcctl-api PRD](platform/services/mcctl-api/prd.md)
- [mcctl-api Plan](platform/services/mcctl-api/plan.md)
- [mcctl-console PRD](platform/services/mcctl-console/prd.md)
- [mcctl-console Plan](platform/services/mcctl-console/plan.md)
- [shared PRD](platform/services/shared/prd.md)
- [CLI PRD](platform/services/cli/prd.md)

---

## Milestone

- **Version**: v2.0.0
- **Milestone**: [Admin Service](https://github.com/smallmiro/minecraft-server-manager/milestone/5)
- **Issues**: #80 - #102 (23 issues)
