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
AVAHI_HOSTS="${AVAHI_HOSTS:-/etc/avahi/hosts}"

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
# World plan
# =============================================================================
# Without --delete-world nothing is deleted unless every world inside the
# server can be located and moved. The plan is made before anything is
# touched (fail fast) and again once the container is gone (the server may
# create folders while it stops); only the second plan is acted on.
WORLDS_DIR="$PLATFORM_DIR/worlds"

# real_dir <dir>: physical path with symlinks resolved (no readlink -f: BSD).
real_dir() { (cd -P -- "$1" 2> /dev/null && pwd -P); }

# is_within <path> <dir>: <path> is <dir> or below it.
is_within() {
    case "$1/" in "$2/"*) return 0 ;; esac
    return 1
}

# worlds_outside_server: worlds/ must not resolve into the server directory,
# or rm -rf would delete the moved world and every other world with it.
worlds_outside_server() {
    local server_real worlds_real
    server_real=$(real_dir "$SERVER_DIR") || {
        PLAN_ERROR="cannot resolve servers/$SERVER_NAME"
        return 1
    }
    if [ -L "$WORLDS_DIR" ] && [ ! -e "$WORLDS_DIR" ]; then
        PLAN_ERROR="worlds/ is a broken symlink"
        return 1
    fi
    [ -e "$WORLDS_DIR" ] || return 0  # created later, next to servers/
    worlds_real=$(real_dir "$WORLDS_DIR") || {
        PLAN_ERROR="cannot resolve worlds/"
        return 1
    }
    if is_within "$worlds_real" "$server_real"; then
        PLAN_ERROR="worlds/ resolves to $worlds_real, inside servers/$SERVER_NAME, which would be deleted"
        return 1
    fi
}

# plan_worlds: sets LEVEL and INTERNAL_WORLDS (folders under data/ to move to
# worlds/). Returns 1 with the reason in PLAN_ERROR when that is not safe.
plan_worlds() {
    INTERNAL_WORLDS=()
    LEVEL=""
    PLAN_ERROR=""
    local config="$SERVER_DIR/config.env" defs="" rc=0 suffix dir files file found world covered hidden=""
    local links link target target_real server_real inside=""

    # Only a single plain `LEVEL=<world name>` line is understood. Anything
    # else Compose may read differently (comments, quotes, spaces, export).
    if [ -f "$config" ]; then
        defs=$(grep -E '^[[:space:]]*(export[[:space:]]+)?LEVEL[[:space:]]*=' "$config") || rc=$?
        if [ "$rc" -gt 1 ]; then
            PLAN_ERROR="cannot read servers/$SERVER_NAME/config.env"
            return 1
        fi
    fi
    if [ -z "$defs" ]; then
        LEVEL="world"  # the image default when LEVEL is unset
    elif [ "$(printf '%s\n' "$defs" | grep -c '')" -gt 1 ]; then
        PLAN_ERROR="LEVEL is defined more than once in servers/$SERVER_NAME/config.env"
        return 1
    elif [[ "$defs" != LEVEL=* ]] || ! validate_world_name "${defs#LEVEL=}" > /dev/null; then
        PLAN_ERROR="cannot resolve '$defs' in servers/$SERVER_NAME/config.env (expected LEVEL=<name> with letters, digits, - or _ only)"
        return 1
    else
        LEVEL="${defs#LEVEL=}"
    fi

    # A symlinked server or data directory would move or delete data elsewhere.
    if [ -L "$SERVER_DIR" ] || [ -L "$SERVER_DIR/data" ]; then
        PLAN_ERROR="servers/$SERVER_NAME or its data/ is a symlink"
        return 1
    fi

    # Symlinked world folders are not moved: rm -rf removes only the link. A
    # target inside the server shows up below as a world that would be lost.
    for suffix in "" _nether _the_end; do
        dir="$SERVER_DIR/data/$LEVEL$suffix"
        if [ -d "$dir" ] && [ ! -L "$dir" ]; then
            INTERNAL_WORLDS+=("$LEVEL$suffix")
        fi
    done
    if [ ${#INTERNAL_WORLDS[@]} -gt 0 ] && [ "${INTERNAL_WORLDS[0]}" != "$LEVEL" ]; then
        PLAN_ERROR="data/ has dimension folders of '$LEVEL' but no data/$LEVEL"
        return 1
    fi

    # Any other world in the server would be deleted. A world is a folder with
    # level.dat, level.dat_old, a region/ folder or *.mca files.
    files=$(find "$SERVER_DIR" \( -type f \( -name level.dat -o -name level.dat_old -o -name '*.mca' \) \) -o \( -type d -name region \)) || {
        PLAN_ERROR="cannot scan servers/$SERVER_NAME for worlds"
        return 1
    }
    while IFS= read -r file; do
        [ -n "$file" ] || continue
        found=$(dirname "$file")
        [ "$(basename "$found")" != region ] || found=$(dirname "$found")
        covered="false"
        for world in "${INTERNAL_WORLDS[@]}"; do
            case "$found/" in "$SERVER_DIR/data/$world/"*) covered="true" ;; esac
        done
        found="${found#"$SERVER_DIR"/}"
        case "$hidden " in *" $found "*) covered="true" ;; esac  # listed already
        [ "$covered" = "true" ] || hidden="$hidden $found"
    done <<< "$files"
    if [ -n "$hidden" ]; then
        PLAN_ERROR="worlds that are not LEVEL '$LEVEL' would be deleted:$hidden"
        return 1
    fi

    # A symlink whose target is inside the server: rm -rf deletes the target
    # with the server, and the link itself is not moved.
    server_real=$(real_dir "$SERVER_DIR") || {
        PLAN_ERROR="cannot resolve servers/$SERVER_NAME"
        return 1
    }
    links=$(find "$SERVER_DIR" -type l) || {
        PLAN_ERROR="cannot scan servers/$SERVER_NAME for symlinks"
        return 1
    }
    while IFS= read -r link; do
        [ -n "$link" ] || continue
        [ -e "$link" ] || continue  # a broken link holds nothing
        if [ -d "$link" ]; then
            target_real=$(real_dir "$link")
        else
            target=$(readlink "$link")
            case "$target" in /*) ;; *) target="$(dirname "$link")/$target" ;; esac
            target_real=$(real_dir "$(dirname "$target")")
        fi || {
            PLAN_ERROR="cannot resolve symlink ${link#"$SERVER_DIR"/}"
            return 1
        }
        if is_within "$target_real" "$server_real"; then
            inside="$inside ${link#"$SERVER_DIR"/}"
        fi
    done <<< "$links"
    if [ -n "$inside" ]; then
        PLAN_ERROR="symlinks point inside servers/$SERVER_NAME, so their targets would be deleted:$inside"
        return 1
    fi

    for world in "${INTERNAL_WORLDS[@]}"; do
        if [ -e "$WORLDS_DIR/$world" ] || [ -L "$WORLDS_DIR/$world" ]; then
            PLAN_ERROR="worlds/$world already exists, so the server's world cannot be moved there"
            return 1
        fi
    done
}

# require_world_plan <what was done so far>: abort unless --delete-world.
# worlds/ inside the server aborts even with --delete-world: that would
# delete worlds that are not the server's.
require_world_plan() {
    if ! worlds_outside_server; then
        echo -e "${RED}Error: $PLAN_ERROR.${NC}" >&2
        echo "$1 Point worlds/ outside servers/$SERVER_NAME first." >&2
        exit 1
    fi
    plan_worlds && return 0
    [ "$DELETE_WORLD" = "true" ] && return 0
    echo -e "${RED}Error: $PLAN_ERROR.${NC}" >&2
    echo "$1 Move the world(s) yourself, or pass --delete-world to delete them with the server." >&2
    exit 1
}

require_world_plan "Nothing was deleted."

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
    if [ -n "$LEVEL" ] && [ -d "$WORLDS_DIR/$LEVEL" ]; then
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
# docker ps -a decides whether the container exists: an unreachable daemon
# is not "no container".
if ! CONTAINERS=$(docker ps -a --format '{{.Names}}'); then
    echo -e "${RED}Error: Cannot list Docker containers (is Docker running?). Nothing was deleted.${NC}" >&2
    exit 1
fi
if ! grep -qx "mc-$SERVER_NAME" <<< "$CONTAINERS"; then
    echo "   Container mc-$SERVER_NAME not found"
elif docker compose ps "mc-$SERVER_NAME" 2>/dev/null | grep -q "mc-$SERVER_NAME"; then
    docker compose stop "mc-$SERVER_NAME" || container_failed stop
    docker compose rm -f "mc-$SERVER_NAME" || container_failed remove
    echo "   Container mc-$SERVER_NAME stopped and removed"
else
    # Not in the compose project (e.g. include already gone): remove directly
    docker rm -f "mc-$SERVER_NAME" || container_failed remove
    echo "   Container mc-$SERVER_NAME removed"
fi

# The server can no longer write: plan again and act only on this plan.
require_world_plan "Only the container was stopped and removed; nothing else was changed."

# =============================================================================
# Step 2: Update servers/compose.yml
# =============================================================================
echo -e "${BLUE}[2/4]${NC} Updating servers/compose.yml..."

if [ -f "$SERVERS_COMPOSE" ]; then
    # Backup original
    cp "$SERVERS_COMPOSE" "$SERVERS_COMPOSE.bak"

    # Remove include entry
    if remove_include_entry "$SERVERS_COMPOSE" "$SERVER_NAME"; then
        echo "   Removed from include section"
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
    if avahi_host_registered "$AVAHI_HOSTS" "$SERVER_NAME.local"; then
        # tee into the existing file keeps its owner/mode (it is root-owned)
        # filtered content is built first so a failed awk never truncates the file
        if new_hosts=$(avahi_hosts_without "$AVAHI_HOSTS" "$SERVER_NAME.local") \
            && printf '%s\n' "$new_hosts" | run_with_sudo_stdin tee "$AVAHI_HOSTS" > /dev/null 2>&1; then
            run_with_sudo systemctl restart avahi-daemon 2>/dev/null || true
            echo -e "   ${GREEN}Removed $SERVER_NAME.local from avahi${NC}"
        else
            echo -e "${YELLOW}   Warning: Failed to update avahi (sudo required)${NC}"
            if has_sudo_password; then
                echo "   Check if MCCTL_SUDO_PASSWORD is correct"
            else
                echo "   Set MCCTL_SUDO_PASSWORD env var or remove the $SERVER_NAME.local line from $AVAHI_HOSTS manually"
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

# move_failed <reason>: report what already moved and keep the server dir.
MOVED=()
move_failed() {
    echo -e "${RED}Error: $1. servers/$SERVER_NAME/ was kept (its container and compose entry are already removed).${NC}" >&2
    for world in "${MOVED[@]}"; do
        echo "Already moved: servers/$SERVER_NAME/data/$world -> worlds/$world" >&2
    done
    exit 1
}
if [ "$DELETE_WORLD" != "true" ] && [ ${#INTERNAL_WORLDS[@]} -gt 0 ]; then
    mkdir -p "$WORLDS_DIR"
    for world in "${INTERNAL_WORLDS[@]}"; do
        # ponytail: check-then-mv is not atomic; a folder created in between
        # makes mv nest the world (worlds/<w>/<w>): misplaced, but the data is
        # kept. Concurrent create/delete of the same world name is rare; a
        # world lock (#670) would close it.
        if [ -e "$WORLDS_DIR/$world" ] || [ -L "$WORLDS_DIR/$world" ]; then
            move_failed "worlds/$world appeared before data/$world could be moved"
        fi
        mv "$SERVER_DIR/data/$world" "$WORLDS_DIR/$world" || move_failed "Failed to move data/$world to worlds/"
        MOVED+=("$world")
        echo -e "   ${GREEN}Moved data/$world to worlds/$world${NC}"
    done
fi

# Check for symlinked worlds and warn
if [ -d "$SERVER_DIR/data" ]; then
    for link in "$SERVER_DIR/data"/*; do
        if [ -L "$link" ]; then
            target=$(readlink "$link")
            echo "   Note: removing symlink $(basename "$link") -> $target (the link only)"
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
if [ "$DELETE_WORLD" = "true" ]; then
    echo -e "${YELLOW}World data inside the server was deleted with it (--delete-world).${NC}"
    if [ -n "$LEVEL" ] && [ -d "$WORLDS_DIR/$LEVEL" ]; then
        echo -e "${GREEN}World worlds/$LEVEL was kept; it is no longer assigned to this server.${NC}"
    fi
elif [ ${#INTERNAL_WORLDS[@]} -gt 0 ]; then
    echo -e "${GREEN}World moved to worlds/$LEVEL; it can be assigned to another server.${NC}"
elif [ -d "$WORLDS_DIR/$LEVEL" ]; then
    echo -e "${GREEN}World worlds/$LEVEL was kept; it is no longer assigned to this server.${NC}"
else
    echo "No world data found for LEVEL '$LEVEL'."
fi
echo ""
