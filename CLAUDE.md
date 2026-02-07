# CLAUDE.md - Docker Minecraft Server Project Guide

This project is a DevOps project for building and operating multiple Minecraft Java Edition servers using the `itzg/minecraft-server` Docker image with `itzg/mc-router` for connection routing and auto-scaling.

## Project Structure

```
minecraft/
├── CLAUDE.md                    # This file (project guide)
├── README.md                    # Project overview
├── prd.md                       # Product Requirements Document
├── plan.md                      # Implementation roadmap
│
├── package.json                 # Root workspace package (pnpm)
├── pnpm-workspace.yaml          # pnpm workspace configuration
├── tsconfig.base.json           # Shared TypeScript configuration
│
├── platform/                    # Docker platform (all runtime files)
│   ├── docker-compose.yml       # Main orchestration (mc-router + server includes)
│   ├── .env                     # Global environment variables
│   ├── .env.example             # Environment template
│   ├── .gitignore               # Git ignore rules for servers, worlds, etc.
│   │
│   ├── servers/                 # Server configurations (gitignored except _template)
│   │   ├── compose.yml          # Server include list (auto-generated, gitignored)
│   │   └── _template/           # Template for new servers
│   │       ├── docker-compose.yml
│   │       └── config.env
│   │   # Servers created by create-server.sh go here (gitignored)
│   │
│   ├── worlds/                  # Shared world storage (gitignored except .locks)
│   │   ├── .locks/              # Lock files for world-server assignment
│   │   └── <world-name>/        # World directories
│   │       └── .meta            # World metadata (seed, createdAt)
│   │
│   ├── shared/                  # Shared resources
│   │   ├── plugins/             # Shared plugins (read-only mount)
│   │   └── mods/                # Shared mods (read-only mount)
│   │
│   ├── scripts/                 # Management scripts (Bash)
│   │   ├── lib/
│   │   │   └── common.sh        # Shared functions library
│   │   ├── mcctl.sh             # Main management CLI (Bash version)
│   │   ├── create-server.sh     # Server creation script
│   │   ├── delete-server.sh     # Server deletion script (preserves world data)
│   │   ├── init.sh              # Platform initialization script
│   │   ├── lock.sh              # World locking system
│   │   ├── logs.sh              # Log viewer
│   │   ├── player.sh            # Player UUID lookup
│   │   ├── backup.sh            # GitHub worlds backup
│   │   └── migrate-nip-io.sh    # Migration script for nip.io hostnames
│   │
│   ├── services/                # TypeScript microservices (Monorepo)
│   │   ├── cli/                 # @minecraft-docker/mcctl (npm CLI)
│   │   │   ├── src/
│   │   │   │   ├── index.ts     # CLI entry point
│   │   │   │   ├── commands/    # Command implementations
│   │   │   │   │   ├── player.ts       # Unified player management
│   │   │   │   │   ├── whitelist.ts    # Whitelist management
│   │   │   │   │   ├── ban.ts          # Ban management
│   │   │   │   │   ├── op.ts           # Operator management
│   │   │   │   │   ├── kick.ts         # Kick player
│   │   │   │   │   ├── migrate.ts      # World storage migration
│   │   │   │   │   ├── mod.ts          # Mod management (search, add, remove)
│   │   │   │   │   ├── audit.ts        # Audit log management (list, purge, stats)
│   │   │   │   │   ├── console/        # Console Management (Web Admin)
│   │   │   │   │   │   ├── init.ts     # Initialize console service
│   │   │   │   │   │   ├── user.ts     # User management
│   │   │   │   │   │   ├── api.ts      # API key management
│   │   │   │   │   │   └── service.ts  # Service lifecycle
│   │   │   │   │   └── ...
│   │   │   │   ├── lib/         # Libraries
│   │   │   │   │   ├── mojang-api.ts   # Mojang API client
│   │   │   │   │   ├── player-cache.ts # Encrypted player cache
│   │   │   │   │   ├── rcon.ts         # RCON helpers
│   │   │   │   │   ├── sudo-utils.ts   # Sudo password handling
│   │   │   │   │   └── prompts/        # Reusable prompt components
│   │   │   │   │       ├── server-select.ts
│   │   │   │   │       ├── player-select.ts
│   │   │   │   │       └── action-select.ts
│   │   │   │   └── infrastructure/     # DI and adapters
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   ├── shared/              # @minecraft-docker/shared (common utilities)
│   │   │   ├── src/
│   │   │   │   ├── domain/      # Domain entities and value objects
│   │   │   │   │   ├── entities/       # Server, World, AuditLog entities
│   │   │   │   │   ├── value-objects/  # ServerName, ServerType, AuditAction, etc.
│   │   │   │   │   └── mod/            # ModProject, ModVersion, ModSearchResult
│   │   │   │   ├── application/ # Use cases and ports
│   │   │   │   │   ├── ports/          # IModSourcePort, IPromptPort, IAuditLogPort, etc.
│   │   │   │   │   └── use-cases/      # CreateServer, DeleteServer, etc.
│   │   │   │   └── infrastructure/     # Adapters and factories
│   │   │   │       ├── adapters/       # ShellAdapter, DocsAdapter, SqliteAuditLogRepository, etc.
│   │   │   │       └── factories/      # ModSourceFactory
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   ├── mod-source-modrinth/ # @minecraft-docker/mod-source-modrinth
│   │   │   ├── src/
│   │   │   │   ├── ModrinthAdapter.ts  # IModSourcePort implementation
│   │   │   │   └── infrastructure/     # API client, mappers
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   ├── mcctl-api/           # @minecraft-docker/mcctl-api (REST API)
│   │   │   ├── src/
│   │   │   │   ├── app.ts              # Fastify app setup
│   │   │   │   ├── routes/             # API endpoints
│   │   │   │   │   ├── servers.ts      # GET/POST /servers
│   │   │   │   │   ├── servers/actions.ts  # start/stop/restart
│   │   │   │   │   ├── console.ts      # RCON exec endpoint
│   │   │   │   │   └── audit-logs.ts   # Audit log API endpoints
│   │   │   │   └── plugins/            # Fastify plugins
│   │   │   │       ├── auth.ts         # 5-mode authentication
│   │   │   │       └── swagger.ts      # OpenAPI documentation
│   │   │   ├── Dockerfile              # Multi-stage build (~156MB)
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   ├── mcctl-console/       # @minecraft-docker/mcctl-console (Web UI) [UNDER DEVELOPMENT]
│   │   │   ├── src/
│   │   │   │   ├── app/                # Next.js App Router
│   │   │   │   │   ├── api/            # BFF proxy routes
│   │   │   │   │   ├── servers/        # Server management pages
│   │   │   │   │   ├── audit-logs/     # Audit log pages
│   │   │   │   │   └── layout.tsx      # Root layout
│   │   │   │   ├── components/         # React components
│   │   │   │   └── hooks/              # Custom hooks (use-servers)
│   │   │   ├── Dockerfile              # Standalone build (~158MB)
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   └── web-admin/           # Deprecated: Use mcctl-console
│   │
│   └── backups/                 # Backup storage
│
├── templates/                   # npm package templates
│   ├── docker-compose.yml       # Template for mcctl init
│   ├── .env.example
│   ├── .gitignore
│   └── servers/_template/
│
├── docs/                        # Documentation (MkDocs + Read the Docs)
│   ├── index.md                 # English homepage
│   ├── index.ko.md              # Korean homepage
│   ├── console/                 # Management Console documentation
│   ├── itzg-reference/          # itzg/docker-minecraft-server official docs
│   ├── cli/                     # CLI command reference
│   ├── getting-started/         # Getting started guides
│   ├── configuration/           # Configuration guides
│   ├── advanced/                # Advanced usage guides
│   └── development/             # Development guides
│
├── e2e/                         # End-to-end tests (Playwright)
│   ├── playwright.config.ts
│   ├── global-setup.ts
│   ├── fixtures/
│   └── tests/
│
└── .claude/
    ├── agents/
    │   ├── release-manager.md
    │   └── technical-writer.md
    └── commands/
        ├── update-docs.md
        ├── sync-docs.md
        ├── write-docs.md
        └── work.md
```

## Custom Commands

> **Note**: Commands are invoked as `/command-name` (not `/project:command-name`)

| Command | Description |
|---------|-------------|
| `/work` | Execute development work based on GitHub Issues/Milestones |
| `/update-docs` | Update docs/itzg-reference/ from official documentation |
| `/sync-docs` | Sync project documentation (CLAUDE.md, README.md) with codebase |
| `/write-docs` | Bilingual (EN/KO) technical documentation writer |

See `.claude/commands/` for detailed command specifications.

## System Requirements

### Runtime (Production)

| Component | Minimum Version | Notes |
|-----------|-----------------|-------|
| **Node.js** | >= 18.0.0 | All packages |
| **Docker Engine** | >= 24.0.0 | Minecraft server containers |
| **Docker Compose** | >= 2.20.0 | `include` feature required |
| **PM2** | >= 6.0.14 | mcctl-api, mcctl-console process management |

**OS**: Linux, macOS only (mcctl CLI depends on bash scripts)

**Ports**:

| Service | Port |
|---------|------|
| mcctl-api | 5001 |
| mcctl-console | 5000 |
| mc-router | 25565 |

**Notes**:
- PM2 is bundled as a dependency of `mcctl` CLI and installed automatically
- `better-sqlite3` (mcctl-console dependency) is a native module; build toolchain (gcc, make, python) may be required on some environments

### Development Only

| Component | Minimum Version | Notes |
|-----------|-----------------|-------|
| **pnpm** | >= 8.0.0 | Monorepo workspace management |
| **TypeScript** | >= 5.3.0 | Build time |

## Quick Start

```bash
# Install CLI globally
npm install -g @minecraft-docker/mcctl

# Initialize platform
mcctl init

# Create a server
mcctl create myserver -t PAPER -v 1.21.1

# Start all infrastructure
mcctl up

# Check status
mcctl status
```

For full CLI reference, see [docs/cli/commands.md](docs/cli/commands.md).

## Architecture Overview

### Multi-Server with mc-router

```
┌──────────────────────┐  ┌────────────────────┐
│  mc-router (:25565)  │  │  avahi-daemon      │
│  hostname routing    │  │  (system service)  │
│  auto-scale up/down  │  │  mDNS broadcast    │
├──────────────────────┤  ├────────────────────┤
│ <server>.local ─→    │  │ /etc/avahi/hosts:  │
│  mc-<server>         │  │  <server>.local    │
└──────────────────────┘  └────────────────────┘
```

**Key Features**:
- Single port (25565) for all servers via hostname routing
- Auto-scale: servers start on client connect, stop after idle timeout
- **nip.io** (Recommended): `<server>.<HOST_IP>.nip.io:25565`
- **mDNS**: `<server>.local:25565` (requires avahi/Bonjour)

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EULA` | **Required** | `TRUE` - Minecraft EULA agreement |
| `TYPE` | Recommended | Server type (PAPER, FORGE, NEOFORGE, FABRIC) |
| `VERSION` | Recommended | Minecraft version |
| `MEMORY` | Recommended | JVM memory (e.g., `4G`) |

## Development Philosophy

### Mandatory Development Practices

> **IMPORTANT**: The following practices are **MANDATORY**, not optional. All code contributions MUST follow these principles.

#### Required Practices (Non-Negotiable)

| Practice | Description | Enforcement |
|----------|-------------|-------------|
| **TDD** | Test-Driven Development: Red → Green → Refactor | All new features MUST have tests written BEFORE implementation |
| **Tidy First** | Never mix structural and behavioral changes | Separate commits for refactoring vs features |
| **DDD** | Domain-Driven Design | Use domain entities, value objects, aggregates |
| **Clean Architecture** | Dependency inversion, use cases, ports/adapters | Business logic independent of frameworks |
| **Hexagonal Architecture** | Ports & Adapters pattern | All external dependencies behind interfaces |

#### TDD is NOT Optional

```
❌ WRONG: Write code first, add tests later (or skip tests)
✅ RIGHT: Write failing test → Write minimal code → Refactor
```

Every new command, feature, or bug fix MUST follow the TDD cycle:
1. **Red**: Write a failing test that defines the expected behavior
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Clean up while keeping tests green

#### Architecture Enforcement

All TypeScript code MUST follow this layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│              (CLI commands, API routes)                  │
├─────────────────────────────────────────────────────────┤
│                    Application Layer                     │
│           (Use cases, application services)              │
├─────────────────────────────────────────────────────────┤
│                      Domain Layer                        │
│    (Entities, Value Objects, Domain Services, Ports)     │
├─────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                   │
│       (Adapters: DB, External APIs, File System)         │
└─────────────────────────────────────────────────────────┘
```

**Key Rules**:
- Domain layer has NO external dependencies
- Use cases orchestrate domain logic
- All I/O operations go through adapters
- Dependency injection for testability

### XP (Extreme Programming) Methodology

This project follows **XP (Extreme Programming)** practices as the core development methodology.

**Core Practices**:
- **TDD (Test-Driven Development)**: Red → Green → Refactor cycle **(MANDATORY)**
- **Tidy First**: Never mix structural and behavioral changes **(MANDATORY)**
- **Pair Programming**: For complex features and architecture decisions
- **Continuous Integration**: All PRs must pass lint, type-check, test, build
- **Small Releases**: Frequent, incremental deployments

**XP Values**:

| Value | Application |
|-------|-------------|
| Communication | PR reviews, pair programming, documentation |
| Simplicity | YAGNI, minimal code to solve the problem |
| Feedback | TDD, CI/CD, code reviews |
| Courage | Refactoring, addressing technical debt |
| Respect | Code review etiquette, team collaboration |

### CLI-First, Web-Ready

All features are implemented via CLI first, with Web Management UI available.

- **Phase 1**: CLI with Interactive Mode (`platform/services/cli`)
- **Phase 2**: Management Console - REST API + Web Console
  - `mcctl-api`: Fastify REST API on port 5001
  - `mcctl-console`: Next.js Web UI on port 5000

### CLI Architecture

The CLI uses **Hexagonal Architecture** (Ports & Adapters) with **Clean Architecture** principles. This is **MANDATORY** for all CLI code.

See [docs/development/cli-architecture.md](docs/development/cli-architecture.md) for details.

### Multi-Agent Collaboration

This project uses a **Multi-Agent Collaboration** system where specialized agents are responsible for different modules.

| Agent | Module |
|-------|--------|
| 🔧 **Core** | `platform/services/shared/` |
| 💻 **CLI** | `platform/services/cli/`, `scripts/` |
| 🖥️ **Backend** | `platform/services/mcctl-api/` |
| 🎨 **Frontend** | `platform/services/mcctl-console/` |
| 🐳 **DevOps** | `platform/`, `e2e/` |
| 📝 **Technical Writer** | `docs/` |
| 🚀 **Release Manager** | Git tags, Docker |

See [docs/development/agent-collaboration.md](docs/development/agent-collaboration.md) for the complete collaboration guide.

### Git-Flow Workflow

This project follows **Git-Flow** branching strategy with **Semantic Versioning**.

| Branch Type | Pattern | Example |
|-------------|---------|---------|
| Feature | `feature/<issue>-<desc>` | `feature/12-add-backup` |
| Bugfix | `bugfix/<issue>-<desc>` | `bugfix/15-fix-lock` |
| Release | `release/<version>` | `release/1.0.0` |

#### Commit Message Format

```
<type>: <description> (#<issue-number>)

<body>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

#### TDD (Test-Driven Development) - MANDATORY

> **This is NOT optional.** Every feature, bug fix, or enhancement MUST follow TDD.

Follow the **Red → Green → Refactor** cycle:
1. **Red**: Write a failing test first
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Clean up while keeping tests green

**PRs without tests will be rejected** unless:
- Documentation-only changes
- Configuration changes with no code logic

```bash
# Example TDD workflow for a new command
# 1. RED: Write failing test
pnpm test -- --watch src/commands/newcmd.test.ts

# 2. GREEN: Implement minimal code
# 3. REFACTOR: Clean up, then commit
git commit -m "feat(cli): add newcmd command (#123)"
```

#### Tidy First - MANDATORY

> **This is NOT optional.** Structural and behavioral changes MUST be in separate commits.

**Never mix structural and behavioral changes in the same commit.**

```bash
# Good: Two separate commits
git commit -m "refactor: extract validate_world function"
git commit -m "feat: add world existence check (#7)"

# Bad: Mixed in one commit - AVOID
git commit -m "feat: add validation with new helper function"
```

**Why this matters**:
- Easier code review (reviewers can focus on one type of change)
- Safer rollbacks (can revert behavior without losing refactoring)
- Cleaner git history

#### Task Checkpoint (task.md)

Use `task.md` (gitignored) for local work-in-progress tracking:

```markdown
## Working On
- [ ] Implementing lock.sh (#5)

## Context
- Branch: feature/5-world-locking

## Notes
- lock file format: <server>:<timestamp>:<pid>
```

See [docs/development/git-workflow.md](docs/development/git-workflow.md) for complete details.

## Documentation Reference

| Topic | Document |
|-------|----------|
| CLI Commands | [docs/cli/commands.md](docs/cli/commands.md) |
| Getting Started | [docs/getting-started/quickstart.md](docs/getting-started/quickstart.md) |
| Agent Collaboration | [docs/development/agent-collaboration.md](docs/development/agent-collaboration.md) |
| CLI Architecture | [docs/development/cli-architecture.md](docs/development/cli-architecture.md) |
| Git Workflow | [docs/development/git-workflow.md](docs/development/git-workflow.md) |
| itzg Reference | [docs/itzg-reference/](docs/itzg-reference/) |
| Troubleshooting | [docs/troubleshooting/index.md](docs/troubleshooting/index.md) |

## External Resources

- **Official Docs**: https://docker-minecraft-server.readthedocs.io/
- **GitHub**: https://github.com/itzg/docker-minecraft-server
- **Docker Hub**: https://hub.docker.com/r/itzg/minecraft-server/
