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

### v3.0.2 (2026-10-24)
- **fix(cli)**: `mcctl update` and `upgrade-v3.sh` skip stopped servers already on the current image and report `up to date` (#810)

### v3.0.1 (2026-10-24)
- **fix(scripts)**: `upgrade-v3.sh` restarts with `--console --force`, checks `kill_timeout`, offers to recreate stopped servers and prints a correct rollback (#794)
- **fix(cli)**: `mcctl console service` no longer crashes without a terminal (#795); `mcctl update` offers to recreate stopped servers, default No (#796)
- **feat(console)**: Routing Table grouped by server (#799)

### v3.0.0 (2026-10-24)
- **BREAKING**: all Bash scripts are removed (#715); everything runs through `mcctl`. `@minecraft-docker/shared` drops the script-based exports. Upgrade a v2.x host with `curl -fsSL https://raw.githubusercontent.com/smallmiro/minecraft-server-manager/main/scripts/upgrade-v3.sh | bash -s -- --dry-run`, then without `--dry-run` ([runbook](https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/#v300-upgrade-script))
- **feat(cli)**: `server.yaml` (ServerSpec) and `mcctl migrate spec`; `mcctl delete` keeps the world unless `--delete-world`; backups, create and delete run in TypeScript (#675, #652, #732)
- **feat(console)**: dashboard and server detail on Bento, hostname routing table, live router log and status stream, router restart, server list summary with total player count (#763-#771, #781)
- **fix(security)**: line breaks in `config.env` values could add arbitrary keys or run commands (#726); shell and path injection in Docker helpers and world routes (#720)

### v2.33.0 (2026-10-18)
- **fix(console)**: upgrading to 2.32.0 signed users out when `.env` held older `BETTER_AUTH_*` values; the ecosystem value now wins until `mcctl upgrade` moves it into `.env`, and Platform Settings shows them read-only meanwhile (#699)
- **fix(cli)**: `mcctl upgrade` moves `BETTER_AUTH_*` from `ecosystem.config.cjs` into `.env`; `mcctl console init` no longer keeps a stale `.env` secret (#699)
- **feat(console)**: Create Server asks before creating with an empty sudo password; defaults VANILLA / `LATEST` (#700); routing table hostname lists start collapsed

### v2.32.0 (2026-10-18)
- **feat(console)**: Platform Settings for admins - edit the platform `.env` with write-only secrets, conflict detection and restart guidance (#683); console auth settings read from `.env` (#686)
- **feat(cli)**: random `RCON_PASSWORD` on `mcctl init` (#680); whitelist off by default, `mcctl create --enable-whitelist` (#679)
- **fix(security)**: platform secrets no longer reach server containers - run `mcctl upgrade`, then stop/start each server (#685); sudo password no longer written to `/etc/avahi/hosts` (#682); `DELETE /api/audit-logs` requires admin (#689)
- **fix**: atomic `.env` writes (#688), LAN-first addresses and copy over HTTP (#681), Minecraft 26.x world info (#601), RCON player list (#600), audit log exit code (#602), console service status (#677), console init access modes (#633)

### v2.31.0 (2026-10-11)
- **feat(console)**: Anonymous usage analytics (GA4): per-install `installId`, normalized page path, console version only. Opt out with `"telemetry": false` in `.mcctl.json` or `DO_NOT_TRACK=1` (#631)
- **fix(cli)**: `mcctl console user/api` no longer drop `--role`, `--password`, `--json`, `--force` (#628)

### v2.30.0 (2026-10-11)
- **docs**: No product behavior changes. Upgrade runbook with post-upgrade verification (#577, #579); README refreshed (#581, #583); contributor guide `DEVELOPMENT.md` (#587)
- **chore(dev)**: `/work` Stop hook (#585), contributor (fork) mode (#589), agent routing and difficulty tiers (#591), per-session work state (#593)

### v2.29.1 (2026-10-10)
- **fix(map)**: Map render no longer fails with exit code 1 on worlds whose Nether/End has no region data; empty dimensions are skipped (#575, #576)
- **fix(map)**: World map now opens on the Overworld (map list rewritten overworld → nether → end after render; apply with **Re-render**) (#575, #576)

### v2.29.0 (2026-10-10)
- **feat(cli)**: `mcctl upgrade` now updates the `router` image and `group_add` in your root `docker-compose.yml` (diff + confirm, timestamped `.bak` backup, router recreated); other customizations are left untouched (#562, #569)
- **chore(router)**: mc-router 1.43.1 → 1.47.1; non-root router gets Docker socket access via `group_add` + auto-detected `DOCKER_GID` (#549, #559)
- **feat(console)**: Ore & Block Stats shown as KPIs, a donut chart, and category bars (#567, #568)
- **fix(map)**: World map opens on the Overworld instead of the End (#564)
- **fix(cli)**: `CF_API_KEY` is optional on Java 17+ images; CLI messages and docs corrected (#561, #566)

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

- [Website](https://mcctl.mirolab.dev/)
- [Full Documentation](https://minecraft-server-manager.readthedocs.io/)
- [REST API Reference](https://minecraft-server-manager.readthedocs.io/en/latest/api/)
- [GitHub Repository](https://github.com/smallmiro/minecraft-server-manager)

## License

Apache-2.0
