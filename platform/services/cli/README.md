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

### v1.15.5 (2026-02-08)
- **fix(cli)**: Fix Better Auth password hashing - use hex string salt for compatibility
- **fix(cli)**: Add `MCCTL_API_KEY` env var to mcctl-console PM2 config (#261)

### v1.15.4 (2026-02-08)
- **fix(console)**: Explicitly pass `baseURL` and `secret` to Better Auth config
- **fix(console)**: Fix HTTP session persistence - disable Secure cookies on HTTP environments
- **fix(console)**: Remove duplicate trustedOrigins entry for localhost:5000

### v1.15.3 (2026-02-08)
- **fix(cli)**: Correct `BETTER_AUTH_URL` to `BETTER_AUTH_BASE_URL` in ecosystem.config.cjs
- **fix(console)**: Fix trustedOrigins env var name to `BETTER_AUTH_BASE_URL`
- **fix(console)**: Use `MCCTL_ROOT` env var for DB path resolution in db.ts
- **fix(console)**: Add missing `user_servers` table to auto-creation DDL
- **fix(cli,api)**: Move audit.db to `MCCTL_ROOT/data/audit.db`

### v1.15.2 (2026-02-08)
- **fix(cli)**: Replace `NEXTAUTH_SECRET`/`NEXTAUTH_URL` with `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` in ecosystem.config.cjs
- **fix(console)**: Auto-create Better Auth SQLite tables (users, accounts, sessions, verifications) on startup

### v1.15.1 (2026-02-08)
- **fix(console)**: Change auth client baseURL from `localhost:5000` to empty string for production deployment
- **fix(console)**: Add `NEXT_PUBLIC_APP_URL` env var support to trustedOrigins

### v1.15.0 (2026-02-08)
- **feat(cli)**: Auto-install mcctl-console package in `console init`
- **fix(cli)**: Resolve service script paths independently for each service
- **fix(cli)**: Add defaultValue to modpack version prompt to prevent trim error

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
