# Quick Start

Create your first Minecraft server in 5 minutes.

## Prerequisites

Ensure you have completed the [installation](installation.md) steps:

- [x] Docker installed and running
- [x] Node.js 18+ installed
- [x] mcctl installed (`npm install -g @minecraft-docker/mcctl`)
- [x] Platform initialized (`mcctl init`)

## Step 1: Create Your First Server

### Interactive Mode (Recommended for Beginners)

Run the create command without arguments for guided setup:

```bash
mcctl create
```

You will be prompted for:

1. **Server name** - A unique name (e.g., `survival`, `creative`)
2. **Server type** - Paper, Vanilla, Forge, Fabric, etc.
3. **Minecraft version** - e.g., 1.21.1, 1.20.4
4. **Memory allocation** - Default is 4GB

### CLI Mode (For Automation)

Create a server with a single command:

```bash
mcctl create myserver -t PAPER -v 1.21.1
```

Options:

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --type` | Server type (PAPER, VANILLA, FORGE, FABRIC) | PAPER |
| `-v, --version` | Minecraft version | Latest |
| `-s, --seed` | World seed | Random |
| `--no-start` | Create without starting | Start automatically |

## Step 2: Wait for Server to Start

The server will download and start automatically. Watch the logs:

```bash
docker logs -f mc-myserver
```

Wait until you see:

```
[Server thread/INFO]: Done (X.XXXs)! For help, type "help"
```

!!! tip "First Start Takes Longer"
    The first start downloads Minecraft server files and generates the world.
    Subsequent starts are much faster.

## Step 3: Connect to Your Server

### Find Your Server Address

Check the output from the create command or run:

```bash
mcctl status
```

You will see connection information:

```
Servers:
  mc-myserver (running)
    Connect: myserver.192.168.1.100.nip.io:25565
```

### Connect from Minecraft

1. Open Minecraft Java Edition
2. Click **Multiplayer** > **Add Server**
3. Enter the server address: `myserver.192.168.1.100.nip.io:25565`
4. Click **Done** and join!

!!! success "Connection Methods"
    === "nip.io (Recommended)"
        Works from any network with internet access:
        ```
        myserver.192.168.1.100.nip.io:25565
        ```

    === "mDNS"
        Works on local network (requires avahi/Bonjour):
        ```
        myserver.local:25565
        ```

    === "Direct IP"
        If DNS doesn't work:
        ```
        192.168.1.100:25565
        ```

## Step 4: Manage Your Server

### View Server Status

```bash
mcctl status
```

Output:

```
Platform Status
===============

Router: mc-router (running)

Servers:
  mc-myserver
    Status: running
    Type: PAPER 1.21.1
    Memory: 4G
    Players: 0/20
    Connect: myserver.192.168.1.100.nip.io:25565
```

### View Server Logs

```bash
mcctl logs myserver

# Follow logs in real-time
mcctl logs myserver -f
```

### Stop the Server

```bash
mcctl stop myserver
```

### Start the Server

```bash
mcctl start myserver
```

!!! note "Auto-Start on Connect"
    With mc-router, stopped servers automatically start when a player attempts to connect.

### Access Server Console (RCON)

```bash
mcctl console myserver
```

This opens an interactive RCON session:

```
> list
There are 0 of a max of 20 players online:
> help
```

Press `Ctrl+C` to exit.

## Example: Create Multiple Servers

Create additional servers for different game modes:

```bash
# Creative server with specific seed
mcctl create creative -t VANILLA -v 1.21.1 -s 12345

# Modded server with Forge
mcctl create modded -t FORGE -v 1.20.4

# Check all servers
mcctl status
```

Each server gets its own hostname:

- `creative.192.168.1.100.nip.io:25565`
- `modded.192.168.1.100.nip.io:25565`

## What's Next?

<div class="grid cards" markdown>

-   :material-cog:{ .lg .middle } **Customize Your Server**

    ---

    Configure server.properties, plugins, and mods

    [:octicons-arrow-right-24: Server Configuration](../configuration/environment.md)

-   :material-earth:{ .lg .middle } **Manage Worlds**

    ---

    Share and lock worlds across servers

    [:octicons-arrow-right-24: World Management](../cli/commands.md#world-management)

-   :material-backup-restore:{ .lg .middle } **Set Up Backups**

    ---

    Automatic GitHub backups for world data

    [:octicons-arrow-right-24: Backup Configuration](../advanced/backup.md)

-   :material-network:{ .lg .middle } **Advanced Networking**

    ---

    Configure nip.io, mDNS, and custom domains

    [:octicons-arrow-right-24: Networking Guide](../advanced/networking.md)

</div>

## Quick Reference

| Task | Command |
|------|---------|
| Create server | `mcctl create <name> [-t TYPE] [-v VERSION]` |
| List servers | `mcctl status` |
| Start server | `mcctl start <name>` |
| Stop server | `mcctl stop <name>` |
| View logs | `mcctl logs <name> [-f]` |
| RCON console | `mcctl console <name>` |
| Delete server | `mcctl delete <name>` |
