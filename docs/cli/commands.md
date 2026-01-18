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

```
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

### mcctl status

Show status of all servers.

```bash
mcctl status [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Example:**

```bash
mcctl status
```

**Output:**

```
Platform Status
===============

Router: mc-router (running)

Servers:
  mc-myserver
    Status: running
    Type: PAPER 1.21.1
    Memory: 4G
    Players: 2/20
    Connect: myserver.192.168.1.100.nip.io:25565

  mc-creative
    Status: stopped
    Type: VANILLA 1.20.4
    Memory: 2G
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

Start a stopped server.

```bash
mcctl start <name>
```

**Example:**

```bash
mcctl start myserver
```

!!! tip "Auto-Start"
    With mc-router, servers automatically start when a player connects.

---

### mcctl stop

Stop a running server.

```bash
mcctl stop <name>
```

**Example:**

```bash
mcctl stop myserver
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
