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
# Show all commands
mcctl --help

# Show command-specific help
mcctl create --help
```

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
| `mcctl exec` | Execute a single RCON command |
| `mcctl config` | View or modify server configuration |

### Player Management

| Command | Description |
|---------|-------------|
| `mcctl op` | Manage server operators (add/remove/list) |
| `mcctl whitelist` | Manage whitelist (add/remove/on/off/status) |
| `mcctl ban` | Manage player and IP bans |
| `mcctl kick` | Kick a player from the server |
| `mcctl player online` | Show online players |
| `mcctl player lookup` | Look up player information |
| `mcctl player uuid` | Get player UUID |

### World Management

| Command | Description |
|---------|-------------|
| `mcctl world list` | List all worlds with lock status |
| `mcctl world assign` | Lock a world to a server |
| `mcctl world release` | Release a world lock |

### Server Backup/Restore

| Command | Description |
|---------|-------------|
| `mcctl server-backup` | Backup server configuration |
| `mcctl server-restore` | Restore server from backup |

### World Backup (GitHub)

| Command | Description |
|---------|-------------|
| `mcctl backup status` | Show backup configuration |
| `mcctl backup push` | Push backup to GitHub |
| `mcctl backup history` | Show backup history |
| `mcctl backup restore` | Restore from backup |

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
mcctl world assign survival mc-myserver
mcctl backup push -m "Before upgrade"
```

## Global Options

These options work with all commands:

| Option | Description |
|--------|-------------|
| `--root <path>` | Custom data directory (default: `~/minecraft-servers`) |
| `--json` | Output in JSON format |
| `-h, --help` | Show help |
| `--version` | Show version |

## Output Formats

### Human-Readable (Default)

```bash
mcctl status
```

```
Platform Status
===============

Router: mc-router (running)

Servers:
  mc-myserver (running)
    Type: PAPER 1.21.1
    Memory: 4G
    Connect: myserver.192.168.1.100.nip.io:25565
```

### JSON Format

```bash
mcctl status --json
```

```json
{
  "router": {
    "name": "mc-router",
    "status": "running"
  },
  "servers": [
    {
      "name": "mc-myserver",
      "status": "running",
      "type": "PAPER",
      "version": "1.21.1"
    }
  ]
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |

## Environment Variables

mcctl respects these environment variables:

| Variable | Description |
|----------|-------------|
| `MCCTL_ROOT` | Default data directory |
| `NO_COLOR` | Disable colored output |

## Next Steps

- **[Command Reference](commands.md)** - Detailed documentation for all commands
- **[Configuration](../configuration/index.md)** - Environment variables and settings
- **[Quick Start](../getting-started/quickstart.md)** - Get started with your first server
