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
| `FABRIC` | Fabric mod server |

## Requirements

- Node.js >= 18.0.0
- Docker & Docker Compose
- Linux or macOS

## Changelog

### v1.12.1 (2026-02-07)
- **fix(console)**: Add `not_created` status to all SSE and API interface type definitions

### v1.12.0 (2026-02-06)
- **feat(api)**: All-servers SSE status endpoint (`GET /api/servers-status`)
- **feat(console)**: Server detail delete menu with confirmation dialog
- **feat(api)**: Audit logging for server create, delete, start, stop, restart actions
- **fix(console)**: SSE URL path updated to `/api/sse/servers-status`
- **fix(console)**: Handle `not_created` server status in card, list, and detail page

### v1.11.0 (2026-02-06)
- **feat(console)**: World management UI - list, reset, server assignment (#175)
- **feat(console)**: Server options tab with config management (#229)
- **feat(console)**: SSE real-time server status replaces polling (#223)
- **feat(api)**: Server config and world reset endpoints (#229)
- **fix(api)**: Path traversal prevention and container status checks in world reset

### v1.10.0 (2026-02-05)
- **feat**: Audit Log System - comprehensive activity tracking (#234, #235)
  - `mcctl audit list/purge/stats` CLI commands with filtering
  - 5 REST API endpoints (list, stats, purge, SSE stream)
  - Full Web UI: audit log page, dashboard widget, server activity tab

### v1.9.0 (2026-02-05)
- **feat(cli)**: Add `--all` flag to `mcctl update` command

### v1.8.0 (2026-02-05)
- **feat(api,console)**: Pass sudo password from web console to server creation API (#230)
- **feat(console)**: Replace ActivityFeed with ChangelogFeed on dashboard

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
