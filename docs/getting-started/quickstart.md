# Quick Start

Create your first Minecraft server in 5 minutes.

## Prerequisites

Ensure you have completed the [installation](installation.md) steps:

- [x] Docker installed and running
- [x] Node.js 18+ installed
- [x] mcctl installed (`npm install -g @minecraft-docker/mcctl`)
- [x] Platform initialized (`mcctl init`)
- [x] mc-router started (`mcctl router start`)

!!! note "Start mc-router once"
    `mcctl init` does not start mc-router, and creating a server starts only that server. Run `mcctl router start` once; Docker starts mc-router again after a reboot until you stop it. `mcctl up` starts mc-router and every server.

## Step 1: Create Your First Server

### Interactive Mode (Recommended for Beginners)

Run the create command without arguments for guided setup:

```bash
mcctl create
```

You will be prompted for:

1. **Server name** - A unique name (e.g., `survival`, `creative`)
2. **Server type** - Paper, Vanilla, Forge, Fabric, etc.
3. **Minecraft version** - e.g., 1.21.1, 1.20.4 (modpack types ask for the modpack instead)
4. **World** - A new world, a new world with a seed, an existing world from `worlds/`, or a world ZIP URL
5. **Memory allocation** - Default is 4GB (6GB for modpacks)
6. **Whitelist** - Off by default; if you turn it on, you can add players
7. **playit.gg domain** - Only when playit.gg is enabled

When `/etc/avahi/hosts` exists (avahi-daemon is installed), mcctl first asks for your sudo password to register `<name>.local` (press Enter to try sudo without a password).

### CLI Mode (For Automation)

Create a server with a single command:

```bash
mcctl create myserver -t PAPER -v 1.21.1
```

Options:

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --type` | Server type (PAPER, VANILLA, FORGE, NEOFORGE, FABRIC) | PAPER |
| `-v, --version` | Minecraft version | Latest |
| `-s, --seed` | World seed | Random |
| `--no-start` | Create without starting | Start automatically |
| `--whitelist`, `--enable-whitelist` | Turn on the whitelist (with the listed players, or empty) | Off |

## Step 2: Wait for Server to Start

The server will download and start automatically. Watch the logs:

```bash
mcctl logs myserver -f
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

The create command prints only `Connect via: myserver.local:25565`. `mcctl status` lists every address of the server in the HOSTNAME column:

```bash
mcctl status
```

```
MINECRAFT SERVERS
SERVER               STATUS       HEALTH     HOSTNAME
------               ------       ------     --------
myserver             running      healthy    myserver.local,myserver.192.168.1.100.nip.io
```

### Connect from Minecraft

1. Open Minecraft Java Edition
2. Click **Multiplayer** > **Add Server**
3. Enter the server address: `myserver.192.168.1.100.nip.io:25565`
4. Click **Done** and join!

!!! success "Connection Methods"
    === "nip.io (Recommended)"
        Works from networks that can reach `192.168.1.100`, usually your LAN (a VPN address in `HOST_IPS` gets its own hostname):
        ```
        myserver.192.168.1.100.nip.io:25565
        ```

    === "mDNS"
        Works on local network (requires avahi/Bonjour):
        ```
        myserver.local:25565
        ```

    A bare IP (`192.168.1.100:25565`) does not work: mc-router picks the server by the hostname the client sends. To let players join from the internet, see [External Access](../advanced/external-access.md).

## Step 4: Manage Your Server

### View Server Status

```bash
mcctl status
```

Output:

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

For type, version, memory and players, use `mcctl status myserver` (or `mcctl status --detail` for every server):

```
=== Server: myserver ===

  myserver
    Container: mc-myserver
    Status:    running (healthy)
    Hostname:  myserver.local,myserver.192.168.1.100.nip.io
    Type:      PAPER
    Version:   1.21.1
    Memory:    4G
    Uptime:    5m
    Resources: 1.2 GB / 15.5 GB (7.7%) | CPU: 3.1%
    Players:   0/20 - none
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
    With mc-router, stopped servers automatically start when a player attempts to connect. This needs the server's container: a server created with `--no-start`, or every server after `mcctl down` (which removes the containers), starts on connect only after you run `mcctl start <name>` (or `mcctl up`) once.

### Access Server Console (RCON)

```bash
mcctl console myserver
```

This opens an interactive RCON session (the server must be running):

```
> list
There are 0 of a max of 20 players online:
> help
```

Type `exit` or `quit`, or press `Ctrl+C` or `Ctrl+D` to leave.

!!! note "Docker Desktop (macOS)"
    `mcctl console` connects over TCP to the container's IP address on the Docker network, which Docker Desktop may not expose to the host. Use `mcctl exec myserver <command>` there.

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

## Keeping mcctl Updated

`mcctl update` updates the CLI and the installed services (mcctl-api, mcctl-console and the shared library) from npm.

### Check for Updates

```bash
mcctl update --check   # exits 1 when a CLI update is available
```

### Update mcctl

```bash
# Interactive (prompts for confirmation)
mcctl update

# Auto-confirm (useful for CI/CD)
mcctl update --yes

# Update only the CLI
mcctl update --cli-only
```

`mcctl update` also checks each server's image tag against its `VERSION`, pulls the server images, and in a terminal offers to recreate stopped servers that still use an old image (default No). It does not run `mcctl upgrade`: run `mcctl upgrade` next to refresh `.env`, `servers/_template` and the router. The [Upgrade Runbook](../advanced/upgrade-runbook.md) has the full procedure.

!!! tip "Automatic Update Checks"
    Before each command (except `--help` and `--version`), mcctl checks npm for a newer version. The result is cached for 24 hours in `~/.mcctl-update-check.json`; when the cache is older, the command waits for the check (at most about 2 seconds).
    If a newer version exists, mcctl prints a notice.

For the full update command reference, see [mcctl update](../cli/commands.md#mcctl-update).

## What's Next?

<div class="grid cards" markdown>

-   :material-cog:{ .lg .middle } **Customize Your Server**

    ---

    Configure server.properties, plugins, and mods

    [:octicons-arrow-right-24: Server Configuration](../configuration/environment.md)

-   :material-earth:{ .lg .middle } **Manage Worlds**

    ---

    Assign worlds to servers (one world, one server)

    [:octicons-arrow-right-24: World Management](../cli/commands.md#world-management)

-   :material-backup-restore:{ .lg .middle } **Set Up Backups**

    ---

    Automatic GitHub backups for world data

    [:octicons-arrow-right-24: Backup Configuration](../advanced/backup.md)

-   :material-network:{ .lg .middle } **Advanced Networking**

    ---

    Configure nip.io, mDNS, and custom domains

    [:octicons-arrow-right-24: Networking Guide](../advanced/networking.md)

-   :material-earth:{ .lg .middle } **External Access (playit.gg)**

    ---

    Let friends join from the internet without port forwarding

    [:octicons-arrow-right-24: External Access Guide](../advanced/external-access.md)

</div>

## Quick Reference

### Server Management

| Task | Command |
|------|---------|
| Start mc-router | `mcctl router start` |
| Start mc-router and every server | `mcctl up` |
| Create server | `mcctl create <name> [-t TYPE] [-v VERSION]` |
| List servers | `mcctl status` |
| Detailed status | `mcctl status --detail` |
| Real-time monitoring | `mcctl status --watch` |
| Start server | `mcctl start <name>` |
| Stop server | `mcctl stop <name>` |
| View logs | `mcctl logs <name> [-f]` |
| RCON console | `mcctl console <name>` |
| Execute RCON command | `mcctl exec <name> <command>` |
| Delete server (asks first; keeps the world) | `mcctl delete <name> [--delete-world]` |

### Player Management

| Task | Command |
|------|---------|
| Add operator | `mcctl op <server> add <player>` |
| Remove operator | `mcctl op <server> remove <player>` |
| List operators | `mcctl op <server> list` |
| Add to whitelist | `mcctl whitelist <server> add <player>` |
| Enable whitelist | `mcctl whitelist <server> on` |
| Ban player | `mcctl ban <server> add <player> [reason]` |
| Kick player | `mcctl kick <server> <player> [reason]` |
| Show online players | `mcctl player online <server>` |

### Configuration

| Task | Command |
|------|---------|
| View config | `mcctl config <server>` |
| Set config | `mcctl config <server> KEY value` |
| Enable cheats | `mcctl config <server> --cheats` |
| Disable PvP | `mcctl config <server> --no-pvp` |

### Backup

| Task | Command |
|------|---------|
| Backup server config | `mcctl server-backup <server>` |
| Restore server config | `mcctl server-restore <server>` |
| Backup worlds to GitHub | `mcctl backup push -m "message"` |
| Restore from GitHub | `mcctl backup restore <commit>` |

### Maintenance

| Task | Command |
|------|---------|
| Check for updates | `mcctl update --check` |
| Update CLI and services | `mcctl update` |
| Update only the CLI | `mcctl update --cli-only` |
| Auto-confirm update | `mcctl update --yes` |
| Sync platform files after an update | `mcctl upgrade` |

---

## Troubleshooting

### Server Won't Start

1. **Check logs for errors:**
   ```bash
   mcctl logs <server> -n 100
   ```

2. **Check Java version compatibility:**
   - Minecraft 26.x and `LATEST` require Java 25
   - Minecraft 1.20.5–1.21.x requires Java 21
   - Minecraft 1.17–1.20.4 requires Java 17
   - Minecraft 1.16.5 and older requires Java 8

### Can't Connect to Server

1. **Verify mc-router is running:**
   ```bash
   mcctl status
   # mc-router should show "running" and "healthy"
   mcctl router start   # if it is not running
   ```

2. **Check server hostname:**
   ```bash
   mcctl status <server>
   # Note the hostname (e.g., myserver.192.168.1.100.nip.io)
   ```

3. **Ensure server is running:**
   ```bash
   mcctl start <server>
   ```

### Server Crashes

1. **Check memory allocation:**
   ```bash
   mcctl config <server> MEMORY
   # Increase if needed: mcctl config <server> MEMORY 6G
   ```

2. **Check for mod conflicts:**
   ```bash
   mcctl logs <server> | grep -i "error\|exception"
   ```

### Permission Denied Errors

```bash
# Fix file ownership (if needed)
sudo chown -R $USER:$USER ~/minecraft-servers/
```

For more detailed troubleshooting, see the [itzg/minecraft-server documentation](https://docker-minecraft-server.readthedocs.io/).
