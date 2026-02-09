#!/bin/bash
# =============================================================================
# common.sh - Shared functions for mcctl scripts
# =============================================================================
# Source this file in other scripts:
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
#
# When running via npm package (mcctl CLI), these environment variables are set:
#   MCCTL_ROOT     - User data directory (~/.minecraft-servers)
#   MCCTL_SCRIPTS  - Package scripts directory
#   MCCTL_TEMPLATES - Package templates directory
# =============================================================================

# Get script/platform directories
# Support both direct execution and npm package execution
if [[ -n "${MCCTL_ROOT:-}" ]]; then
    # Running via npm package (mcctl CLI)
    PLATFORM_DIR="$MCCTL_ROOT"
    SCRIPT_DIR="${MCCTL_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
    TEMPLATES_DIR="${MCCTL_TEMPLATES:+$MCCTL_TEMPLATES/servers/_template}"
    TEMPLATES_DIR="${TEMPLATES_DIR:-$PLATFORM_DIR/servers/_template}"
else
    # Running directly (development mode)
    SCRIPT_DIR="${SCRIPT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
    PLATFORM_DIR="${PLATFORM_DIR:-$(dirname "$SCRIPT_DIR")}"
    TEMPLATES_DIR="$PLATFORM_DIR/servers/_template"
fi

# Export for sub-scripts
export PLATFORM_DIR SCRIPT_DIR TEMPLATES_DIR

# Colors (disabled if not terminal or JSON output)
setup_colors() {
    if [[ -t 1 ]] && [[ "${JSON_OUTPUT:-}" != "true" ]]; then
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[1;33m'
        BLUE='\033[0;34m'
        CYAN='\033[0;36m'
        BOLD='\033[1m'
        NC='\033[0m'
    else
        RED=''
        GREEN=''
        YELLOW=''
        BLUE=''
        CYAN=''
        BOLD=''
        NC=''
    fi
}
setup_colors

# =============================================================================
# Output Functions
# =============================================================================

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

# =============================================================================
# Sudo Functions
# =============================================================================
# Supports MCCTL_SUDO_PASSWORD environment variable for automation
# When set, uses sudo -S to pipe password via stdin

# Run command with sudo, supporting MCCTL_SUDO_PASSWORD for automation
# Usage: run_with_sudo <command> [args...]
# Example: run_with_sudo tee -a /etc/avahi/hosts
# Example: run_with_sudo systemctl restart avahi-daemon
run_with_sudo() {
    if [[ -z "$*" ]]; then
        error "run_with_sudo: No command specified"
        return 1
    fi

    if [[ -n "${MCCTL_SUDO_PASSWORD:-}" ]]; then
        # Automation mode: use sudo -S to read password from stdin
        debug "Using MCCTL_SUDO_PASSWORD for sudo"
        echo "$MCCTL_SUDO_PASSWORD" | sudo -S "$@" 2>/dev/null
    else
        # Interactive mode: let sudo prompt for password
        sudo "$@"
    fi
}

# Run command with sudo and capture output (for commands like tee)
# Usage: echo "content" | run_with_sudo_stdin <command> [args...]
# Example: echo "$ip $hostname" | run_with_sudo_stdin tee -a /etc/avahi/hosts
run_with_sudo_stdin() {
    if [[ -z "$*" ]]; then
        error "run_with_sudo_stdin: No command specified"
        return 1
    fi

    if [[ -n "${MCCTL_SUDO_PASSWORD:-}" ]]; then
        # Automation mode: need to handle both password and stdin content
        # Use expect-like approach with heredoc
        local stdin_content
        stdin_content=$(cat)
        debug "Using MCCTL_SUDO_PASSWORD for sudo with stdin"
        {
            echo "$MCCTL_SUDO_PASSWORD"
            echo "$stdin_content"
        } | sudo -S "$@" 2>/dev/null
    else
        # Interactive mode: let sudo prompt for password, pass stdin through
        sudo "$@"
    fi
}

# Check if sudo password is configured for automation
has_sudo_password() {
    [[ -n "${MCCTL_SUDO_PASSWORD:-}" ]]
}

# Validate sudo password (test if it works)
validate_sudo_password() {
    if [[ -z "${MCCTL_SUDO_PASSWORD:-}" ]]; then
        return 1
    fi
    echo "$MCCTL_SUDO_PASSWORD" | sudo -S -v 2>/dev/null
}

# =============================================================================
# Docker Functions
# =============================================================================

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
        return 1
    fi
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running or permission denied"
        return 1
    fi
    return 0
}

# Get container status (running, exited, paused, etc.)
get_container_status() {
    local container="$1"
    local status
    status=$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null) || status="not_found"
    echo -n "$status"
}

# Check if container exists
container_exists() {
    local container="$1"
    docker inspect "$container" &>/dev/null
}

# Get container health status
get_container_health() {
    local container="$1"
    local health
    health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null) || health="unknown"
    echo -n "$health"
}

# Get minecraft server containers (those starting with mc-)
get_mc_containers() {
    docker ps -a --filter "name=mc-" --format '{{.Names}}' | grep -v "mc-router" | sort
}

# Get running minecraft server containers
get_running_mc_containers() {
    docker ps --filter "name=mc-" --filter "status=running" --format '{{.Names}}' | grep -v "mc-router" | sort
}

# Get container's assigned world (from environment or volume mount)
get_container_world() {
    local container="$1"
    # Check WORLD environment variable first
    local world=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container" 2>/dev/null | grep "^WORLD=" | cut -d= -f2)
    if [[ -n "$world" ]]; then
        echo "$world"
        return
    fi
    # Otherwise try to get from volume mount
    echo "-"
}

# Get container's hostname label (mc-router.host)
get_container_hostname() {
    local container="$1"
    local hostname
    hostname=$(docker inspect --format '{{index .Config.Labels "mc-router.host"}}' "$container" 2>/dev/null) || hostname="-"
    [[ -z "$hostname" ]] && hostname="-"
    echo -n "$hostname"
}

# =============================================================================
# JSON Output Functions
# =============================================================================

# Escape string for JSON
json_escape() {
    local str="$1"
    str="${str//\\/\\\\}"
    str="${str//\"/\\\"}"
    str="${str//$'\n'/\\n}"
    str="${str//$'\r'/\\r}"
    str="${str//$'\t'/\\t}"
    echo "$str"
}

# =============================================================================
# Path Functions
# =============================================================================

get_servers_dir() {
    echo "$PLATFORM_DIR/servers"
}

get_worlds_dir() {
    echo "$PLATFORM_DIR/worlds"
}

get_locks_dir() {
    echo "$PLATFORM_DIR/worlds/.locks"
}

# List all server directories
get_server_names() {
    local servers_dir
    servers_dir=$(get_servers_dir)
    if [[ -d "$servers_dir" ]]; then
        find "$servers_dir" -maxdepth 1 -mindepth 1 -type d ! -name '_template' -exec basename {} \; 2>/dev/null | sort
    fi
}
