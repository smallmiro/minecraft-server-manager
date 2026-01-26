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
│   │   └── .locks/              # Lock files (future)
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
│   │   │   │   │   ├── entities/       # Server, World entities
│   │   │   │   │   ├── value-objects/  # ServerName, ServerType, etc.
│   │   │   │   │   └── mod/            # ModProject, ModVersion, ModSearchResult
│   │   │   │   ├── application/ # Use cases and ports
│   │   │   │   │   ├── ports/          # IModSourcePort, IPromptPort, etc.
│   │   │   │   │   └── use-cases/      # CreateServer, DeleteServer, etc.
│   │   │   │   └── infrastructure/     # Adapters and factories
│   │   │   │       ├── adapters/       # ShellAdapter, DocsAdapter, etc.
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
│   │   │   │   │   └── console.ts      # RCON exec endpoint
│   │   │   │   └── plugins/            # Fastify plugins
│   │   │   │       ├── auth.ts         # 5-mode authentication
│   │   │   │       └── swagger.ts      # OpenAPI documentation
│   │   │   ├── Dockerfile              # Multi-stage build (~156MB)
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   ├── mcctl-console/       # @minecraft-docker/mcctl-console (Web UI)
│   │   │   ├── src/
│   │   │   │   ├── app/                # Next.js App Router
│   │   │   │   │   ├── api/            # BFF proxy routes
│   │   │   │   │   ├── servers/        # Server management pages
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
│   ├── admin-service/           # Admin Service documentation
│   │   ├── index.md             # Overview
│   │   ├── installation.md      # Installation guide
│   │   ├── cli-commands.md      # CLI reference
│   │   ├── api-reference.md     # REST API docs
│   │   └── web-console.md       # Web console guide
│   ├── itzg-reference/          # itzg/docker-minecraft-server official docs
│   │   ├── doc-list.md
│   │   └── *.md
│   ├── cli/                     # CLI command reference
│   │   ├── commands.md          # English CLI docs
│   │   └── commands.ko.md       # Korean CLI docs
│   ├── getting-started/         # Getting started guides
│   ├── configuration/           # Configuration guides
│   ├── advanced/                # Advanced usage guides
│   ├── development/             # Development guides
│   └── usage/                   # Project usage guides
│
├── e2e/                         # End-to-end tests (Playwright)
│   ├── playwright.config.ts     # Playwright configuration
│   ├── global-setup.ts          # Test setup
│   ├── fixtures/                # Test fixtures
│   │   └── auth.ts              # Authentication fixture
│   └── tests/                   # Test suites
│       ├── auth.spec.ts         # Authentication tests
│       ├── dashboard.spec.ts    # Dashboard tests
│       ├── servers.spec.ts      # Server management tests
│       └── api.spec.ts          # API endpoint tests
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

### /work

Executes development work based on GitHub Issues or Milestones following the project workflow.

```bash
# Single issue implementation
/work --issue 7

# Process all issues in milestone (uses Ralph Loop)
/work --milestone 1

# Options
/work --issue 7 --dry-run      # Plan only, no execution
/work --issue 7 --skip-review  # Skip code review (emergency)
/work --milestone 1 --parallel # Auto-parallelize independent issues
```

This command performs the following tasks:
- **Single Issue**: Implements one issue with full workflow (branch → TDD → PR → review → merge)
- **Milestone**: Processes all issues using Ralph Loop (max iterations = issue count + 3)
- Updates `task.md` with work history at each checkpoint
- Updates `plan.md` checkboxes when tasks complete
- Updates GitHub Issue body checkboxes
- Runs code review before merge
- Analyzes and suggests parallel execution for independent issues

**Workflow Steps**:
1. Load issue/milestone context (milestone: remember goals throughout)
2. Create feature branch from `develop`
3. Implement with TDD (Red → Green → Refactor)
4. Commit at checkpoints with issue reference
5. Create PR and run code review
6. Merge on approval, close issue

### /update-docs

Reads the official documentation (https://docker-minecraft-server.readthedocs.io/) and updates the docs/itzg-reference/ directory to the latest state.

```bash
# Run in Claude Code
/update-docs
```

This command performs the following tasks:
- Reads official documentation URLs via WebFetch
- Checks for new environment variables, options, and examples
- Updates documents with changes
- Maintains existing format (environment variable tables, example code blocks)

### /sync-docs

Analyzes the codebase and synchronizes project documentation (CLAUDE.md, README.md, prd.md) with the current state.

```bash
# Run in Claude Code
/sync-docs
```

This command performs the following tasks:
- Analyzes docker-compose.yml and project structure
- Updates CLAUDE.md with current configuration
- Syncs README.md quick start examples
- Updates prd.md if it exists

**Important**: This command does NOT edit files in `docs/itzg-reference/` directory. Those are managed by `/update-docs`.

### /write-docs

Bilingual (English/Korean) technical documentation writer for MkDocs + Read the Docs.

```bash
# Create new document (both EN and KO)
/write-docs create getting-started/installation --title "Installation Guide"

# Translate existing document
/write-docs translate cli/commands --from en --to ko

# Review documentation
/write-docs review getting-started/ --check all

# Sync translations (find missing/outdated)
/write-docs sync .
```

This command performs the following tasks:
- Creates bilingual documentation (English + Korean)
- Uses MkDocs i18n suffix pattern (`page.md`, `page.ko.md`)
- Provides templates: basic, reference, tutorial, guide
- Reviews technical accuracy and translation quality
- Expertise: DevOps, Docker, Bash, Network, Linux, TypeScript

## npm Package Installation (Global CLI)

The management CLI can be installed globally via npm for easy access from anywhere.

### Installation

```bash
# Install globally via npm
npm install -g @minecraft-docker/mcctl

# Or via pnpm
pnpm add -g @minecraft-docker/mcctl
```

### Usage

After installation, `mcctl` is available globally:

```bash
# Initialize platform in ~/minecraft-servers
mcctl init

# Create a new server (interactive mode - guided prompts)
mcctl create

# Create a new server (CLI mode - with arguments)
mcctl create myserver -t FORGE -v 1.20.4

# Delete a server (interactive or with name)
mcctl delete              # Interactive: shows server list
mcctl delete myserver     # CLI: deletes myserver
mcctl delete myserver --force  # Force delete even with players online

# Automation (sudo password for mDNS registration)
MCCTL_SUDO_PASSWORD=secret mcctl create myserver   # Environment variable
mcctl create myserver --sudo-password "secret"     # CLI option

# Infrastructure management
mcctl up                  # Start all (mc-router + all servers)
mcctl down                # Stop all infrastructure
mcctl router start        # Start mc-router only
mcctl router stop         # Stop mc-router only
mcctl router restart      # Restart mc-router
mcctl start --all         # Start all MC servers (not router)
mcctl stop --all          # Stop all MC servers (not router)

# Server management
mcctl status
mcctl start myserver
mcctl stop myserver
mcctl logs myserver
mcctl console myserver    # Connect to RCON console

# Server commands (RCON)
mcctl exec myserver say "Hello!"     # Execute RCON command
mcctl exec myserver list             # List online players
mcctl exec myserver give Player diamond 64

# Server configuration
mcctl config myserver              # View all config
mcctl config myserver MOTD         # View specific key
mcctl config myserver MOTD "Welcome!"  # Set value
mcctl config myserver --cheats     # Enable cheats (shortcut)
mcctl config myserver --no-pvp     # Disable PvP (shortcut)
mcctl config myserver --json       # JSON output

# Operator management
mcctl op myserver list             # List operators
mcctl op myserver add Notch        # Add operator
mcctl op myserver remove Steve     # Remove operator

# Whitelist management
mcctl whitelist myserver list      # List whitelisted players
mcctl whitelist myserver add Steve # Add to whitelist
mcctl whitelist myserver remove Steve  # Remove from whitelist
mcctl whitelist myserver on        # Enable whitelist
mcctl whitelist myserver off       # Disable whitelist

# Ban management
mcctl ban myserver list            # List banned players
mcctl ban myserver add Griefer "reason"  # Ban player
mcctl ban myserver remove Griefer  # Unban player
mcctl ban myserver ip list         # List banned IPs
mcctl ban myserver ip add 1.2.3.4  # Ban IP

# Kick player
mcctl kick myserver PlayerName "reason"

# Online players
mcctl player online myserver       # List online players
mcctl player online --all          # List all online players

# Unified player management (interactive)
mcctl player                       # Interactive: server → player → action
mcctl player myserver              # Interactive: for specific server
mcctl player info Steve            # Player info lookup (UUID, skin)
mcctl player info Steve --offline  # Offline UUID calculation
mcctl player info Steve --json     # JSON output
mcctl player cache stats           # Show cache statistics
mcctl player cache clear           # Clear cached data

# Server backup/restore
mcctl server-backup myserver       # Backup server config
mcctl server-backup myserver --list  # List backups
mcctl server-restore myserver      # Interactive restore
mcctl server-restore myserver abc123  # Restore specific backup

# Migration (for existing servers to new world directory structure)
mcctl migrate status               # Check migration status for all servers
mcctl migrate worlds               # Migrate worlds to /worlds/ directory
mcctl migrate worlds --all         # Migrate all servers
mcctl migrate worlds --dry-run     # Preview without changes
mcctl migrate worlds --backup      # Create backup before migration

# World management (interactive or with arguments)
mcctl world list          # List all worlds with lock status
mcctl world new           # Interactive: create new world with prompts
mcctl world new myworld --seed 12345  # CLI: create with seed
mcctl world new myworld --server myserver  # Create and assign to server
mcctl world new myworld --server myserver --no-start  # Don't auto-start server
mcctl world assign        # Interactive: select world and server
mcctl world assign survival mc-myserver  # CLI: assign directly
mcctl world release       # Interactive: select locked world
mcctl world release survival  # CLI: release directly
mcctl world delete        # Interactive: select world to delete
mcctl world delete old-world  # CLI: delete with confirmation
mcctl world delete old-world --force  # Force delete without confirmation

# Mod management
mcctl mod search sodium   # Search mods on Modrinth
mcctl mod add myserver sodium lithium  # Add mods from Modrinth
mcctl mod add myserver --curseforge jei  # Add from CurseForge
mcctl mod add myserver --spiget 9089  # Add from SpigotMC (plugin ID)
mcctl mod add myserver --url https://example.com/mod.jar  # Direct URL
mcctl mod list myserver   # List configured mods
mcctl mod remove myserver sodium  # Remove mod from config
mcctl mod sources         # Show available mod sources

# Backup management
mcctl backup status       # Show backup configuration
mcctl backup push         # Interactive: prompt for message
mcctl backup push -m "Before upgrade"  # CLI: with message
mcctl backup history      # Show backup history
mcctl backup restore      # Interactive: select from history
mcctl backup restore abc1234  # CLI: restore specific commit

# Console Management (Web Admin)
# Note: `mcctl admin` commands are deprecated. Use `mcctl console` instead.
mcctl console init          # Initialize console service (create users.yaml, API key)
mcctl console init --force  # Reinitialize (overwrite existing)

mcctl console user list     # List console users
mcctl console user add alice  # Add user interactively
mcctl console user remove bob  # Remove user
mcctl console user reset alice  # Reset user password

mcctl console api start     # Start API service only
mcctl console api stop      # Stop API service
mcctl console api status    # Check API status

mcctl console service start           # Start all services (API + Console)
mcctl console service stop            # Stop all services
mcctl console service restart         # Restart all services
mcctl console service status          # Show service status
mcctl console service status --json   # JSON output
mcctl console service logs            # View logs
mcctl console service logs --api      # API logs only
mcctl console service logs --console  # Console logs only
mcctl console service logs -f         # Follow logs

# Custom data directory
mcctl --root /path/to/data init
```

### Data Directory

Default data directory: `~/minecraft-servers`

This location is used instead of `~/.minecraft-servers` for compatibility with Snap Docker, which has restrictions on hidden directories.

### Development (Local)

```bash
# Build all packages
pnpm build

# Link CLI globally for development
cd platform/services/cli && pnpm link --global

# Test
mcctl --version
```

## Development Philosophy

### CLI-First, Web-Ready

All features are implemented via CLI first, with Web Management UI now available.

**Phase 1**: CLI with Interactive Mode (`platform/services/cli`) ✅
**Phase 2**: Admin Service - REST API + Web Console ✅
- `mcctl-api`: Fastify REST API on port 3001
- `mcctl-console`: Next.js Web UI on port 3000

When developing CLI tools:
- Design scripts to be **callable from external programs** (Web API)
- Use **structured output** (JSON-compatible) for status/list commands
- Keep **business logic separate** from CLI argument parsing
- Store configuration in **parseable formats** (TOML, JSON, env files)
- Use **exit codes** consistently for error handling

This ensures smooth transition when wrapping CLI with Web API later.

### CLI Architecture

The CLI uses **Hexagonal Architecture** (Ports & Adapters) with **Clean Architecture** principles:

```
┌─────────────────────────────────────────────────────────────┐
│  Commands Layer (src/commands/)                              │
│  - Entry points for CLI commands                             │
│  - Parses arguments, calls Use Cases                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Application Layer (src/application/)                        │
│  - Use Cases: CreateServer, DeleteServer, WorldManagement    │
│  - Ports: IPromptPort, IShellPort, IServerRepository         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Domain Layer (src/domain/)                                  │
│  - Value Objects: ServerName, ServerType, McVersion, Memory  │
│  - Entities: Server, World                                   │
└─────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Infrastructure Layer (src/infrastructure/)                  │
│  - Adapters: ClackPromptAdapter, ShellAdapter, DocsAdapter   │
│  - Container: Dependency injection                           │
└─────────────────────────────────────────────────────────────┘
```

**Key Concepts**:
- **Value Objects**: Immutable, validated on construction (e.g., `ServerName.create("myserver")`)
- **Use Cases**: Business logic with interactive and CLI modes
- **Ports**: Interfaces for external dependencies (prompts, shell, repositories)
- **Adapters**: Concrete implementations (@clack/prompts, bash scripts)

See [docs/development/cli-architecture.md](docs/development/cli-architecture.md) for detailed documentation.

### Multi-Agent Collaboration

This project uses a **Multi-Agent Collaboration** system where specialized agents are responsible for different modules. This applies to **ALL work**, not just specific milestones.

#### 🔴 Orchestrator-First Rule

**모든 비단순 업무는 Orchestrator Agent가 먼저 분석해야 합니다:**

1. **업무 분석**: 요청된 작업의 범위와 복잡도 파악
2. **에이전트 식별**: 필요한 에이전트와 관련 모듈 식별
3. **협업 계획**: 병렬/순차 작업 구조 설계
4. **의존성 매핑**: 에이전트 간 의존성 파악
5. **작업 할당**: `WORK_REQUEST`로 각 에이전트에 작업 배정

**Orchestrator 계획 출력 형식:**
```markdown
## 🎯 Orchestrator 업무 분석

### 작업 요약
[요청된 작업 요약]

### 관련 에이전트
| Agent | 역할 | 작업 내용 |
|-------|------|----------|
| 💻 CLI | ... | ... |
| 🐳 DevOps | ... | ... |

### 실행 계획
1. **Phase 1** (병렬): [에이전트A, 에이전트B]
2. **Phase 2** (순차): [에이전트C] ← Phase 1 완료 후

### 의존성
- 에이전트B → 에이전트C: [의존 내용]
```

**예외 (Orchestrator 분석 생략 가능):**
- 단일 에이전트로 완료 가능한 단순 작업
- 명확한 단일 모듈 수정 (예: "CLI에 옵션 추가")
- 문서만 수정하는 작업

#### 🔴 Critical Rules

**NEVER do another agent's work.** Each agent has exclusive ownership of their module:

| Agent | Exclusive Module | Do NOT Touch |
|-------|------------------|--------------|
| 🔧 **Core** | `platform/services/shared/` | Other agents' code |
| 💻 **CLI** | `platform/services/cli/`, `scripts/` | Other agents' code |
| 🖥️ **Backend** | `platform/services/mcctl-api/` | Other agents' code |
| 🎨 **Frontend** | `platform/services/mcctl-console/` | Other agents' code |
| 🐳 **DevOps** | `platform/`, `e2e/` | Other agents' code |

**If you need something from another agent's module:**
1. **DO NOT** implement it yourself
2. **DO** send a `DEPENDENCY_NEEDED` message to that agent
3. **DO** wait for `DEPENDENCY_READY` response
4. **DO** use the provided interface/artifact

#### Agent Registry

**Development Agents** (Module Ownership):

| Agent | Role | Module |
|-------|------|--------|
| 🎯 **Orchestrator** | Project Coordinator | All (coordination only) |
| 🔧 **Core** | Shared Package | `platform/services/shared/` |
| 💻 **CLI** | CLI Commands | `platform/services/cli/`, `scripts/` |
| 🖥️ **Backend** | REST API | `platform/services/mcctl-api/` |
| 🎨 **Frontend** | Web Console | `platform/services/mcctl-console/` |
| 🐳 **DevOps** | Integration & E2E | `platform/`, `e2e/` |

**Support Agents** (Cross-cutting Concerns):

| Agent | Role | Module | Invoked By |
|-------|------|--------|------------|
| 📝 **Technical Writer** | Documentation | `docs/` | `/write-docs` command, Release Manager |
| 🚀 **Release Manager** | Release & Deploy | Git tags, Docker | User request (릴리즈, 배포) |

#### Agent Labels (GitHub Issues)

**When creating issues, ALWAYS assign the appropriate agent label:**

| Label | Agent | Module | Color |
|-------|-------|--------|-------|
| `agent:orchestrator` | 🎯 Orchestrator | Coordination | Gray |
| `agent:core` | 🔧 Core | `shared/` | Blue |
| `agent:cli` | 💻 CLI | `cli/`, `scripts/` | Green |
| `agent:backend` | 🖥️ Backend | `mcctl-api/` | Purple |
| `agent:frontend` | 🎨 Frontend | `mcctl-console/` | Pink |
| `agent:devops` | 🐳 DevOps | `platform/`, `e2e/` | Cyan |
| `agent:docs` | 📝 Technical Writer | `docs/` | Yellow |
| `agent:release` | 🚀 Release Manager | releases | Orange |

**Issue Creation Rules:**
1. **Every issue MUST have an agent label** - No issue without agent assignment
2. **One primary agent per issue** - If multiple agents needed, create separate issues
3. **Use label for filtering** - `label:agent:backend` to see Backend agent's issues
4. **Include agent info in body** - Add `## 🤖 Agent Assignment` section (see issue templates)

```bash
# Example: Create issue with agent label
gh issue create --title "feat(api): Add auth endpoint" --label "agent:backend"

# Filter issues by agent
gh issue list --label "agent:backend"
```

#### Agent Files

Each agent has a dedicated specification file:
```
.claude/agents/
├── orchestrator-agent.md    # Coordination protocol
├── core-agent.md            # Shared package tasks
├── cli-agent.md             # CLI admin commands
├── backend-agent.md         # mcctl-api service
├── frontend-agent.md        # mcctl-console service
├── devops-agent.md          # Docker + E2E tests
├── technical-writer.md      # Documentation (EN/KO)
└── release-manager.md       # Release & deployment
```

#### Collaboration Protocol

**When you need something from another module:**

```markdown
## 📋 DEPENDENCY_NEEDED

**From**: [your agent]
**To**: [target agent]
**Issue**: #XX

### Need
[What you need]

### Reason
[Why you need it]

### Expected Format
[Interface, spec, or artifact format]
```

**When you complete work that others depend on:**

```markdown
## ✅ DEPENDENCY_READY

**From**: [your agent]
**To**: [dependent agents]
**Issue**: #XX

### Artifact
[What is now available]

### Location
[Where to find it]

### Usage
[How to use it]
```

#### Communication Message Types

| Message | Purpose |
|---------|---------|
| `WORK_REQUEST` | Orchestrator assigns work to agent |
| `WORK_COMPLETE` | Agent reports task completion |
| `DEPENDENCY_READY` | Agent notifies dependency is available |
| `DEPENDENCY_NEEDED` | Agent requests dependency from another |
| `SYNC_REQUEST` | Request sync point coordination |
| `BLOCKING_ISSUE` | Report a blocker |

See [docs/development/agent-collaboration.md](docs/development/agent-collaboration.md) for the complete collaboration guide.

### Git-Flow Workflow

This project follows **Git-Flow** branching strategy.

```
main (production)
  │
  └── develop (integration)
        │
        ├── feature/xxx (new features)
        ├── bugfix/xxx (bug fixes)
        └── release/x.x.x (release preparation)
```

#### Branch Naming Convention
| Branch Type | Pattern | Example |
|-------------|---------|---------|
| Feature | `feature/<issue-number>-<description>` | `feature/12-add-backup-script` |
| Bugfix | `bugfix/<issue-number>-<description>` | `bugfix/15-fix-lock-release` |
| Release | `release/<version>` | `release/1.0.0` |
| Hotfix | `hotfix/<issue-number>-<description>` | `hotfix/20-critical-fix` |

#### Workflow
1. Create GitHub Issue for task
2. Create feature branch from `develop`
3. Implement and commit with issue reference (`#issue-number`)
4. Create PR to `develop`
5. Merge after review
6. Delete feature branch

#### Commit Message Format
```
<type>: <description> (#<issue-number>)

<body>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

### Semantic Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/).

**Format**: `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)

| Version | When to Increment | Example |
|---------|-------------------|---------|
| **MAJOR** | Incompatible API/breaking changes | `1.0.0` → `2.0.0` |
| **MINOR** | New features (backward compatible) | `1.0.0` → `1.1.0` |
| **PATCH** | Bug fixes (backward compatible) | `1.0.0` → `1.0.1` |

**Key Rules**:
- `0.x.x`: Initial development, API may change anytime
- `1.0.0`: First stable release, public API defined
- When MAJOR increments → reset MINOR and PATCH to 0
- When MINOR increments → reset PATCH to 0

**Pre-release & Build Metadata**:
```
1.0.0-alpha      # Pre-release (lower precedence than 1.0.0)
1.0.0-alpha.1    # Pre-release with identifier
1.0.0-beta       # Beta release
1.0.0-rc.1       # Release candidate
1.0.0+20250117   # Build metadata (ignored in precedence)
```

**Version Precedence**: `1.0.0-alpha` < `1.0.0-alpha.1` < `1.0.0-beta` < `1.0.0-rc.1` < `1.0.0`

### Task Checkpoint (task.md)

During development, use `task.md` to track work-in-progress:

```markdown
# Current Task

## Working On
- [ ] Implementing lock.sh (#5)

## Context
- Started: 2025-01-17 14:00
- Branch: feature/5-world-locking

## Notes
- lock file format decided: <server>:<timestamp>:<pid>
- Need to handle stale locks

## Next Steps
- [ ] Test concurrent lock attempts
- [ ] Add to mcctl.sh
```

**Important**: `task.md` is in `.gitignore` - for local tracking only, not committed.

### TDD (Test-Driven Development)

Follow the **Red → Green → Refactor** cycle:

1. **Red**: Write a failing test first
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Clean up while keeping tests green

```bash
# Example for Bash scripts
# 1. Write test case in tests/test_lock.sh
# 2. Run test - expect failure
# 3. Implement in scripts/lock.sh
# 4. Run test - expect success
# 5. Refactor and verify tests still pass
```

### Tidy First

**Never mix structural and behavioral changes in the same commit.**

| Change Type | Examples | Commit Separately |
|-------------|----------|-------------------|
| Structural | Rename, extract function, move file | Yes |
| Behavioral | New feature, bug fix, logic change | Yes |

```bash
# Good: Two separate commits
git commit -m "refactor: Extract validate_world function"
git commit -m "feat: Add world existence check (#7)"

# Bad: Mixed in one commit
git commit -m "feat: Add validation with new helper function"
```

### Using plan.md

The `plan.md` file serves as the implementation roadmap:

1. **Before starting work**: Read `plan.md` to understand the overall architecture
2. **Check current phase**: Find the next unmarked task in the current phase
3. **Update as you go**: Mark completed items, add discovered tasks
4. **Sync with GitHub Issues**: Each phase/task maps to GitHub Issues

```bash
# Workflow
1. Read plan.md → Identify next task
2. Create GitHub Issue (if not exists)
3. Create feature branch
4. Implement following TDD
5. Mark task complete in plan.md
6. Commit and PR
```

### Code Quality Standards

- **Eliminate duplication**: Extract common patterns into reusable functions
- **Clear naming**: Variables and functions should be self-documenting
- **Single responsibility**: Each function does one thing well
- **Small commits**: Atomic changes that are easy to review and revert

## Architecture Overview

### Multi-Server with mc-router and avahi-daemon

This project uses **hostname-based routing** via mc-router and **automatic hostname discovery** via avahi-daemon (system mDNS) for multi-server management:

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
- Zero resources when servers are stopped (only mc-router runs)
- **mDNS auto-discovery**: Clients on same LAN can connect without hosts file
- **avahi-daemon**: System-level mDNS (auto-registered by create-server.sh)

### Client Connection

The `create-server.sh` script configures dual hostnames for each server:
- **nip.io** (Recommended): `<server>.<HOST_IP>.nip.io:25565` - Works everywhere, no setup needed
- **mDNS**: `<server>.local:25565` - Requires avahi/Bonjour on client

**Connection Methods**:

| Method | Example | Client Requirements |
|--------|---------|---------------------|
| **nip.io (Recommended)** | `myserver.192.168.20.37.nip.io:25565` | Internet access only |
| mDNS | `myserver.local:25565` | avahi-daemon/Bonjour |
| hosts file | `myserver.local:25565` | Manual /etc/hosts entry |

**nip.io Magic DNS**:
nip.io automatically resolves `<name>.<ip>.nip.io` to `<ip>`:
```
myserver.192.168.20.37.nip.io → 192.168.20.37
```
No client configuration needed - just connect directly in Minecraft.

**Server Requirements**:
- HOST_IP or HOST_IPS set in `.env` (required for nip.io)
- avahi-daemon installed (optional, for mDNS)

**VPN Mesh Support**:
For access from multiple networks (e.g., LAN + Tailscale/ZeroTier):
```bash
# .env - comma-separated IPs generate multiple nip.io hostnames
HOST_IPS=192.168.20.37,100.64.0.5
```
This creates hostnames: `server.local`, `server.192.168.20.37.nip.io`, `server.100.64.0.5.nip.io`

**mDNS Client Requirements** (if using .local):
| OS | Requirement |
|----|-------------|
| Linux | avahi-daemon (usually pre-installed) |
| macOS | Built-in Bonjour (no setup needed) |
| Windows | Bonjour Print Services or iTunes |

**avahi-daemon Installation**:
| OS | Command |
|----|---------|
| Debian/Ubuntu | `sudo apt install avahi-daemon && sudo systemctl enable --now avahi-daemon` |
| CentOS/RHEL | `sudo dnf install avahi && sudo systemctl enable --now avahi-daemon` |
| Arch Linux | `sudo pacman -S avahi nss-mdns && sudo systemctl enable --now avahi-daemon` |
| Alpine Linux | `apk add avahi && rc-update add avahi-daemon default && rc-service avahi-daemon start` |

See [README.md mDNS Setup Guide](README.md#mdns-setup-guide) for detailed instructions including Windows WSL.

**Migrate Existing Servers to nip.io**:
```bash
cd platform
./scripts/migrate-nip-io.sh           # Apply changes
./scripts/migrate-nip-io.sh --dry-run # Preview changes only
```

## Core Principles

### Infrastructure as Code
- Main `docker-compose.yml` includes server-specific compose files
- Each server has its own directory with `docker-compose.yml` and `config.env`
- Control server behavior through environment variables
- Ensure data persistence through volume mounts

### Adding a New Server

**Fully automated with create-server.sh**

```bash
cd platform
./scripts/create-server.sh <server-name> [options]

# Basic examples:
./scripts/create-server.sh myworld              # Creates & starts PAPER server
./scripts/create-server.sh techcraft -t FORGE   # Creates & starts FORGE server
./scripts/create-server.sh myworld -t VANILLA -v 1.21.1   # Vanilla with specific version
./scripts/create-server.sh myworld --no-start   # Create only, don't start

# World options (mutually exclusive):
./scripts/create-server.sh myworld --seed 12345           # Specific world seed
./scripts/create-server.sh myworld --world-url URL        # Download world from ZIP
./scripts/create-server.sh myworld -w existing-world -v 1.21.1  # Use existing world (creates symlink)
```

**Options**:
| Option | Description |
|--------|-------------|
| `-t, --type TYPE` | Server type: PAPER (default), VANILLA, FORGE, NEOFORGE, FABRIC |
| `-v, --version VER` | Minecraft version (e.g., 1.21.1, 1.20.4) |
| `-s, --seed NUMBER` | World seed for new world generation |
| `-u, --world-url URL` | Download world from ZIP URL |
| `-w, --world NAME` | Use existing world from `worlds/` directory (creates symlink) |
| `--start` | Start server after creation (default) |
| `--no-start` | Create without starting |

The script automatically:
1. Creates server directory with configuration
2. Sets LEVEL to server name (world stored in `/worlds/<server-name>/`)
3. Creates symlink to existing world (if `--world` specified)
4. Updates `servers/compose.yml` (include list only - main docker-compose.yml is NOT modified)
5. Validates configuration
6. Registers hostname with avahi-daemon (mDNS)
7. Starts the server (unless `--no-start` specified)

**World Storage**: All worlds are stored in the shared `/worlds/` directory using `EXTRA_ARGS=--universe /worlds/`. This enables:
- Server-to-server world sharing
- Centralized world backup
- Easy world migration between servers

**mc-router auto-discovery**: mc-router uses `--in-docker` mode to automatically discover servers via Docker labels (`mc-router.host`). No manual MAPPING configuration is needed.

The server name you provide will be used for:
- **Directory**: `servers/<server-name>/`
- **Service**: `mc-<server-name>`
- **Container**: `mc-<server-name>`
- **Hostname**: `<server-name>.local`

After creation, just:
1. (Optional) Edit `config.env` for custom server settings
2. Configure client hosts file: `<server-ip> <server-name>.local`
3. Connect via Minecraft: `<server-name>.local:25565`

### Change Management
1. **Configuration changes**: Modify compose files → `docker compose up -d`
2. **Add mods/plugins**: Modify environment variables or mount directories
3. **Version upgrade**: Change `VERSION` in server's `config.env`

### Backup First
- Always backup server's `data/` before changes
- Recommended to run `rcon-cli save-all` before backup

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EULA` | **Required** | `TRUE` - Minecraft EULA agreement |
| `TYPE` | Recommended | Server type (PAPER, FORGE, NEOFORGE, FABRIC) |
| `VERSION` | Recommended | Minecraft version |
| `MEMORY` | Recommended | JVM memory (e.g., `4G`) |
| `RCON_PASSWORD` | Recommended | RCON password |
| `LEVEL` | Auto-set | World folder name in `/worlds/` (default: server name) |
| `EXTRA_ARGS` | Auto-set | `--universe /worlds/` for shared world storage |

## Optional: GitHub Backup Configuration

Backup `worlds/` directory to a private GitHub repository.

| Variable | Description |
|----------|-------------|
| `BACKUP_GITHUB_TOKEN` | GitHub Personal Access Token (repo scope) |
| `BACKUP_GITHUB_REPO` | Repository as `username/repo-name` |
| `BACKUP_GITHUB_BRANCH` | Branch name (default: `main`) |
| `BACKUP_AUTO_ON_STOP` | Auto backup on server stop (`true`/`false`) |

```bash
# .env example
BACKUP_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
BACKUP_GITHUB_REPO=myuser/minecraft-worlds-backup
BACKUP_AUTO_ON_STOP=true
```

## Common Tasks

### Start/Stop All Infrastructure

```bash
# Using mcctl (recommended)
mcctl up      # Start mc-router + all servers
mcctl down    # Stop all infrastructure

# Using docker compose directly
cd platform
docker compose up -d    # Start all
docker compose down     # Stop all
```

### Start/Stop All Servers (not router)

```bash
# Start/stop all MC servers (mc-router keeps running)
mcctl start --all       # or mcctl start -a
mcctl stop --all        # or mcctl stop -a
```

### Start/Stop Individual Server

```bash
# Using mcctl (recommended)
mcctl start myserver
mcctl stop myserver

# Using docker compose directly
cd platform
docker compose up -d mc-<server-name>
docker compose stop mc-<server-name>

# View server logs
docker logs -f mc-<server-name>
```

### Management CLI (mcctl.sh)

```bash
cd platform

# Server status
./scripts/mcctl.sh status
./scripts/mcctl.sh status --json

# Logs
./scripts/mcctl.sh logs <server-name>
./scripts/mcctl.sh logs <server-name> -n 100

# RCON console
./scripts/mcctl.sh console <server-name>

# World management
./scripts/mcctl.sh world list
./scripts/mcctl.sh world assign <world-name> mc-<server-name>
./scripts/mcctl.sh world release <world-name>

# Player lookup
./scripts/mcctl.sh player lookup Notch
./scripts/mcctl.sh player uuid Steve --offline

# Backup (requires .env configuration)
./scripts/mcctl.sh backup status
./scripts/mcctl.sh backup push -m "Before upgrade"
./scripts/mcctl.sh backup history
./scripts/mcctl.sh backup restore abc1234
```

### Execute Commands

```bash
# Single command (replace <server-name> with your server name)
docker exec mc-<server-name> rcon-cli say Hello

# Interactive console
docker exec -i mc-<server-name> rcon-cli
```

### Change Server Type

Modify `TYPE` in server's `config.env`:

```bash
# platform/servers/<server-name>/config.env
TYPE=PAPER       # Paper server
TYPE=FORGE       # Forge mod server
TYPE=NEOFORGE    # NeoForge mod server (1.20.1+)
TYPE=FABRIC      # Fabric mod server
```

### Add Mods/Plugins

Modify server's `config.env`:

```bash
# Download from Modrinth
MODRINTH_PROJECTS="fabric-api,lithium"

# Download from CurseForge
CF_API_KEY="${CF_API_KEY}"
CURSEFORGE_FILES="jei,journeymap"
```

Or use shared directories (mounted read-only):
- `platform/shared/plugins/` for plugins
- `platform/shared/mods/` for mods

## Troubleshooting

### Enable Debugging

```yaml
environment:
  DEBUG: "true"
  DEBUG_EXEC: "true"
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Server fails to start | Check logs with `DEBUG=true` |
| Java version error | Change image tag (java8, java17, java21) |
| Out of memory | Increase `MEMORY` value |
| Permission error | Set `UID`, `GID` or `SKIP_CHOWN_DATA=true` |

## Java Version Guide

| Minecraft Version | Image Tag |
|-------------------|-----------|
| 1.21+ | `java21` or `latest` |
| 1.18 - 1.20.4 | `java17` or `java21` |
| Forge 1.16.5 and below | `java8` (required) |

## Documentation Reference

For detailed settings, refer to the documents in the `docs/itzg-reference/` directory:

- [Getting Started](docs/itzg-reference/01-getting-started.md)
- [Environment Variables](docs/itzg-reference/03-variables.md)
- [Server Types](docs/itzg-reference/06-types-and-platforms.md)
- [Mods/Plugins](docs/itzg-reference/08-mods-and-plugins.md)
- [Troubleshooting](docs/itzg-reference/15-troubleshooting.md)

## External Resources

- **Official Docs**: https://docker-minecraft-server.readthedocs.io/
- **GitHub**: https://github.com/itzg/docker-minecraft-server
- **Docker Hub**: https://hub.docker.com/r/itzg/minecraft-server/

## Checklists

### New Server Setup
- [ ] Run `./scripts/create-server.sh <server-name> [options]`
- [ ] (Optional) Edit `config.env` for custom settings
- [ ] Update DNS/hosts file on client machines
- [ ] Connect via Minecraft: `<server-name>.local:25565`

### Server Upgrade
- [ ] Backup server's `data/` directory
- [ ] Change `VERSION` in `config.env`
- [ ] Check mod/plugin compatibility
- [ ] Run `docker compose up -d <server-name>`
- [ ] Check logs

### Modpack Installation
- [ ] Verify server type (FORGE/FABRIC) in `config.env`
- [ ] Check Java version (image tag in `docker-compose.yml`)
- [ ] Set API key (CurseForge) if needed
- [ ] Set modpack slug/URL
- [ ] Allocate sufficient memory

## Important Notes

- **EULA**: Must be set to `TRUE` to start the server
- **Backup**: Always backup data before changes
- **Java Version**: Use the version required by server/mods
- **Memory**: Modpacks require at least 4G recommended
- **mDNS**: Clients on same LAN auto-discover servers (no hosts file needed)
- **Auto-Scale**: Servers start on connect, stop after 10 min idle (configurable)
- **mc-router**: Always running, handles routing to all servers via single port 25565
- **avahi-daemon**: System mDNS service, hostnames registered by create-server.sh
