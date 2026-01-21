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
# IMPORTANT: World data in worlds/ directory is PRESERVED.
#
# Options:
#   -f, --force    Skip confirmation prompt
#   -y, --yes      Same as --force
#   --keep-avahi   Don't remove avahi hostname entry
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

SERVERS_DIR="$PLATFORM_DIR/servers"
SERVERS_COMPOSE="$SERVERS_DIR/compose.yml"
MAIN_COMPOSE="$PLATFORM_DIR/docker-compose.yml"
AVAHI_HOSTS="/etc/avahi/hosts"

# Default values
FORCE_DELETE="false"
KEEP_AVAHI="false"

# Show usage
show_usage() {
    echo "Usage: $0 <server-name> [options]"
    echo ""
    echo "Delete a Minecraft server (worlds are preserved)."
    echo ""
    echo "Options:"
    echo "  -f, --force    Skip confirmation prompt"
    echo "  -y, --yes      Same as --force"
    echo "  --keep-avahi   Don't remove avahi hostname entry"
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

# Validate server name
SERVER_DIR="$SERVERS_DIR/$SERVER_NAME"
if [ ! -d "$SERVER_DIR" ]; then
    echo -e "${RED}Error: Server '$SERVER_NAME' not found at $SERVER_DIR${NC}"
    exit 1
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
    echo -e "${GREEN}World data in worlds/ will be PRESERVED.${NC}"
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
if docker compose ps "mc-$SERVER_NAME" 2>/dev/null | grep -q "mc-$SERVER_NAME"; then
    docker compose stop "mc-$SERVER_NAME" 2>/dev/null || true
    docker compose rm -f "mc-$SERVER_NAME" 2>/dev/null || true
    echo "   Container mc-$SERVER_NAME stopped and removed"
else
    echo "   Container mc-$SERVER_NAME not running"
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
echo -e "${BLUE}[4/4]${NC} Deleting server directory..."

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
echo -e "${GREEN}World data in worlds/ has been preserved.${NC}"
echo ""
