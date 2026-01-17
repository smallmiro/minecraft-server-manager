# CLAUDE.md - Docker Minecraft Server Project Guide

This project is a DevOps project for building and operating Minecraft Java Edition servers using the `itzg/minecraft-server` Docker image.

## Project Structure

```
minecraft/
├── CLAUDE.md              # This file (project guide)
├── docker-compose.yml     # Server configuration file
├── data/                  # Server data (volume mount)
├── config/                # Additional configuration files
├── secrets/               # Sensitive information (passwords, etc.)
├── .claude/
│   └── commands/
│       └── update-docs.md # Documentation update command
└── docs/                  # Documentation
    ├── README.md          # Main guide
    ├── doc-list.md        # Original documentation links
    └── *.md               # Category-specific documents
```

## Custom Commands

### /project:work

Executes development work based on GitHub Issues or Milestones following the project workflow.

```bash
# Single issue implementation
/project:work --issue 7

# Process all issues in milestone (uses Ralph Loop)
/project:work --milestone 1

# Options
/project:work --issue 7 --dry-run      # Plan only, no execution
/project:work --issue 7 --skip-review  # Skip code review (emergency)
/project:work --milestone 1 --parallel # Auto-parallelize independent issues
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

### /project:update-docs

Reads the official documentation (https://docker-minecraft-server.readthedocs.io/) and updates the docs/ directory to the latest state.

```bash
# Run in Claude Code
/project:update-docs
```

This command performs the following tasks:
- Reads official documentation URLs via WebFetch
- Checks for new environment variables, options, and examples
- Updates documents with changes
- Maintains existing format (environment variable tables, example code blocks)

### /project:sync-docs

Analyzes the codebase and synchronizes project documentation (CLAUDE.md, README.md, prd.md) with the current state.

```bash
# Run in Claude Code
/project:sync-docs
```

This command performs the following tasks:
- Analyzes docker-compose.yml and project structure
- Updates CLAUDE.md with current configuration
- Syncs README.md quick start examples
- Updates prd.md if it exists

**Important**: This command does NOT edit files in `docs/` directory. Those are managed by `/project:update-docs`.

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

## Core Principles

### Infrastructure as Code
- All server settings are defined in `docker-compose.yml`
- Control server behavior through environment variables
- Ensure data persistence through volume mounts
- Use Docker Secrets or environment variable files for passwords

### Change Management
1. **Configuration changes**: Modify `docker-compose.yml` → `docker compose up -d`
2. **Add mods/plugins**: Modify environment variables or `/mods`, `/plugins` directories
3. **Version upgrade**: Change `VERSION` environment variable

### Backup First
- Always backup `/data` before server changes
- Recommended to run `rcon-cli save-all` before backup

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EULA` | **Required** | `TRUE` - Minecraft EULA agreement |
| `TYPE` | Recommended | Server type (PAPER, FORGE, FABRIC) |
| `VERSION` | Recommended | Minecraft version |
| `MEMORY` | Recommended | JVM memory (e.g., `4G`) |
| `RCON_PASSWORD` | Recommended | RCON password |

## Common Tasks

### Start/Stop Server

```bash
# Start
docker compose up -d

# Stop
docker compose down

# View logs
docker logs -f mc
```

### Execute Commands

```bash
# Single command
docker exec mc rcon-cli say Hello

# Interactive console
docker exec -i mc rcon-cli
```

### Change Server Type

Modify `TYPE` environment variable in `docker-compose.yml`:

```yaml
environment:
  TYPE: "PAPER"     # Paper server
  TYPE: "FORGE"     # Forge mod server
  TYPE: "FABRIC"    # Fabric mod server
```

### Add Mods/Plugins

```yaml
environment:
  # Download from Modrinth
  MODRINTH_PROJECTS: |
    fabric-api
    lithium

  # Download from CurseForge
  CF_API_KEY: "${CF_API_KEY}"
  CURSEFORGE_FILES: "jei,journeymap"
```

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
- [ ] Create `docker-compose.yml`
- [ ] Set `EULA=TRUE`
- [ ] Select server type and version
- [ ] Configure memory settings
- [ ] Verify volume mounts
- [ ] Verify port forwarding

### Server Upgrade
- [ ] Backup `/data`
- [ ] Change `VERSION` environment variable
- [ ] Check mod/plugin compatibility
- [ ] Run `docker compose up -d`
- [ ] Check logs

### Modpack Installation
- [ ] Verify server type (FORGE/FABRIC)
- [ ] Check Java version
- [ ] Set API key (CurseForge)
- [ ] Set modpack slug/URL
- [ ] Allocate sufficient memory

## Important Notes

- **EULA**: Must be set to `TRUE` to start the server
- **Backup**: Always backup data before changes
- **Java Version**: Use the version required by server/mods
- **Memory**: Modpacks require at least 4G recommended
- **Port**: Default 25565, notify clients if changed
