# CLI Overview

mcctl is the command-line interface for managing Docker Minecraft servers. It provides both interactive and command-line modes for all operations.

## Installation

```bash
npm install -g @minecraft-docker/mcctl
```

## Basic Usage

```bash
mcctl <command> [options]
```

### Getting Help

```bash
# Show all commands and options
mcctl --help
```

`mcctl <command> --help` prints the same page. Each command is described in the [Command Reference](commands.md).

## Command Categories

### Infrastructure Commands

| Command | Description |
|---------|-------------|
| `mcctl init` | Initialize platform directory structure |
| `mcctl up` | Start all infrastructure (router + servers) |
| `mcctl down` | Stop all infrastructure |
| `mcctl router <action>` | Manage mc-router (start/stop/restart) |

### Server Management

| Command | Description |
|---------|-------------|
| `mcctl create` | Create a new server (interactive or CLI) |
| `mcctl delete` | Delete a server (preserves world data) |
| `mcctl status` | Show status of all servers |
| `mcctl start` | Start a stopped server |
| `mcctl stop` | Stop a running server |
| `mcctl logs` | View server logs |
| `mcctl console` | Connect to RCON console |
| `mcctl rcon` | Connect to RCON console (same session as `mcctl console`) |
| `mcctl exec` | Execute a single RCON command |
| `mcctl config` | View or modify server configuration |

### Player Management

| Command | Description |
|---------|-------------|
| `mcctl op` | Manage server operators (add/remove/list) |
| `mcctl whitelist` | Manage whitelist (add/remove/on/off/status) |
| `mcctl ban` | Manage player and IP bans |
| `mcctl kick` | Kick a player from the server |
| `mcctl player` | Interactive player management (server, player, action) |
| `mcctl player online` | Show online players |
| `mcctl player info` | Look up a player's UUID and skin |
| `mcctl player cache` | Show or clear the player lookup cache |

### World Management

| Command | Description |
|---------|-------------|
| `mcctl world list` | List all worlds with the servers they are assigned to |
| `mcctl world new` | Create a world, optionally assigned to a server |
| `mcctl world assign` | Assign a world to a stopped server (one world, one server) |
| `mcctl world release` | Switch a world's server back to its own default world |
| `mcctl world delete` | Delete a world that no server uses |

### Server Backup/Restore

| Command | Description |
|---------|-------------|
| `mcctl server-backup` | Backup server configuration |
| `mcctl server-restore` | Restore server from backup |
| `mcctl config-snapshot` | Snapshots of server configuration files, also on a schedule |

### World Backup (GitHub)

| Command | Description |
|---------|-------------|
| `mcctl backup init` | Set up the GitHub backup |
| `mcctl backup status` | Show backup configuration |
| `mcctl backup push` | Push backup to GitHub |
| `mcctl backup history` | Show backup history |
| `mcctl backup restore` | Restore from backup |
| `mcctl backup schedule` | Back up on a schedule |

### Mods and Plugins

| Command | Description |
|---------|-------------|
| `mcctl mod` | Search, add, list and remove mods and plugins (`search`, `add`, `list`, `remove`, `sources`) |

### Platform Maintenance

| Command | Description |
|---------|-------------|
| `mcctl update` | Update the CLI, the installed services and the server images |
| `mcctl upgrade` | Migrate the platform configuration files to the installed version |
| `mcctl migrate` | Move worlds to the shared `worlds/` directory, or import servers into `server.yaml` |

### External Access, Console and Audit

| Command | Description |
|---------|-------------|
| `mcctl playit` | Manage the playit.gg agent and the servers' external domains |
| `mcctl console` subcommands (`init`, `service`, `user`, `api`, `remove`) | Manage the web console ([Console CLI Commands](../console/cli-commands.md)) |
| `mcctl audit` | Show and clean up the audit log ([Audit Log](audit-log.md)) |

## Interactive vs CLI Mode

Most commands support both modes:

### Interactive Mode

Run commands without arguments to enter guided mode:

```bash
mcctl create
# Prompts for: server name, type, version, memory

mcctl world assign
# Prompts for: world selection, server selection

mcctl backup push
# Prompts for: backup message
```

### CLI Mode

Provide arguments directly for scripting and automation:

```bash
mcctl create myserver -t PAPER -v 1.21.1
mcctl world assign survival myserver
mcctl backup push -m "Before upgrade"
```

## Global Options

| Option | Description |
|--------|-------------|
| `--root <path>` | Data directory (default: `MCCTL_ROOT` or `~/minecraft-servers`) |
| `--json` | JSON output, for the commands that support it |
| `--sudo-password <pwd>` | Sudo password for the mDNS entry of `create` and `delete` |
| `-h, --help` | Show help |
| `--version` | Show version |

See [Global Options Reference](commands.md#global-options-reference) for value and `--` handling.

## Output Formats

### Human-Readable (Default)

```bash
mcctl status
```

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
myserver             running      healthy    myserver.local,myserver.192.168.1.100.nip.io
```

### JSON Format

```bash
mcctl status --json
```

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
      "name": "myserver",
      "container": "mc-myserver",
      "status": "running",
      "health": "healthy",
      "hostname": "myserver.local,myserver.192.168.1.100.nip.io"
    }
  ]
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | `mcctl start` / `mcctl stop`: the server is already running / not running |

`mcctl update --check` exits with 1 when a newer CLI version is available, and `mcctl exec` exits with the exit code of the RCON command.

## Environment Variables

mcctl respects these environment variables:

| Variable | Description |
|----------|-------------|
| `MCCTL_ROOT` | Default data directory |
| `MCCTL_SUDO_PASSWORD` | Sudo password for the mDNS entry of `create` and `delete` |

## Next Steps

- **[Command Reference](commands.md)** - Detailed documentation for all commands
- **[Configuration](../configuration/index.md)** - Environment variables and settings
- **[Quick Start](../getting-started/quickstart.md)** - Get started with your first server
