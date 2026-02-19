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

### v2.11.0 (2026-02-19)
- **feat(console)**: Show Console section only on Overview tab (#387, #388)
- **refactor(console)**: Redesign server.properties editor as inline view (replace dialog with full-page view)

### v2.10.0 (2026-02-19)
- **feat(console)**: Phase 5 - File Upload/Download with streaming proxy, drag-and-drop (#379, #386)
- **feat(console)**: Phase 6 - File Operations: delete, rename, new folder dialogs (#380, #385)

### v2.9.0 (2026-02-18)
- **feat(console)**: Server Files Management - complete 4-phase implementation
  - Phase 1: File Browser with directory navigation and file listing (#375, #381)
  - Phase 2: Text Editor for reading/writing server config files (#376, #382)
  - Phase 3: Player Editor smart routing for whitelist/ops/bans (#377, #383)
  - Phase 4: server.properties Form Editor with visual form-based editing (#378, #384)
- **refactor(console)**: Remove Roboto Mono font, use MUI default (#373, #374)

### v2.8.1 (2026-02-18)
- **refactor(console)**: Improve responsive design across 14 components for mobile/tablet/desktop (#371, #372)

### v2.8.0 (2026-02-18)
- **feat(console)**: HostnameDisplay common component with popover for multiple hostnames (#369, #370)

### v2.7.0 (2026-02-18)
- **feat(console)**: Replace Ubuntu font with Roboto Mono across all console components

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
