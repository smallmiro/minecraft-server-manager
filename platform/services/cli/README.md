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

### v1.11.0 (2026-02-06)
- **feat(console)**: World management UI - list, reset, server assignment (#175)
- **feat(console)**: Server options tab with config management (#229)
- **feat(console)**: SSE real-time server status replaces polling (#223)
- **feat(api)**: Server config and world reset endpoints (#229)
- **feat(cli)**: Add shared package to `mcctl update --all`
- **fix(api)**: Path traversal prevention and container status checks in world reset
- **fix(cli)**: Always force update check when running `mcctl update`

### v1.10.0 (2026-02-05)
- **feat**: Audit Log System - comprehensive activity tracking (#234, #235)
  - `mcctl audit list/purge/stats` CLI commands with filtering
  - 5 REST API endpoints (list, stats, purge, SSE stream)
  - Full Web UI: audit log page, dashboard widget, server activity tab
  - SQLite storage with WAL mode, auto-cleanup (90-day retention)

### v1.9.0 (2026-02-05)
- **feat(cli)**: Add `--all` flag to `mcctl update` command
  - Update CLI and all installed services (mcctl-api, mcctl-console) together

### v1.8.0 (2026-02-05)
- **feat(api,console)**: Pass sudo password from web console to server creation API (#230)
- **feat(console)**: Replace ActivityFeed with ChangelogFeed on dashboard

### v1.7.12 (2026-02-05)
- **fix(scripts)**: Correct TEMPLATE_DIR path duplication in create-server.sh (#230)

### v1.7.11 (2026-02-04)
- **fix(shared)**: Check LEVEL config before WORLD_NAME for world size calculation

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
