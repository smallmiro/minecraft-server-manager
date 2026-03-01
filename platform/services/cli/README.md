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

### v2.18.0 (2026-02-24)
- **refactor**: Relocate backup storage paths to `<MCCTL_ROOT>/backups/` (#429, #430)
  - World backup cache: `$HOME/.minecraft-backup` -> `<MCCTL_ROOT>/backups/worlds/`
  - Backup schedule DB: `data/` -> `backups/meta/`
  - Config snapshot DB/storage: `data/` -> `backups/meta/`
- **docs**: Simplify CLAUDE.md Project Structure (35% reduction)

### v2.17.1 (2026-02-24)
- **fix(console)**: Reorder server backup sub-tabs to show Config Snapshots first, World Backups second

### v2.17.0 (2026-02-24)
- **feat(console)**: Implement Backups tab in Server Detail page (#427, #428)
  - World Backups sub-tab with server-scoped backup components
  - Config Snapshots sub-tab with server-filtered schedule management
- **fix(console)**: Add missing react-diff-viewer-continued dependency
- **fix(deps)**: Sync pnpm-lock.yaml with react-diff-viewer-continued

### v2.16.0 (2026-02-23)
- **feat**: Config Snapshot system - full-stack server configuration versioning (#397~#406)
  - Domain layer, infrastructure, API, CLI, Console UI, and E2E tests
  - Automated snapshot scheduling with node-cron
  - Config diff viewer and restore functionality
- **feat**: Backup retention policy pruning implementation (#396, #426)
- **fix**: Backup git path and shell injection prevention (#423, #425)

### v2.15.3 (2026-02-22)
- **docs**: Update README.md with Management Console features and architecture (#412, #413)

### v2.15.2 (2026-02-22)
- **docs**: Server Overview/Mods tab screenshots with detailed descriptions (#409)
- **docs**: Integrated setup guide for mcctl init to console init flow (#410)

### v2.15.1 (2026-02-22)
- **docs**: Comprehensive web console documentation update with screenshots (#407, #408)
- **fix**: Sync pnpm-lock.yaml with mcctl-api package.json (node-cron)

### v2.15.0 (2026-02-22)
- **feat**: Automated backup scheduling with cron-based scheduler (#394, #395)
  - CLI `mcctl backup schedule` with list/add/remove/enable/disable operations
  - REST API endpoints for schedule CRUD with node-cron integration
  - Web Console UI with schedule management dialog and toggle
  - Shell injection prevention, 54+ tests across all layers

[Full Changelog](https://github.com/smallmiro/minecraft-server-manager/releases)

## Community

- **[Q&A / Support](https://github.com/smallmiro/minecraft-server-manager/discussions/categories/q-a)** - Ask questions and get help from the community
- **[Ideas / Feature Requests](https://github.com/smallmiro/minecraft-server-manager/discussions/categories/ideas)** - Share your ideas and vote on feature requests

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
