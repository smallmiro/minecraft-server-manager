# Minecraft Docker Server Manager

A DevOps solution for managing multiple Minecraft Java Edition servers using Docker and the **mcctl** CLI.

## Features

- **Multi-Server Management**: Run multiple Minecraft servers on a single host
- **Hostname-Based Routing**: Connect via `server.local:25565` using mc-router
- **nip.io Magic DNS**: No client configuration needed with `server.<ip>.nip.io`
- **Auto-Scaling**: Servers start on connect, stop after idle timeout
- **Interactive CLI**: Beautiful terminal UI with @clack/prompts
- **World Management**: Assign, lock, and release worlds between servers
- **Player Management**: Operators, whitelist, bans, and kicks via CLI
- **GitHub Backup**: Automatic world backup to private repositories

## Quick Start

```bash
# Install CLI globally
npm install -g @minecraft-docker/mcctl

# Initialize platform
mcctl init

# Create a server (interactive mode)
mcctl create

# Or with arguments
mcctl create myserver -t PAPER -v 1.21.1

# Start/stop servers
mcctl start myserver
mcctl stop myserver

# View status
mcctl status
```

## Common Commands

| Command | Description |
|---------|-------------|
| `mcctl create` | Create a new server (interactive) |
| `mcctl start <name>` | Start a server |
| `mcctl stop <name>` | Stop a server |
| `mcctl status` | Show all server status |
| `mcctl logs <name>` | View server logs |
| `mcctl console <name>` | Connect to RCON console |
| `mcctl config <name>` | View/edit server configuration |

## Architecture

```mermaid
flowchart TB
    subgraph router["mc-router (:25565)"]
        direction LR
        R[Hostname Routing]
    end

    C1[server1.local] --> router
    C2[server2.local] --> router

    router --> S1[mc-server1]
    router --> S2[mc-server2]
```

## Documentation

- [Installation](getting-started/installation.md) - Set up the platform
- [Quick Start](getting-started/quickstart.md) - Create your first server
- [CLI Commands](cli/commands.md) - Full command reference
- [Configuration](configuration/index.md) - Server configuration with mcctl

## Links

- [GitHub Repository](https://github.com/smallmiro/minecraft-server-manager)
- [itzg/minecraft-server Documentation](https://docker-minecraft-server.readthedocs.io/)
