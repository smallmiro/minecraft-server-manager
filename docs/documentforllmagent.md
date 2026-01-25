# mcctl - Minecraft Server Management CLI

> **Version**: 2.0.0 (Admin Service)
> **Last Updated**: 2025-01-26
> **Purpose**: Knowledge base for LLM agents (ChatGPT, Gemini, Claude) to answer mcctl questions

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
mcctl world new <name>        # Create new world
mcctl world new <name> --seed 12345  # With seed
mcctl world assign <world> <server>  # Lock world to server
mcctl world release <world>   # Release lock
mcctl world delete <world>    # Delete world
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

### Migration

```bash
mcctl migrate status              # Check migration status
mcctl migrate worlds              # Migrate to shared directory
mcctl migrate worlds --all        # Migrate all servers
mcctl migrate worlds --dry-run    # Preview changes
```

### Admin Service (v2.0.0)

```bash
# Initialization
mcctl admin init              # Initialize admin service
mcctl admin init --force      # Reinitialize

# User management
mcctl admin user list         # List admin users
mcctl admin user add <name>   # Add user
mcctl admin user remove <name>  # Remove user
mcctl admin user reset <name>   # Reset password

# API management
mcctl admin api start         # Start API only
mcctl admin api stop          # Stop API
mcctl admin api status        # Check status

# Service lifecycle
mcctl admin service start     # Start all (API + Console)
mcctl admin service stop      # Stop all
mcctl admin service restart   # Restart services
mcctl admin service status    # Show status
mcctl admin service logs      # View logs
mcctl admin service logs -f   # Follow logs
mcctl admin service logs --api  # API logs only
mcctl admin service logs --console  # Console logs only
```

## Common Use Cases

### Setting Up a New Server

```bash
# 1. Initialize platform (first time only)
mcctl init

# 2. Create a server
mcctl create myserver -t PAPER -v 1.21.1

# 3. Server auto-starts, connect via:
#    myserver.local:25565 (mDNS)
#    myserver.<HOST_IP>.nip.io:25565 (nip.io)
```

### Setting Up a Modded Server

```bash
# 1. Create Forge server
mcctl create modded -t FORGE -v 1.20.4

# 2. Search and add mods
mcctl mod search sodium
mcctl mod add modded sodium lithium

# 3. Restart to apply
mcctl stop modded && mcctl start modded
```

### Managing Players

```bash
# Add player to whitelist
mcctl whitelist myserver add Steve

# Give operator permissions
mcctl op myserver add Notch

# Kick troublemaker
mcctl kick myserver Griefer "Griefing not allowed"

# Ban player
mcctl ban myserver add Griefer "Repeated griefing"
```

### Using Admin Web Console

```bash
# 1. Initialize admin service
mcctl admin init

# 2. Start services
mcctl admin service start

# 3. Access web console at http://localhost:3000

# 4. Check status
mcctl admin service status
```

## FAQ

### Q: How do I connect to my server?
A: Use `<server-name>.local:25565` (requires mDNS/avahi) or `<server-name>.<your-ip>.nip.io:25565` (works anywhere).

### Q: Why does my server auto-stop?
A: mc-router auto-scales servers. They stop after 10 minutes of no players. They auto-start when someone connects.

### Q: How do I add mods?
A: Use `mcctl mod add <server> <mod-name>`. Default source is Modrinth. Use `--curseforge` for CurseForge mods.

### Q: Where is world data stored?
A: All worlds are in `~/minecraft-servers/worlds/`. They're shared across servers using locks.

### Q: How do I backup my server?
A: Use `mcctl server-backup <server>` for config backup. For world backup, configure GitHub in `.env` and use `mcctl backup push`.

### Q: What server types are supported?
A: PAPER (default), VANILLA, FORGE, NEOFORGE, FABRIC. Set with `-t` flag on create.

### Q: How do I enable cheats?
A: Use `mcctl config <server> --cheats` or set `ALLOW_CHEATS=true` in config.env.

### Q: How do I change the MOTD?
A: Use `mcctl config <server> MOTD "Your message here"`.

### Q: What is the Admin Service?
A: It's a web-based management console (mcctl-console on port 3000) backed by a REST API (mcctl-api on port 3001). Initialize with `mcctl admin init` and start with `mcctl admin service start`.

### Q: How do I check server status?
A: Use `mcctl status` for all servers or `mcctl status <server>` for a specific one. Add `--detail` for memory/CPU info.

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
| `RCON_PASSWORD` | Default RCON password |
| `MCCTL_SUDO_PASSWORD` | Sudo password for automation |
| `CF_API_KEY` | CurseForge API key (for mods) |

## Troubleshooting

### Server won't start
- Check logs: `mcctl logs <server>`
- Verify Docker is running: `docker ps`
- Check config: `mcctl config <server>`

### Can't connect to server
- Check if server is running: `mcctl status <server>`
- Verify hostname: use nip.io if mDNS doesn't work
- Check mc-router: `mcctl status router`

### Mod errors
- Verify Minecraft version matches mod requirements
- Check mod compatibility with server type (Forge mods need Forge server)
- View mod config: `mcctl mod list <server>`

## Links

- **GitHub**: https://github.com/smallmiro/minecraft-server-manager
- **Documentation**: https://docker-minecraft-server.readthedocs.io/
- **itzg/minecraft-server**: https://hub.docker.com/r/itzg/minecraft-server/
