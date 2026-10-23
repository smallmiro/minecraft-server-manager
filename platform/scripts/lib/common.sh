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
# Supports MCCTL_SUDO_PASSWORD environment variable for automation.
# The password is only fed to `sudo -S -v` (authentication). The command then
# runs with `sudo -n`, so the password never reaches the command's stdin, even
# when sudo skips the prompt (cached credentials, NOPASSWD) (#682).

# Authenticate sudo with MCCTL_SUDO_PASSWORD, reporting the cause on failure.
# printf (not echo) so a password like "-n" is passed literally.
sudo_authenticate() {
    if ! printf '%s\n' "$MCCTL_SUDO_PASSWORD" | sudo -S -p '' -v; then
        error "sudo authentication with MCCTL_SUDO_PASSWORD failed (wrong password or no sudo rights)"
        return 1
    fi
}

# Run command with sudo, supporting MCCTL_SUDO_PASSWORD for automation.
# The command's stdin is passed through untouched.
# Usage: run_with_sudo <command> [args...]
# Example: run_with_sudo systemctl restart avahi-daemon
run_with_sudo() {
    if [[ -z "$*" ]]; then
        error "run_with_sudo: No command specified"
        return 1
    fi

    if [[ -n "${MCCTL_SUDO_PASSWORD:-}" ]]; then
        debug "Using MCCTL_SUDO_PASSWORD for sudo"
        sudo_authenticate || return 1
        sudo -n "$@"
    else
        # Interactive mode: let sudo prompt for password
        sudo "$@"
    fi
}

# Run command with sudo, feeding it stdin (for commands like tee)
# Usage: echo "content" | run_with_sudo_stdin <command> [args...]
# Example: echo "$ip $hostname" | run_with_sudo_stdin tee -a /etc/avahi/hosts
run_with_sudo_stdin() {
    run_with_sudo "$@"
}

# Check if sudo password is configured for automation
has_sudo_password() {
    [[ -n "${MCCTL_SUDO_PASSWORD:-}" ]]
}

# Validate sudo password (test if it works)
validate_sudo_password() {
    [[ -n "${MCCTL_SUDO_PASSWORD:-}" ]] && sudo_authenticate 2>/dev/null
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
# Naming Rules (mirror @minecraft-docker/shared ServerName / WorldName, #649)
# =============================================================================

# Server names whose mc-<name> container collides with a platform service
RESERVED_SERVER_NAMES=(router)

# Validate a new server name: 2-32 chars, starts with a letter, lowercase
# letters/digits and single hyphens, no trailing hyphen, not reserved.
# Prints the reason and returns 1 when invalid.
validate_server_name() {
    local LC_ALL=C  # ASCII ranges: [a-z] must not match accented letters
    local name="$1" reserved
    local pattern='^[a-z](-?[a-z0-9])*$'
    if [[ ${#name} -lt 2 || ${#name} -gt 32 ]]; then
        echo "Server name must be 2-32 characters"
        return 1
    fi
    if [[ ! "$name" =~ $pattern ]]; then
        echo "Server name must start with a letter, end with a letter or number, and contain only lowercase letters, numbers, and single hyphens"
        return 1
    fi
    for reserved in "${RESERVED_SERVER_NAMES[@]}"; do
        if [[ "$name" == "$reserved" ]]; then
            echo "Server name '$name' is reserved (conflicts with the mc-$name container)"
            return 1
        fi
    done
    return 0
}

# Validate the name of a server that already exists (EXISTING_SERVER_NAME_PATTERN):
# legacy names stay usable, path and shell characters do not.
# Prints the reason and returns 1 when invalid.
validate_existing_server_name() {
    local LC_ALL=C
    local pattern='^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$'
    if [[ ! "$1" =~ $pattern ]]; then
        echo "Invalid server name '$1'"
        return 1
    fi
    return 0
}

# Validate a world (LEVEL) name: letters, digits, hyphens, underscores.
# Prints the reason and returns 1 when invalid.
validate_world_name() {
    local LC_ALL=C  # ASCII ranges: [a-z] must not match accented letters
    local pattern='^[a-zA-Z0-9_-]+$'
    if [[ ! "$1" =~ $pattern ]]; then
        echo "World name can only contain letters, numbers, hyphens, and underscores"
        return 1
    fi
    return 0
}

# Validate a value written as KEY=<value> to config.env, which Compose reads
# as an env_file (#726). Same intent as ENV_FILE_VALUE_RE in
# services/shared/src/utils/env-file.ts: no control character (C0, DEL, C1,
# U+2028, U+2029), and no quote or backtick after the leading blanks Compose
# skips (space, tab, VT, FF, NBSP), since Compose closes a quoted value and
# parses the rest of the line as more settings (MOTD="" MODS=<url>).
# Prints the reason and returns 1 when invalid.
validate_env_value() {
    # case globs, not [[ =~ ]]: macOS bash 3.2 hands the regex to BSD regcomp,
    # which mishandles these bytes; bash matches globs itself, byte-wise in C
    local LC_ALL=C
    local message="Value must be one line without control characters and must not start with a quote"
    local c1=$'\xc2['$'\x80''-'$'\x9f'']' rest="$1"
    case "$1" in
        *[[:cntrl:]]* | *$c1* | *$'\xe2\x80\xa8'* | *$'\xe2\x80\xa9'*)
            echo "$message"
            return 1
            ;;
    esac
    # Skip the blanks Compose skips before a value: space, tab, VT, FF, NBSP, NEL
    while :; do
        case "$rest" in
            ' '* | $'\t'* | $'\v'* | $'\f'*) rest="${rest#?}" ;;
            $'\xc2\xa0'* | $'\xc2\x85'*) rest="${rest#??}" ;;
            *) break ;;
        esac
    done
    case "$rest" in
        [\"\'\`]*)
            echo "$message"
            return 1
            ;;
    esac
    return 0
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
