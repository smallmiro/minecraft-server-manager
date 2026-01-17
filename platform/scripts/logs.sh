#!/bin/bash
# =============================================================================
# logs.sh - Log viewer for Minecraft servers
# =============================================================================
# View logs from Docker containers or log files.
#
# Usage:
#   ./scripts/logs.sh <server> [options]
#   ./scripts/logs.sh <server> -n <lines>    # Show last N lines
#   ./scripts/logs.sh <server> -f            # Follow logs in real-time
#   ./scripts/logs.sh <server> --file        # View log file instead
#   ./scripts/logs.sh router                 # View mc-router logs
#   ./scripts/logs.sh avahi                  # View avahi-daemon logs (journalctl)
#
# Options:
#   -n, --lines <N>        Number of lines to show (default: 50)
#   -f, --follow           Follow log output in real-time
#   --file                 Read from log file instead of Docker
#   --timestamps           Include timestamps in output
#   --since <time>         Show logs since timestamp (e.g., "10m", "1h")
#   --json                 Output as JSON array
#   -h, --help             Show this help message
#
# Exit codes:
#   0 - Success
#   1 - Error
#   2 - Warning
# =============================================================================

set -e

# Get script directory and source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(dirname "$SCRIPT_DIR")"
source "$SCRIPT_DIR/lib/common.sh"

# =============================================================================
# Configuration
# =============================================================================

DEFAULT_LINES=50
LOG_FILE_PATH="logs/latest.log"

# =============================================================================
# Usage
# =============================================================================

usage() {
    cat <<EOF
Usage: $(basename "$0") <server> [options]

View logs from Minecraft servers (Docker or file-based).

Arguments:
  <server>                 Server name (without mc- prefix)
                           Special values: router, avahi

Options:
  -n, --lines <N>          Number of lines to show (default: $DEFAULT_LINES)
  -f, --follow             Follow log output in real-time
  --file                   Read from log file (servers/<server>/logs/latest.log)
  --timestamps             Include timestamps in Docker logs
  --since <time>           Show logs since time (e.g., "10m", "1h", "2024-01-17")
  --json                   Output as JSON array
  -h, --help               Show this help message

Examples:
  $(basename "$0") ironwood              # Last 50 lines from Docker
  $(basename "$0") ironwood -n 100       # Last 100 lines
  $(basename "$0") ironwood -f           # Follow in real-time
  $(basename "$0") ironwood --file       # Read from log file
  $(basename "$0") ironwood --file -f    # Follow log file
  $(basename "$0") ironwood --json       # JSON output
  $(basename "$0") router                # mc-router logs
  $(basename "$0") avahi                 # avahi-daemon logs (journalctl)
  $(basename "$0") ironwood --since 1h   # Logs from last hour
EOF
}

# =============================================================================
# Docker Logs
# =============================================================================

docker_logs() {
    local container="$1"
    local lines="$2"
    local follow="$3"
    local timestamps="$4"
    local since="$5"
    local json_output="$6"

    local args=()

    # Build docker logs arguments
    [[ -n "$lines" ]] && args+=("--tail" "$lines")
    [[ "$follow" == "true" ]] && args+=("-f")
    [[ "$timestamps" == "true" ]] && args+=("-t")
    [[ -n "$since" ]] && args+=("--since" "$since")

    if [[ "$json_output" == "true" ]]; then
        # Collect logs and output as JSON
        echo "["
        local first=true
        while IFS= read -r line; do
            if [[ "$first" != "true" ]]; then
                echo ","
            fi
            first=false
            # Escape for JSON
            local escaped
            escaped=$(json_escape "$line")
            printf '  "%s"' "$escaped"
        done < <(docker logs "${args[@]}" "$container" 2>&1)
        echo ""
        echo "]"
    else
        docker logs "${args[@]}" "$container" 2>&1
    fi
}

# =============================================================================
# File Logs
# =============================================================================

file_logs() {
    local server="$1"
    local lines="$2"
    local follow="$3"
    local json_output="$4"

    local log_file="$PLATFORM_DIR/servers/$server/$LOG_FILE_PATH"

    if [[ ! -f "$log_file" ]]; then
        error "Log file not found: $log_file"
        return 1
    fi

    if [[ "$json_output" == "true" ]]; then
        echo "["
        local first=true
        while IFS= read -r line; do
            if [[ "$first" != "true" ]]; then
                echo ","
            fi
            first=false
            local escaped
            escaped=$(json_escape "$line")
            printf '  "%s"' "$escaped"
        done < <(tail -n "$lines" "$log_file")
        echo ""
        echo "]"
    elif [[ "$follow" == "true" ]]; then
        tail -f "$log_file"
    else
        tail -n "$lines" "$log_file"
    fi
}

# =============================================================================
# Main
# =============================================================================

main() {
    local server=""
    local lines="$DEFAULT_LINES"
    local follow=false
    local file_mode=false
    local timestamps=false
    local since=""
    local json_output=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -n|--lines)
                lines="$2"
                shift 2
                ;;
            -f|--follow)
                follow=true
                shift
                ;;
            --file)
                file_mode=true
                shift
                ;;
            --timestamps)
                timestamps=true
                shift
                ;;
            --since)
                since="$2"
                shift 2
                ;;
            --json)
                json_output=true
                JSON_OUTPUT=true
                setup_colors
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            -*)
                error "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                if [[ -z "$server" ]]; then
                    server="$1"
                else
                    error "Unexpected argument: $1"
                    usage
                    exit 1
                fi
                shift
                ;;
        esac
    done

    # Validate server argument
    if [[ -z "$server" ]]; then
        error "Server name is required"
        usage
        exit 1
    fi

    check_docker || exit 1

    # Determine container name
    local container
    local use_journalctl=false
    case "$server" in
        router|mc-router)
            container="mc-router"
            server="router"
            ;;
        avahi|avahi-daemon)
            # avahi-daemon is a system service, use journalctl
            use_journalctl=true
            server="avahi"
            ;;
        *)
            container="mc-$server"
            ;;
    esac

    # Handle avahi-daemon logs via journalctl
    if $use_journalctl; then
        info "Viewing avahi-daemon logs (system service via journalctl)"
        local journal_opts="-u avahi-daemon --no-pager"
        [[ -n "$lines" ]] && journal_opts="$journal_opts -n $lines"
        [[ "$follow" == "true" ]] && journal_opts="$journal_opts -f"
        [[ -n "$since" ]] && journal_opts="$journal_opts --since=$since"
        # shellcheck disable=SC2086
        sudo journalctl $journal_opts
        exit 0
    fi

    # Check if using file mode
    if $file_mode; then
        if [[ "$server" == "router" ]]; then
            error "File mode not supported for $server"
            exit 1
        fi
        file_logs "$server" "$lines" "$follow" "$json_output"
    else
        # Check container exists
        if ! container_exists "$container"; then
            error "Container '$container' not found"
            exit 1
        fi

        docker_logs "$container" "$lines" "$follow" "$timestamps" "$since" "$json_output"
    fi
}

# Run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
