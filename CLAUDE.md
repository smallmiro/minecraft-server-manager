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
