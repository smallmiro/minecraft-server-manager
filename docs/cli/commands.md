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

**Configuration:**

mc-router settings are configured via environment variables in `.env` file:

```bash
# Auto-scaling settings
AUTO_SCALE_UP=true              # Auto-start servers on player connect
AUTO_SCALE_DOWN=true            # Auto-stop idle servers
AUTO_SCALE_DOWN_AFTER=10m       # Idle timeout (1m, 5m, 10m, 30m, 1h)
DOCKER_TIMEOUT=120              # Container start timeout in seconds

# Custom MOTD for sleeping servers
AUTO_SCALE_ASLEEP_MOTD=§e§lServer is sleeping§r\n§7Connect to wake up!
```

After changing `.env`, restart mc-router with `mcctl router restart`.

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

    **Output:**
    ```
    === Server Status (mc-router Managed) ===

    INFRASTRUCTURE
    SERVICE              STATUS       HEALTH     PORT/INFO
    -------              ------       ------     ---------
    mc-router            running      healthy    :25565 (hostname routing)
    avahi-daemon         running      (system)   mDNS broadcast

    MINECRAFT SERVERS
    SERVER               STATUS       HEALTH     HOSTNAME
    ------               ------       ------     --------
    survival             running      healthy    survival.local,survival.192.168.1.100.nip.io
    ```

=== "Detailed Status"
    ```bash
    mcctl status --detail
    ```

    **Output:**
    ```
    === Detailed Server Status ===

    INFRASTRUCTURE

      mc-router
        Status:    running (healthy)
        Port:      25565
        Mode:      --in-docker (auto-discovery)
        Uptime:    1d 1h 27m
        Routes:    2 configured
          - survival.local → mc-survival:25565
          - survival.192.168.1.100.nip.io → mc-survival:25565

      avahi-daemon
        Status:    running
        Type:      system

    MINECRAFT SERVERS

      survival
        Container: mc-survival
        Status:    running (healthy)
        Hostname:  survival.local,survival.192.168.1.100.nip.io
        Type:      PAPER
        Version:   1.21.1
        Memory:    4G
        Uptime:    1d 1h 16m
        Resources: 3.1 GB / 8.0 GB (38.8%) | CPU: 15.2%
        Players:   2/20 - Steve, Alex
    ```

=== "JSON Output"
    ```bash
    mcctl status --json
    ```

    **Output:**
    ```json
    {
      "router": {
        "name": "mc-router",
        "status": "running",
        "health": "healthy",
        "port": 25565
      },
      "avahi_daemon": {
        "name": "avahi-daemon",
        "status": "running",
        "type": "system"
      },
      "servers": [
        {
          "name": "survival",
          "container": "mc-survival",
          "status": "running",
          "health": "healthy",
          "hostname": "survival.local,survival.192.168.1.100.nip.io"
        }
      ]
    }
    ```

=== "Single Server"
    ```bash
    mcctl status survival
    ```

    **Output:**
    ```
    === Server: survival ===

      survival
        Container: mc-survival
        Status:    running (healthy)
        Hostname:  survival.local,survival.192.168.1.100.nip.io
        Type:      PAPER
        Version:   1.21.1
        Memory:    4G
        Uptime:    1d 1h 16m
        Resources: 3.1 GB / 8.0 GB (38.8%) | CPU: 18.2%
        Players:   2/20 - Steve, Alex
    ```

=== "Router Status"
    ```bash
    mcctl status router
    ```

    **Output:**
    ```
    === mc-router Status ===

      Status:    running (healthy)
      Port:      25565
      Mode:      --in-docker (auto-discovery)
      Uptime:    1d 1h 27m

    ROUTING TABLE

      HOSTNAME                                 TARGET                    STATUS
      --------                                 ------                    ------
      survival.local                           mc-survival:25565         running
      survival.192.168.1.100.nip.io            mc-survival:25565         running
    ```

=== "Real-time Monitoring"
    ```bash
    # Default 5 second refresh
    mcctl status --watch

    # Custom 2 second refresh
    mcctl status --watch --interval 2
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
| `--type` | `-t` | Server type: PAPER, VANILLA, FORGE, NEOFORGE, FABRIC, SPIGOT, BUKKIT, PURPUR, QUILT, MODRINTH |
| `--version` | `-v` | Minecraft version (e.g., 1.21.1) |
| `--seed` | `-s` | World seed for generation |
| `--world-url` | `-u` | Download world from ZIP URL |
| `--world` | `-w` | Use existing world from worlds/ directory |
| `--modpack` | | Enable Modrinth modpack server creation (interactive search) |
| `--no-start` | | Create without starting |
| `--sudo-password` | | Sudo password for mDNS registration (automation) |

!!! tip "Automation with Sudo Password"
    When automating server creation in CI/CD pipelines, you can provide the sudo password for mDNS registration:

    - Environment variable: `MCCTL_SUDO_PASSWORD`
    - CLI option: `--sudo-password`

    If avahi-daemon is installed and no password is provided, you will be prompted interactively.

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

=== "Modpack (Modrinth)"
    ```bash
    # Interactive modpack creation (search, select version, choose loader)
    mcctl create myserver --modpack

    # The CLI will guide you through:
    # 1. Search Modrinth for modpacks
    # 2. Select a modpack version
    # 3. Choose a mod loader (only supported loaders shown)
    # 4. Configure memory and other settings
    ```

=== "Automation (CI/CD)"
    ```bash
    # Using environment variable for sudo password
    export MCCTL_SUDO_PASSWORD="your-password"
    mcctl create myserver -t PAPER -v 1.21.1

    # Using --sudo-password option
    mcctl create myserver --sudo-password "your-password"
    ```

**Server Types:**

| Type | Description | Plugins | Mods |
|------|-------------|---------|------|
| `PAPER` | High performance (Recommended) | Yes | No |
| `VANILLA` | Official Minecraft server | No | No |
| `FORGE` | Modded server for Forge mods | No | Yes |
| `NEOFORGE` | Modern Forge fork (1.20.1+) | No | Yes |
| `FABRIC` | Lightweight modded server | No | Yes |
| `SPIGOT` | Modified Bukkit server | Yes | No |
| `BUKKIT` | Classic plugin server | Yes | No |
| `PURPUR` | Paper fork with more features | Yes | No |
| `QUILT` | Modern modding toolchain | No | Yes |
| `MODRINTH` | Modrinth modpack server | No | Yes |

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
| `--sudo-password` | | Sudo password for mDNS deregistration (automation) |

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

# Automation with sudo password
MCCTL_SUDO_PASSWORD="your-password" mcctl delete myserver --force
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
mcctl logs survival

# Follow logs in real-time
mcctl logs survival -f

# Show last 10 lines
mcctl logs survival -n 10
```

**Output Example:**
```
[22:09:48] [Server thread/INFO]: Steve joined the game
[22:10:15] [Server thread/INFO]: Alex joined the game
[22:15:30] [Server thread/INFO]: <Steve> Hello everyone!
[22:15:45] [Server thread/INFO]: <Alex> Hi Steve!
[22:20:00] [Server thread/INFO]: Steve has made the advancement [Getting Wood]
[22:25:12] [Server thread/INFO]: Saving the game (this may take a moment!)
[22:25:12] [Server thread/INFO]: Saved the game
[22:30:00] [Server thread/INFO]: Alex left the game
[22:35:15] [RCON Listener #1/INFO]: Thread RCON Client started
[22:35:15] [RCON Client #1/INFO]: Thread RCON Client shutting down
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

### mcctl rcon

Connect to an interactive RCON console for a Minecraft server. This opens a persistent session where you can execute multiple commands.

```bash
mcctl rcon <server>
```

**Example:**

```bash
$ mcctl rcon survival
Connecting to RCON console for 'survival'...
Type "help" for commands, Ctrl+C or "exit" to quit

> list
There are 2 of 20 players online: Steve, Alex
> say Server maintenance in 10 minutes!
[Server: Server maintenance in 10 minutes!]
> tp Steve 0 100 0
Teleported Steve to 0.0, 100.0, 0.0
> exit
```

**When to use `rcon` vs `exec`:**

| Command | Mode | Use Case |
|---------|------|----------|
| `mcctl rcon <server>` | Interactive | Manual administration, debugging, multiple commands |
| `mcctl exec <server> <cmd>` | Non-interactive | Scripts, automation, CI/CD, single commands |

For a complete list of available RCON commands, see [RCON Commands Reference](rcon-commands.md).

---

### mcctl exec

Execute a single RCON command on a server. This is the non-interactive alternative to `mcctl rcon`, useful for scripts and automation.

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

# Use in scripts
PLAYERS=$(mcctl exec myserver list)
if echo "$PLAYERS" | grep -q "0 of"; then
  mcctl stop myserver
fi
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
    mcctl config survival
    ```

    **Output:**
    ```
    Configuration for survival:

      TYPE=PAPER
      VERSION=1.21.1
      MEMORY=4G
      GAMEMODE=survival
      DIFFICULTY=normal
      MAX_PLAYERS=20
      VIEW_DISTANCE=10
      PVP=true
      SPAWN_PROTECTION=0
      LEVEL=survival-world
      ENABLE_RCON=true
      MOTD=Welcome to survival! Your adventure begins here.
      ALLOW_CHEATS=false
      ENABLE_COMMAND_BLOCK=true
      OPS=Steve
    ```

=== "View Single Key"
    ```bash
    mcctl config survival MOTD
    ```

=== "Set Value"
    ```bash
    mcctl config survival MOTD "Welcome to my server!"
    mcctl config survival MAX_PLAYERS 50
    ```

=== "Use Shortcuts"
    ```bash
    mcctl config survival --cheats
    mcctl config survival --no-pvp
    mcctl config survival --command-block
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
mcctl server-backup survival -m "Before upgrade"

# List all backups
mcctl server-backup survival --list
```

**Output Example (--list):**
```
Backups for survival:

  20260120-203357
    Created: 1/20/2026, 8:33:57 PM
    Size: 3 KB, Files: 7
    Description: Before upgrade

  20260118-150000
    Created: 1/18/2026, 3:00:00 PM
    Size: 3 KB, Files: 7
    Description: Initial setup
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
mcctl op survival list

# Add operator
mcctl op survival add Steve

# Remove operator
mcctl op survival remove Steve
```

**Output Example (list):**
```
Operators for survival:

  Steve
  Alex
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
mcctl whitelist survival list

# Add player
mcctl whitelist survival add Steve

# Enable whitelist
mcctl whitelist survival on

# Check status
mcctl whitelist survival status
```

**Output Example (list):**
```
Whitelist for survival:

  Steve
  Alex
  Notch
```

**Output Example (status):**
```
Whitelist Status for survival:

  Enabled: Yes
  Players: 3
  Running: Yes
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
mcctl ban survival list

# Ban player with reason
mcctl ban survival add Griefer "Griefing spawn area"

# Unban player
mcctl ban survival remove Griefer

# List banned IPs
mcctl ban survival ip list

# Ban IP
mcctl ban survival ip add 192.168.1.100 "Spam"
```

**Output Example (list):**
```
Banned Players for survival:

  Griefer (Reason: Griefing spawn area)
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

=== "Single Server"
    ```bash
    mcctl player online survival
    ```

    **Output:**
    ```
    Online Players for survival:

      Status: Running (2/20)

      Players:
        - Steve
        - Alex
    ```

=== "All Servers"
    ```bash
    mcctl player online --all
    ```

    **Output:**
    ```
    Online Players (All Servers):

      survival: 2 players
        - Steve
        - Alex

      creative: 0 players

      Total: 2 players online
    ```

---

## World Management

### mcctl world new

Create a new world directory with optional seed configuration.

```bash
mcctl world new [name] [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `name` | World name (optional, prompts if not provided) |

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--seed` | `-s` | World seed for generation |
| `--server` | | Server to assign world to (also sets SEED in config) |
| `--no-start` | | Don't auto-start server after assignment |

**Examples:**

=== "Interactive Mode"
    ```bash
    mcctl world new
    # Prompts for:
    # 1. World name
    # 2. Optional seed
    # 3. Optional server assignment
    # 4. Auto-start preference (if server assigned)
    ```

=== "CLI Mode"
    ```bash
    # Create empty world directory
    mcctl world new myworld

    # Create world with specific seed
    mcctl world new myworld --seed 12345

    # Create and assign to server
    mcctl world new myworld --server myserver

    # Create with seed and assign to server
    mcctl world new myworld --seed 12345 --server myserver

    # Create and assign without auto-starting
    mcctl world new myworld --server myserver --no-start
    ```

**What it does:**

1. Creates world directory in `worlds/<name>/`
2. Creates `.seed` file if seed is provided (for reference)
3. If server assigned:
   - Updates server's `config.env` with `LEVEL=<world-name>`
   - Sets `SEED=<seed>` if provided
   - Optionally starts the server

!!! tip "Seed Behavior"
    The seed is applied via the server's `SEED` environment variable.
    The world is generated with this seed when the server first starts.

---

### mcctl world list

List all worlds with their lock status.

```bash
mcctl world list [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Examples:**

=== "Default Output"
    ```bash
    mcctl world list
    ```

    **Output:**
    ```
    Worlds:

      survival-world
        Status: locked (mc-survival)
        Size: 514.0MB
        Path: /home/myuser/minecraft-servers/worlds/survival-world

      creative-world
        Status: unlocked
        Size: 128.5MB
        Path: /home/myuser/minecraft-servers/worlds/creative-world
    ```

=== "JSON Output"
    ```bash
    mcctl world list --json
    ```

    **Output:**
    ```json
    [
      {
        "name": "survival-world",
        "path": "/home/myuser/minecraft-servers/worlds/survival-world",
        "isLocked": true,
        "lockedBy": "mc-survival",
        "size": "514.0MB",
        "lastModified": "2026-01-21T13:19:48.853Z"
      },
      {
        "name": "creative-world",
        "path": "/home/myuser/minecraft-servers/worlds/creative-world",
        "isLocked": false,
        "size": "128.5MB",
        "lastModified": "2026-01-20T10:30:00.000Z"
      }
    ]
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

### mcctl world delete

Permanently delete a world and all its data.

```bash
mcctl world delete [world] [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `world` | World name (optional, prompts if not provided) |

**Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--force` | `-f` | Skip confirmation prompt |
| `--json` | | Output in JSON format |

!!! danger "Permanent Deletion"
    This command permanently deletes all world data including:

    - World files (level.dat, region data, etc.)
    - Nether and End dimensions
    - Player data for that world

    **This action cannot be undone.** Make sure to backup important worlds before deletion.

**Examples:**

=== "Interactive Mode"
    ```bash
    mcctl world delete
    # Shows world list for selection
    # Asks for confirmation before deletion
    ```

=== "CLI Mode"
    ```bash
    # Delete with confirmation prompt
    mcctl world delete old-world

    # Force delete without confirmation
    mcctl world delete old-world --force
    ```

**Safety Features:**

- **Lock Check**: Cannot delete a world that is locked (assigned to a running server)
- **Confirmation Prompt**: Requires typing "DELETE" to confirm (unless `--force`)
- **Size Display**: Shows world size before deletion

**Output Example:**

```
World 'old-world' (512.5 MB) will be permanently deleted.

Type DELETE to confirm: DELETE

✓ World 'old-world' deleted
  Freed: 512.5 MB
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
=== Backup Status ===

Configuration: Configured
Repository:    myuser/minecraft-backup-repo
Branch:        main
Auto on stop:  true

Cache:         Exists
Last commit:   fd8633b
Last date:     2026-01-20 21:06:35 +0900

Worlds dir:    /home/myuser/minecraft-servers/worlds
Cache dir:     /home/myuser/.minecraft-backup

Backup Configuration:

  Status: Configured
  Repository: myuser/minecraft-backup-repo
  Branch: main
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

**Examples:**

=== "Default Output"
    ```bash
    mcctl backup history
    ```

    **Output:**
    ```
    Backup History:

      fd8633b  Backup: 2026-01-20 21:06:30       2026-01-20
      19a7a4d  Backup: 2026-01-20 20:21:06       2026-01-20
      7c2ad14  Manual backup                     2026-01-19
      ddeda27  Initial backup                    2026-01-17
    ```

=== "JSON Output"
    ```bash
    mcctl backup history --json
    ```

    **Output:**
    ```json
    {
      "history": [
        {"commit": "fd8633b", "date": "2026-01-20 21:06:35 +0900", "message": "Backup: 2026-01-20 21:06:30"},
        {"commit": "19a7a4d", "date": "2026-01-20 20:21:08 +0900", "message": "Backup: 2026-01-20 20:21:06"},
        {"commit": "7c2ad14", "date": "2026-01-19 22:50:42 +0900", "message": "Manual backup"},
        {"commit": "ddeda27", "date": "2026-01-17 23:43:24 +0900", "message": "Initial backup"}
      ]
    }
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

### mcctl player (Interactive Mode)

Unified player management with interactive workflow.

```bash
mcctl player
mcctl player <server>
```

**Examples:**

=== "Full Interactive"
    ```bash
    mcctl player
    # 1. Select server from list
    # 2. Select online player or enter name
    # 3. Select action (op/deop, whitelist, ban, kick, info)
    ```

=== "Server-Specific"
    ```bash
    mcctl player myserver
    # 1. Select online player or enter name
    # 2. Select action
    ```

The interactive mode provides:

- Server selection with status indicators
- Online player list with easy selection
- Action menu (op/deop, whitelist add/remove, ban/unban, kick, view info)
- Automatic server restart prompts when needed

---

### mcctl player info

Look up player information from Mojang API with encrypted local caching.

```bash
mcctl player info <name> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--offline` | Calculate offline-mode UUID instead of Mojang lookup |
| `--json` | Output in JSON format |

**Examples:**

```bash
# Look up player info (UUID, skin URL)
mcctl player info Notch

# Offline UUID calculation
mcctl player info Steve --offline

# JSON output for scripting
mcctl player info Notch --json
```

**Output:**

```
Player: Notch
  UUID: 069a79f4-44e9-4726-a5be-fca90e38aaf5
  Skin: http://textures.minecraft.net/texture/292009a4925b58f02c77dadc3ecef07ea4c7472f64e0fdc32ce5522489362680
  Source: mojang
```

**JSON Output:**

```json
{
  "username": "Notch",
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "skinUrl": "https://textures.minecraft.net/texture/...",
  "source": "mojang",
  "cached": true
}
```

!!! info "Player Cache"
    Player data is cached locally with AES-256-GCM encryption:

    - **UUID**: Cached permanently (never changes)
    - **Username**: Cached for 30 days (can change)
    - **Skin URL**: Cached for 1 day (changes frequently)

    Cache location: `~/.minecraft-docker/.player-cache`

---

### mcctl player cache

Manage the encrypted player data cache.

```bash
mcctl player cache <action>
```

**Actions:**

| Action | Description |
|--------|-------------|
| `stats` | Show cache statistics |
| `clear` | Clear all cached player data |

**Examples:**

```bash
# View cache statistics
mcctl player cache stats

# Clear all cached data
mcctl player cache clear
```

**Stats Output:**

```
Player Cache Statistics
  Players cached: 5
  Cache size: 2.1 KB
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

### mcctl player lookup (Legacy)

!!! note "Deprecated"
    Use `mcctl player info` instead. This command is kept for backward compatibility.

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

### mcctl player uuid (Legacy)

!!! note "Deprecated"
    Use `mcctl player info` or `mcctl player info --offline` instead.

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

## Migration Commands

### mcctl migrate status

Check migration status for all servers.

```bash
mcctl migrate status [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Example:**

```bash
mcctl migrate status
```

**Output:**

```
Migration Status:

  survival: needs migration
    Missing EXTRA_ARGS=--universe /worlds/
  creative: up to date

1 server(s) need migration.
Run: mcctl migrate worlds to migrate.
```

---

### mcctl migrate worlds

Migrate worlds to the shared `/worlds/` directory structure.

```bash
mcctl migrate worlds [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--all` | Migrate all servers without selection |
| `--dry-run` | Preview changes without applying |
| `--backup` | Create backup before migration |
| `--force` | Skip confirmation prompts |

**Examples:**

=== "Interactive Mode"
    ```bash
    mcctl migrate worlds
    # Shows servers needing migration, select one or all
    ```

=== "Migrate All"
    ```bash
    mcctl migrate worlds --all
    ```

=== "Dry Run"
    ```bash
    mcctl migrate worlds --dry-run
    ```

    **Output:**
    ```
    DRY RUN - No changes will be made

    Would migrate: survival
      1. Stop server if running
      2. Move world: servers/survival/data/world → worlds/survival
      3. Update config.env:
         - Add: EXTRA_ARGS=--universe /worlds/
         - Set: LEVEL=survival
    ```

=== "With Backup"
    ```bash
    mcctl migrate worlds --all --backup
    ```

**What Migration Does:**

1. **Stops server** if running
2. **Moves world data** from `servers/<name>/data/world` to `worlds/<server-name>/`
3. **Updates config.env**:
   - Adds `EXTRA_ARGS=--universe /worlds/`
   - Sets `LEVEL=<server-name>`
4. **Detects existing worlds** with case-insensitive matching

!!! info "World Storage Change"
    New servers created with `mcctl create` already use the `/worlds/` directory structure.
    This migration command is for existing servers created before this change.

---

## Mod Management

Manage mods and plugins for your Minecraft servers. mcctl integrates with multiple mod sources including Modrinth, CurseForge, Spiget (SpigotMC), and direct URL downloads.

### mcctl mod search

Search for mods on Modrinth.

```bash
mcctl mod search <query> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `query` | Search query (mod name, description keywords) |

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Examples:**

```bash
# Search for optimization mods
mcctl mod search sodium

# Search for world generation mods
mcctl mod search "world generation"

# JSON output for scripting
mcctl mod search lithium --json
```

**Output Example:**

```
Search results for "sodium" (25 total):

  sodium (12.5M downloads)
    Sodium server client
    A modern rendering engine for Minecraft

  sodium-extra (2.1M downloads)
    Sodium Extra server? client
    Extra options for Sodium

Use: mcctl mod add <server> <mod-slug> to install
```

The output shows:

- **Mod slug** (used for installation)
- **Download count** (popularity indicator)
- **Side requirements** (server/client/both)
- **Description** (truncated)

---

### mcctl mod add

Add mods to a server configuration.

```bash
mcctl mod add <server> <mod...> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `server` | Server name |
| `mod...` | One or more mod slugs/IDs |

**Options:**

| Option | Description |
|--------|-------------|
| `--modrinth` | Use Modrinth (default) |
| `--curseforge` | Use CurseForge (requires CF_API_KEY) |
| `--spiget` | Use Spiget (SpigotMC plugins) |
| `--url` | Direct JAR URL download |
| `--force` | Add even if mod not found or server type mismatch |
| `--json` | Output in JSON format |

**Examples:**

=== "Modrinth (Default)"
    ```bash
    # Add single mod
    mcctl mod add myserver sodium

    # Add multiple mods at once
    mcctl mod add myserver sodium lithium phosphor

    # Add to Fabric server
    mcctl mod add fabric-server fabric-api sodium lithium
    ```

=== "CurseForge"
    ```bash
    # Requires CF_API_KEY in .env file
    mcctl mod add myserver --curseforge jei journeymap

    # Add popular modpack mods
    mcctl mod add myserver --curseforge create applied-energistics-2
    ```

=== "Spiget (SpigotMC)"
    ```bash
    # Use resource IDs from SpigotMC
    mcctl mod add myserver --spiget 9089 1649

    # EssentialsX example (resource ID: 9089)
    mcctl mod add paper-server --spiget 9089
    ```

=== "Direct URL"
    ```bash
    # Download JAR directly from URL
    mcctl mod add myserver --url https://example.com/mod.jar

    # Multiple URLs
    mcctl mod add myserver --url https://example.com/mod1.jar https://example.com/mod2.jar
    ```

**How It Works:**

1. **Validation**: Verifies mod exists on Modrinth (if using Modrinth source)
2. **Server Type Check**: Warns if server type may not support mods
3. **Config Update**: Adds mod to appropriate environment variable in `config.env`
4. **Restart Required**: Server must be restarted to apply changes

**Environment Variables Used:**

| Source | Environment Variable | Server Types |
|--------|---------------------|--------------|
| Modrinth | `MODRINTH_PROJECTS` | All |
| CurseForge | `CURSEFORGE_FILES` | All (requires CF_API_KEY) |
| Spiget | `SPIGET_RESOURCES` | Paper, Spigot, Bukkit |
| URL | `MODS` | Forge, NeoForge, Fabric, Quilt |
| URL | `PLUGINS` | Paper, Spigot, Bukkit |

!!! warning "⚠️ Automatic Dependency Download"
    Mods often require other mods as dependencies (e.g., Iris requires Sodium).

    **By default, dependencies are automatically downloaded** via the `MODRINTH_DOWNLOAD_DEPENDENCIES=required` setting in `config.env`.

    | Setting | Behavior |
    |---------|----------|
    | `required` | Download required dependencies automatically **(DEFAULT, RECOMMENDED)** |
    | `optional` | Download required + optional dependencies |
    | `none` | Don't download dependencies (manual management) |

    **Example**: When you add `iris`, it automatically downloads `sodium` (required dependency).

    ```bash
    mcctl mod add myserver iris
    # ✓ iris added
    # ✓ sodium automatically downloaded on server start (required dependency)
    ```

**Output Example:**

```
Validating mods on Modrinth...
  ✓ Sodium (sodium)
  ✓ Lithium (lithium)

✓ Added 2 mod(s) to myserver

  sodium
  lithium

Config: MODRINTH_PROJECTS=sodium,lithium

Restart the server to apply changes:
  mcctl stop myserver && mcctl start myserver
```

---

### mcctl mod list

List configured mods for a server.

```bash
mcctl mod list <server> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `server` | Server name |

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Examples:**

```bash
# List mods for server
mcctl mod list myserver

# JSON output
mcctl mod list myserver --json
```

**Output Example:**

```
Mods for myserver (FABRIC):

  Modrinth:
    - sodium
    - lithium
    - phosphor

  CurseForge:
    - jei
    - journeymap

Total: 5 mod(s)
```

**JSON Output:**

```json
{
  "serverType": "FABRIC",
  "sources": [
    {"key": "MODRINTH_PROJECTS", "name": "Modrinth", "mods": ["sodium", "lithium"]},
    {"key": "CURSEFORGE_FILES", "name": "CurseForge", "mods": ["jei"]}
  ],
  "total": 3
}
```

---

### mcctl mod remove

Remove mods from a server configuration.

```bash
mcctl mod remove <server> <mod...> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `server` | Server name |
| `mod...` | One or more mod slugs/IDs to remove |

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Examples:**

```bash
# Remove single mod
mcctl mod remove myserver sodium

# Remove multiple mods
mcctl mod remove myserver sodium lithium phosphor
```

**Output Example:**

```
  ✓ Removed sodium from MODRINTH_PROJECTS
  ✓ Removed lithium from MODRINTH_PROJECTS

✓ Removed 2 mod(s) from myserver

Restart the server to apply changes:
  mcctl stop myserver && mcctl start myserver
```

!!! note "Restart Required"
    Removed mods will still be present in the server's mods folder until the server is restarted. On restart, the itzg/minecraft-server image will sync the mods folder with the configuration.

---

### mcctl mod sources

Display available mod sources and their configuration.

```bash
mcctl mod sources [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Examples:**

```bash
mcctl mod sources
```

**Output:**

```
Available Mod Sources:

  Modrinth --modrinth (default)
    Free, open-source mod platform. No API key required.
    Config: MODRINTH_PROJECTS
    mcctl mod add myserver sodium lithium

  CurseForge --curseforge
    Popular mod platform. Requires CF_API_KEY in .env
    Config: CURSEFORGE_FILES
    mcctl mod add myserver --curseforge jei journeymap

  Spiget (SpigotMC) --spiget
    SpigotMC plugin repository. Use resource IDs.
    Config: SPIGET_RESOURCES
    mcctl mod add myserver --spiget 9089

  URL --url
    Direct JAR file download URLs.
    Config: MODS / PLUGINS
    mcctl mod add myserver --url https://example.com/mod.jar
```

---

### Mod Management Workflows

#### Setting Up a Modded Server

Complete workflow for creating and configuring a modded Fabric server:

```bash
# 1. Create a Fabric server
mcctl create modded-server -t FABRIC -v 1.20.4

# 2. Search for mods
mcctl mod search "optimization"

# 3. Add essential mods
mcctl mod add modded-server fabric-api sodium lithium phosphor

# 4. List configured mods
mcctl mod list modded-server

# 5. Restart to apply
mcctl stop modded-server && mcctl start modded-server
```

#### Setting Up a Plugin Server

Complete workflow for a Paper server with plugins:

```bash
# 1. Create a Paper server
mcctl create plugin-server -t PAPER -v 1.21.1

# 2. Add plugins from Modrinth
mcctl mod add plugin-server luckperms

# 3. Add plugins from Spiget (SpigotMC)
mcctl mod add plugin-server --spiget 9089  # EssentialsX

# 4. Restart to apply
mcctl stop plugin-server && mcctl start plugin-server
```

#### CurseForge Configuration

To use CurseForge mods, you need an API key:

1. Get an API key from [CurseForge for Studios](https://console.curseforge.com/)
2. Add to your `.env` file:

```bash
CF_API_KEY=your-api-key-here
```

3. Now you can add CurseForge mods:

```bash
mcctl mod add myserver --curseforge jei journeymap
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

---

## Environment Variables

Environment variables for automation and CI/CD pipelines.

### MCCTL_SUDO_PASSWORD

Provides sudo password for operations requiring root access (mDNS registration/deregistration).

```bash
export MCCTL_SUDO_PASSWORD="your-password"
```

**Used by:**

- `mcctl create` - For registering mDNS hostname with avahi-daemon
- `mcctl delete` - For deregistering mDNS hostname

**Example (CI/CD):**

```bash
# GitHub Actions example
- name: Create Minecraft Server
  env:
    MCCTL_SUDO_PASSWORD: ${{ secrets.SUDO_PASSWORD }}
  run: |
    mcctl create myserver -t PAPER -v 1.21.1
```

!!! warning "Security"
    Store sudo passwords securely using CI/CD secrets. Never commit passwords to version control.

**Alternative:** Use `--sudo-password` option directly:

```bash
mcctl create myserver --sudo-password "your-password"
```
