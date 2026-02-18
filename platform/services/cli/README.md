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

### v2.8.0 (2026-02-18)
- **feat(console)**: HostnameDisplay common component with popover for multiple hostnames (#369, #370)
  - Applied to ServerCard, ServerOverview, ServerDetailPage, InfoRow, ConnectionInfoCard
  - Extracted CopyButton and hostname utilities as shared components
- **fix(console)**: Resolve DOM nesting warning and preserve InfoRow null behavior
- **test(console)**: Add HostnameDisplay component tests

### v2.7.0 (2026-02-18)
- **feat(console)**: Replace Ubuntu font with Roboto Mono across all console components
  - Unified typography: layout, MUI theme, and 11 components updated
  - Minecraft font preserved for game branding

### v2.6.1 (2026-02-17)
- **fix(console)**: Remove individual Restart badges, show specific field names in StickyActionBar

### v2.6.0 (2026-02-17)
- **feat(console)**: Server Properties Full UI - 6 sections, ~40 fields with Progressive Disclosure (#365, #366)
- **test(api)**: Add 22 ConfigService tests + 6 API integration tests (#367, #368)

### v2.5.0 (2026-02-17)
- **feat(console)**: Add Online Mode and Whitelist security settings UI (#357, #358, #362)
- **fix(api)**: Pass memory parameter to create-server.sh (#356, #360)
- **fix(console)**: Align player list field name with backend (#359, #361)
- **fix(api)**: Detect RCON error in whitelist remove and fall back to file (#363, #364)

### v2.4.1 (2026-02-14)
- **fix(ci)**: Fix mcctl-api npm publish missing workspace replacement for mod-source-modrinth

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
