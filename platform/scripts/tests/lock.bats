#!/usr/bin/env bats
# lock.sh world locking (example for new tests). flock is required.

load helpers

setup() {
    require_flock
    make_platform
    mkdir -p "$PLATFORM/worlds/survival"
    LOCK="$PLATFORM/worlds/.locks/survival.lock"
}

@test "lock: acquire writes <server>:<timestamp>:<pid>" {
    run bash "$SCRIPTS_DIR/lock.sh" lock survival alpha
    [ "$status" -eq 0 ]
    [[ "$(cat "$LOCK")" == alpha:*:* ]] || return 1
}

@test "lock: a different server cannot take a held lock" {
    bash "$SCRIPTS_DIR/lock.sh" lock survival alpha
    run bash "$SCRIPTS_DIR/lock.sh" lock survival beta
    [ "$status" -eq 1 ]
    [[ "$(cat "$LOCK")" == alpha:* ]] || return 1
}

@test "unlock: non-owner is refused, --force overrides, owner releases" {
    bash "$SCRIPTS_DIR/lock.sh" lock survival alpha
    run bash "$SCRIPTS_DIR/lock.sh" unlock survival beta
    [ "$status" -eq 1 ]
    [ -f "$LOCK" ]
    run bash "$SCRIPTS_DIR/lock.sh" unlock survival beta --force
    [ "$status" -eq 0 ]
    [ ! -f "$LOCK" ]
}

@test "check: reports unlocked, locked and stale (exit 2)" {
    run bash "$SCRIPTS_DIR/lock.sh" check survival
    [ "$output" = "unlocked" ]
    mkdir -p "$(dirname "$LOCK")"
    echo "alpha:$(date +%s):1" > "$LOCK"
    run bash "$SCRIPTS_DIR/lock.sh" check survival
    [ "$status" -eq 0 ]
    [[ "$output" == locked:alpha:* ]] || return 1
    echo "alpha:1000000000:1" > "$LOCK"
    run bash "$SCRIPTS_DIR/lock.sh" check survival
    [ "$status" -eq 2 ]
    [[ "$output" == stale:alpha:* ]] || return 1
}
