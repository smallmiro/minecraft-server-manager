# Minecraft Docker Server Manager

A DevOps solution for managing multiple Minecraft Java Edition servers using Docker.

## Features

- **Multi-Server Management**: Run multiple Minecraft servers on a single host
- **Hostname-Based Routing**: Connect via `server.local:25565` using mc-router
- **nip.io Magic DNS**: No client configuration needed with `server.<ip>.nip.io`
- **Auto-Scaling**: Servers start on connect, stop after idle timeout
- **Interactive CLI**: Beautiful terminal UI with @clack/prompts
- **World Management**: Assign, lock, and release worlds between servers

## Quick Start

```bash
# Install CLI globally
npm install -g @minecraft-docker/mcctl

# Initialize platform
mcctl init

# Create a server (interactive mode)
mcctl create
```

## Architecture

```text
┌──────────────────────┐
│  mc-router (:25565)  │
│  hostname routing    │
├──────────────────────┤
│ server1.local ─→     │
│  mc-server1          │
│ server2.local ─→     │
│  mc-server2          │
└──────────────────────┘
```

## Documentation

- [Installation](getting-started/installation.md) - Set up the platform
- [Quick Start](getting-started/quickstart.md) - Create your first server
- [CLI Commands](cli/commands.md) - Full command reference
- [Configuration](configuration/environment.md) - Environment variables

## Links

- [GitHub Repository](https://github.com/smallmiro/minecraft-server-manager)
- [itzg/minecraft-server Documentation](https://docker-minecraft-server.readthedocs.io/)
