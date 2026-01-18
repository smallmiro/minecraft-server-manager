# Installation Guide

This guide walks you through installing mcctl and setting up the required dependencies.

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

Verify installation:

```bash
mcctl --version
# mcctl version 0.1.0
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
├── docker-compose.yml     # Main orchestration
├── .env                   # Environment configuration
├── servers/               # Server configurations
│   ├── compose.yml        # Server include list
│   └── _template/         # Server template
├── worlds/                # Shared world storage
├── shared/                # Shared plugins/mods
│   ├── plugins/
│   └── mods/
├── scripts/               # Management scripts
└── backups/               # Backup storage
```

!!! tip "Custom Data Directory"
    Use `--root` to specify a custom location:
    ```bash
    mcctl --root /path/to/data init
    ```

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

# Default server settings
DEFAULT_MEMORY=4G
DEFAULT_VERSION=1.20.4

# Timezone
TZ=Asia/Seoul

# RCON password (change in production!)
RCON_PASSWORD=changeme
```

## Verifying Installation

Run the status command to verify everything is working:

```bash
mcctl status
```

Expected output:

```
Platform Status
===============

Router: mc-router (running)
Servers: 0

No servers configured. Create one with:
  mcctl create <name>
```

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
