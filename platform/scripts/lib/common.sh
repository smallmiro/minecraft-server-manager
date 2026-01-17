#!/bin/bash
# =============================================================================
# common.sh - Shared functions for mcctl scripts
# =============================================================================
# Source this file in other scripts:
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
# =============================================================================

# Get script/platform directories
SCRIPT_DIR="${SCRIPT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PLATFORM_DIR="${PLATFORM_DIR:-$(dirname "$SCRIPT_DIR")}"

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
