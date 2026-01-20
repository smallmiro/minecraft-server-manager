# Command Reference

Complete reference for all mcctl commands.

## Platform Commands

### mcctl init

Initialize the platform directory structure.

```bash
mcctl init [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--root <path>` | Custom data directory |
| `--skip-validation` | Skip Docker validation |
| `--skip-docker` | Skip Docker check |

**Example:**

```bash
# Initialize in default location (~/minecraft-servers)
mcctl init

# Initialize in custom location
mcctl --root /opt/minecraft init
```

**What it creates:**

```text
~/minecraft-servers/
├── docker-compose.yml
├── .env
├── servers/
│   ├── compose.yml
│   └── _template/
├── worlds/
├── shared/
│   ├── plugins/
│   └── mods/
├── scripts/
└── backups/
```

---

### mcctl up

Start all infrastructure (mc-router and all Minecraft servers).

```bash
mcctl up
```

**Example:**

```bash
mcctl up
```

Equivalent to `docker compose up -d`.

---

### mcctl down

Stop all infrastructure and remove network.

```bash
mcctl down
```

**Example:**

```bash
mcctl down
```

Stops all mc-* containers and runs `docker compose down`.

---

### mcctl router

Manage mc-router independently from Minecraft servers.

```bash
mcctl router <action>
```

**Actions:**

| Action | Description |
|--------|-------------|
| `start` | Start mc-router only |
| `stop` | Stop mc-router only |
| `restart` | Restart mc-router |

**Examples:**

```bash
# Start mc-router
mcctl router start

# Stop mc-router
mcctl router stop

# Restart mc-router (useful after configuration changes)
mcctl router restart
```

mc-router handles hostname-based routing for all Minecraft servers. It must be running for clients to connect to any server.

---

### mcctl status

Show status of all servers with various display options.

```bash
mcctl status [options]
mcctl status <server>
mcctl status router
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--detail` | `-d` | Show detailed info (memory, CPU, players, uptime) |
| `--watch` | `-W` | Real-time monitoring mode |
| `--interval <sec>` | | Watch refresh interval (default: 5) |
| `--json` | | Output in JSON format |

**Examples:**

=== "Basic Status"
    ```bash
    mcctl status
    ```

=== "Detailed Status"
    ```bash
    mcctl status --detail
    ```

=== "Real-time Monitoring"
    ```bash
    # Default 5 second refresh
    mcctl status --watch

    # Custom 2 second refresh
    mcctl status --watch --interval 2
    ```

=== "Single Server"
    ```bash
    mcctl status myserver
    ```

=== "Router Status"
    ```bash
    mcctl status router
    ```

**Detailed Output Example:**

```
=== Detailed Server Status ===

INFRASTRUCTURE

  mc-router
    Status:    running (healthy)
    Port:      25565
    Mode:      --in-docker (auto-discovery)
    Uptime:    3d 14h 22m
    Routes:    2 configured
      - myserver.local → mc-myserver:25565
      - creative.local → mc-creative:25565

MINECRAFT SERVERS

  myserver
    Container: mc-myserver
    Status:    running (healthy)
    Hostname:  myserver.192.168.1.100.nip.io
    Type:      PAPER
    Version:   1.21.1
    Memory:    4G
    Uptime:    2d 8h 15m
    Resources: 2.1 GB / 4.0 GB (52.5%) | CPU: 15.2%
    Players:   3/20 - Steve, Alex, Notch
```

---

## Server Commands

### mcctl create

Create a new Minecraft server.

```bash
mcctl create [name] [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `name` | Server name (optional, prompts if not provided) |

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--type` | `-t` | Server type: PAPER, VANILLA, FORGE, FABRIC, SPIGOT, BUKKIT, PURPUR, QUILT |
| `--version` | `-v` | Minecraft version (e.g., 1.21.1) |
| `--seed` | `-s` | World seed for generation |
| `--world-url` | `-u` | Download world from ZIP URL |
| `--world` | `-w` | Use existing world from worlds/ directory |
| `--no-start` | | Create without starting |

**Examples:**

=== "Interactive Mode"
    ```bash
    mcctl create
    # Prompts for all options
    ```

=== "CLI Mode"
    ```bash
    # Basic Paper server
    mcctl create myserver

    # Forge server with specific version
    mcctl create modded -t FORGE -v 1.20.4

    # Server with world seed
    mcctl create survival -t PAPER -v 1.21.1 -s 12345

    # Using existing world
    mcctl create legacy -w old-world -v 1.20.4

    # Create without starting
    mcctl create myserver --no-start
    ```

**Server Types:**

| Type | Description | Plugins | Mods |
|------|-------------|---------|------|
| `PAPER` | High performance (Recommended) | Yes | No |
| `VANILLA` | Official Minecraft server | No | No |
| `FORGE` | Modded server for Forge mods | No | Yes |
| `FABRIC` | Lightweight modded server | No | Yes |
| `SPIGOT` | Modified Bukkit server | Yes | No |
| `BUKKIT` | Classic plugin server | Yes | No |
| `PURPUR` | Paper fork with more features | Yes | No |
| `QUILT` | Modern modding toolchain | No | Yes |

---

### mcctl delete

Delete a server.

```bash
mcctl delete [name] [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `name` | Server name (optional, shows list if not provided) |

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--force` | `-y` | Skip confirmation |

!!! warning "World Data Preserved"
    `mcctl delete` removes the server configuration but preserves world data in the `worlds/` directory.

**Examples:**

```bash
# Interactive - shows server list
mcctl delete

# Delete specific server with confirmation
mcctl delete myserver

# Force delete without confirmation
mcctl delete myserver --force
```

---

### mcctl start

Start a stopped server or all servers.

```bash
mcctl start <name>
mcctl start --all
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--all` | `-a` | Start all Minecraft servers (not router) |

**Examples:**

```bash
# Start single server
mcctl start myserver

# Start all servers
mcctl start --all
```

!!! tip "Auto-Start"
    With mc-router, servers automatically start when a player connects.

---

### mcctl stop

Stop a running server or all servers.

```bash
mcctl stop <name>
mcctl stop --all
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--all` | `-a` | Stop all Minecraft servers (not router) |

**Examples:**

```bash
# Stop single server
mcctl stop myserver

# Stop all servers
mcctl stop --all
```

---

### mcctl logs

View server logs.

```bash
mcctl logs <name> [options]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--follow` | `-f` | Follow log output |
| `--lines` | `-n` | Number of lines to show |

**Examples:**

```bash
# Show last 50 lines
mcctl logs myserver

# Follow logs in real-time
mcctl logs myserver -f

# Show last 100 lines
mcctl logs myserver -n 100
```

---

### mcctl console

Connect to server RCON console.

```bash
mcctl console <name>
```

**Example:**

```bash
mcctl console myserver
```

```
> list
There are 2 of a max of 20 players online: Steve, Alex
> say Hello everyone!
> tp Steve Alex
```

Press `Ctrl+C` to exit.

---

### mcctl exec

Execute a single RCON command on a server.

```bash
mcctl exec <server> <command...>
```

**Examples:**

```bash
# Say message to all players
mcctl exec myserver say "Hello everyone!"

# Give items to player
mcctl exec myserver give Steve diamond 64

# List online players
mcctl exec myserver list

# Change weather
mcctl exec myserver weather clear

# Set time
mcctl exec myserver time set day
```

---

### mcctl config

View or modify server configuration.

```bash
mcctl config <server> [key] [value] [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `server` | Server name |
| `key` | Configuration key (optional) |
| `value` | New value (optional) |

**Shortcut Options:**

| Option | Description |
|--------|-------------|
| `--cheats` | Enable cheats (ALLOW_CHEATS=true) |
| `--no-cheats` | Disable cheats |
| `--pvp` | Enable PvP |
| `--no-pvp` | Disable PvP |
| `--command-block` | Enable command blocks |
| `--no-command-block` | Disable command blocks |

**Examples:**

=== "View All Config"
    ```bash
    mcctl config myserver
    ```

=== "View Single Key"
    ```bash
    mcctl config myserver MOTD
    ```

=== "Set Value"
    ```bash
    mcctl config myserver MOTD "Welcome to my server!"
    mcctl config myserver MAX_PLAYERS 50
    ```

=== "Use Shortcuts"
    ```bash
    mcctl config myserver --cheats
    mcctl config myserver --no-pvp
    mcctl config myserver --command-block
    ```

!!! note "Restart Required"
    Some configuration changes require a server restart to take effect.

---

## Server Backup & Restore

### mcctl server-backup

Backup server configuration (config.env, docker-compose.yml).

```bash
mcctl server-backup <server> [options]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--message` | `-m` | Backup description |
| `--list` | | List all backups for server |
| `--json` | | Output in JSON format |

**Examples:**

```bash
# Backup with message
mcctl server-backup myserver -m "Before upgrade"

# List all backups
mcctl server-backup myserver --list
```

---

### mcctl server-restore

Restore server configuration from backup.

```bash
mcctl server-restore <server> [backup-id] [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation |
| `--dry-run` | Show what would be restored |
| `--json` | Output in JSON format |

**Examples:**

```bash
# Interactive - shows backup list
mcctl server-restore myserver

# Restore specific backup
mcctl server-restore myserver abc123

# Preview restoration
mcctl server-restore myserver abc123 --dry-run
```

---

## Player Management

### mcctl op

Manage server operators.

```bash
mcctl op <server> <action> [player]
```

**Actions:**

| Action | Description |
|--------|-------------|
| `list` | Show current operators |
| `add <player>` | Add operator (updates RCON + config.env) |
| `remove <player>` | Remove operator |

**Examples:**

```bash
# List operators
mcctl op myserver list

# Add operator
mcctl op myserver add Steve

# Remove operator
mcctl op myserver remove Steve
```

---

### mcctl whitelist

Manage server whitelist.

```bash
mcctl whitelist <server> <action> [player]
```

**Actions:**

| Action | Description |
|--------|-------------|
| `list` | Show whitelisted players |
| `add <player>` | Add to whitelist |
| `remove <player>` | Remove from whitelist |
| `on` | Enable whitelist |
| `off` | Disable whitelist |
| `status` | Show whitelist status |

**Examples:**

```bash
# List whitelisted players
mcctl whitelist myserver list

# Add player
mcctl whitelist myserver add Steve

# Enable whitelist
mcctl whitelist myserver on

# Check status
mcctl whitelist myserver status
```

---

### mcctl ban

Manage player and IP bans.

```bash
mcctl ban <server> <action> [target] [reason]
mcctl ban <server> ip <action> [ip] [reason]
```

**Player Ban Actions:**

| Action | Description |
|--------|-------------|
| `list` | Show banned players |
| `add <player> [reason]` | Ban player |
| `remove <player>` | Unban player |

**IP Ban Actions:**

| Action | Description |
|--------|-------------|
| `ip list` | Show banned IPs |
| `ip add <ip> [reason]` | Ban IP address |
| `ip remove <ip>` | Unban IP address |

**Examples:**

```bash
# List banned players
mcctl ban myserver list

# Ban player with reason
mcctl ban myserver add Griefer "Destroying buildings"

# Unban player
mcctl ban myserver remove Griefer

# List banned IPs
mcctl ban myserver ip list

# Ban IP
mcctl ban myserver ip add 192.168.1.100 "Spam"
```

---

### mcctl kick

Kick a player from the server.

```bash
mcctl kick <server> <player> [reason]
```

**Examples:**

```bash
# Kick player
mcctl kick myserver Steve

# Kick with reason
mcctl kick myserver Steve "AFK too long"
```

---

### mcctl player online

Show online players on servers.

```bash
mcctl player online <server>
mcctl player online --all
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--all` | `-a` | Show players on all servers |
| `--json` | | Output in JSON format |

**Examples:**

```bash
# Single server
mcctl player online myserver

# All servers
mcctl player online --all
```

**Output:**

```
Online Players for myserver:

  Status: Running (3/20)

  Steve
  Alex
  Notch
```

---

## World Management

### mcctl world list

List all worlds with their lock status.

```bash
mcctl world list [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Example:**

```bash
mcctl world list
```

**Output:**

```
Worlds:

  survival
    Status: locked: mc-myserver
    Size: 256 MB
    Path: /home/user/minecraft-servers/worlds/survival

  creative
    Status: unlocked
    Size: 128 MB
    Path: /home/user/minecraft-servers/worlds/creative
```

---

### mcctl world assign

Lock a world to a server.

```bash
mcctl world assign [world] [server]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `world` | World name (optional, prompts if not provided) |
| `server` | Server name (optional, prompts if not provided) |

**Examples:**

=== "Interactive Mode"
    ```bash
    mcctl world assign
    # Shows world list, then server list
    ```

=== "CLI Mode"
    ```bash
    mcctl world assign survival mc-myserver
    ```

!!! info "World Locking"
    A locked world can only be used by the assigned server. This prevents data corruption from simultaneous access.

---

### mcctl world release

Release a world lock.

```bash
mcctl world release [world] [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `world` | World name (optional, prompts if not provided) |

**Options:**

| Option | Description |
|--------|-------------|
| `--force` | Force release even if server is running |

**Examples:**

```bash
# Interactive - shows locked worlds
mcctl world release

# Release specific world
mcctl world release survival
```

---

## Backup Management

### mcctl backup status

Show backup configuration status.

```bash
mcctl backup status [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Example:**

```bash
mcctl backup status
```

**Output (configured):**

```
Backup Configuration:

  Status: Configured
  Repository: user/minecraft-worlds-backup
  Branch: main
  Last backup: 2024-01-15 14:30:00
  Auto backup: enabled
```

**Output (not configured):**

```
Backup Configuration:

  Status: Not configured

  To enable backups, set in .env:
    BACKUP_GITHUB_TOKEN=your-token
    BACKUP_GITHUB_REPO=username/repo
```

---

### mcctl backup push

Push world data to GitHub repository.

```bash
mcctl backup push [options]
```

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--message` | `-m` | Commit message |

**Examples:**

=== "Interactive Mode"
    ```bash
    mcctl backup push
    # Prompts for commit message
    ```

=== "CLI Mode"
    ```bash
    mcctl backup push -m "Before server upgrade"
    ```

---

### mcctl backup history

Show backup history.

```bash
mcctl backup history [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Example:**

```bash
mcctl backup history
```

**Output:**

```
Backup History:

  abc1234  Before server upgrade  2024-01-15
  def5678  Weekly backup          2024-01-08
  ghi9012  Initial backup         2024-01-01
```

---

### mcctl backup restore

Restore world data from a backup.

```bash
mcctl backup restore [commit]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `commit` | Commit hash (optional, shows list if not provided) |

**Examples:**

=== "Interactive Mode"
    ```bash
    mcctl backup restore
    # Shows backup history for selection
    ```

=== "CLI Mode"
    ```bash
    mcctl backup restore abc1234
    ```

!!! danger "Data Overwrite"
    Restore will overwrite current world data. Make sure to backup before restoring.

---

## Player Utilities

### mcctl player lookup

Look up player information from Mojang API.

```bash
mcctl player lookup <name> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Example:**

```bash
mcctl player lookup Notch
```

---

### mcctl player uuid

Get player UUID.

```bash
mcctl player uuid <name> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--offline` | Generate offline UUID |
| `--json` | Output in JSON format |

**Examples:**

```bash
# Online UUID (from Mojang)
mcctl player uuid Notch

# Offline UUID (for offline-mode servers)
mcctl player uuid Steve --offline
```

---

## Global Options Reference

These options work with all commands:

| Option | Description | Example |
|--------|-------------|---------|
| `--root <path>` | Custom data directory | `mcctl --root /opt/mc status` |
| `--json` | JSON output format | `mcctl status --json` |
| `-h, --help` | Show help | `mcctl --help` |
| `--version` | Show version | `mcctl --version` |
