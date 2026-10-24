#!/bin/bash
# =============================================================================
# common.sh - bash mirror of the @minecraft-docker/shared naming rules
# (ServerName / WorldName, #649). The scripts that sourced it were replaced by
# TypeScript (#675, #734, #735); tests/naming-rules.bats keeps the cases in sync.
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
