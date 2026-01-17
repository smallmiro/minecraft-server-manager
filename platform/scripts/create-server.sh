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
#   --no-start           Don't start the server after creation
#   --start              Start the server after creation (default)
#
# World options are mutually exclusive (only one can be specified).
#
# Examples:
#   ./scripts/create-server.sh myserver
#   ./scripts/create-server.sh myserver -t FORGE
#   ./scripts/create-server.sh myserver --seed 12345 --no-start
#   ./scripts/create-server.sh myserver --world-url https://example.com/world.zip
#   ./scripts/create-server.sh myserver --world existing-world
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(dirname "$SCRIPT_DIR")"
SERVERS_DIR="$PLATFORM_DIR/servers"
TEMPLATE_DIR="$SERVERS_DIR/_template"
MAIN_COMPOSE="$PLATFORM_DIR/docker-compose.yml"

# Default values
SERVER_TYPE="PAPER"
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
    echo "  -s, --seed NUMBER    World seed for new world generation"
    echo "  -u, --world-url URL  Download world from ZIP URL"
    echo "  -w, --world NAME     Use existing world from worlds/ directory"
    echo "  --no-start           Don't start the server after creation"
    echo "  --start              Start the server after creation (default)"
    echo ""
    echo "World options (--seed, --world-url, --world) are mutually exclusive."
    echo ""
    echo "Examples:"
    echo "  $0 myserver"
    echo "  $0 myserver -t FORGE"
    echo "  $0 myserver --seed 12345"
    echo "  $0 myserver --world-url https://example.com/world.zip"
    echo "  $0 myserver --world existing-world --no-start"
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
echo "  Directory: $SERVER_DIR"
echo "  Auto-start: $START_SERVER"
echo ""

# =============================================================================
# Step 1: Copy template
# =============================================================================
echo -e "${BLUE}[1/5]${NC} Copying template..."
cp -r "$TEMPLATE_DIR" "$SERVER_DIR"

# =============================================================================
# Step 2: Update server's docker-compose.yml
# =============================================================================
echo -e "${BLUE}[2/5]${NC} Updating server docker-compose.yml..."
COMPOSE_FILE="$SERVER_DIR/docker-compose.yml"

# Replace template with server name
sed -i "s/mc-template/mc-$SERVER_NAME/g" "$COMPOSE_FILE"
sed -i "s/template\.local/$SERVER_NAME.local/g" "$COMPOSE_FILE"
sed -i "s/# Minecraft Server Configuration Template/# $SERVER_NAME Server/g" "$COMPOSE_FILE"

# Update header comments
sed -i "s|# Usage:|# Hostname: $SERVER_NAME.local|g" "$COMPOSE_FILE"
sed -i "s|#   1\. Copy this directory.*|# Type: $SERVER_TYPE|g" "$COMPOSE_FILE"
sed -i "/^#   [2-5]\./d" "$COMPOSE_FILE"

# =============================================================================
# Step 3: Update config.env
# =============================================================================
echo -e "${BLUE}[3/5]${NC} Updating config.env..."
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
            echo -e "${YELLOW}   Warning: World '$WORLD_NAME' not found in worlds/ directory${NC}"
            echo "   LEVEL set to '$WORLD_NAME' - world will be created on first start"
            sed -i "s/^LEVEL=.*/LEVEL=$WORLD_NAME/" "$CONFIG_FILE"
        fi
    fi
fi

# Create data and logs directories
mkdir -p "$SERVER_DIR/data"
mkdir -p "$SERVER_DIR/logs"

# =============================================================================
# Step 4: Update main docker-compose.yml
# =============================================================================
echo -e "${BLUE}[4/5]${NC} Updating main docker-compose.yml..."

# Backup original
cp "$MAIN_COMPOSE" "$MAIN_COMPOSE.bak"

# --- Add include entry ---
# Check if include section exists and is not commented
if grep -q "^include:" "$MAIN_COMPOSE"; then
    # Add new server to existing include section
    # Find the line after "include:" and add the new entry
    sed -i "/^include:/a\\  - servers/$SERVER_NAME/docker-compose.yml" "$MAIN_COMPOSE"
    echo "   Added to include section"
else
    # Check if include is commented out
    if grep -q "^# include:" "$MAIN_COMPOSE"; then
        # Uncomment and add
        sed -i "s/^# include:/include:/" "$MAIN_COMPOSE"
        sed -i "/^include:/a\\  - servers/$SERVER_NAME/docker-compose.yml" "$MAIN_COMPOSE"
        echo "   Enabled and added to include section"
    else
        # Add include section before services
        sed -i "/^services:/i\\include:\\n  - servers/$SERVER_NAME/docker-compose.yml\\n" "$MAIN_COMPOSE"
        echo "   Created include section"
    fi
fi

# --- Add MAPPING entry ---
# Find MAPPING line and add new entry
if grep -q "MAPPING:" "$MAIN_COMPOSE"; then
    # Check if MAPPING is empty (MAPPING: "")
    if grep -q 'MAPPING: ""' "$MAIN_COMPOSE"; then
        # Replace empty MAPPING with new entry
        sed -i "s|MAPPING: \"\"|MAPPING: \|\n        $SERVER_NAME.local=mc-$SERVER_NAME:25565|" "$MAIN_COMPOSE"
        echo "   Set MAPPING entry"
    else
        # Add to existing MAPPING (find the line after MAPPING: | and add)
        # Use awk for more reliable multi-line handling
        awk -v server="$SERVER_NAME" '
            /MAPPING: \|/ { print; getline; print; print "        " server ".local=mc-" server ":25565"; next }
            { print }
        ' "$MAIN_COMPOSE" > "$MAIN_COMPOSE.tmp" && mv "$MAIN_COMPOSE.tmp" "$MAIN_COMPOSE"
        echo "   Added to MAPPING"
    fi
fi

# --- Add depends_on entry ---
# Find depends_on in router section and add new entry
if grep -q "depends_on:" "$MAIN_COMPOSE"; then
    # Add new dependency after existing depends_on entries
    # Find the last "- mc-" line under depends_on and add after it
    awk -v server="$SERVER_NAME" '
        /depends_on:/ { in_depends=1 }
        in_depends && /^[[:space:]]*- mc-/ { last_mc=NR; last_line=$0 }
        in_depends && !/^[[:space:]]*-/ && NR>1 && last_mc {
            if (NR == last_mc+1 || (!/^[[:space:]]*$/ && !/^[[:space:]]*#/)) {
                in_depends=0
            }
        }
        { lines[NR]=$0 }
        END {
            for (i=1; i<=NR; i++) {
                print lines[i]
                if (i == last_mc) {
                    # Get indentation from last line
                    match(lines[i], /^[[:space:]]*/)
                    indent = substr(lines[i], RSTART, RLENGTH)
                    print indent "- mc-" server
                }
            }
        }
    ' "$MAIN_COMPOSE" > "$MAIN_COMPOSE.tmp" && mv "$MAIN_COMPOSE.tmp" "$MAIN_COMPOSE"
    echo "   Added to depends_on"
else
    echo -e "${YELLOW}   Warning: depends_on section not found${NC}"
fi

# Verify the changes
if docker compose -f "$MAIN_COMPOSE" config --quiet 2>/dev/null; then
    echo -e "   ${GREEN}docker-compose.yml validated successfully${NC}"
    rm -f "$MAIN_COMPOSE.bak"
else
    echo -e "${RED}   Error: docker-compose.yml validation failed!${NC}"
    echo "   Restoring backup..."
    mv "$MAIN_COMPOSE.bak" "$MAIN_COMPOSE"
    echo "   Please check the configuration manually."
    exit 1
fi

# =============================================================================
# Step 5: Start server (optional)
# =============================================================================
if [ "$START_SERVER" = "true" ]; then
    echo -e "${BLUE}[5/5]${NC} Starting server..."
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
    echo -e "${BLUE}[5/5]${NC} Skipping server start (--no-start specified)"
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
if [ -n "$WORLD_SEED" ] || [ -n "$WORLD_URL" ] || [ -n "$WORLD_NAME" ]; then
    echo -e "${GREEN}World configuration:${NC}"
    if [ -n "$WORLD_SEED" ]; then
        echo "  - Seed: $WORLD_SEED"
    fi
    if [ -n "$WORLD_URL" ]; then
        echo "  - URL: $WORLD_URL (downloaded on first start)"
    fi
    if [ -n "$WORLD_NAME" ]; then
        echo "  - Level: $WORLD_NAME"
    fi
    echo ""
fi

echo -e "${GREEN}Server details:${NC}"
echo "  - Directory: servers/$SERVER_NAME/"
echo "  - Service: mc-$SERVER_NAME"
echo "  - Hostname: $SERVER_NAME.local"
echo "  - Type: $SERVER_TYPE"
echo ""

echo -e "${YELLOW}Client setup:${NC}"
echo "  Add to hosts file: <server-ip> $SERVER_NAME.local"
echo "  Connect via: $SERVER_NAME.local:25565"
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
