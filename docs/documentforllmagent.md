# mcctl - Minecraft Server Management CLI

> **Version**: 1.6.12
> **Last Updated**: 2026-01-31
> **Purpose**: Knowledge base for LLM agents (ChatGPT, Gemini, Claude) to answer mcctl questions

## System Requirements

| Component | Minimum Version | Recommended | Notes |
|-----------|-----------------|-------------|-------|
| **Node.js** | >= 18.0.0 | 20 LTS | Required for mcctl CLI |
| **Docker Engine** | >= 24.0.0 | Latest | Container runtime |
| **Docker Compose** | >= 2.20.0 | Latest | `include` feature required |
| **OS** | Linux, macOS | Ubuntu 22.04+ | Windows via WSL2 |

## Overview

`mcctl` is a command-line tool for managing multiple Minecraft servers using Docker. It provides:

- Multi-server management with hostname-based routing
- Auto-scaling (servers start on connect, stop when idle)
- Shared world storage with locking mechanism
- Player management (whitelist, ban, op, kick)
- Mod management (Modrinth, CurseForge, Spiget)
- Admin Service (REST API + Web Console)

## Installation

```bash
# Install globally via npm
npm install -g @minecraft-docker/mcctl

# Or via pnpm
pnpm add -g @minecraft-docker/mcctl

# Initialize platform
mcctl init
```

Default data directory: `~/minecraft-servers`

## Command Reference

### Platform Management

```bash
mcctl init                    # Initialize platform
mcctl up                      # Start all (router + servers)
mcctl down                    # Stop all
mcctl router start|stop|restart  # Manage mc-router only
```

### Server Management

```bash
mcctl status                  # Show all servers status
mcctl status <server>         # Show specific server status
mcctl status --detail         # Show detailed info (memory, CPU)
mcctl status --watch          # Real-time monitoring

mcctl create <name>           # Create server (interactive)
mcctl create <name> -t FORGE -v 1.20.4  # Create with options
mcctl delete <name>           # Delete server (preserves world)

mcctl start <server>          # Start server
mcctl stop <server>           # Stop server
mcctl start --all             # Start all servers
mcctl stop --all              # Stop all servers

mcctl logs <server>           # View server logs
mcctl logs <server> -f        # Follow logs
mcctl console <server>        # RCON console
mcctl exec <server> <cmd>     # Execute RCON command
```

### Server Configuration

```bash
mcctl config <server>              # View all config
mcctl config <server> MOTD         # View specific key
mcctl config <server> MOTD "Hi!"   # Set value
mcctl config <server> --cheats     # Enable cheats
mcctl config <server> --no-pvp     # Disable PvP
```

### Player Management

```bash
# Operator management
mcctl op <server> list             # List operators
mcctl op <server> add <player>     # Add operator
mcctl op <server> remove <player>  # Remove operator

# Whitelist management
mcctl whitelist <server> list      # List whitelisted
mcctl whitelist <server> add <p>   # Add to whitelist
mcctl whitelist <server> remove <p>  # Remove from whitelist
mcctl whitelist <server> on|off    # Enable/disable whitelist

# Ban management
mcctl ban <server> list            # List banned players
mcctl ban <server> add <p> [reason]  # Ban player
mcctl ban <server> remove <p>      # Unban player
mcctl ban <server> ip list         # List banned IPs
mcctl ban <server> ip add <ip>     # Ban IP

# Kick player
mcctl kick <server> <player> [reason]

# Online players
mcctl player online <server>       # List online players
mcctl player online --all          # All servers

# Player info
mcctl player info <name>           # Get UUID, skin URL
mcctl player info <name> --offline # Offline UUID
```

### World Management

```bash
mcctl world list              # List worlds with lock status
mcctl world new               # Interactive: create new world
mcctl world new <name>        # Create world directory with .meta file
mcctl world new <name> --seed 12345  # Create with seed (stored in .meta)
mcctl world new <name> --server <srv>  # Create and assign to server
mcctl world new <name> --server <srv> --no-start  # Don't auto-start
mcctl world assign <world> <server>  # Lock world to server
mcctl world release <world>   # Release lock
mcctl world delete <world>    # Delete world (with confirmation)
mcctl world delete <world> --force  # Force delete without confirmation
```

### Mod Management

```bash
mcctl mod search <query>           # Search mods on Modrinth
mcctl mod add <server> <mod...>    # Add mods (Modrinth default)
mcctl mod add <server> --curseforge <mod>  # CurseForge
mcctl mod add <server> --spiget <id>  # SpigotMC plugin
mcctl mod add <server> --url <url>    # Direct URL
mcctl mod list <server>            # List configured mods
mcctl mod remove <server> <mod>    # Remove mod
mcctl mod sources                  # Show mod sources
```

### Backup Management

```bash
# Server config backup
mcctl server-backup <server>       # Backup server config
mcctl server-backup <server> --list  # List backups
mcctl server-restore <server>      # Interactive restore
mcctl server-restore <server> <id>   # Restore specific backup

# World backup (requires GitHub config)
mcctl backup status               # Show backup config
mcctl backup push                 # Backup to GitHub
mcctl backup push -m "message"    # With message
mcctl backup history              # Show history
mcctl backup restore <commit>     # Restore from commit
```

### Console Management (Admin Service)

```bash
# Initialization
mcctl console init              # Initialize console service
mcctl console init --force      # Reinitialize

# User management
mcctl console user list         # List console users
mcctl console user add <name>   # Add user
mcctl console user remove <name>  # Remove user
mcctl console user reset <name>   # Reset password

# API management
mcctl console api start         # Start API only
mcctl console api stop          # Stop API
mcctl console api status        # Check status

# Service lifecycle
mcctl console service start     # Start all (API + Console)
mcctl console service stop      # Stop all
mcctl console service restart   # Restart services
mcctl console service status    # Show status
mcctl console service logs      # View logs
mcctl console service logs -f   # Follow logs
```

## Server Types

| Type | Description | Plugins | Mods | Recommended For |
|------|-------------|---------|------|-----------------|
| **PAPER** | High-performance (default) | Yes | No | General use |
| **VANILLA** | Official Minecraft | No | No | Pure experience |
| **FORGE** | Forge mod server | No | Yes | Complex modpacks |
| **FABRIC** | Lightweight mods | No | Yes | Performance mods |
| **PURPUR** | Paper fork | Yes | No | Advanced customization |

## REST API Reference

Admin Service provides a REST API (port 3001) for programmatic access.

### Authentication

```bash
# API Key (recommended)
curl -H "X-API-Key: mctk_xxx" http://localhost:3001/api/servers

# Basic Auth
curl -u admin:password http://localhost:3001/api/servers
```

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/servers` | List all servers |
| GET | `/api/servers/:name` | Get server details |
| POST | `/api/servers/:name/start` | Start server |
| POST | `/api/servers/:name/stop` | Stop server |
| POST | `/api/servers/:name/restart` | Restart server |
| POST | `/api/servers/:name/exec` | Execute RCON command |
| GET | `/api/servers/:name/logs` | Get logs (supports SSE) |
| GET | `/api/worlds` | List all worlds |
| POST | `/api/worlds/:name/assign` | Assign world to server |
| POST | `/api/worlds/:name/release` | Release world lock |

### Example: Execute Command

```bash
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"command": "list"}' \
  http://localhost:3001/api/servers/survival/exec
```

## Common Use Cases

### Setting Up a New Server

```bash
mcctl init                        # First time only
mcctl create myserver -t PAPER -v 1.21.1
# Connect via myserver.<HOST_IP>.nip.io:25565
```

### Setting Up a Modded Server

```bash
mcctl create modded -t FORGE -v 1.20.4
mcctl mod search create           # Search mods
mcctl mod add modded create jei journeymap
mcctl stop modded && mcctl start modded
```

### Performance Fabric Server

```bash
mcctl create perf -t FABRIC -v 1.21.1
mcctl config perf MODRINTH_PROJECTS "fabric-api,lithium,starlight,krypton"
mcctl config perf MODRINTH_DOWNLOAD_DEPENDENCIES required
mcctl stop perf && mcctl start perf
```

### Managing Players

```bash
mcctl whitelist myserver add Steve
mcctl op myserver add Notch
mcctl kick myserver Griefer "Griefing not allowed"
mcctl ban myserver add Griefer "Repeated griefing"
```

### Using Admin Web Console

```bash
mcctl console init                # Interactive setup
mcctl console service start       # Start services
# Access http://localhost:3000
```

## FAQ

### Q: How do I connect to my server?
A: Use `<server>.<your-ip>.nip.io:25565` (works everywhere) or `<server>.local:25565` (requires mDNS/avahi).

### Q: Why does my server auto-stop?
A: mc-router auto-scales servers. They stop after 10 minutes of no players. They auto-start when someone connects.

### Q: How do I add mods?
A: Use `mcctl mod add <server> <mod-name>`. Default source is Modrinth. Use `--curseforge` for CurseForge mods.

### Q: Where is world data stored?
A: All worlds are in `~/minecraft-servers/worlds/`. They're shared across servers using locks.

### Q: How do I backup my server?
A: Use `mcctl server-backup <server>` for config. For worlds, configure GitHub in `.env` and use `mcctl backup push`.

### Q: What server types are supported?
A: PAPER (default, recommended), VANILLA, FORGE, NEOFORGE, FABRIC, PURPUR, SPIGOT, BUKKIT, QUILT.

### Q: What are the system requirements?
A: Node.js >= 18.0.0, Docker Engine >= 24.0.0, Docker Compose >= 2.20.0. The `include` feature in docker-compose requires v2.20.0 or higher.

### Q: How do I enable cheats?
A: Use `mcctl config <server> --cheats` or set `ALLOW_CHEATS=true`.

### Q: How do I change memory?
A: Use `mcctl config <server> MEMORY 8G` then restart the server.

### Q: What is the Admin Service?
A: Web console (port 3000) + REST API (port 3001). Initialize with `mcctl console init` and start with `mcctl console service start`.

### Q: How do I use the REST API?
A: After `mcctl console init`, use the generated API key with `X-API-Key` header. See REST API Reference section.

### Q: How do I optimize performance?
A: Use `mcctl config <server> USE_AIKAR_FLAGS true`. For modded servers, increase MEMORY to 6-8G.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     mc-router (:25565)                       │
│                  hostname-based routing                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
    ┌─────────────────────┼─────────────────────┐
    ▼                     ▼                     ▼
┌─────────┐         ┌─────────┐         ┌─────────┐
│ mc-srv1 │         │ mc-srv2 │         │ mc-srv3 │
│ :25566  │         │ :25567  │         │ :25568  │
└────┬────┘         └────┬────┘         └────┬────┘
     │                   │                   │
     └───────────────────┴───────────────────┘
                         │
              ┌──────────▼──────────┐
              │     worlds/         │
              │  (shared storage)   │
              └─────────────────────┘
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `HOST_IP` | Your IP for nip.io hostnames |
| `HOST_IPS` | Multiple IPs for VPN mesh (comma-separated) |
| `RCON_PASSWORD` | Default RCON password |
| `DEFAULT_MEMORY` | Default memory allocation (e.g., 4G) |
| `CF_API_KEY` | CurseForge API key (for mods) |
| `BACKUP_GITHUB_TOKEN` | GitHub PAT for backup |
| `BACKUP_GITHUB_REPO` | Backup repository (user/repo) |

## Troubleshooting

### Server won't start
- Check logs: `mcctl logs <server>`
- Verify Docker is running: `docker ps`
- Check config: `mcctl config <server>`

### Can't connect to server
- Check if running: `mcctl status <server>`
- Use nip.io hostname if mDNS fails
- Verify mc-router: `mcctl status router`

### Mod errors
- Verify Minecraft version matches mod requirements
- Check mod compatibility with server type
- View mod config: `mcctl mod list <server>`

### API connection issues
- Check service status: `mcctl console service status`
- Verify API key: check `~/minecraft-servers/api.key`
- Test health: `curl http://localhost:3001/health`

## Links

- **GitHub**: https://github.com/smallmiro/minecraft-server-manager
- **Documentation**: https://minecraft-server-manager.readthedocs.io/
- **REST API Docs**: https://minecraft-server-manager.readthedocs.io/en/latest/api/
- **AI Assistant**: https://notebooklm.google.com/notebook/e91b656e-0d95-45b4-a961-fb1610b13962
- **itzg/minecraft-server**: https://hub.docker.com/r/itzg/minecraft-server/
