#!/bin/bash
# =============================================================================
# migrate-nip-io.sh - Add nip.io domains to existing servers
# =============================================================================
# Usage: ./scripts/migrate-nip-io.sh [options]
#
# This script updates all existing server docker-compose.yml files to include
# nip.io magic DNS hostnames alongside the existing .local hostnames.
#
# Options:
#   --dry-run    Show what would be changed without making changes
#   -h, --help   Show this help message
#
# Requirements:
#   - HOST_IP must be set in platform/.env
#
# Example:
#   ./scripts/migrate-nip-io.sh           # Apply changes
#   ./scripts/migrate-nip-io.sh --dry-run # Preview changes only
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script/platform directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(dirname "$SCRIPT_DIR")"
SERVERS_DIR="$PLATFORM_DIR/servers"
ENV_FILE="$PLATFORM_DIR/.env"

# Options
DRY_RUN=false

# =============================================================================
# Helper Functions
# =============================================================================

show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Add nip.io magic DNS hostnames to existing server configurations."
    echo ""
    echo "Options:"
    echo "  --dry-run    Show what would be changed without making changes"
    echo "  -h, --help   Show this help message"
    echo ""
    echo "Requirements:"
    echo "  HOST_IP must be set in platform/.env"
}

# Get host IP from .env file
get_host_ip() {
    if [ -f "$ENV_FILE" ]; then
        local env_ip
        env_ip=$(grep "^HOST_IP=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        if [ -n "$env_ip" ]; then
            echo "$env_ip"
            return
        fi
    fi
    echo ""
}

# Extract server name from docker-compose.yml
get_server_name() {
    local compose_file="$1"
    # Look for mc-router.host label and extract the .local hostname
    local hostname
    hostname=$(grep -E "mc-router\.host.*\.local" "$compose_file" 2>/dev/null | head -1 | grep -oP '[a-z0-9-]+(?=\.local)' | head -1)
    echo "$hostname"
}

# Check if nip.io is already configured
has_nip_io() {
    local compose_file="$1"
    grep -q "nip\.io" "$compose_file" 2>/dev/null
}

# =============================================================================
# Parse Arguments
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
done

# =============================================================================
# Main Script
# =============================================================================

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}nip.io Migration Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check HOST_IP
HOST_IP=$(get_host_ip)
if [ -z "$HOST_IP" ]; then
    echo -e "${RED}Error: HOST_IP not set in $ENV_FILE${NC}"
    echo "Please set HOST_IP to your server's local IP address."
    echo "Example: HOST_IP=192.168.20.37"
    exit 1
fi

echo "HOST_IP: $HOST_IP"
echo "Servers directory: $SERVERS_DIR"
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}DRY RUN MODE - No changes will be made${NC}"
fi
echo ""

# Find all server directories (excluding _template)
SERVERS_FOUND=0
SERVERS_UPDATED=0
SERVERS_SKIPPED=0

for server_dir in "$SERVERS_DIR"/*/; do
    # Skip _template directory
    if [[ "$(basename "$server_dir")" == "_template" ]]; then
        continue
    fi

    compose_file="$server_dir/docker-compose.yml"

    # Check if docker-compose.yml exists
    if [ ! -f "$compose_file" ]; then
        continue
    fi

    SERVERS_FOUND=$((SERVERS_FOUND + 1))
    server_name=$(basename "$server_dir")

    echo -e "${BLUE}Processing:${NC} $server_name"

    # Check if already has nip.io
    if has_nip_io "$compose_file"; then
        echo -e "  ${YELLOW}Skipped${NC} - nip.io already configured"
        SERVERS_SKIPPED=$((SERVERS_SKIPPED + 1))
        continue
    fi

    # Get the current hostname from the file
    current_hostname=$(get_server_name "$compose_file")
    if [ -z "$current_hostname" ]; then
        echo -e "  ${YELLOW}Skipped${NC} - Could not find mc-router.host label"
        SERVERS_SKIPPED=$((SERVERS_SKIPPED + 1))
        continue
    fi

    # Construct new hostname value
    new_hostname="$current_hostname.local,$current_hostname.$HOST_IP.nip.io"

    echo "  Current: $current_hostname.local"
    echo "  New: $new_hostname"

    if [ "$DRY_RUN" = true ]; then
        echo -e "  ${YELLOW}Would update${NC} (dry run)"
    else
        # Create backup
        cp "$compose_file" "$compose_file.bak"

        # Update the mc-router.host label
        # Handle both YAML format (mc-router.host: "value") and array format (- "mc-router.host=value")
        if grep -q "mc-router\.host:" "$compose_file"; then
            # YAML format
            sed -i "s/mc-router\.host:.*\"$current_hostname\.local\"/mc-router.host: \"$new_hostname\"/" "$compose_file"
        else
            # Array format
            sed -i "s/mc-router\.host=$current_hostname\.local/mc-router.host=$new_hostname/" "$compose_file"
        fi

        echo -e "  ${GREEN}Updated${NC}"

        # Remove backup on success
        rm -f "$compose_file.bak"
    fi

    SERVERS_UPDATED=$((SERVERS_UPDATED + 1))
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Migration Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Servers found: $SERVERS_FOUND"
echo "Servers updated: $SERVERS_UPDATED"
echo "Servers skipped: $SERVERS_SKIPPED"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}This was a dry run. Run without --dry-run to apply changes.${NC}"
elif [ "$SERVERS_UPDATED" -gt 0 ]; then
    echo -e "${GREEN}Migration complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Validate configuration: docker compose -f $PLATFORM_DIR/docker-compose.yml config"
    echo "  2. Restart servers: docker compose down && docker compose up -d"
    echo ""
    echo "Clients can now connect via:"
    echo "  <server>.$HOST_IP.nip.io:25565"
else
    echo "No servers needed migration."
fi
