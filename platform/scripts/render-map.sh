#!/bin/bash
# =============================================================================
# render-map.sh - Render a world's web map with BlueMap (offline CLI)
# =============================================================================
# Generates static, pan/zoom-able web maps for a world using the BlueMap CLI
# inside Docker. BlueMap runs standalone (no Minecraft server needed), so this
# is compatible with mc-router auto-scaling.
#
# Usage: ./scripts/render-map.sh <world-name> [options]
#
# Arguments:
#   world-name           Name of a world under worlds/ (e.g. survival)
#
# Options:
#   -d, --dimensions LIST  Comma-separated dimensions to render
#                          (overworld,nether,end). Default: auto-detect present.
#   -f, --force            Full re-render (discard cached tiles for the world).
#   --no-build             Fail instead of building the BlueMap image if missing.
#   --json                 Emit a machine-readable JSON summary on success.
#   -h, --help             Show this help.
#
# Output (per world, kept OUT of worlds/ so backups stay lean):
#   maps/<world>/web/      Web map (index.html is the iframe entry point)
#   maps/<world>/config/   Generated BlueMap config
#   maps/.bluemap-data/    Shared render cache (Minecraft client jar, textures)
#
# Examples:
#   ./scripts/render-map.sh survival
#   ./scripts/render-map.sh survival -d overworld,nether
#   ./scripts/render-map.sh survival --force --json
# =============================================================================

set -euo pipefail

# Get script/platform directories (mirrors create-server.sh).
# Supports both direct execution and npm package execution (mcctl CLI).
if [[ -n "${MCCTL_ROOT:-}" ]]; then
    PLATFORM_DIR="$MCCTL_ROOT"
    SCRIPT_DIR="${MCCTL_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
else
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PLATFORM_DIR="$(dirname "$SCRIPT_DIR")"
fi

source "$SCRIPT_DIR/lib/common.sh"

# Docker build context for the BlueMap image. In npm package mode the docker/
# directory ships alongside scripts (MCCTL_DOCKER), otherwise it is a sibling.
DOCKER_DIR="${MCCTL_DOCKER:-$(dirname "$SCRIPT_DIR")/docker}/bluemap"

BLUEMAP_VERSION="5.22"
IMAGE="mcctl-bluemap:${BLUEMAP_VERSION}"

WORLDS_DIR="$(get_worlds_dir)"
MAPS_DIR="$PLATFORM_DIR/maps"
DATA_CACHE="$MAPS_DIR/.bluemap-data"

# Dimension metadata (map id -> Minecraft dimension id / display name)
declare -A DIM_MC=(
    [overworld]="minecraft:overworld"
    [nether]="minecraft:the_nether"
    [end]="minecraft:the_end"
)
declare -A DIM_NAME=(
    [overworld]="Overworld"
    [nether]="Nether"
    [end]="End"
)

# =============================================================================
# Helpers
# =============================================================================

usage() {
    sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit "${1:-0}"
}

# True if a region directory contains at least one .mca file.
has_region_data() {
    local dir="$1"
    [[ -d "$dir" ]] || return 1
    compgen -G "$dir/*.mca" > /dev/null 2>&1
}

# Echo the newest *.mca modification time (epoch seconds) in a region dir,
# or 0 when the directory is missing or holds no region files.
newest_region_mtime() {
    local dir="$1"
    [[ -d "$dir" ]] || { echo 0; return; }
    local newest
    newest="$(find "$dir" -maxdepth 1 -name '*.mca' -printf '%T@\n' 2>/dev/null \
        | cut -d. -f1 | sort -rn | head -n1)"
    echo "${newest:-0}"
}

# Choose between a split-layout (satellite) candidate and a single-folder
# candidate for one dimension. When BOTH hold region data — e.g. a world that
# migrated from Paper (split) to a single-folder server type leaves a stale
# satellite behind — pick whichever was written most recently, i.e. the layout
# the server is actually using. Echoes the chosen world-save root, or nothing.
# Args: <split_region_dir> <split_root> <single_region_dir> <single_root>
pick_dimension_root() {
    local split_region="$1" split_root="$2" single_region="$3" single_root="$4"
    local split_ok=false single_ok=false
    has_region_data "$split_region" && split_ok=true
    has_region_data "$single_region" && single_ok=true
    if $split_ok && $single_ok; then
        # Tie favours the satellite (the historical default) — only relevant
        # when both layouts share an identical newest mtime, which is unlikely.
        if (( $(newest_region_mtime "$split_region") >= $(newest_region_mtime "$single_region") )); then
            echo "$split_root"
        else
            echo "$single_root"
        fi
    elif $split_ok; then
        echo "$split_root"
    elif $single_ok; then
        echo "$single_root"
    fi
}

# Resolve the world-save root that holds a dimension's region data, handling
# vanilla (single folder: DIM-1/DIM1), Paper/Spigot (split folders:
# <world>_nether/<world>_the_end) and latest-Minecraft (every dimension under
# <world>/dimensions/minecraft/<dim>) layouts. The mounted root stays <world>
# for non-split layouts — BlueMap resolves the dimension key to DIM-1/DIM1 or
# dimensions/minecraft/<dim> itself. Echoes the host path, or nothing.
resolve_dimension_root() {
    local world_root="$1" dim="$2" single_region
    case "$dim" in
        overworld)
            if has_region_data "$world_root/region" \
                || has_region_data "$world_root/dimensions/minecraft/overworld/region"; then
                echo "$world_root"
            fi
            ;;
        nether)
            single_region="$world_root/DIM-1/region"
            has_region_data "$single_region" \
                || single_region="$world_root/dimensions/minecraft/the_nether/region"
            pick_dimension_root \
                "${world_root}_nether/DIM-1/region" "${world_root}_nether" \
                "$single_region" "$world_root"
            ;;
        end)
            single_region="$world_root/DIM1/region"
            has_region_data "$single_region" \
                || single_region="$world_root/dimensions/minecraft/the_end/region"
            pick_dimension_root \
                "${world_root}_the_end/DIM1/region" "${world_root}_the_end" \
                "$single_region" "$world_root"
            ;;
    esac
}

# Ensure the BlueMap renderer image exists, building it on demand.
ensure_image() {
    if docker image inspect "$IMAGE" &> /dev/null; then
        return 0
    fi
    if [[ "$NO_BUILD" == "true" ]]; then
        error "BlueMap image '$IMAGE' not found and --no-build was given"
        return 1
    fi
    if [[ ! -f "$DOCKER_DIR/Dockerfile" ]]; then
        error "BlueMap Dockerfile not found at $DOCKER_DIR/Dockerfile"
        return 1
    fi
    info "Building BlueMap renderer image '$IMAGE' (first run only)..."
    docker build -t "$IMAGE" "$DOCKER_DIR" >&2
}

# When sourced (e.g. by tests) expose the helper functions above without running
# the CLI flow below. `return` only succeeds while being sourced; on direct
# execution the `|| true` keeps `set -e` happy and we fall through to main.
[[ "${BASH_SOURCE[0]}" != "${0}" ]] && return 0 2>/dev/null || true

# =============================================================================
# Argument parsing
# =============================================================================

WORLD_NAME=""
DIMENSIONS=""
FORCE="false"
NO_BUILD="false"
JSON_OUTPUT="false"

while [[ $# -gt 0 ]]; do
    case "$1" in
        -d|--dimensions) DIMENSIONS="$2"; shift 2 ;;
        -f|--force) FORCE="true"; shift ;;
        --no-build) NO_BUILD="true"; shift ;;
        --json) JSON_OUTPUT="true"; shift ;;
        -h|--help) usage 0 ;;
        -*) error "Unknown option: $1"; usage 1 ;;
        *)
            if [[ -z "$WORLD_NAME" ]]; then
                WORLD_NAME="$1"; shift
            else
                error "Unexpected argument: $1"; usage 1
            fi
            ;;
    esac
done

[[ -n "$WORLD_NAME" ]] || { error "World name is required"; usage 1; }

# =============================================================================
# Validation
# =============================================================================

check_docker || exit 1

WORLD_ROOT="$WORLDS_DIR/$WORLD_NAME"
if [[ ! -d "$WORLD_ROOT" ]]; then
    error "World not found: $WORLD_ROOT"
    exit 1
fi

# Determine which dimensions to render.
declare -a REQUESTED
if [[ -n "$DIMENSIONS" ]]; then
    IFS=',' read -ra REQUESTED <<< "$DIMENSIONS"
else
    REQUESTED=(overworld nether end)
fi

declare -a MAP_IDS=()
declare -a MOUNT_ARGS=()
for dim in "${REQUESTED[@]}"; do
    dim="$(echo "$dim" | tr '[:upper:]' '[:lower:]' | tr -d ' ')"
    if [[ -z "${DIM_MC[$dim]:-}" ]]; then
        error "Unknown dimension: '$dim' (expected overworld|nether|end)"
        exit 1
    fi
    root="$(resolve_dimension_root "$WORLD_ROOT" "$dim")"
    if [[ -z "$root" ]]; then
        warn "No region data for '$dim' in $WORLD_NAME — skipping"
        continue
    fi
    MAP_IDS+=("$dim")
    MOUNT_ARGS+=(-v "$root:/worlds/$dim:ro")
done

if [[ ${#MAP_IDS[@]} -eq 0 ]]; then
    error "No renderable dimensions found for world '$WORLD_NAME'"
    exit 1
fi

ensure_image || exit 1

# =============================================================================
# Prepare output + config
# =============================================================================

WORLD_MAPS="$MAPS_DIR/$WORLD_NAME"
CONFIG_DIR="$WORLD_MAPS/config"
WEB_DIR="$WORLD_MAPS/web"

if [[ "$FORCE" == "true" ]]; then
    # Regenerate config from scratch (cheap), but KEEP the existing web output so
    # a failed re-render does not destroy the previously working map. BlueMap's
    # `-f` flag re-renders all tiles in place, overwriting on success.
    info "Force render: regenerating config for '$WORLD_NAME' (existing map kept until overwritten)"
    rm -rf "$CONFIG_DIR"
fi

# Pre-create writable dirs as the host user so the container (run via --user)
# can write into bind mounts. Docker would otherwise create them as root.
mkdir -p "$CONFIG_DIR" "$WEB_DIR" "$DATA_CACHE"

DOCKER_USER="$(id -u):$(id -g)"

# Scaffold default config the first time (gives us a known-good core.conf,
# storages/file.conf, webapp.conf, etc.), then patch the parts we control.
if [[ ! -f "$CONFIG_DIR/core.conf" ]]; then
    debug "Generating default BlueMap config"
    docker run --rm --user "$DOCKER_USER" \
        -v "$CONFIG_DIR:/work/config" \
        -v "$DATA_CACHE:/work/data" \
        "$IMAGE" -c /work/config > /dev/null 2>&1 || true
fi

if [[ ! -f "$CONFIG_DIR/core.conf" ]]; then
    error "Failed to generate BlueMap config in $CONFIG_DIR"
    exit 1
fi

# Accept Mojang's EULA for texture download (BlueMap is offline/standalone) and
# disable anonymous metrics.
sed -i \
    -e 's/^accept-download: false/accept-download: true/' \
    -e 's/^metrics: true/metrics: false/' \
    "$CONFIG_DIR/core.conf"

# Replace the default per-dimension maps with our resolved set.
rm -f "$CONFIG_DIR/maps/"*.conf
mkdir -p "$CONFIG_DIR/maps"
for id in "${MAP_IDS[@]}"; do
    cat > "$CONFIG_DIR/maps/$id.conf" <<EOF
world: "/worlds/$id"
dimension: "${DIM_MC[$id]}"
name: "${DIM_NAME[$id]}"
storage: "file"
EOF
done

# =============================================================================
# Render
# =============================================================================

info "Rendering map for '$WORLD_NAME' (dimensions: ${MAP_IDS[*]})..."

RENDER_ARGS=(-c /work/config -r -g -m "$(IFS=,; echo "${MAP_IDS[*]}")")
[[ "$FORCE" == "true" ]] && RENDER_ARGS+=(-f)

docker run --rm --user "$DOCKER_USER" \
    -v "$CONFIG_DIR:/work/config" \
    -v "$DATA_CACHE:/work/data" \
    -v "$WEB_DIR:/work/web" \
    "${MOUNT_ARGS[@]}" \
    "$IMAGE" "${RENDER_ARGS[@]}" >&2

if [[ ! -f "$WEB_DIR/index.html" ]]; then
    error "Render finished but $WEB_DIR/index.html is missing"
    exit 1
fi

info "Map rendered: $WEB_DIR/index.html"

if [[ "$JSON_OUTPUT" == "true" ]]; then
    maps_json=""
    for id in "${MAP_IDS[@]}"; do
        [[ -n "$maps_json" ]] && maps_json+=","
        maps_json+="\"$(json_escape "$id")\""
    done
    cat <<EOF
{
  "world": "$(json_escape "$WORLD_NAME")",
  "maps": [$maps_json],
  "webroot": "$(json_escape "$WEB_DIR")",
  "entry": "$(json_escape "$WEB_DIR/index.html")"
}
EOF
fi
