# PRD: mcctl - CLI Tool

## Parent Document
- [Project PRD](../../../prd.md) - Section 9

## Agent Assignment

| Role | Agent | Label |
|------|-------|-------|
| **Owner** | 💻 CLI Agent | `agent:cli` |
| **Spec File** | [.claude/agents/cli-agent.md](../../../.claude/agents/cli-agent.md) | - |

**Responsibilities**:
- CLI command implementations (`src/commands/`)
- Interactive prompts with @clack/prompts (`ClackPromptAdapter`)
- Bash script integration (`scripts/`)
- DI container configuration for CLI

**Collaboration**:
- Imports Use Cases and Ports from `@minecraft-docker/shared`
- Depends on Core Agent for domain logic updates

## 1. Overview

### 1.1 Purpose
Command-line interface (CLI) tool for Minecraft server management. Supports both interactive prompts and command-line arguments.

### 1.2 Scope
- Server creation/deletion/start/stop
- World management (create, assign, release)
- Player management (whitelist, ban, OP, kick)
- Backup/restore
- Platform initialization

### 1.3 Non-Goals
- Web UI (handled by mcctl-console)
- REST API (handled by mcctl-api)

## 2. Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 18+ |
| Language | TypeScript | 5.x |
| Prompts | @clack/prompts | 0.7.x |
| Colors | picocolors | 1.x |
| Shared | @minecraft-docker/shared | workspace |

## 3. Development Methodology

> **Reference**: [CLAUDE.md](../../../CLAUDE.md) - Development Philosophy 섹션 참조
>
> 프로젝트 공통 개발 방법론:
> - **XP (Extreme Programming)** 기반
> - **TDD**: Red → Green → Refactor
> - **Tidy First**: 구조 변경과 동작 변경 분리
> - **CI/CD**: lint, type-check, test, build

### Testing Strategy (CLI 특화)

| 테스트 유형 | 도구 | 대상 |
|------------|------|------|
| Unit | Vitest | Use Cases, Utils, Domain |
| Integration | Vitest | Shell Commands, Docker Integration |
| E2E | Vitest | Full CLI Command Flows |

**테스트 커버리지 목표**: 80% 이상

## 4. Architecture

### 4.1 Hexagonal Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│                  CLI Commands (index.ts)                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   APPLICATION LAYER                          │
│         Use Cases (from @minecraft-docker/shared)            │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    DOMAIN LAYER                              │
│    Entities, Value Objects (from @minecraft-docker/shared)   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                         │
│   ClackPromptAdapter (CLI-specific) + Shared Adapters        │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Directory Structure

```
platform/services/cli/
├── prd.md                      # This document
├── plan.md                     # Implementation plan
├── README.md                   # npm package description
├── package.json                # @minecraft-docker/mcctl
├── tsconfig.json
├── src/
│   ├── index.ts                # CLI entry point
│   ├── commands/               # Command implementations
│   │   ├── create.ts
│   │   ├── delete.ts
│   │   ├── status.ts
│   │   ├── world.ts
│   │   ├── player.ts
│   │   ├── whitelist.ts
│   │   ├── ban.ts
│   │   ├── op.ts
│   │   ├── kick.ts
│   │   ├── backup.ts
│   │   └── ...
│   ├── adapters/
│   │   └── ClackPromptAdapter.ts  # CLI-specific adapter
│   ├── di/
│   │   └── container.ts        # DI container
│   └── lib/
│       ├── prompts/            # Reusable prompt components
│       ├── mojang-api.ts       # Mojang API client
│       └── player-cache.ts     # Player cache
└── tests/
```

## 5. Command Structure

### 4.1 Server Management

| Command | Description |
|---------|-------------|
| `mcctl init` | Initialize platform |
| `mcctl create [name]` | Create server |
| `mcctl delete [name]` | Delete server |
| `mcctl status` | View server status |
| `mcctl start <name>` | Start server |
| `mcctl stop <name>` | Stop server |
| `mcctl logs <name>` | View server logs |
| `mcctl console <name>` | RCON console |

### 4.2 World Management

| Command | Description |
|---------|-------------|
| `mcctl world list` | List worlds |
| `mcctl world new [name]` | Create world |
| `mcctl world assign` | Assign world |
| `mcctl world release` | Release world |

### 4.3 Player Management

| Command | Description |
|---------|-------------|
| `mcctl player` | Unified player management (interactive) |
| `mcctl player info <name>` | Player info |
| `mcctl whitelist <server> <action>` | Whitelist |
| `mcctl ban <server> <action>` | Ban/unban |
| `mcctl op <server> <action>` | OP management |
| `mcctl kick <server> <player>` | Kick |

### 4.4 Backup

| Command | Description |
|---------|-------------|
| `mcctl backup status` | Backup status |
| `mcctl backup push` | Push backup |
| `mcctl backup history` | Backup history |
| `mcctl backup restore` | Restore backup |

## 6. Interactive Mode

### 5.1 Server Creation Flow

```
$ mcctl create

┌  Create Minecraft Server
│
◆  Server name?
│  myserver
│
◆  Server type?
│  ● Paper (Recommended)
│  ○ Vanilla
│  ○ Forge
│  ○ Fabric
│
◆  Minecraft version?
│  1.21.1
│
◇  Creating server...
│
└  ✓ Server 'myserver' created!
   Connect via: myserver.local:25565
```

## 7. Dependencies

### 6.1 Internal Dependencies

```json
{
  "dependencies": {
    "@minecraft-docker/shared": "workspace:*"
  }
}
```

### 6.2 External Dependencies

```json
{
  "dependencies": {
    "@clack/prompts": "^0.7.x",
    "picocolors": "^1.x"
  }
}
```

## 8. Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCCTL_ROOT` | Data directory | `~/minecraft-servers` |
| `MCCTL_SUDO_PASSWORD` | sudo password (for automation) | - |

## 9. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-25 | - | Initial PRD |
