#!/bin/bash
# =============================================================================
# create-server.sh - Create a new Minecraft server from template
# =============================================================================
# Usage: ./scripts/create-server.sh <server-name> [options]
#
# Arguments:
#   server-name  : Name for the new server (e.g., ironwood, myserver)
#                  This will be used for:
#                  - Directory name: servers/<server-name>/
#                  - Service name: mc-<server-name>
#                  - Container name: mc-<server-name>
#                  - Hostname: <server-name>.local
#
# Options:
#   -t, --type TYPE      Server type: PAPER (default), VANILLA, FORGE, FABRIC
#   -v, --version VER    Minecraft version (e.g., 1.21.1, 1.20.4)
#   -s, --seed NUMBER    World seed for new world generation
#   -u, --world-url URL  Download world from ZIP URL
#   -w, --world NAME     Use existing world from worlds/ directory (creates symlink)
#   --no-start           Don't start the server after creation
#   --start              Start the server after creation (default)
#
# World options are mutually exclusive (only one can be specified).
#
# Examples:
#   ./scripts/create-server.sh myserver
#   ./scripts/create-server.sh myserver -t FORGE
#   ./scripts/create-server.sh myserver -t VANILLA -v 1.21.1
#   ./scripts/create-server.sh myserver --seed 12345 --no-start
#   ./scripts/create-server.sh myserver --world-url https://example.com/world.zip
#   ./scripts/create-server.sh myserver --world existing-world --version 1.21.1
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script/platform directories
# Support both direct execution and npm package execution (mcctl CLI)
if [[ -n "${MCCTL_ROOT:-}" ]]; then
    # Running via npm package
    PLATFORM_DIR="$MCCTL_ROOT"
    SCRIPT_DIR="${MCCTL_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
    TEMPLATE_DIR="${MCCTL_TEMPLATES:-$PLATFORM_DIR/servers/_template}/servers/_template"
else
    # Running directly (development mode)
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PLATFORM_DIR="$(dirname "$SCRIPT_DIR")"
    TEMPLATE_DIR="$PLATFORM_DIR/servers/_template"
fi

SERVERS_DIR="$PLATFORM_DIR/servers"
SERVERS_COMPOSE="$SERVERS_DIR/compose.yml"
MAIN_COMPOSE="$PLATFORM_DIR/docker-compose.yml"
ENV_FILE="$PLATFORM_DIR/.env"
AVAHI_HOSTS="/etc/avahi/hosts"

# =============================================================================
# Helper Functions
# =============================================================================

# Get host IP from .env or auto-detect (returns first IP for avahi)
get_host_ip() {
    # Try to get from .env file (HOST_IPS first, then HOST_IP)
    if [ -f "$ENV_FILE" ]; then
        local env_ips
        env_ips=$(grep "^HOST_IPS=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        if [ -n "$env_ips" ]; then
            # Return first IP for avahi registration
            echo "$env_ips" | cut -d',' -f1 | tr -d ' '
            return
        fi

        local env_ip
        env_ip=$(grep "^HOST_IP=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        if [ -n "$env_ip" ]; then
            echo "$env_ip"
            return
        fi
    fi

    # Auto-detect: get IP of default route interface
    local detected_ip
    detected_ip=$(ip route get 1 2>/dev/null | awk '{print $7; exit}')
    if [ -n "$detected_ip" ]; then
        echo "$detected_ip"
        return
    fi

    # Fallback: try hostname -I
    detected_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [ -n "$detected_ip" ]; then
        echo "$detected_ip"
        return
    fi

    echo ""
}

# Get all host IPs from .env (comma-separated)
# Supports HOST_IPS for multiple IPs (e.g., LAN + VPN mesh)
get_host_ips() {
    if [ -f "$ENV_FILE" ]; then
        # Try HOST_IPS first (comma-separated list)
        local env_ips
        env_ips=$(grep "^HOST_IPS=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
        if [ -n "$env_ips" ]; then
            echo "$env_ips"
            return
        fi

        # Fallback to single HOST_IP
        local env_ip
        env_ip=$(grep "^HOST_IP=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        if [ -n "$env_ip" ]; then
            echo "$env_ip"
            return
        fi
    fi

    # Auto-detect if not configured
    get_host_ip
}

# Build nip.io hostnames for all configured IPs
# Returns: server.local,server.ip1.nip.io,server.ip2.nip.io,...
build_hostnames() {
    local server_name="$1"
    local host_ips="$2"

    local hostnames="$server_name.local"

    if [ -n "$host_ips" ]; then
        # Split by comma and add nip.io for each IP
        IFS=',' read -ra IPS <<< "$host_ips"
        for ip in "${IPS[@]}"; do
            ip=$(echo "$ip" | tr -d ' ')  # trim whitespace
            if [ -n "$ip" ]; then
                hostnames="$hostnames,$server_name.$ip.nip.io"
            fi
        done
    fi

    echo "$hostnames"
}

# Register hostname with avahi-daemon
register_avahi_hostname() {
    local hostname="$1"
    local ip="$2"

    if [ -z "$ip" ]; then
        echo -e "${YELLOW}   Warning: Could not determine HOST_IP, skipping avahi registration${NC}"
        echo "   Set HOST_IP in .env or add manually: sudo nano $AVAHI_HOSTS"
        return 1
    fi

    # Check if avahi-daemon is available
    if ! command -v avahi-daemon &> /dev/null; then
        echo -e "${YELLOW}   Warning: avahi-daemon not found, skipping mDNS registration${NC}"
        return 1
    fi

    # Check if entry already exists
    if grep -q "^[^#]*$hostname" "$AVAHI_HOSTS" 2>/dev/null; then
        echo -e "${YELLOW}   Hostname $hostname already registered in avahi${NC}"
        return 0
    fi

    # Add entry to /etc/avahi/hosts (requires sudo)
    echo -e "   Registering $hostname -> $ip with avahi-daemon..."
    if echo "$ip $hostname" | run_with_sudo_stdin tee -a "$AVAHI_HOSTS" > /dev/null 2>&1; then
        # Restart avahi-daemon to apply changes
        if run_with_sudo systemctl restart avahi-daemon 2>/dev/null; then
            echo -e "   ${GREEN}mDNS hostname registered: $hostname -> $ip${NC}"
            return 0
        else
            echo -e "${YELLOW}   Warning: Failed to restart avahi-daemon${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}   Warning: Failed to write to $AVAHI_HOSTS (sudo required)${NC}"
        if has_sudo_password; then
            echo "   Check if MCCTL_SUDO_PASSWORD is correct"
        else
            echo "   Set MCCTL_SUDO_PASSWORD env var or add manually: echo '$ip $hostname' | sudo tee -a $AVAHI_HOSTS"
        fi
        return 1
    fi
}

# Create servers/compose.yml if it doesn't exist
ensure_servers_compose() {
    if [ ! -f "$SERVERS_COMPOSE" ]; then
        echo -e "   Creating servers/compose.yml..."
        cat > "$SERVERS_COMPOSE" << 'EOF'
# =============================================================================
# Server Include List (managed automatically by create-server.sh)
# =============================================================================
# This file is modified by scripts/create-server.sh and scripts/delete-server.sh
# Do NOT modify docker-compose.yml - only this file is updated for server changes
# =============================================================================

# Server includes are added below by create-server.sh
EOF
        echo -e "   ${GREEN}Created servers/compose.yml${NC}"
    fi
}

# Default values
SERVER_TYPE="PAPER"
MC_VERSION=""
WORLD_SEED=""
WORLD_URL=""
WORLD_NAME=""
START_SERVER="true"

# Show usage
show_usage() {
    echo "Usage: $0 <server-name> [options]"
    echo ""
    echo "Arguments:"
    echo "  server-name  : Name for the new server (lowercase, no spaces)"
    echo ""
    echo "Options:"
    echo "  -t, --type TYPE      Server type: PAPER (default), VANILLA, FORGE, FABRIC"
    echo "  -v, --version VER    Minecraft version (e.g., 1.21.1, 1.20.4)"
    echo "  -s, --seed NUMBER    World seed for new world generation"
    echo "  -u, --world-url URL  Download world from ZIP URL"
    echo "  -w, --world NAME     Use existing world from worlds/ directory (creates symlink)"
    echo "  --no-start           Don't start the server after creation"
    echo "  --start              Start the server after creation (default)"
    echo ""
    echo "World options (--seed, --world-url, --world) are mutually exclusive."
    echo ""
    echo "Examples:"
    echo "  $0 myserver"
    echo "  $0 myserver -t FORGE"
    echo "  $0 myserver -t VANILLA -v 1.21.1"
    echo "  $0 myserver --seed 12345"
    echo "  $0 myserver --world-url https://example.com/world.zip"
    echo "  $0 myserver --world existing-world -v 1.21.1 --no-start"
}

# Check if first argument exists
if [ -z "$1" ]; then
    echo -e "${RED}Error: Server name is required${NC}"
    echo ""
    show_usage
    exit 1
fi

# First argument is server name
SERVER_NAME="$1"
shift

# Parse remaining arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            SERVER_TYPE="$2"
            shift 2
            ;;
        -v|--version)
            MC_VERSION="$2"
            shift 2
            ;;
        -s|--seed)
            WORLD_SEED="$2"
            shift 2
            ;;
        -u|--world-url)
            WORLD_URL="$2"
            shift 2
            ;;
        -w|--world)
            WORLD_NAME="$2"
            shift 2
            ;;
        --no-start)
            START_SERVER="false"
            shift
            ;;
        --start)
            START_SERVER="true"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            # For backward compatibility: if it looks like a server type, use it
            if [[ "$1" =~ ^(PAPER|VANILLA|FORGE|FABRIC|NEOFORGE|QUILT|SPIGOT)$ ]]; then
                SERVER_TYPE="$1"
                shift
            else
                echo -e "${RED}Error: Unknown option: $1${NC}"
                echo ""
                show_usage
                exit 1
            fi
            ;;
    esac
done

# Validate mutually exclusive world options
WORLD_OPTIONS_COUNT=0
[ -n "$WORLD_SEED" ] && WORLD_OPTIONS_COUNT=$((WORLD_OPTIONS_COUNT + 1))
[ -n "$WORLD_URL" ] && WORLD_OPTIONS_COUNT=$((WORLD_OPTIONS_COUNT + 1))
[ -n "$WORLD_NAME" ] && WORLD_OPTIONS_COUNT=$((WORLD_OPTIONS_COUNT + 1))

if [ "$WORLD_OPTIONS_COUNT" -gt 1 ]; then
    echo -e "${RED}Error: World options (--seed, --world-url, --world) are mutually exclusive${NC}"
    echo "Please specify only one world option."
    exit 1
fi

# Validate server name (lowercase, alphanumeric, hyphens only)
if [[ ! "$SERVER_NAME" =~ ^[a-z][a-z0-9-]*$ ]]; then
    echo -e "${RED}Error: Server name must start with a letter and contain only lowercase letters, numbers, and hyphens${NC}"
    exit 1
fi

# Check if server already exists
SERVER_DIR="$SERVERS_DIR/$SERVER_NAME"
if [ -d "$SERVER_DIR" ]; then
    echo -e "${RED}Error: Server '$SERVER_NAME' already exists at $SERVER_DIR${NC}"
    exit 1
fi

# Check if template exists
if [ ! -d "$TEMPLATE_DIR" ]; then
    echo -e "${RED}Error: Template directory not found at $TEMPLATE_DIR${NC}"
    exit 1
fi

# Check if main docker-compose.yml exists
if [ ! -f "$MAIN_COMPOSE" ]; then
    echo -e "${RED}Error: Main docker-compose.yml not found at $MAIN_COMPOSE${NC}"
    exit 1
fi

echo -e "${GREEN}Creating new server: $SERVER_NAME${NC}"
echo "  Type: $SERVER_TYPE"
[ -n "$MC_VERSION" ] && echo "  Version: $MC_VERSION"
echo "  Directory: $SERVER_DIR"
echo "  Auto-start: $START_SERVER"
echo ""

# =============================================================================
# Step 1: Copy template
# =============================================================================
echo -e "${BLUE}[1/6]${NC} Copying template..."
cp -r "$TEMPLATE_DIR" "$SERVER_DIR"

# =============================================================================
# Step 2: Update server's docker-compose.yml
# =============================================================================
echo -e "${BLUE}[2/6]${NC} Updating server docker-compose.yml..."
COMPOSE_FILE="$SERVER_DIR/docker-compose.yml"

# Get all HOST_IPS for nip.io hostnames (supports multiple IPs for VPN mesh)
HOST_IPS=$(get_host_ips)
HOSTNAMES=$(build_hostnames "$SERVER_NAME" "$HOST_IPS")

# Replace template with server name
sed -i "s/mc-template/mc-$SERVER_NAME/g" "$COMPOSE_FILE"

# Configure mc-router hostnames (supports multiple IPs: .local + nip.io for each IP)
if [ -n "$HOST_IPS" ]; then
    sed -i "s/template\.local/$HOSTNAMES/g" "$COMPOSE_FILE"
    echo "   Hostnames: $HOSTNAMES"
else
    # Fallback to .local only
    echo -e "${YELLOW}   Warning: HOST_IP/HOST_IPS not set, using .local domain only${NC}"
    echo "   Set HOST_IP or HOST_IPS in .env for nip.io domain support"
    sed -i "s/template\.local/$SERVER_NAME.local/g" "$COMPOSE_FILE"
fi
sed -i "s/# Minecraft Server Configuration Template/# $SERVER_NAME Server/g" "$COMPOSE_FILE"

# Update header comments
sed -i "s|# Usage:|# Hostname: $SERVER_NAME.local|g" "$COMPOSE_FILE"
sed -i "s|#   1\. Copy this directory.*|# Type: $SERVER_TYPE|g" "$COMPOSE_FILE"
sed -i "/^#   [2-5]\./d" "$COMPOSE_FILE"

# =============================================================================
# Step 3: Update config.env
# =============================================================================
echo -e "${BLUE}[3/6]${NC} Updating config.env..."
CONFIG_FILE="$SERVER_DIR/config.env"
if [ -f "$CONFIG_FILE" ]; then
    sed -i "s/^TYPE=.*/TYPE=$SERVER_TYPE/" "$CONFIG_FILE"
    sed -i "s/^MOTD=.*/MOTD=Welcome to $SERVER_NAME! Your adventure begins here./" "$CONFIG_FILE"

    # Set LEVEL to server name by default (world stored in /worlds/<server-name>)
    # This can be overridden by --world option
    sed -i "s/^LEVEL=.*/LEVEL=$SERVER_NAME/" "$CONFIG_FILE"
    echo "   World directory: worlds/$SERVER_NAME"

    # Apply version if specified
    if [ -n "$MC_VERSION" ]; then
        sed -i "s/^VERSION=.*/VERSION=$MC_VERSION/" "$CONFIG_FILE"
        echo "   Version: $MC_VERSION"
    fi

    # Apply world options
    if [ -n "$WORLD_SEED" ]; then
        echo "" >> "$CONFIG_FILE"
        echo "# World Seed" >> "$CONFIG_FILE"
        echo "SEED=$WORLD_SEED" >> "$CONFIG_FILE"
        echo "   World seed: $WORLD_SEED"
    fi

    if [ -n "$WORLD_URL" ]; then
        echo "" >> "$CONFIG_FILE"
        echo "# World Download URL" >> "$CONFIG_FILE"
        echo "WORLD=$WORLD_URL" >> "$CONFIG_FILE"
        echo "   World URL: $WORLD_URL"
    fi

    if [ -n "$WORLD_NAME" ]; then
        # Check if the world exists in shared worlds directory
        WORLD_PATH="$PLATFORM_DIR/worlds/$WORLD_NAME"
        if [ -d "$WORLD_PATH" ]; then
            sed -i "s/^LEVEL=.*/LEVEL=$WORLD_NAME/" "$CONFIG_FILE"
            echo "   Using existing world: $WORLD_NAME (from worlds/$WORLD_NAME)"
        else
            echo -e "${YELLOW}   Warning: World '$WORLD_NAME' not found in worlds/ directory${NC}"
            echo "   LEVEL set to '$WORLD_NAME' - world will be created on first start"
            sed -i "s/^LEVEL=.*/LEVEL=$WORLD_NAME/" "$CONFIG_FILE"
        fi
    fi
fi

# Create data and logs directories
mkdir -p "$SERVER_DIR/data"
mkdir -p "$SERVER_DIR/logs"

# Ensure worlds directory exists (world will be created here via --world-dir)
WORLD_LEVEL="${WORLD_NAME:-$SERVER_NAME}"
mkdir -p "$PLATFORM_DIR/worlds"

# =============================================================================
# Step 4: Update servers/compose.yml
# =============================================================================
echo -e "${BLUE}[4/6]${NC} Updating servers/compose.yml..."

# Ensure servers/compose.yml exists
ensure_servers_compose

# Backup original
cp "$SERVERS_COMPOSE" "$SERVERS_COMPOSE.bak"

# Check if include section exists
if grep -q "^include:" "$SERVERS_COMPOSE"; then
    # Add new server to existing include section
    sed -i "/^include:/a\\  - $SERVER_NAME/docker-compose.yml" "$SERVERS_COMPOSE"
    echo "   Added to include section"
else
    # Add include section at the end
    echo "" >> "$SERVERS_COMPOSE"
    echo "include:" >> "$SERVERS_COMPOSE"
    echo "  - $SERVER_NAME/docker-compose.yml" >> "$SERVERS_COMPOSE"
    echo "   Created include section and added server"
fi

# Verify the changes
if docker compose -f "$MAIN_COMPOSE" config --quiet 2>/dev/null; then
    echo -e "   ${GREEN}Configuration validated successfully${NC}"
    rm -f "$SERVERS_COMPOSE.bak"
else
    echo -e "${RED}   Error: Configuration validation failed!${NC}"
    echo "   Restoring backup..."
    mv "$SERVERS_COMPOSE.bak" "$SERVERS_COMPOSE"
    echo "   Please check the configuration manually."
    exit 1
fi

# =============================================================================
# Step 5: Register with avahi-daemon (mDNS)
# =============================================================================
echo -e "${BLUE}[5/6]${NC} Registering mDNS hostname..."
HOST_IP=$(get_host_ip)
register_avahi_hostname "$SERVER_NAME.local" "$HOST_IP"

# =============================================================================
# Step 6: Start server (optional)
# =============================================================================
if [ "$START_SERVER" = "true" ]; then
    echo -e "${BLUE}[6/6]${NC} Starting server..."
    cd "$PLATFORM_DIR"
    docker compose up -d "mc-$SERVER_NAME"

    # Wait a moment and check status
    sleep 2
    if docker compose ps "mc-$SERVER_NAME" 2>/dev/null | grep -q "Up"; then
        echo -e "   ${GREEN}Server mc-$SERVER_NAME started successfully${NC}"
    else
        echo -e "   ${YELLOW}Server is starting... (check logs with: docker logs -f mc-$SERVER_NAME)${NC}"
    fi
else
    echo -e "${BLUE}[6/6]${NC} Skipping server start (--no-start specified)"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Server '$SERVER_NAME' created successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Show world configuration summary
echo -e "${GREEN}World configuration:${NC}"
if [ -n "$WORLD_NAME" ]; then
    echo "  - World: worlds/$WORLD_NAME (existing)"
elif [ -n "$WORLD_URL" ]; then
    echo "  - World: worlds/$SERVER_NAME (from URL)"
    echo "  - URL: $WORLD_URL"
else
    echo "  - World: worlds/$SERVER_NAME (new)"
fi
if [ -n "$WORLD_SEED" ]; then
    echo "  - Seed: $WORLD_SEED"
fi
echo ""

echo -e "${GREEN}Server details:${NC}"
echo "  - Directory: servers/$SERVER_NAME/"
echo "  - Service: mc-$SERVER_NAME"
if [ -n "$HOST_IPS" ]; then
    echo "  - Hostnames: $HOSTNAMES"
else
    echo "  - Hostname: $SERVER_NAME.local"
fi
echo "  - Type: $SERVER_TYPE"
[ -n "$MC_VERSION" ] && echo "  - Version: $MC_VERSION"
echo ""

echo -e "${GREEN}Connection:${NC}"
if [ -n "$HOST_IPS" ]; then
    echo "  ${GREEN}Recommended (nip.io - no client setup needed):${NC}"
    # Show each IP's nip.io address
    IFS=',' read -ra IPS <<< "$HOST_IPS"
    for ip in "${IPS[@]}"; do
        ip=$(echo "$ip" | tr -d ' ')
        if [ -n "$ip" ]; then
            echo "    $SERVER_NAME.$ip.nip.io:25565"
        fi
    done
    echo ""
    echo "  Alternative (mDNS - requires avahi/Bonjour on client):"
    echo "    $SERVER_NAME.local:25565"
else
    echo "  mDNS: $SERVER_NAME.local:25565"
    echo "  (Set HOST_IP or HOST_IPS in .env for nip.io support)"
fi
echo ""

if [ "$START_SERVER" = "true" ]; then
    echo -e "${GREEN}Commands:${NC}"
    echo "  View logs:    docker logs -f mc-$SERVER_NAME"
    echo "  Stop server:  docker compose stop mc-$SERVER_NAME"
    echo "  RCON console: docker exec -i mc-$SERVER_NAME rcon-cli"
else
    echo -e "${YELLOW}To start the server:${NC}"
    echo "  cd $PLATFORM_DIR && docker compose up -d mc-$SERVER_NAME"
fi
echo ""
