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

### v2.28.0 (2026-10-01)
- **feat(console)**: Bento layout across every Web Console screen - page hero with key status, metrics, and primary action, followed by panels for detailed content; existing actions and permissions unchanged
- **fix(console)**: Dashboard "needs attention" includes unhealthy servers and shows **Reconnecting** when SSE is down; pages show **Unavailable** instead of misleading zeros on load failure, and keep cached data on refetch errors
- **fix(cli)**: `mcctl console user ...` / `mcctl console api ...` no longer fail with `unknown command 'node'` (#556, #557)

### v2.27.0 (2026-09-27)
- **feat(console)**: Server **Players** tab - merged online (RCON) + offline roster with avatars, badges, and kick/ban/op/whitelist actions; works while the server is stopped (#528, #550)
- **feat(console)**: Player detail modal with statistics/advancements (#551), saved + live position and status from `playerdata` NBT (#552), and session/visit history collected from container logs into `data/players.db` (#553)
- **feat(api)**: `GET /api/servers/:name/players` returns the full roster (no more `400` for stopped servers); new `GET /api/servers/:name/players/:uuid?include=stats,nbt,sessions` (#550–#553)

### v2.26.3 (2026-06-28)
- **fix(worlds)**: Maps, block statistics, and structure markers now support the latest Minecraft `dimensions/` world layout (#546, #547)

### v2.26.2 (2026-06-28)
- **fix(worlds)**: Nether/End maps and stats no longer read stale satellite folders on layout-switched worlds (#542–#545)

### v2.26.1 (2026-06-28)
- **fix(console)**: Live player locations in the World tab; BlueMap gzip-stored map files are now served (#538–#541)

### v2.26.0 (2026-06-28)
- **feat(console)**: World Info Panel - world info & player locations, BlueMap full map, structure markers, ore/block statistics (#525, #529–#537)
- **feat(modpack)**: Auto-detect client-only mods; installed modpack jar listing + Exclude toggle (#523, #524, #526, #527)

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
