#!/usr/bin/env bats
# render-map.sh resolve_dimension_root(): the active dimension layout is chosen
# correctly, especially when a world migrated from Paper (split folders) to a
# single-folder server type leaves a STALE satellite folder behind (#542).

load helpers

setup() {
    require_bash4
    # Source the script under test (CLI flow is skipped via its source-guard).
    # shellcheck source=../render-map.sh
    source "$SCRIPTS_DIR/render-map.sh"
    set +u  # the script sets -u; keep bats internals lenient
}

# mk_region <dir> <YYYYMMDDhhmm>: region dir holding one .mca stamped at that date.
mk_region() {
    mkdir -p "$1"
    : > "$1/r.0.0.mca"
    touch -t "$2" "$1/r.0.0.mca"
}

NEW=202606281200
OLD=202602021200
MID=202604041200

@test "nether: stale satellite + newer single-folder -> single-folder (#542)" {
    W="$BATS_TEST_TMPDIR/w"
    mk_region "$W/DIM-1/region" $NEW
    mk_region "${W}_nether/DIM-1/region" $OLD
    [ "$(resolve_dimension_root "$W" nether)" = "$W" ]
}

@test "nether: only split satellite -> satellite" {
    W="$BATS_TEST_TMPDIR/w"
    mk_region "${W}_nether/DIM-1/region" $NEW
    [ "$(resolve_dimension_root "$W" nether)" = "${W}_nether" ]
}

@test "nether: only single-folder -> single-folder" {
    W="$BATS_TEST_TMPDIR/w"
    mk_region "$W/DIM-1/region" $NEW
    [ "$(resolve_dimension_root "$W" nether)" = "$W" ]
}

@test "nether: newer split satellite -> satellite" {
    W="$BATS_TEST_TMPDIR/w"
    mk_region "$W/DIM-1/region" $OLD
    mk_region "${W}_nether/DIM-1/region" $NEW
    [ "$(resolve_dimension_root "$W" nether)" = "${W}_nether" ]
}

@test "nether: no region data -> empty" {
    W="$BATS_TEST_TMPDIR/w"
    mkdir -p "$W"
    [ -z "$(resolve_dimension_root "$W" nether)" ]
}

@test "end: stale satellite + newer single-folder -> single-folder" {
    W="$BATS_TEST_TMPDIR/w"
    mk_region "$W/DIM1/region" $NEW
    mk_region "${W}_the_end/DIM1/region" $OLD
    [ "$(resolve_dimension_root "$W" end)" = "$W" ]
}

@test "overworld: region present -> world root" {
    W="$BATS_TEST_TMPDIR/w"
    mk_region "$W/region" $NEW
    [ "$(resolve_dimension_root "$W" overworld)" = "$W" ]
}

@test "dimensions/ layout resolves to world root for every dimension (#546)" {
    W="$BATS_TEST_TMPDIR/w"
    mk_region "$W/dimensions/minecraft/overworld/region" $NEW
    mk_region "$W/dimensions/minecraft/the_nether/region" $NEW
    mk_region "$W/dimensions/minecraft/the_end/region" $NEW
    [ "$(resolve_dimension_root "$W" overworld)" = "$W" ]
    [ "$(resolve_dimension_root "$W" nether)" = "$W" ]
    [ "$(resolve_dimension_root "$W" end)" = "$W" ]
}

@test "nether: dimensions/ (new) vs stale satellite -> world root" {
    W="$BATS_TEST_TMPDIR/w"
    mk_region "$W/dimensions/minecraft/the_nether/region" $NEW
    mk_region "${W}_nether/DIM-1/region" $OLD
    [ "$(resolve_dimension_root "$W" nether)" = "$W" ]
}

@test "nether: all three layouts, dimensions/ newest -> world root" {
    W="$BATS_TEST_TMPDIR/w"
    mk_region "$W/dimensions/minecraft/the_nether/region" $NEW
    mk_region "${W}_nether/DIM-1/region" $MID
    mk_region "$W/DIM-1/region" $OLD
    [ "$(resolve_dimension_root "$W" nether)" = "$W" ]
}

@test "no region data under set -e -> empty root, no abort (#575)" {
    W="$BATS_TEST_TMPDIR/w"
    mkdir -p "$W/dimensions/minecraft/the_nether/region"
    out="$(set -e; root="$(resolve_dimension_root "$W" nether)"; echo "survived:[$root]")"
    [ "$out" = "survived:[]" ]
}
