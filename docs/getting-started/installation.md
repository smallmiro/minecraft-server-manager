# Installation Guide

This guide walks you through installing mcctl and setting up the required dependencies.

## System Requirements

| Component | Minimum Version | Recommended | Notes |
|-----------|-----------------|-------------|-------|
| **Node.js** | >= 18.0.0 | 20 LTS | Required for mcctl CLI |
| **Docker Engine** | >= 24.0.0 | Latest | Container runtime |
| **Docker Compose** | >= 2.20.0 | Latest | `include` feature required |
| **OS** | Linux, macOS | Ubuntu 22.04+ | Windows via WSL2 |
| **git** | >= 2.31 | Latest | Only for GitHub world backups |
| **PM2** | >= 6.0.0 | Latest | Only for the web console: `mcctl console init` needs `pm2` on `PATH` (`npm install -g pm2`) |

!!! warning "Docker Compose Version"
    Docker Compose **v2.20.0 or higher** is required. The `include` directive used by mcctl was introduced in this version. Check your version with `docker compose version`.

    `mcctl init` checks Node.js, Docker Engine and Docker Compose and stops if one is missing or too old.

## Prerequisites

Before installing mcctl, ensure you have the following installed:

### Docker

Docker is required to run Minecraft servers. Install Docker Engine:

=== "Ubuntu/Debian"
    ```bash
    # Add Docker's official GPG key
    sudo apt-get update
    sudo apt-get install ca-certificates curl
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

    # Add the repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    sudo apt-get update
    sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin

    # Add your user to docker group
    sudo usermod -aG docker $USER
    newgrp docker
    ```

=== "CentOS/RHEL"
    ```bash
    sudo dnf install -y dnf-plugins-core
    sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    sudo dnf install docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo systemctl enable --now docker
    sudo usermod -aG docker $USER
    ```

=== "macOS"
    Download and install [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/).

Verify Docker installation:

```bash
docker --version
# Docker version 24.0.0 or higher

docker compose version
# Docker Compose version v2.20.0 or higher
```

### Node.js

Node.js 18 or higher is required:

=== "Using nvm (Recommended)"
    ```bash
    # Install nvm
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    source ~/.bashrc

    # Install Node.js 20 LTS
    nvm install 20
    nvm use 20
    ```

=== "Ubuntu/Debian"
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ```

=== "macOS (Homebrew)"
    ```bash
    brew install node@20
    ```

Verify Node.js installation:

```bash
node --version
# v20.0.0 or higher

npm --version
# v10.0.0 or higher
```

## Installing mcctl

### Global Installation (Recommended)

Install mcctl globally via npm:

```bash
npm install -g @minecraft-docker/mcctl
```

Or using pnpm:

```bash
pnpm add -g @minecraft-docker/mcctl
```

`mcctl update` reinstalls the CLI with `npm install -g`, so it does not update a pnpm global install. Prefer npm.

Verify installation:

```bash
mcctl --version
# mcctl version 3.0.2 (or newer)
```

### Using npx (No Installation)

You can also run mcctl without installing:

```bash
npx @minecraft-docker/mcctl --help
```

## Platform Initialization

After installing mcctl, initialize the platform:

```bash
mcctl init
```

This creates the platform directory structure at `~/minecraft-servers/`:

```text
~/minecraft-servers/
├── docker-compose.yml     # Main orchestration (mc-router, server includes)
├── .env                   # Platform settings (HOST_IP, RCON_PASSWORD, ...)
├── .mcctl.json            # mcctl settings (template version, playit, install ID)
├── .gitignore             # Keeps .env, servers, worlds and backups out of git
├── servers/               # Server configurations
│   ├── compose.yml        # Server include list
│   ├── global.env         # .env keys passed to every server
│   └── _template/         # Server template
├── worlds/                # Shared world storage
├── shared/
│   ├── plugins/           # Mounted read-only into every server (/plugins)
│   └── mods/              # Created, but not mounted by the server template
└── backups/               # Backup storage
```

`mcctl init` also asks which host IP address(es) to use for nip.io hostnames and whether to enable playit.gg, and creates the Docker network `minecraft-net`.

!!! tip "Custom Data Directory"
    Use `--root` to specify a custom location:
    ```bash
    mcctl --root /path/to/data init
    ```

    Pass `--root` to every later command as well, or set `MCCTL_ROOT` (for example `export MCCTL_ROOT=/path/to/data` in your shell profile). Otherwise mcctl uses `~/minecraft-servers`.

## Start mc-router

`mcctl init` does not start mc-router, the router that accepts connections on port 25565. Start it once:

```bash
mcctl router start
```

mc-router has `restart: unless-stopped`, so Docker starts it again after a reboot until you stop it (`mcctl router stop`). Creating or starting a server starts only that server. `mcctl up` starts mc-router and every server.

## Optional: mDNS Setup

For local network discovery using `.local` hostnames, install avahi-daemon:

=== "Ubuntu/Debian"
    ```bash
    sudo apt install avahi-daemon
    sudo systemctl enable --now avahi-daemon
    ```

=== "CentOS/RHEL"
    ```bash
    sudo dnf install avahi
    sudo systemctl enable --now avahi-daemon
    ```

=== "macOS"
    macOS has built-in Bonjour support - no additional installation needed.

!!! note "sudo for `.local` names"
    `mcctl create` registers `<server>.local` in `/etc/avahi/hosts` with sudo. When that file exists, it asks for your sudo password (or takes `--sudo-password` / `MCCTL_SUDO_PASSWORD`); press Enter to try sudo without a password (sudoers `NOPASSWD`). See [Register Hostnames](../advanced/networking.md#register-hostnames).

!!! note "nip.io Recommended"
    nip.io magic DNS is recommended over mDNS as it works without any client configuration.
    See [Networking Guide](../advanced/networking.md) for details.

## Configuration

Edit the environment file to customize settings:

```bash
nano ~/minecraft-servers/.env
```

Key settings:

```bash
# Your server's IP address (required for nip.io)
HOST_IP=192.168.1.100

# For VPN mesh with multiple IPs (Tailscale/ZeroTier)
# HOST_IPS=192.168.1.100,100.64.0.5

# Timezone
TZ=Asia/Seoul

# RCON password (generated randomly by `mcctl init`; recreate containers after changing it)
RCON_PASSWORD=<random, generated by mcctl init>
```

## Verifying Installation

After `mcctl router start`, run the status command to verify everything is working:

```bash
mcctl status
```

Expected output (no servers yet):

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
  No Minecraft servers configured
```

Without avahi-daemon, its row shows `not installed`.

## Troubleshooting

### Docker Permission Denied

If you get a permission error:

```bash
# Add your user to the docker group
sudo usermod -aG docker $USER

# Apply the group change
newgrp docker
```

### Port 25565 Already in Use

Check if another process is using port 25565:

```bash
sudo lsof -i :25565
```

Stop the conflicting service or change the port in docker-compose.yml.

### mcctl Command Not Found

Ensure npm global bin is in your PATH:

```bash
# For npm
export PATH="$PATH:$(npm config get prefix)/bin"

# Add to ~/.bashrc for persistence
echo 'export PATH="$PATH:$(npm config get prefix)/bin"' >> ~/.bashrc
```

## Next Steps

- **[Quick Start](quickstart.md)** - Create your first Minecraft server
- **[CLI Commands](../cli/commands.md)** - Learn all available commands
- **[Configuration](../configuration/index.md)** - Customize server settings
