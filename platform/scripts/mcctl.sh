#!/bin/bash
# =============================================================================
# mcctl.sh - Minecraft Server Management CLI
# =============================================================================
# Main management tool for Minecraft servers with mc-router integration.
#
# Usage:
#   mcctl.sh status [--json]              Show all server status
#   mcctl.sh logs <server> [lines]        View server logs
#   mcctl.sh console <server>             Connect to RCON console
#   mcctl.sh start <server>               Start server (bypass auto-scale)
#   mcctl.sh stop <server>                Stop server
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

# Load environment variables from .env
ENV_FILE="$PLATFORM_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # bash 3.2 (macOS) reads nothing from `source <(...)`; bash itself skips
    # comments and blank lines
    # shellcheck disable=SC1090
    . "$ENV_FILE" 2>/dev/null || true
    set +a
fi

# =============================================================================
# Usage
# =============================================================================

usage() {
    cat <<EOF
Usage: $(basename "$0") <command> [options]

Server Management:
  status [--json]              Show status of all servers and router
  logs <server> [lines]        View server logs (default: 50 lines)
  console <server>             Connect to RCON console (interactive)
  start <server>               Start a specific server
  stop <server>                Stop a specific server

Backup (runs 'mcctl backup ...'; requires .env configuration):
  backup push [--message "m"]  Backup worlds to GitHub
  backup status                Show backup configuration
  backup history [--json]      Show backup history
  backup restore <commit> [--force]  Restore from a commit (servers stopped)

Options:
  --json                       Output in JSON format
  -h, --help                   Show this help message

Examples:
  $(basename "$0") status
  $(basename "$0") status --json
  $(basename "$0") logs ironwood 100
  $(basename "$0") console ironwood
  $(basename "$0") start ironwood
  $(basename "$0") stop ironwood
EOF
}

# =============================================================================
# Status Command
# =============================================================================

cmd_status() {
    local json_output=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --json)
                json_output=true
                JSON_OUTPUT=true
                setup_colors
                shift
                ;;
            *)
                error "Unknown option: $1"
                return 1
                ;;
        esac
    done

    check_docker || return 1

    local router_status
    local router_health
    local router_port

    # Get router status
    router_status=$(get_container_status "mc-router")
    router_health=$(get_container_health "mc-router")
    router_port="25565"

    # Get avahi-daemon status (system service, not Docker)
    local avahi_status="unknown"
    if systemctl is-active --quiet avahi-daemon 2>/dev/null; then
        avahi_status="running"
    elif rc-service avahi-daemon status &>/dev/null 2>&1; then
        avahi_status="running"
    elif command -v avahi-daemon &>/dev/null; then
        avahi_status="installed (not running)"
    else
        avahi_status="not installed"
    fi

    if $json_output; then
        # JSON output
        echo "{"
        echo '  "router": {'
        echo "    \"name\": \"mc-router\","
        echo "    \"status\": \"$router_status\","
        echo "    \"health\": \"$router_health\","
        echo "    \"port\": $router_port"
        echo '  },'
        echo '  "avahi_daemon": {'
        echo "    \"name\": \"avahi-daemon\","
        echo "    \"status\": \"$avahi_status\","
        echo "    \"type\": \"system\""
        echo '  },'
        echo '  "servers": ['

        local first=true
        local containers
        containers=$(get_mc_containers)

        for container in $containers; do
            local status
            local health
            local hostname
            local server_name

            status=$(get_container_status "$container")
            health=$(get_container_health "$container")
            hostname=$(get_container_hostname "$container")
            server_name="${container#mc-}"  # Remove mc- prefix

            if [[ "$first" != "true" ]]; then
                echo ","
            fi
            first=false

            printf '    {"name": "%s", "container": "%s", "status": "%s", "health": "%s", "hostname": "%s"}' \
                "$server_name" "$container" "$status" "$health" "$hostname"
        done

        echo ""
        echo "  ]"
        echo "}"
    else
        # Human-readable output
        echo -e "${BOLD}=== Server Status (mc-router Managed) ===${NC}"
        echo ""

        # Router status
        echo -e "${CYAN}INFRASTRUCTURE${NC}"
        printf "%-20s %-12s %-10s %s\n" "SERVICE" "STATUS" "HEALTH" "PORT/INFO"
        printf "%-20s %-12s %-10s %s\n" "-------" "------" "------" "---------"

        local router_color="${RED}"
        [[ "$router_status" == "running" ]] && router_color="${GREEN}"
        printf "%-20s ${router_color}%-12s${NC} %-10s %s\n" "mc-router" "$router_status" "$router_health" ":$router_port (hostname routing)"

        local avahi_color="${RED}"
        [[ "$avahi_status" == "running" ]] && avahi_color="${GREEN}"
        printf "%-20s ${avahi_color}%-12s${NC} %-10s %s\n" "avahi-daemon" "$avahi_status" "(system)" "mDNS broadcast"

        echo ""
        echo -e "${CYAN}MINECRAFT SERVERS${NC}"
        printf "%-20s %-12s %-10s %s\n" "SERVER" "STATUS" "HEALTH" "HOSTNAME"
        printf "%-20s %-12s %-10s %s\n" "------" "------" "------" "--------"

        local containers
        containers=$(get_mc_containers)

        if [[ -z "$containers" ]]; then
            echo "  No Minecraft servers configured"
        else
            for container in $containers; do
                local status
                local health
                local hostname
                local server_name
                local status_color="${RED}"

                status=$(get_container_status "$container")
                health=$(get_container_health "$container")
                hostname=$(get_container_hostname "$container")
                server_name="${container#mc-}"

                [[ "$status" == "running" ]] && status_color="${GREEN}"
                [[ "$status" == "exited" ]] && status_color="${YELLOW}"

                printf "%-20s ${status_color}%-12s${NC} %-10s %s\n" "$server_name" "$status" "$health" "$hostname"
            done
        fi

        echo ""
    fi
}

# =============================================================================
# Logs Command
# =============================================================================

cmd_logs() {
    local server="" lines=50 follow=()
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -f|--follow) follow=(-f) ;;
            -n|--lines) lines="${2:-50}"; shift ;;
            *) if [[ -z "$server" ]]; then server="$1"; else lines="$1"; fi ;;
        esac
        shift
    done

    if [[ -z "$server" ]]; then
        error "Usage: logs <server> [lines] [-f]"
        return 1
    fi

    check_docker || return 1

    local container="mc-$server"

    if ! container_exists "$container"; then
        error "Server '$server' (container: $container) not found"
        return 1
    fi

    docker logs "${follow[@]}" --tail "$lines" -- "$container"
}

# =============================================================================
# Console Command
# =============================================================================

cmd_console() {
    local server="$1"

    if [[ -z "$server" ]]; then
        error "Usage: console <server>"
        return 1
    fi

    check_docker || return 1

    local container="mc-$server"

    if ! container_exists "$container"; then
        error "Server '$server' (container: $container) not found"
        return 1
    fi

    local status
    status=$(get_container_status "$container")

    if [[ "$status" != "running" ]]; then
        error "Server '$server' is not running (status: $status)"
        return 1
    fi

    info "Connecting to RCON console for '$server'..."
    info "Type 'quit' or press Ctrl+C to exit"
    echo ""

    docker exec -i "$container" rcon-cli
}

# =============================================================================
# World Commands
# =============================================================================

cmd_world() {
    # World assignment moved to the TypeScript CLI with lock.sh's removal (#670):
    # a server's world is its LEVEL. This subcommand goes away in #734.
    error "mcctl.sh world was removed with lock.sh (#670); use 'mcctl world list|assign|release'"
    return 1
}

# =============================================================================
# Start/Stop Commands
# =============================================================================

cmd_start() {
    local server="$1"

    if [[ -z "$server" ]]; then
        error "Usage: start <server>"
        return 1
    fi

    check_docker || return 1

    local container="mc-$server"
    local server_config="$PLATFORM_DIR/servers/$server/docker-compose.yml"

    # Check if server configuration exists
    if [[ ! -f "$server_config" ]]; then
        error "Server '$server' not found (no config at servers/$server/)"
        return 1
    fi

    # Check if container already running
    if container_exists "$container"; then
        local status
        status=$(get_container_status "$container")

        if [[ "$status" == "running" ]]; then
            warn "Server '$server' is already running"
            return 2
        fi
    fi

    # Use docker compose up to create and start (works even if container doesn't exist)
    info "Starting server '$server'..."
    cd "$PLATFORM_DIR" && docker compose up -d "$container"
    info "Server '$server' started"
}

cmd_stop() {
    local server="$1"

    if [[ -z "$server" ]]; then
        error "Usage: stop <server>"
        return 1
    fi

    check_docker || return 1

    local container="mc-$server"
    local server_config="$PLATFORM_DIR/servers/$server/docker-compose.yml"

    # Check if server configuration exists
    if [[ ! -f "$server_config" ]]; then
        error "Server '$server' not found (no config at servers/$server/)"
        return 1
    fi

    # Check if container exists
    if ! container_exists "$container"; then
        warn "Server '$server' is not running (container not created)"
        return 2
    fi

    local status
    status=$(get_container_status "$container")

    if [[ "$status" != "running" ]]; then
        warn "Server '$server' is not running (status: $status)"
        return 2
    fi

    info "Stopping server '$server'..."
    docker stop "$container"
    info "Server '$server' stopped"

    # Auto-backup on stop (if configured)
    if [[ "${BACKUP_AUTO_ON_STOP:-false}" == "true" ]]; then
        if [[ -n "${BACKUP_GITHUB_TOKEN:-}" && -n "${BACKUP_GITHUB_REPO:-}" ]]; then
            info "Auto-backup triggered..."
            run_mcctl backup push --auto || warn "Auto-backup failed (non-critical)"
        fi
    fi
}

# =============================================================================
# Backup Command
# =============================================================================

# Run the TypeScript CLI (#732; backup.sh is gone): the node and entry point of
# the mcctl that called this script (MCCTL_NODE/MCCTL_CLI), else mcctl on PATH.
run_mcctl() {
    if [[ -n "${MCCTL_NODE:-}" && -n "${MCCTL_CLI:-}" ]]; then
        "$MCCTL_NODE" "$MCCTL_CLI" "$@" --root "$PLATFORM_DIR"
    elif command -v mcctl > /dev/null 2>&1; then
        mcctl "$@" --root "$PLATFORM_DIR"
    else
        error "mcctl not found: backups run in the mcctl CLI (npm install -g @minecraft-docker/mcctl)"
        return 1
    fi
}

cmd_backup() {
    run_mcctl backup "$@"
}

# =============================================================================
# Config
# =============================================================================

# Set a key=value in a server's config.env (callers: ShellAdapter.setServerConfig).
cmd_config() {
    local server="$1"
    local key="$2"
    local value="$3"

    if [[ -z "$server" || -z "$key" ]]; then
        error "Usage: config <server> <key> <value>"
        return 1
    fi

    if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
        error "Invalid config key: $key"
        return 1
    fi
    local problem
    if ! problem="$(validate_env_value "$value")"; then
        error "${key}: ${problem}"
        return 1
    fi

    local config_file="$PLATFORM_DIR/servers/$server/config.env"
    if [[ ! -f "$config_file" ]]; then
        error "Server '$server' config not found: $config_file"
        return 1
    fi

    # awk with ENVIRON writes the value literally; in a sed expression '|',
    # '&' and the e flag are interpreted (#726)
    local updated
    updated="$(KEY="$key" VALUE="$value" awk '
        BEGIN { line = ENVIRON["KEY"] "=" ENVIRON["VALUE"]; prefix = ENVIRON["KEY"] "=" }
        index($0, prefix) == 1 { print line; found = 1; next }
        { print }
        END { if (!found) print line }
    ' "$config_file")"
    printf '%s\n' "$updated" > "$config_file"
    info "Set ${key}=${value} in servers/${server}/config.env"
}

# =============================================================================
# Main
# =============================================================================

main() {
    local command="${1:-}"
    shift || true

    case "$command" in
        status)
            cmd_status "$@"
            ;;
        logs)
            cmd_logs "$@"
            ;;
        console)
            cmd_console "$@"
            ;;
        world)
            cmd_world "$@"
            ;;
        start)
            cmd_start "$@"
            ;;
        stop)
            cmd_stop "$@"
            ;;
        backup)
            cmd_backup "$@"
            ;;
        config)
            cmd_config "$@"
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
