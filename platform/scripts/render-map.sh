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

# Resolve the world-save root that holds a dimension's region data, handling
# both vanilla (single folder: DIM-1/DIM1) and Paper/Spigot (split folders:
# <world>_nether/<world>_the_end) layouts. Echoes the host path, or nothing.
resolve_dimension_root() {
    local world_root="$1" dim="$2"
    case "$dim" in
        overworld)
            has_region_data "$world_root/region" && echo "$world_root"
            ;;
        nether)
            if has_region_data "${world_root}_nether/DIM-1/region"; then
                echo "${world_root}_nether"
            elif has_region_data "$world_root/DIM-1/region"; then
                echo "$world_root"
            fi
            ;;
        end)
            if has_region_data "${world_root}_the_end/DIM1/region"; then
                echo "${world_root}_the_end"
            elif has_region_data "$world_root/DIM1/region"; then
                echo "$world_root"
            fi
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
    info "Force render: clearing cached output for '$WORLD_NAME'"
    rm -rf "$WEB_DIR" "$CONFIG_DIR"
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
