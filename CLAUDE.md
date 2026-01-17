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
│   ├── scripts/                 # Management scripts
│   │   ├── lib/
│   │   │   └── common.sh        # Shared functions library
│   │   ├── mcctl.sh             # Main management CLI
│   │   ├── create-server.sh     # Server creation script
│   │   ├── delete-server.sh     # Server deletion script (preserves world data)
│   │   ├── init.sh              # Platform initialization script
│   │   ├── lock.sh              # World locking system
│   │   ├── logs.sh              # Log viewer
│   │   ├── player.sh            # Player UUID lookup
│   │   └── backup.sh            # GitHub worlds backup
│   │
│   ├── services/                # Microservices (reserved for future use)
│   │
│   └── backups/                 # Backup storage
│
├── docs/                        # Documentation (official docs reference)
│   ├── README.md
│   ├── doc-list.md
│   └── *.md
│
└── .claude/
    └── commands/
        ├── update-docs.md
        ├── sync-docs.md
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

Reads the official documentation (https://docker-minecraft-server.readthedocs.io/) and updates the docs/ directory to the latest state.

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

**Important**: This command does NOT edit files in `docs/` directory. Those are managed by `/update-docs`.

## Development Philosophy

### CLI-First, Web-Ready

All features are implemented via CLI first, with Web Management UI as a future enhancement.

**Current Phase**: CLI-based management (`scripts/mcctl.sh`)
**Future Phase**: Web UI (Next.js + MUI + TypeScript)

When developing CLI tools:
- Design scripts to be **callable from external programs** (Web API)
- Use **structured output** (JSON-compatible) for status/list commands
- Keep **business logic separate** from CLI argument parsing
- Store configuration in **parseable formats** (TOML, JSON, env files)
- Use **exit codes** consistently for error handling

This ensures smooth transition when wrapping CLI with Web API later.

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

**With mDNS (Recommended)**:
The `create-server.sh` script automatically registers hostnames with avahi-daemon.
Clients on the same LAN can connect directly via Minecraft: `<server-name>.local:25565`

**mDNS Client Requirements**:
| OS | Requirement |
|----|-------------|
| Linux | avahi-daemon (usually pre-installed) |
| macOS | Built-in Bonjour (no setup needed) |
| Windows | Bonjour Print Services or iTunes |

**Server Requirements**:
- avahi-daemon installed and running
- HOST_IP set in `.env` (or auto-detected)

**Fallback (if mDNS unavailable)**:
Configure hosts file:
```bash
# Add to /etc/hosts (Linux/macOS) or C:\Windows\System32\drivers\etc\hosts (Windows)
192.168.1.100 myserver.local
# Add more servers as needed:
# 192.168.1.100 another-server.local
```

Then connect via Minecraft: `myserver.local:25565`

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
| `-t, --type TYPE` | Server type: PAPER (default), VANILLA, FORGE, FABRIC |
| `-v, --version VER` | Minecraft version (e.g., 1.21.1, 1.20.4) |
| `-s, --seed NUMBER` | World seed for new world generation |
| `-u, --world-url URL` | Download world from ZIP URL |
| `-w, --world NAME` | Use existing world from `worlds/` directory (creates symlink) |
| `--start` | Start server after creation (default) |
| `--no-start` | Create without starting |

The script automatically:
1. Creates server directory with configuration
2. Creates symlink to existing world (if `--world` specified)
3. Updates `servers/compose.yml` (include list only - main docker-compose.yml is NOT modified)
4. Validates configuration
5. Registers hostname with avahi-daemon (mDNS)
6. Starts the server (unless `--no-start` specified)

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
| `TYPE` | Recommended | Server type (PAPER, FORGE, FABRIC) |
| `VERSION` | Recommended | Minecraft version |
| `MEMORY` | Recommended | JVM memory (e.g., `4G`) |
| `RCON_PASSWORD` | Recommended | RCON password |

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

### Start/Stop All Servers

```bash
cd platform

# Start mc-router and all servers
docker compose up -d

# Stop all
docker compose down

# View router logs
docker logs -f mc-router
```

### Start/Stop Individual Server

```bash
cd platform

# Start specific server (replace <server-name> with your server name)
docker compose up -d mc-<server-name>

# Stop specific server
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

For detailed settings, refer to the documents in the `docs/` directory:

- [Getting Started](docs/01-getting-started.md)
- [Environment Variables](docs/03-variables.md)
- [Server Types](docs/06-types-and-platforms.md)
- [Mods/Plugins](docs/08-mods-and-plugins.md)
- [Troubleshooting](docs/15-troubleshooting.md)

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
