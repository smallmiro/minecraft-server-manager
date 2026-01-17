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
#   -s, --seed NUMBER    World seed for new world generation
#   -u, --world-url URL  Download world from ZIP URL
#   -w, --world NAME     Use existing world from worlds/ directory
#
# World options are mutually exclusive (only one can be specified).
#
# Examples:
#   ./scripts/create-server.sh myserver
#   ./scripts/create-server.sh myserver -t FORGE
#   ./scripts/create-server.sh myserver --seed 12345
#   ./scripts/create-server.sh myserver --world-url https://example.com/world.zip
#   ./scripts/create-server.sh myserver --world existing-world
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(dirname "$SCRIPT_DIR")"
SERVERS_DIR="$PLATFORM_DIR/servers"
TEMPLATE_DIR="$SERVERS_DIR/_template"

# Default values
SERVER_TYPE="PAPER"
WORLD_SEED=""
WORLD_URL=""
WORLD_NAME=""

# Show usage
show_usage() {
    echo "Usage: $0 <server-name> [options]"
    echo ""
    echo "Arguments:"
    echo "  server-name  : Name for the new server (lowercase, no spaces)"
    echo ""
    echo "Options:"
    echo "  -t, --type TYPE      Server type: PAPER (default), VANILLA, FORGE, FABRIC"
    echo "  -s, --seed NUMBER    World seed for new world generation"
    echo "  -u, --world-url URL  Download world from ZIP URL"
    echo "  -w, --world NAME     Use existing world from worlds/ directory"
    echo ""
    echo "World options (--seed, --world-url, --world) are mutually exclusive."
    echo ""
    echo "Examples:"
    echo "  $0 myserver"
    echo "  $0 myserver -t FORGE"
    echo "  $0 myserver --seed 12345"
    echo "  $0 myserver --world-url https://example.com/world.zip"
    echo "  $0 myserver --world existing-world"
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

echo -e "${GREEN}Creating new server: $SERVER_NAME${NC}"
echo "  Type: $SERVER_TYPE"
echo "  Directory: $SERVER_DIR"
echo ""

# Copy template
echo "1. Copying template..."
cp -r "$TEMPLATE_DIR" "$SERVER_DIR"

# Update docker-compose.yml
echo "2. Updating docker-compose.yml..."
COMPOSE_FILE="$SERVER_DIR/docker-compose.yml"

# Replace template with server name
sed -i "s/mc-template/mc-$SERVER_NAME/g" "$COMPOSE_FILE"
sed -i "s/template\.local/$SERVER_NAME.local/g" "$COMPOSE_FILE"
sed -i "s/# Minecraft Server Configuration Template/# $SERVER_NAME Server/g" "$COMPOSE_FILE"

# Update header comments
sed -i "s|# Usage:|# Hostname: $SERVER_NAME.local|g" "$COMPOSE_FILE"
sed -i "s|#   1\. Copy this directory.*|# Type: $SERVER_TYPE|g" "$COMPOSE_FILE"
sed -i "/^#   [2-5]\./d" "$COMPOSE_FILE"

# Update config.env
echo "3. Updating config.env..."
CONFIG_FILE="$SERVER_DIR/config.env"
if [ -f "$CONFIG_FILE" ]; then
    sed -i "s/^TYPE=.*/TYPE=$SERVER_TYPE/" "$CONFIG_FILE"
    sed -i "s/^MOTD=.*/MOTD=Welcome to $SERVER_NAME Server/" "$CONFIG_FILE"

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
        # Check if the world exists
        WORLD_PATH="$PLATFORM_DIR/worlds/$WORLD_NAME"
        if [ -d "$WORLD_PATH" ]; then
            sed -i "s/^LEVEL=.*/LEVEL=$WORLD_NAME/" "$CONFIG_FILE"
            echo "   Using existing world: $WORLD_NAME"
        else
            echo -e "${YELLOW}Warning: World '$WORLD_NAME' not found in worlds/ directory${NC}"
            echo "   Available worlds:"
            ls -d "$PLATFORM_DIR/worlds"/*/ 2>/dev/null | xargs -n1 basename || echo "   (none)"
            echo ""
            echo "   LEVEL set to '$WORLD_NAME' - world will be created on first start"
            sed -i "s/^LEVEL=.*/LEVEL=$WORLD_NAME/" "$CONFIG_FILE"
        fi
    fi
fi

# Create data and logs directories
echo "4. Creating data directories..."
mkdir -p "$SERVER_DIR/data"
mkdir -p "$SERVER_DIR/logs"

# Show next steps
echo ""
echo -e "${GREEN}Server '$SERVER_NAME' created successfully!${NC}"
echo ""

# Show world configuration summary
if [ -n "$WORLD_SEED" ] || [ -n "$WORLD_URL" ] || [ -n "$WORLD_NAME" ]; then
    echo -e "${GREEN}World configuration:${NC}"
    if [ -n "$WORLD_SEED" ]; then
        echo "  - Seed: $WORLD_SEED (new world will be generated)"
    fi
    if [ -n "$WORLD_URL" ]; then
        echo "  - URL: $WORLD_URL (will be downloaded on first start)"
    fi
    if [ -n "$WORLD_NAME" ]; then
        echo "  - Level: $WORLD_NAME (existing world)"
    fi
    echo ""
fi

echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "1. Edit server settings:"
echo "   nano $SERVER_DIR/config.env"
echo ""
echo "2. Add to platform/docker-compose.yml:"
echo ""
echo "   include:"
echo "     - servers/$SERVER_NAME/docker-compose.yml"
echo ""
echo "3. Add MAPPING to router:"
echo ""
echo "   MAPPING: |"
echo "     $SERVER_NAME.local=mc-$SERVER_NAME:25565"
echo ""
echo "4. Add depends_on to router:"
echo ""
echo "   depends_on:"
echo "     - mc-$SERVER_NAME"
echo ""
echo "5. Configure client hosts file:"
echo "   <server-ip> $SERVER_NAME.local"
echo ""
echo "6. Start the server:"
echo "   cd $PLATFORM_DIR && docker compose up -d"
echo ""
echo "7. Connect via Minecraft:"
echo "   $SERVER_NAME.local:25565"
