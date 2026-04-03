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

### v2.20.2 (2026-04-03)
- **feat**: Add mc-router loading MOTD label (`auto-scale-loading-motd`) to server templates (#471)
- **feat(cli)**: Auto-add loading MOTD label to existing servers during `mcctl update` (#471)
- **fix**: Update CLI defaults and docs for MC 26.x / Java 25 (defaultVersion → 26.1.1)

### v2.20.1 (2026-04-03)
- **feat(cli)**: Add Docker image auto-pull to `mcctl update` (#465)
- **feat(cli)**: Auto-upgrade server Docker image tags during `mcctl update` (#468)
- **fix(shared,cli)**: MC 26.1.1+ requires Java 25 - update default image tag to `java25` (#467)
- **fix**: Update CLI defaults (defaultVersion 1.21.1 -> 26.1.1) and docs for MC 26.x / Java 25
- **fix**: Resolve merge artifacts from parallel PR merges

### v2.20.0 (2026-04-03)
- **feat(shared)**: Java 25 support - McVersion.recommendedImageTag, DocsAdapter java25 (#444)
- **feat(shared)**: New server types - LEAF, FOLIA, PUFFERFISH (#445)
- **feat(api,console)**: Native AutoPause (PAUSE_WHEN_EMPTY_SECONDS) config support (#446)
- **feat(api,console)**: WebSocket Console and SSH Console config support (#447)
- **feat(api,console)**: Configuration Repository settings support (#448)
- **fix(shared)**: DocsAdapter file path bug fix (#449)
- **chore**: Migrate shared tests to vitest (#450), unify @types/node ^22.x (#451)

### v2.19.0 (2026-03-01)
- **feat(console)**: Add Q&A and Ideas community links to Footer (#434, #438)
- **fix(console)**: Add null guards to `useServerConfigSnapshots` to prevent TypeError (#431, #435)
- **fix(console)**: Disable View History button when less than 2 snapshots (#432, #437)

### v2.18.0 (2026-02-24)
- **refactor**: Relocate backup storage paths to `<MCCTL_ROOT>/backups/` (#429, #430)

### v2.17.1 (2026-02-24)
- **fix(console)**: Reorder server backup sub-tabs to show Config Snapshots first, World Backups second

### v2.17.0 (2026-02-24)
- **feat(console)**: Implement Backups tab in Server Detail page (#427, #428)

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
