#!/bin/bash
# =============================================================================
# player.sh - Player UUID lookup using PlayerDB API
# =============================================================================
# Look up Minecraft player information including UUID.
#
# Usage:
#   ./scripts/player.sh lookup <playerName>           # Full player info
#   ./scripts/player.sh lookup <playerName> --json    # JSON output
#   ./scripts/player.sh uuid <playerName>             # Online UUID only
#   ./scripts/player.sh uuid <playerName> --offline   # Offline UUID only
#
# Exit codes:
#   0 - Success
#   1 - Error (API error, player not found, etc.)
#   2 - Warning
# =============================================================================

set -e

# Get script directory and source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# =============================================================================
# Configuration
# =============================================================================

PLAYERDB_API="https://playerdb.co/api/player/minecraft"
AVATAR_BASE="https://crafthead.net/avatar"

# =============================================================================
# Usage
# =============================================================================

usage() {
    cat <<EOF
Usage: $(basename "$0") <command> <playerName> [options]

Look up Minecraft player information using PlayerDB API.

Commands:
  lookup <playerName>           Show full player information
  uuid <playerName>             Get player's online UUID

Options:
  --json                        Output in JSON format
  --offline                     Get offline UUID (for uuid command)
  -h, --help                    Show this help message

Examples:
  $(basename "$0") lookup Notch
  $(basename "$0") lookup Notch --json
  $(basename "$0") uuid Notch
  $(basename "$0") uuid Notch --offline

Notes:
  - Online UUID is fetched from Mojang API via PlayerDB
  - Offline UUID is calculated from player name (UUID v3)
  - Requires: curl and jq
EOF
}

# =============================================================================
# Helper Functions
# =============================================================================

# Check required commands
check_requirements() {
    local missing=()

    if ! command -v curl &> /dev/null; then
        missing+=("curl")
    fi

    if ! command -v jq &> /dev/null; then
        missing+=("jq")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        error "Missing required commands: ${missing[*]}"
        error "Please install them and try again"
        return 1
    fi
}

# Calculate offline UUID from player name
# Offline UUID = UUID v3 based on "OfflinePlayer:<name>"
calculate_offline_uuid() {
    local player_name="$1"
    local input="OfflinePlayer:$player_name"

    # Calculate MD5 hash and format as UUID v3
    local md5_hash
    md5_hash=$(echo -n "$input" | md5sum | cut -d' ' -f1)

    # Format as UUID with version 3 marker
    # UUID format: xxxxxxxx-xxxx-3xxx-yxxx-xxxxxxxxxxxx
    # where 3 is the version and y is 8, 9, a, or b (variant)
    local uuid
    uuid=$(echo "$md5_hash" | sed 's/\(........\)\(....\)\(....\)\(....\)\(............\)/\1-\2-\3-\4-\5/')

    # Set version to 3 (third section starts with 3)
    uuid=$(echo "$uuid" | sed 's/\(........-....\)-\(.\)/\1-3/')

    # Set variant (first char of fourth section should be 8, 9, a, or b)
    # We'll use 8 for simplicity
    local fourth_section
    fourth_section=$(echo "$uuid" | cut -d'-' -f4)
    local first_char=${fourth_section:0:1}
    local rest=${fourth_section:1}

    # Convert first char to variant (8-b range)
    case $first_char in
        0|1|2|3) first_char="8" ;;
        4|5|6|7) first_char="9" ;;
        8|9) ;; # Already valid
        a|b) ;; # Already valid
        c|d|e|f) first_char="a" ;;
    esac

    # Reconstruct UUID
    uuid=$(echo "$uuid" | sed "s/\(........-....-....-\).\(...-............\)/\1${first_char}\2/")

    echo "$uuid"
}

# Fetch player info from PlayerDB API
fetch_player_info() {
    local player_name="$1"
    local response
    local http_code

    # Make API request with error handling
    response=$(curl -s -w "\n%{http_code}" "${PLAYERDB_API}/${player_name}" 2>/dev/null) || {
        error "Failed to connect to PlayerDB API"
        return 1
    }

    # Extract HTTP code and body
    http_code=$(echo "$response" | tail -n1)
    local body
    body=$(echo "$response" | sed '$d')

    # Check HTTP status
    if [[ "$http_code" != "200" ]]; then
        error "API request failed with HTTP $http_code"
        return 1
    fi

    # Check API success
    local success
    success=$(echo "$body" | jq -r '.success' 2>/dev/null)

    if [[ "$success" != "true" ]]; then
        local code
        code=$(echo "$body" | jq -r '.code' 2>/dev/null)
        if [[ "$code" == "minecraft.invalid_username" ]]; then
            error "Invalid username format: $player_name"
        elif [[ "$code" == "minecraft.api_failure" ]]; then
            error "Player not found: $player_name"
        else
            error "API error: $(echo "$body" | jq -r '.message' 2>/dev/null)"
        fi
        return 1
    fi

    echo "$body"
}

# =============================================================================
# Commands
# =============================================================================

# Lookup command - show full player info
cmd_lookup() {
    local player_name=""
    local json_output=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --json)
                json_output=true
                JSON_OUTPUT=true
                setup_colors
                shift
                ;;
            -*)
                error "Unknown option: $1"
                return 1
                ;;
            *)
                if [[ -z "$player_name" ]]; then
                    player_name="$1"
                else
                    error "Unexpected argument: $1"
                    return 1
                fi
                shift
                ;;
        esac
    done

    if [[ -z "$player_name" ]]; then
        error "Player name is required"
        return 1
    fi

    check_requirements || return 1

    local response
    response=$(fetch_player_info "$player_name") || return 1

    # Extract player data
    local username
    local online_uuid
    local raw_id
    local avatar
    local skin_texture

    username=$(echo "$response" | jq -r '.data.player.username')
    online_uuid=$(echo "$response" | jq -r '.data.player.id')
    raw_id=$(echo "$response" | jq -r '.data.player.raw_id')
    avatar=$(echo "$response" | jq -r '.data.player.avatar')
    skin_texture=$(echo "$response" | jq -r '.data.player.meta.name_history[0].name // empty' 2>/dev/null || echo "")

    # Calculate offline UUID
    local offline_uuid
    offline_uuid=$(calculate_offline_uuid "$username")

    if $json_output; then
        cat <<EOF
{
  "username": "$username",
  "online_uuid": "$online_uuid",
  "offline_uuid": "$offline_uuid",
  "raw_id": "$raw_id",
  "avatar": "$avatar"
}
EOF
    else
        echo -e "${BOLD}Player: ${CYAN}$username${NC}"
        echo -e "Online UUID:  ${GREEN}$online_uuid${NC}"
        echo -e "Offline UUID: ${YELLOW}$offline_uuid${NC}"
        echo -e "Avatar: $avatar"
    fi
}

# UUID command - get specific UUID
cmd_uuid() {
    local player_name=""
    local offline_mode=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --offline)
                offline_mode=true
                shift
                ;;
            -*)
                error "Unknown option: $1"
                return 1
                ;;
            *)
                if [[ -z "$player_name" ]]; then
                    player_name="$1"
                else
                    error "Unexpected argument: $1"
                    return 1
                fi
                shift
                ;;
        esac
    done

    if [[ -z "$player_name" ]]; then
        error "Player name is required"
        return 1
    fi

    if $offline_mode; then
        # Just calculate offline UUID (no API call needed)
        calculate_offline_uuid "$player_name"
    else
        check_requirements || return 1

        local response
        response=$(fetch_player_info "$player_name") || return 1

        echo "$response" | jq -r '.data.player.id'
    fi
}

# =============================================================================
# Main
# =============================================================================

main() {
    local command="${1:-}"
    shift || true

    case "$command" in
        lookup)
            cmd_lookup "$@"
            ;;
        uuid)
            cmd_uuid "$@"
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
