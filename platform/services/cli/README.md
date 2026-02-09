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
| `mcctl update` | Update mcctl CLI to latest version |
| `mcctl update --all` | Update CLI and all installed services |

## Server Types

| Type | Description |
|------|-------------|
| `PAPER` | Paper server (default, recommended) |
| `VANILLA` | Official Minecraft server |
| `FORGE` | Forge mod server |
| `NEOFORGE` | NeoForge mod server (1.20.1+) |
| `FABRIC` | Fabric mod server |
| `MODRINTH` | Modrinth modpack server |

## Requirements

- Node.js >= 18.0.0
- Docker & Docker Compose
- Linux or macOS

## Changelog

### v2.1.0 (2026-02-09) - Console Feature Completion
- **feat**: Modrinth modpack CLI/API support - search, create, manage modpack servers (#244, #245)
- **feat**: Admin user management Console UI - list, detail, role management (#189)
- **feat**: OP Level support across all layers - domain model, CLI, API, Console (#284, #285, #286, #287)
- **fix**: Console sign-out 403 bug with LAN IP addresses (#300, #301)
- **feat**: Offline player management support (#288, #289)
- **feat**: User profile settings page with password change (#265, #266)

### v1.15.5 (2026-02-08)
- **fix(cli)**: Fix Better Auth password hashing - use hex string salt for compatibility
- **fix(cli)**: Add `MCCTL_API_KEY` env var to mcctl-console PM2 config (#261)

### v1.15.0 (2026-02-08)
- **feat(cli)**: Auto-install mcctl-console package in `console init`
- **fix(cli)**: Resolve service script paths independently for each service

### v1.14.0 (2026-02-08)
- **feat**: MODRINTH modpack server creation (CLI & Web Console) (#244, #246)
- **feat**: NeoForge mod loader option for modpack servers

### v1.13.0 (2026-02-07)
- **feat**: Unified prerequisite checker for `init` and `console init` (#241)
- **feat**: Console npm publishing as standalone package
- **feat**: Console `--force` option for PM2 process termination (#238)

### v1.12.0 (2026-02-06)
- **feat**: All-servers SSE status endpoint, server detail delete menu, API audit logging

[Full Changelog](https://github.com/smallmiro/minecraft-server-manager/releases)

## AI Assistant

Get help using mcctl with our AI-powered assistant:

- **[AI Assistant chatbot](https://notebooklm.google.com/notebook/e91b656e-0d95-45b4-a961-fb1610b13962)** - Interactive Q&A about mcctl commands, configuration, and troubleshooting

You can also use the [LLM Knowledge Base](https://minecraft-server-manager.readthedocs.io/en/latest/documentforllmagent/) with ChatGPT, Claude, or other AI assistants:

1. Download the knowledge base document
2. Upload to your preferred AI assistant
3. Ask questions about mcctl usage

## Documentation

- [Full Documentation](https://minecraft-server-manager.readthedocs.io/)
- [REST API Reference](https://minecraft-server-manager.readthedocs.io/en/latest/api/)
- [GitHub Repository](https://github.com/smallmiro/minecraft-server-manager)

## License

Apache-2.0
