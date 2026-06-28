#!/bin/bash
# =============================================================================
# Tests for render-map.sh resolve_dimension_root()
# =============================================================================
# Verifies that the active dimension layout is chosen correctly, especially
# when a world migrated from Paper (split folders) to a single-folder server
# type leaves a STALE satellite folder behind (issue #542).
#
# Run: bash platform/scripts/tests/resolve-dimension-root.test.sh
# =============================================================================

set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(dirname "$TEST_DIR")"

# Source the script under test (CLI flow is skipped via its source-guard).
# shellcheck source=../render-map.sh
source "$SCRIPTS_DIR/render-map.sh"
set +eu  # keep the harness lenient regardless of the script's `set -euo`

FAILED=0

assert_eq() {
    local desc="$1" expected="$2" actual="$3"
    if [[ "$expected" == "$actual" ]]; then
        echo "  ok   - $desc"
    else
        echo "  FAIL - $desc"
        echo "         expected: '$expected'"
        echo "         actual:   '$actual'"
        FAILED=$((FAILED + 1))
    fi
}

# Create a region dir holding one .mca file stamped at a given date.
mk_region() {
    local dir="$1" date="$2"
    mkdir -p "$dir"
    : > "$dir/r.0.0.mca"
    touch -d "$date" "$dir/r.0.0.mca"
}

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# --- Nether ------------------------------------------------------------------

# Stale split satellite (old) shadows the active single-folder data (new).
# This is the issue #542 scenario: must pick the single-folder root.
W="$WORK/w1"
mk_region "$W/DIM-1/region" "2026-06-28 12:00:00"          # active (new)
mk_region "${W}_nether/DIM-1/region" "2026-02-02 12:00:00" # stale satellite (old)
assert_eq "nether: stale satellite + newer single-folder -> single-folder" \
    "$W" "$(resolve_dimension_root "$W" nether)"

# Genuine Paper world: only the split satellite exists -> use it (no regression).
W="$WORK/w2"
mk_region "${W}_nether/DIM-1/region" "2026-06-28 12:00:00"
assert_eq "nether: only split satellite -> satellite" \
    "${W}_nether" "$(resolve_dimension_root "$W" nether)"

# Single-folder only -> use it.
W="$WORK/w3"
mk_region "$W/DIM-1/region" "2026-06-28 12:00:00"
assert_eq "nether: only single-folder -> single-folder" \
    "$W" "$(resolve_dimension_root "$W" nether)"

# Both present but the split satellite is the newer one -> prefer satellite.
W="$WORK/w4"
mk_region "$W/DIM-1/region" "2026-02-02 12:00:00"
mk_region "${W}_nether/DIM-1/region" "2026-06-28 12:00:00"
assert_eq "nether: newer split satellite -> satellite" \
    "${W}_nether" "$(resolve_dimension_root "$W" nether)"

# Neither present -> empty.
W="$WORK/w5"
mkdir -p "$W"
assert_eq "nether: no region data -> empty" \
    "" "$(resolve_dimension_root "$W" nether)"

# --- End ---------------------------------------------------------------------

# Stale _the_end satellite shadows active single-folder DIM1 data.
W="$WORK/e1"
mk_region "$W/DIM1/region" "2026-06-28 12:00:00"
mk_region "${W}_the_end/DIM1/region" "2026-02-02 12:00:00"
assert_eq "end: stale satellite + newer single-folder -> single-folder" \
    "$W" "$(resolve_dimension_root "$W" end)"

# --- Overworld ---------------------------------------------------------------

W="$WORK/o1"
mk_region "$W/region" "2026-06-28 12:00:00"
assert_eq "overworld: region present -> world root" \
    "$W" "$(resolve_dimension_root "$W" overworld)"

# -----------------------------------------------------------------------------
echo ""
if [[ $FAILED -eq 0 ]]; then
    echo "All tests passed."
    exit 0
else
    echo "$FAILED test(s) failed."
    exit 1
fi
