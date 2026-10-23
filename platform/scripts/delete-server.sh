#!/bin/bash
# =============================================================================
# delete-server.sh - Delete a Minecraft server
# =============================================================================
# Usage: ./scripts/delete-server.sh <server-name> [options]
#
# This script removes a server created by create-server.sh:
#   - Stops and removes the Docker container
#   - Removes server from servers/compose.yml
#   - Removes hostname from avahi-daemon
#   - Deletes server directory (servers/<server-name>/)
#
# Worlds outlive their server (#652):
#   - A world in worlds/ is kept; it is only no longer assigned to this server.
#   - A world inside the server (servers/<name>/data/<LEVEL>, plus <LEVEL>_nether
#     and <LEVEL>_the_end) is moved to worlds/ before the directory is removed.
#     If worlds/ already has a folder of that name, nothing is deleted.
#   - --delete-world deletes the world inside the server instead of moving it.
#
# Options:
#   -f, --force     Skip confirmation prompt
#   -y, --yes       Same as --force
#   --delete-world  Delete the world inside the server instead of moving it
#   --keep-avahi    Don't remove avahi hostname entry
#
# Examples:
#   ./scripts/delete-server.sh myserver
#   ./scripts/delete-server.sh myserver --force
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
else
    # Running directly (development mode)
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PLATFORM_DIR="$(dirname "$SCRIPT_DIR")"
fi

# Source common functions
source "$SCRIPT_DIR/lib/common.sh"

SERVERS_DIR="$PLATFORM_DIR/servers"
SERVERS_COMPOSE="$SERVERS_DIR/compose.yml"
MAIN_COMPOSE="$PLATFORM_DIR/docker-compose.yml"
AVAHI_HOSTS="/etc/avahi/hosts"

# Default values
FORCE_DELETE="false"
KEEP_AVAHI="false"
DELETE_WORLD="false"

# Show usage
show_usage() {
    echo "Usage: $0 <server-name> [options]"
    echo ""
    echo "Delete a Minecraft server. Its world is kept in worlds/ unless --delete-world."
    echo ""
    echo "Options:"
    echo "  -f, --force     Skip confirmation prompt"
    echo "  -y, --yes       Same as --force"
    echo "  --delete-world  Delete the world inside the server instead of moving it to worlds/"
    echo "  --keep-avahi    Don't remove avahi hostname entry"
    echo ""
    echo "Examples:"
    echo "  $0 myserver"
    echo "  $0 myserver --force"
}

# Check if first argument exists
if [ -z "$1" ]; then
    echo -e "${RED}Error: Server name is required${NC}"
    echo ""
    show_usage
    exit 1
fi

# Check for help flag first
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_usage
    exit 0
fi

# First argument is server name
SERVER_NAME="$1"
shift

# Parse remaining arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force|-y|--yes)
            FORCE_DELETE="true"
            shift
            ;;
        --keep-avahi)
            KEEP_AVAHI="true"
            shift
            ;;
        --delete-world)
            DELETE_WORLD="true"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown option: $1${NC}"
            echo ""
            show_usage
            exit 1
            ;;
    esac
done

# Validate server name (existing servers may still carry legacy names)
if ! NAME_ERROR=$(validate_existing_server_name "$SERVER_NAME"); then
    echo -e "${RED}Error: $NAME_ERROR${NC}" >&2
    exit 1
fi
SERVER_DIR="$SERVERS_DIR/$SERVER_NAME"
if [ ! -d "$SERVER_DIR" ]; then
    echo -e "${RED}Error: Server '$SERVER_NAME' not found at $SERVER_DIR${NC}" >&2
    exit 1
fi

# =============================================================================
# World plan: decided before anything is touched
# =============================================================================
WORLDS_DIR="$PLATFORM_DIR/worlds"
# LEVEL names the world; the image uses "world" when it is unset.
LEVEL=$(sed -n 's/^LEVEL=//p' "$SERVER_DIR/config.env" 2>/dev/null | tail -n 1 | tr -d "\r\"'")
LEVEL="${LEVEL:-world}"

# World folders inside the server. Symlinks are skipped: rm -rf removes the
# link, not its target.
INTERNAL_WORLDS=()
if validate_world_name "$LEVEL" > /dev/null; then
    LEVEL_VALID="true"
    for suffix in "" _nether _the_end; do
        dir="$SERVER_DIR/data/$LEVEL$suffix"
        if [ -d "$dir" ] && [ ! -L "$dir" ]; then
            INTERNAL_WORLDS+=("$LEVEL$suffix")
        fi
    done
else
    LEVEL_VALID="false"
    if [ "$DELETE_WORLD" != "true" ] && [ -e "$SERVER_DIR/data/$LEVEL" ]; then
        echo -e "${RED}Error: LEVEL '$LEVEL' in servers/$SERVER_NAME/config.env is not a valid world name, so its world cannot be moved safely.${NC}" >&2
        echo "Nothing was deleted. Move the world out of servers/$SERVER_NAME/data/ yourself, or pass --delete-world." >&2
        exit 1
    fi
fi

if [ "$DELETE_WORLD" != "true" ]; then
    for world in "${INTERNAL_WORLDS[@]}"; do
        if [ -e "$WORLDS_DIR/$world" ] || [ -L "$WORLDS_DIR/$world" ]; then
            echo -e "${RED}Error: worlds/$world already exists, so the server's world cannot be moved there.${NC}" >&2
            echo "Nothing was deleted. Rename or remove worlds/$world, or pass --delete-world to delete the server's copy." >&2
            exit 1
        fi
    done
fi

# Confirmation prompt
if [ "$FORCE_DELETE" != "true" ]; then
    echo -e "${YELLOW}WARNING: This will delete server '$SERVER_NAME'${NC}"
    echo ""
    echo "The following will be removed:"
    echo "  - Docker container: mc-$SERVER_NAME"
    echo "  - Server directory: servers/$SERVER_NAME/"
    echo "  - servers/compose.yml entry"
    if [ "$KEEP_AVAHI" != "true" ]; then
        echo "  - avahi hostname: $SERVER_NAME.local"
    fi
    echo ""
    if [ ${#INTERNAL_WORLDS[@]} -gt 0 ]; then
        if [ "$DELETE_WORLD" = "true" ]; then
            echo -e "${RED}World inside the server will be DELETED: ${INTERNAL_WORLDS[*]}${NC}"
        else
            echo -e "${GREEN}World inside the server will be moved to worlds/: ${INTERNAL_WORLDS[*]}${NC}"
        fi
    fi
    if [ "$LEVEL_VALID" = "true" ] && [ -d "$WORLDS_DIR/$LEVEL" ]; then
        echo -e "${GREEN}World worlds/$LEVEL will be kept (no longer assigned to this server).${NC}"
    fi
    echo ""
    read -p "Are you sure? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo ""
echo -e "${RED}Deleting server: $SERVER_NAME${NC}"
echo ""

# =============================================================================
# Step 1: Stop Docker container
# =============================================================================
echo -e "${BLUE}[1/4]${NC} Stopping Docker container..."
cd "$PLATFORM_DIR"
# A container that cannot be stopped or removed may still be writing the world.
container_failed() {
    echo -e "${RED}Error: Failed to $1 container mc-$SERVER_NAME. Nothing was deleted.${NC}" >&2
    exit 1
}
if docker compose ps "mc-$SERVER_NAME" 2>/dev/null | grep -q "mc-$SERVER_NAME"; then
    docker compose stop "mc-$SERVER_NAME" || container_failed stop
    docker compose rm -f "mc-$SERVER_NAME" || container_failed remove
    echo "   Container mc-$SERVER_NAME stopped and removed"
else
    # Check if container exists but not managed by compose (exited state)
    if docker ps -a --format '{{.Names}}' | grep -q "^mc-$SERVER_NAME$"; then
        docker rm -f "mc-$SERVER_NAME" || container_failed remove
        echo "   Container mc-$SERVER_NAME removed"
    else
        echo "   Container mc-$SERVER_NAME not found"
    fi
fi

# =============================================================================
# Step 2: Update servers/compose.yml
# =============================================================================
echo -e "${BLUE}[2/4]${NC} Updating servers/compose.yml..."

if [ -f "$SERVERS_COMPOSE" ]; then
    # Backup original
    cp "$SERVERS_COMPOSE" "$SERVERS_COMPOSE.bak"

    # Remove include entry
    if grep -q "$SERVER_NAME/docker-compose.yml" "$SERVERS_COMPOSE"; then
        sed -i "\|$SERVER_NAME/docker-compose.yml|d" "$SERVERS_COMPOSE"
        echo "   Removed from include section"

        # If no more includes, remove the include: line
        if ! grep -q "^  - " "$SERVERS_COMPOSE"; then
            sed -i '/^include:/d' "$SERVERS_COMPOSE"
            echo "   Removed empty include section"
        fi
    else
        echo "   Server not found in compose.yml"
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
else
    echo "   servers/compose.yml not found (nothing to update)"
fi

# =============================================================================
# Step 3: Remove from avahi-daemon
# =============================================================================
echo -e "${BLUE}[3/4]${NC} Removing mDNS hostname..."
if [ "$KEEP_AVAHI" = "true" ]; then
    echo "   Skipped (--keep-avahi specified)"
elif [ -f "$AVAHI_HOSTS" ]; then
    if grep -q "$SERVER_NAME.local" "$AVAHI_HOSTS" 2>/dev/null; then
        if run_with_sudo sed -i "/$SERVER_NAME\.local/d" "$AVAHI_HOSTS" 2>/dev/null; then
            run_with_sudo systemctl restart avahi-daemon 2>/dev/null || true
            echo -e "   ${GREEN}Removed $SERVER_NAME.local from avahi${NC}"
        else
            echo -e "${YELLOW}   Warning: Failed to update avahi (sudo required)${NC}"
            if has_sudo_password; then
                echo "   Check if MCCTL_SUDO_PASSWORD is correct"
            else
                echo "   Set MCCTL_SUDO_PASSWORD env var or remove manually: sudo sed -i '/$SERVER_NAME.local/d' $AVAHI_HOSTS"
            fi
        fi
    else
        echo "   Hostname not found in avahi"
    fi
else
    echo "   avahi not configured"
fi

# =============================================================================
# Step 4: Delete server directory
# =============================================================================
echo -e "${BLUE}[4/4]${NC} Handling world data and deleting server directory..."

if [ "$DELETE_WORLD" != "true" ] && [ ${#INTERNAL_WORLDS[@]} -gt 0 ]; then
    mkdir -p "$WORLDS_DIR"
    for world in "${INTERNAL_WORLDS[@]}"; do
        if ! mv "$SERVER_DIR/data/$world" "$WORLDS_DIR/$world"; then
            echo -e "${RED}Error: Failed to move data/$world to worlds/. servers/$SERVER_NAME/ was kept.${NC}" >&2
            exit 1
        fi
        echo -e "   ${GREEN}Moved data/$world to worlds/$world${NC}"
    done
fi

# Check for symlinked worlds and warn
if [ -d "$SERVER_DIR/data" ]; then
    for link in "$SERVER_DIR/data"/*; do
        if [ -L "$link" ]; then
            target=$(readlink "$link")
            echo "   Note: Symlink found: $(basename "$link") -> $target (preserved in worlds/)"
        fi
    done
fi

rm -rf "$SERVER_DIR"
echo -e "   ${GREEN}Deleted servers/$SERVER_NAME/${NC}"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Server '$SERVER_NAME' deleted successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Removed:"
echo "  - Container: mc-$SERVER_NAME"
echo "  - Directory: servers/$SERVER_NAME/"
echo "  - servers/compose.yml entry"
if [ "$KEEP_AVAHI" != "true" ]; then
    echo "  - avahi hostname: $SERVER_NAME.local"
fi
echo ""
if [ ${#INTERNAL_WORLDS[@]} -gt 0 ] && [ "$DELETE_WORLD" = "true" ]; then
    echo -e "${YELLOW}World deleted with the server (--delete-world): ${INTERNAL_WORLDS[*]}${NC}"
elif [ ${#INTERNAL_WORLDS[@]} -gt 0 ]; then
    echo -e "${GREEN}World moved to worlds/$LEVEL; it can be assigned to another server.${NC}"
elif [ "$LEVEL_VALID" = "true" ] && [ -d "$WORLDS_DIR/$LEVEL" ]; then
    echo -e "${GREEN}World worlds/$LEVEL was kept; it is no longer assigned to this server.${NC}"
else
    echo "No world data found for LEVEL '$LEVEL'."
fi
echo ""
