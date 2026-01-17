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
#   mcctl.sh world list [--json]          List worlds and locks
#   mcctl.sh world assign <world> <srv>   Assign world to server
#   mcctl.sh world release <world>        Force release world lock
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

World Management:
  world list [--json]          List worlds and their lock status
  world assign <world> <srv>   Lock world and assign to server
  world release <world>        Force release world lock

Player Lookup:
  player lookup <name>         Look up player info (UUID, avatar)
  player uuid <name>           Get player's online UUID
  player uuid <name> --offline Get player's offline UUID

Options:
  --json                       Output in JSON format
  -h, --help                   Show this help message

Examples:
  $(basename "$0") status
  $(basename "$0") status --json
  $(basename "$0") logs ironwood 100
  $(basename "$0") console ironwood
  $(basename "$0") world list
  $(basename "$0") world assign survival mc-ironwood
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

    # Get mdns-publisher status
    local mdns_status
    mdns_status=$(get_container_status "mdns-publisher")

    if $json_output; then
        # JSON output
        echo "{"
        echo '  "router": {'
        echo "    \"name\": \"mc-router\","
        echo "    \"status\": \"$router_status\","
        echo "    \"health\": \"$router_health\","
        echo "    \"port\": $router_port"
        echo '  },'
        echo '  "mdns_publisher": {'
        echo "    \"name\": \"mdns-publisher\","
        echo "    \"status\": \"$mdns_status\""
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

        local mdns_color="${RED}"
        [[ "$mdns_status" == "running" ]] && mdns_color="${GREEN}"
        printf "%-20s ${mdns_color}%-12s${NC} %-10s %s\n" "mdns-publisher" "$mdns_status" "-" "mDNS broadcast"

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
    local server="$1"
    local lines="${2:-50}"

    if [[ -z "$server" ]]; then
        error "Usage: logs <server> [lines]"
        return 1
    fi

    check_docker || return 1

    local container="mc-$server"

    if ! container_exists "$container"; then
        error "Server '$server' (container: $container) not found"
        return 1
    fi

    # Use the logs.sh script if available
    if [[ -x "$SCRIPT_DIR/logs.sh" ]]; then
        "$SCRIPT_DIR/logs.sh" "$server" "$lines"
    else
        docker logs --tail "$lines" "$container"
    fi
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
    local subcmd="${1:-}"
    shift || true

    case "$subcmd" in
        list)
            cmd_world_list "$@"
            ;;
        assign)
            cmd_world_assign "$@"
            ;;
        release)
            cmd_world_release "$@"
            ;;
        "")
            error "Usage: world <list|assign|release> [options]"
            return 1
            ;;
        *)
            error "Unknown world subcommand: $subcmd"
            return 1
            ;;
    esac
}

cmd_world_list() {
    # Delegate to lock.sh
    if [[ -x "$SCRIPT_DIR/lock.sh" ]]; then
        "$SCRIPT_DIR/lock.sh" list "$@"
    else
        error "lock.sh not found"
        return 1
    fi
}

cmd_world_assign() {
    local world="$1"
    local server="$2"

    if [[ -z "$world" || -z "$server" ]]; then
        error "Usage: world assign <world> <server>"
        return 1
    fi

    # Delegate to lock.sh
    if [[ -x "$SCRIPT_DIR/lock.sh" ]]; then
        "$SCRIPT_DIR/lock.sh" lock "$world" "$server"
    else
        error "lock.sh not found"
        return 1
    fi
}

cmd_world_release() {
    local world="$1"

    if [[ -z "$world" ]]; then
        error "Usage: world release <world>"
        return 1
    fi

    # Get current holder from lock.sh check
    if [[ -x "$SCRIPT_DIR/lock.sh" ]]; then
        local lock_status
        lock_status=$("$SCRIPT_DIR/lock.sh" check "$world")

        if [[ "$lock_status" == "unlocked" ]]; then
            warn "World '$world' is not locked"
            return 2
        fi

        local holder
        holder=$(echo "$lock_status" | cut -d: -f2)

        "$SCRIPT_DIR/lock.sh" unlock "$world" "$holder" --force
    else
        error "lock.sh not found"
        return 1
    fi
}

# =============================================================================
# Player Commands
# =============================================================================

cmd_player() {
    # Delegate to player.sh
    if [[ -x "$SCRIPT_DIR/player.sh" ]]; then
        "$SCRIPT_DIR/player.sh" "$@"
    else
        error "player.sh not found"
        return 1
    fi
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

    if ! container_exists "$container"; then
        error "Server '$server' (container: $container) not found"
        return 1
    fi

    local status
    status=$(get_container_status "$container")

    if [[ "$status" == "running" ]]; then
        warn "Server '$server' is already running"
        return 2
    fi

    info "Starting server '$server'..."
    docker start "$container"
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

    if ! container_exists "$container"; then
        error "Server '$server' (container: $container) not found"
        return 1
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
        player)
            cmd_player "$@"
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
