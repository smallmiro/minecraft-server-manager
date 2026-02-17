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

### v2.4.0 (2026-02-14)
- **feat(cli)**: Add `mcctl upgrade` command for upgrading mcctl and all services (#326, #355)
- **feat(cli)**: Add creeper ASCII banner with version check on `mcctl init` (#353, #354)
- **feat(console)**: Implement Mods tab functionality (#351, #352)
- **feat(cli)**: Add `mcctl playit domain` subcommand (#347, #348)

### v2.3.0 (2026-02-12) - External Play (playit.gg)
- **feat(cli)**: Add `mcctl playit` subcommand - start/stop/status/setup (#273, #331)
- **feat(api)**: Add playit.gg status and control API endpoints (#292, #332)
- **feat(console)**: Add playit.gg external access UI (#274, #333)
- **feat(api)**: Add comprehensive audit logging to all mutating routes (#324, #325)

### v2.2.0 (2026-02-11)
- **feat(console)**: Whitelist Console UI - toggle ON/OFF, bulk player add, search/filter (#283, #321)
- **feat**: Enable whitelist by default on `mcctl create` (#282, #320)
- **feat(console)**: Hostname/domain management in server Options tab (#314, #315)

### v2.1.0 (2026-02-09) - Console Feature Completion
- **feat**: Modrinth modpack CLI/API support (#244, #245)
- **feat**: Admin user management Console UI (#189)
- **feat**: OP Level support across all layers (#284, #285, #286, #287)

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
