#!/bin/bash
# =============================================================================
# lock.sh - World locking system for Minecraft servers
# =============================================================================
# Provides flock-based exclusive locking to prevent simultaneous world access.
#
# Usage:
#   ./scripts/lock.sh lock <world> <server>    # Acquire lock
#   ./scripts/lock.sh unlock <world> <server>  # Release lock
#   ./scripts/lock.sh check <world>            # Check lock status
#   ./scripts/lock.sh list                     # List all locks
#   ./scripts/lock.sh list --json              # JSON output
#
# Lock file format:
#   worlds/.locks/<world-name>.lock
#   Content: <server-name>:<timestamp>:<pid>
#
# Exit codes:
#   0 - Success
#   1 - Error (lock failed, invalid args, etc.)
#   2 - Warning (lock already held, stale lock detected)
# =============================================================================

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(dirname "$SCRIPT_DIR")"
WORLDS_DIR="$PLATFORM_DIR/worlds"
LOCKS_DIR="$WORLDS_DIR/.locks"

# Configuration
STALE_THRESHOLD=86400  # 24 hours in seconds

# Colors (disabled if not terminal)
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# =============================================================================
# Helper Functions
# =============================================================================

usage() {
    cat <<EOF
Usage: $(basename "$0") <command> [options]

Commands:
  lock <world> <server>    Acquire exclusive lock on world for server
  unlock <world> <server>  Release lock (only owner can release)
  check <world>            Check if world is locked
  list [--json]            List all worlds and their lock status

Options:
  --json                   Output in JSON format (for list command)
  --force                  Force unlock (admin override, use with caution)

Exit codes:
  0 - Success
  1 - Error
  2 - Warning (lock held by another, stale lock)

Examples:
  $(basename "$0") lock survival mc-ironwood
  $(basename "$0") unlock survival mc-ironwood
  $(basename "$0") check survival
  $(basename "$0") list --json
EOF
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

debug() {
    if [[ "${DEBUG:-}" == "true" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $1" >&2
    fi
}

# Ensure locks directory exists
ensure_locks_dir() {
    if [[ ! -d "$LOCKS_DIR" ]]; then
        mkdir -p "$LOCKS_DIR"
        debug "Created locks directory: $LOCKS_DIR"
    fi
}

# Get lock file path for a world
get_lock_file() {
    local world="$1"
    echo "$LOCKS_DIR/${world}.lock"
}

# Parse lock file content
# Returns: server:timestamp:pid
parse_lock_file() {
    local lock_file="$1"
    if [[ -f "$lock_file" ]]; then
        cat "$lock_file"
    fi
}

# Check if lock is stale (older than threshold)
is_stale_lock() {
    local lock_file="$1"
    local lock_content
    local lock_timestamp
    local current_time
    local age

    if [[ ! -f "$lock_file" ]]; then
        return 1  # No lock file, not stale
    fi

    lock_content=$(parse_lock_file "$lock_file")
    lock_timestamp=$(echo "$lock_content" | cut -d: -f2)

    if [[ -z "$lock_timestamp" ]]; then
        return 0  # Invalid format, consider stale
    fi

    current_time=$(date +%s)
    age=$((current_time - lock_timestamp))

    if [[ $age -gt $STALE_THRESHOLD ]]; then
        return 0  # Stale
    fi

    return 1  # Not stale
}

# Get all world directories
get_worlds() {
    if [[ -d "$WORLDS_DIR" ]]; then
        find "$WORLDS_DIR" -maxdepth 1 -mindepth 1 -type d ! -name '.locks' -exec basename {} \; 2>/dev/null | sort
    fi
}

# =============================================================================
# Lock Functions
# =============================================================================

# Acquire lock on a world
# Usage: lock_world <world> <server>
lock_world() {
    local world="$1"
    local server="$2"
    local lock_file
    local lock_content
    local current_holder
    local timestamp
    local pid

    if [[ -z "$world" || -z "$server" ]]; then
        error "Usage: lock <world> <server>"
        return 1
    fi

    ensure_locks_dir
    lock_file=$(get_lock_file "$world")
    timestamp=$(date +%s)
    pid=$$

    # Use flock for atomic locking
    (
        flock -n 200 || {
            # Lock is held, check who owns it
            if [[ -f "$lock_file" ]]; then
                lock_content=$(parse_lock_file "$lock_file")
                current_holder=$(echo "$lock_content" | cut -d: -f1)

                if [[ "$current_holder" == "$server" ]]; then
                    warn "World '$world' is already locked by this server ($server)"
                    exit 2
                else
                    error "World '$world' is locked by '$current_holder'"
                    exit 1
                fi
            fi
            error "Failed to acquire lock on '$world'"
            exit 1
        }

        # Check for existing lock file
        if [[ -f "$lock_file" ]]; then
            lock_content=$(parse_lock_file "$lock_file")
            current_holder=$(echo "$lock_content" | cut -d: -f1)

            if [[ "$current_holder" == "$server" ]]; then
                # Same server, update timestamp
                echo "${server}:${timestamp}:${pid}" > "$lock_file"
                info "Lock renewed: $world -> $server"
                exit 0
            fi

            # Check for stale lock
            if is_stale_lock "$lock_file"; then
                warn "Removing stale lock on '$world' (was held by '$current_holder')"
                rm -f "$lock_file"
            else
                error "World '$world' is locked by '$current_holder'"
                exit 1
            fi
        fi

        # Create lock file
        echo "${server}:${timestamp}:${pid}" > "$lock_file"
        info "Lock acquired: $world -> $server"
        exit 0
    ) 200>"$lock_file.flock"

    local result=$?
    rm -f "$lock_file.flock"
    return $result
}

# Release lock on a world
# Usage: unlock_world <world> <server> [--force]
unlock_world() {
    local world="$1"
    local server="$2"
    local force="${3:-}"
    local lock_file
    local lock_content
    local current_holder

    if [[ -z "$world" || -z "$server" ]]; then
        error "Usage: unlock <world> <server>"
        return 1
    fi

    lock_file=$(get_lock_file "$world")

    if [[ ! -f "$lock_file" ]]; then
        warn "World '$world' is not locked"
        return 2
    fi

    lock_content=$(parse_lock_file "$lock_file")
    current_holder=$(echo "$lock_content" | cut -d: -f1)

    # Check ownership
    if [[ "$current_holder" != "$server" ]]; then
        if [[ "$force" == "--force" ]]; then
            warn "Force unlocking '$world' (was held by '$current_holder')"
        else
            error "World '$world' is locked by '$current_holder', not '$server'"
            error "Use --force to override (admin only)"
            return 1
        fi
    fi

    # Remove lock file
    rm -f "$lock_file"
    info "Lock released: $world (was held by $current_holder)"
    return 0
}

# Check lock status of a world
# Usage: check_lock <world>
check_lock() {
    local world="$1"
    local lock_file
    local lock_content
    local holder
    local timestamp
    local lock_time
    local age

    if [[ -z "$world" ]]; then
        error "Usage: check <world>"
        return 1
    fi

    lock_file=$(get_lock_file "$world")

    if [[ ! -f "$lock_file" ]]; then
        echo "unlocked"
        return 0
    fi

    lock_content=$(parse_lock_file "$lock_file")
    holder=$(echo "$lock_content" | cut -d: -f1)
    timestamp=$(echo "$lock_content" | cut -d: -f2)

    if [[ -n "$timestamp" ]]; then
        lock_time=$(date -d "@$timestamp" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -r "$timestamp" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "unknown")
        age=$(( $(date +%s) - timestamp ))

        if is_stale_lock "$lock_file"; then
            echo "stale:$holder:$lock_time (${age}s ago)"
            return 2
        else
            echo "locked:$holder:$lock_time (${age}s ago)"
            return 0
        fi
    else
        echo "locked:$holder:unknown"
        return 0
    fi
}

# List all worlds and their lock status
# Usage: list_locks [--json]
list_locks() {
    local json_output="${1:-}"
    local worlds
    local world
    local lock_file
    local lock_content
    local holder
    local timestamp
    local lock_time
    local status
    local first=true

    ensure_locks_dir

    if [[ "$json_output" == "--json" ]]; then
        echo "{"
        echo '  "worlds": ['
    else
        printf "%-20s %-12s %-20s %s\n" "WORLD" "STATUS" "HOLDER" "LOCKED_AT"
        printf "%-20s %-12s %-20s %s\n" "-----" "------" "------" "---------"
    fi

    worlds=$(get_worlds)

    for world in $worlds; do
        lock_file=$(get_lock_file "$world")
        holder=""
        timestamp=""
        lock_time=""

        if [[ -f "$lock_file" ]]; then
            lock_content=$(parse_lock_file "$lock_file")
            holder=$(echo "$lock_content" | cut -d: -f1)
            timestamp=$(echo "$lock_content" | cut -d: -f2)

            if [[ -n "$timestamp" ]]; then
                lock_time=$(date -d "@$timestamp" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -r "$timestamp" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "unknown")
            fi

            if is_stale_lock "$lock_file"; then
                status="stale"
            else
                status="locked"
            fi
        else
            status="available"
            holder="-"
            lock_time="-"
        fi

        if [[ "$json_output" == "--json" ]]; then
            if [[ "$first" != "true" ]]; then
                echo ","
            fi
            first=false
            printf '    {"name": "%s", "status": "%s"' "$world" "$status"
            if [[ "$status" != "available" ]]; then
                printf ', "holder": "%s", "locked_at": "%s", "timestamp": %s' "$holder" "$lock_time" "${timestamp:-null}"
            fi
            printf "}"
        else
            printf "%-20s %-12s %-20s %s\n" "$world" "$status" "$holder" "$lock_time"
        fi
    done

    if [[ "$json_output" == "--json" ]]; then
        echo ""
        echo "  ],"
        echo "  \"locks_dir\": \"$LOCKS_DIR\","
        echo "  \"stale_threshold_seconds\": $STALE_THRESHOLD"
        echo "}"
    fi
}

# =============================================================================
# Main
# =============================================================================

main() {
    local command="${1:-}"
    shift || true

    case "$command" in
        lock)
            lock_world "$@"
            ;;
        unlock)
            unlock_world "$@"
            ;;
        check)
            check_lock "$@"
            ;;
        list)
            list_locks "$@"
            ;;
        -h|--help|help)
            usage
            exit 0
            ;;
        "")
            error "No command specified"
            usage
            exit 1
            ;;
        *)
            error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

# Run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
