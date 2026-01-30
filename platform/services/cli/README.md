# @minecraft-docker/mcctl

CLI tool for managing Docker Minecraft servers with mc-router.

## Features

- **Multi-server management** with hostname-based routing
- **Auto-scaling**: Servers start on connect, stop when idle
- **Interactive mode**: Guided prompts for all operations
- **World management**: Assign and release worlds between servers
- **Backup system**: GitHub-based world backup and restore

## Installation

```bash
npm install -g @minecraft-docker/mcctl
```

## Quick Start

```bash
# Initialize platform in ~/minecraft-servers
mcctl init

# Create a new server (interactive)
mcctl create

# Create with arguments
mcctl create myserver -t PAPER -v 1.21.1

# Check server status
mcctl status

# Start/stop servers
mcctl start myserver
mcctl stop myserver

# View logs
mcctl logs myserver
```

## Commands

| Command | Description |
|---------|-------------|
| `mcctl init` | Initialize the platform |
| `mcctl create [name]` | Create a new server |
| `mcctl delete [name]` | Delete a server |
| `mcctl status` | Show all server status |
| `mcctl start <name>` | Start a server |
| `mcctl stop <name>` | Stop a server |
| `mcctl logs <name>` | View server logs |
| `mcctl world list` | List all worlds |
| `mcctl world assign` | Assign world to server |
| `mcctl world release` | Release world from server |
| `mcctl backup push` | Backup worlds to GitHub |
| `mcctl backup restore` | Restore worlds from backup |

## Server Types

| Type | Description |
|------|-------------|
| `PAPER` | Paper server (default, recommended) |
| `VANILLA` | Official Minecraft server |
| `FORGE` | Forge mod server |
| `FABRIC` | Fabric mod server |

## Requirements

- Node.js >= 18.0.0
- Docker & Docker Compose
- Linux or macOS

## Changelog

### v1.6.3 (2026-01-30)
- **fix**: npm publish support for `@minecraft-docker/mod-source-modrinth` package
- **docs**: Added project badges to README
- **docs**: Created development guide (EN/KO)
- **ci**: Added mod-source-modrinth to release workflow

### v1.6.2 (2026-01-28)
- **feat**: Improved API, E2E tests, and documentation
- **fix**: Various bug fixes and stability improvements

### v1.6.0 (2026-01-24)
- **feat**: Added mod management commands (`mcctl mod search/add/remove`)
- **feat**: Modrinth integration for mod search and installation

### v1.5.0 (2026-01-21)
- **feat**: Added player management with Mojang API integration
- **feat**: Local player cache for offline UUID lookup

### v1.4.0 (2026-01-20)
- **feat**: World management commands (`mcctl world new/assign/release`)
- **feat**: Server backup and restore functionality

[Full Changelog](https://github.com/smallmiro/minecraft-server-manager/releases)

## Documentation

- [Full Documentation](https://minecraft-server-manager.readthedocs.io/)
- [GitHub Repository](https://github.com/smallmiro/minecraft-server-manager)

## License

Apache-2.0
