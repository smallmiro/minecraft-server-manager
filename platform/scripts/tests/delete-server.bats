#!/usr/bin/env bats
# delete-server.sh against the fake docker (example for new tests).

bats_require_minimum_version 1.5.0
load helpers

setup() {
    use_fake_docker
    make_platform
    add_server alpha
}

@test "delete: unknown server is an error and removes nothing" {
    run bash "$SCRIPTS_DIR/delete-server.sh" nope --force
    [ "$status" -eq 1 ]
    [ -d "$PLATFORM/servers/alpha" ]
}

@test "delete: removes the server dir, keeps worlds, removes the container" {
    mkdir -p "$PLATFORM/worlds/alpha"
    FAKE_DOCKER_PS="mc-alpha" run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 0 ]
    [ ! -d "$PLATFORM/servers/alpha" ]
    [ -d "$PLATFORM/worlds/alpha" ]
    grep -q '^rm -f mc-alpha$' "$FAKE_DOCKER_LOG"
}

@test "delete: only the exact container name is removed (no prefix match)" {
    FAKE_DOCKER_PS="mc-alpha2" run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 0 ]
    run ! grep -q '^rm -f' "$FAKE_DOCKER_LOG"
}

@test "delete: drops the include entry from servers/compose.yml" {
    require_gnu_sed
    printf 'include:\n  - alpha/docker-compose.yml\n  - beta/docker-compose.yml\n' > "$PLATFORM/servers/compose.yml"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 0 ]
    run ! grep -q alpha "$PLATFORM/servers/compose.yml"
    grep -q beta "$PLATFORM/servers/compose.yml"
}

@test "delete: restores compose.yml and keeps the server when validation fails" {
    require_gnu_sed
    printf 'include:\n  - alpha/docker-compose.yml\n' > "$PLATFORM/servers/compose.yml"
    FAKE_DOCKER_CONFIG_RC=1 run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 1 ]
    grep -q alpha "$PLATFORM/servers/compose.yml"
    [ -d "$PLATFORM/servers/alpha" ]
}

# --- #652: worlds outlive their server ---------------------------------------

# mk_world <dir>: a minimal world folder.
mk_world() {
    mkdir -p "$1"
    echo level > "$1/level.dat"
}

@test "delete: rejects a name outside the naming rule and removes nothing (#652)" {
    run bash "$SCRIPTS_DIR/delete-server.sh" ../servers/alpha --force --keep-avahi
    [ "$status" -eq 1 ]
    [ -d "$PLATFORM/servers/alpha" ]
    [ ! -s "$FAKE_DOCKER_LOG" ]
}

@test "delete: a legacy name that predates the strict rule can still be deleted (#652)" {
    add_server My_Server
    run bash "$SCRIPTS_DIR/delete-server.sh" My_Server --force --keep-avahi
    [ "$status" -eq 0 ]
    [ ! -d "$PLATFORM/servers/My_Server" ]
}

@test "delete: moves the server-internal world and its dimension folders to worlds/ (#652)" {
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    mk_world "$PLATFORM/servers/alpha/data/alpha_nether"
    mk_world "$PLATFORM/servers/alpha/data/alpha_the_end"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 0 ]
    [ ! -d "$PLATFORM/servers/alpha" ]
    [ -f "$PLATFORM/worlds/alpha/level.dat" ]
    [ -f "$PLATFORM/worlds/alpha_nether/level.dat" ]
    [ -f "$PLATFORM/worlds/alpha_the_end/level.dat" ]
    [[ "$output" == *"moved to worlds/alpha"* ]]
}

@test "delete: LEVEL defaults to 'world' when config.env does not set it (#652)" {
    : > "$PLATFORM/servers/alpha/config.env"
    mk_world "$PLATFORM/servers/alpha/data/world"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 0 ]
    [ -f "$PLATFORM/worlds/world/level.dat" ]
}

@test "delete: aborts without touching anything when worlds/ already has that world (#652)" {
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    mkdir -p "$PLATFORM/worlds/alpha"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 1 ]
    [ -f "$PLATFORM/servers/alpha/data/alpha/level.dat" ]
    [ ! -s "$FAKE_DOCKER_LOG" ]
    [[ "$output" == *"worlds/alpha"* ]]
}

@test "delete: a dimension folder name clash also aborts before anything is deleted (#652)" {
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    mk_world "$PLATFORM/servers/alpha/data/alpha_nether"
    mkdir -p "$PLATFORM/worlds/alpha_nether"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 1 ]
    [ -f "$PLATFORM/servers/alpha/data/alpha/level.dat" ]
    [ ! -d "$PLATFORM/worlds/alpha" ]
}

@test "delete: --delete-world deletes the server-internal world (#652)" {
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    mk_world "$PLATFORM/servers/alpha/data/alpha_nether"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi --delete-world
    [ "$status" -eq 0 ]
    [ ! -d "$PLATFORM/servers/alpha" ]
    [ ! -e "$PLATFORM/worlds/alpha" ]
    [ ! -e "$PLATFORM/worlds/alpha_nether" ]
    [[ "$output" == *"deleted"* ]]
}

@test "delete: a world in worlds/ is only unassigned, even with --delete-world (#652)" {
    mk_world "$PLATFORM/worlds/alpha"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi --delete-world
    [ "$status" -eq 0 ]
    [ -f "$PLATFORM/worlds/alpha/level.dat" ]
    [[ "$output" == *"worlds/alpha"* ]]
}

@test "delete: a symlinked world is not moved and its target survives (#652)" {
    mk_world "$PLATFORM/worlds/alpha"
    mkdir -p "$PLATFORM/servers/alpha/data"
    ln -s "$PLATFORM/worlds/alpha" "$PLATFORM/servers/alpha/data/alpha"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 0 ]
    [ ! -d "$PLATFORM/servers/alpha" ]
    [ -f "$PLATFORM/worlds/alpha/level.dat" ]
}

@test "delete: an unsafe LEVEL with a folder behind it aborts instead of guessing (#652)" {
    echo "LEVEL=.." > "$PLATFORM/servers/alpha/config.env"
    mkdir -p "$PLATFORM/servers/alpha/data"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 1 ]
    [ -d "$PLATFORM/servers/alpha" ]
}

@test "delete: aborts and keeps the server when the container fails to stop (#652)" {
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    FAKE_DOCKER_PS="mc-alpha" FAKE_DOCKER_COMPOSE_PS="mc-alpha" FAKE_DOCKER_STOP_RC=1 \
        run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 1 ]
    [ -f "$PLATFORM/servers/alpha/data/alpha/level.dat" ]
    [ ! -e "$PLATFORM/worlds/alpha" ]
    run ! grep -qE '(^| )rm( |$)' "$FAKE_DOCKER_LOG"
}

@test "delete: does not claim a world was preserved when there was none (#652)" {
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 0 ]
    [[ "$output" != *"preserved"* ]]
    [[ "$output" == *"No world data found"* ]]
}

# --- #652 review (PR #741): no world is lost when its location is unclear ---

# expect_abort_keeping <path>: the delete failed, touched no container, kept <path>.
expect_abort_keeping() {
    [ "$status" -eq 1 ]
    [ -e "$1" ]
    [ -d "$PLATFORM/servers/alpha" ]
    if grep -qE '(^| )(stop|rm)( |$)' "$FAKE_DOCKER_LOG"; then return 1; fi
}

@test "delete: LEVEL with an inline comment is not guessed (#652)" {
    echo "LEVEL=alpha # world name" > "$PLATFORM/servers/alpha/config.env"
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    expect_abort_keeping "$PLATFORM/servers/alpha/data/alpha/level.dat"
    [[ "$output" == *"LEVEL"* ]]
}

@test "delete: 'LEVEL = alpha' (spaces) is not read as unset (#652)" {
    echo "LEVEL = alpha" > "$PLATFORM/servers/alpha/config.env"
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    expect_abort_keeping "$PLATFORM/servers/alpha/data/alpha/level.dat"
}

@test "delete: quoted LEVEL values are not rewritten (#652)" {
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    for line in 'LEVEL="alpha"' "LEVEL='alpha'" "LEVEL=\"al'pha\""; do
        echo "$line" > "$PLATFORM/servers/alpha/config.env"
        run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
        expect_abort_keeping "$PLATFORM/servers/alpha/data/alpha/level.dat"
    done
}

@test "delete: LEVEL defined twice is ambiguous (#652)" {
    printf 'LEVEL=alpha\nLEVEL=beta\n' > "$PLATFORM/servers/alpha/config.env"
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    expect_abort_keeping "$PLATFORM/servers/alpha/data/alpha/level.dat"
}

@test "delete: an invalid LEVEL aborts even when only its dimension folder exists (#652)" {
    echo "LEVEL=my.world" > "$PLATFORM/servers/alpha/config.env"
    mk_world "$PLATFORM/servers/alpha/data/my.world_nether"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    expect_abort_keeping "$PLATFORM/servers/alpha/data/my.world_nether/level.dat"
}

@test "delete: an absolute LEVEL path aborts (#652)" {
    echo "LEVEL=/data/alpha" > "$PLATFORM/servers/alpha/config.env"
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    expect_abort_keeping "$PLATFORM/servers/alpha/data/alpha/level.dat"
}

@test "delete: dimension folders without their base world abort (#652)" {
    mk_world "$PLATFORM/servers/alpha/data/alpha_nether"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    expect_abort_keeping "$PLATFORM/servers/alpha/data/alpha_nether/level.dat"
}

@test "delete: a symlink to a world inside the server aborts and names the world (#652)" {
    mk_world "$PLATFORM/servers/alpha/data/realworld"
    ln -s realworld "$PLATFORM/servers/alpha/data/alpha"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    expect_abort_keeping "$PLATFORM/servers/alpha/data/realworld/level.dat"
    [[ "$output" == *"data/realworld"* ]]
}

@test "delete: a world under another name (old LEVEL) aborts and names it (#652)" {
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    mk_world "$PLATFORM/servers/alpha/data/world"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    expect_abort_keeping "$PLATFORM/servers/alpha/data/world/level.dat"
    [ -f "$PLATFORM/servers/alpha/data/alpha/level.dat" ]
    [[ "$output" == *"data/world"* ]]
}

@test "delete: a symlinked data/ aborts and leaves its target alone (#652)" {
    mk_world "$BATS_TEST_TMPDIR/external-data/alpha"
    ln -s "$BATS_TEST_TMPDIR/external-data" "$PLATFORM/servers/alpha/data"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    expect_abort_keeping "$BATS_TEST_TMPDIR/external-data/alpha/level.dat"
    [ ! -e "$PLATFORM/worlds/alpha" ]
}

@test "delete: --delete-world still deletes when the world cannot be located (#652)" {
    echo "LEVEL=alpha # world name" > "$PLATFORM/servers/alpha/config.env"
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi --delete-world
    [ "$status" -eq 0 ]
    [ ! -d "$PLATFORM/servers/alpha" ]
}

@test "delete: a dimension created while the server stops is moved too (#652)" {
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    FAKE_DOCKER_PS="mc-alpha" FAKE_DOCKER_COMPOSE_PS="mc-alpha" \
        FAKE_DOCKER_STOP_HOOK='mkdir -p "$MCCTL_ROOT/servers/alpha/data/alpha_nether" && echo n > "$MCCTL_ROOT/servers/alpha/data/alpha_nether/level.dat"' \
        run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 0 ]
    [ -f "$PLATFORM/worlds/alpha/level.dat" ]
    [ -f "$PLATFORM/worlds/alpha_nether/level.dat" ]
}

@test "delete: a destination created while the server stops aborts before deleting (#652)" {
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    FAKE_DOCKER_PS="mc-alpha" FAKE_DOCKER_COMPOSE_PS="mc-alpha" \
        FAKE_DOCKER_STOP_HOOK='mkdir -p "$MCCTL_ROOT/worlds/alpha"' \
        run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 1 ]
    [ -f "$PLATFORM/servers/alpha/data/alpha/level.dat" ]
    [ ! -e "$PLATFORM/worlds/alpha/alpha" ]
}

@test "delete: a failed Docker query is not 'no container' (#652)" {
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    FAKE_DOCKER_PS_RC=1 run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 1 ]
    [ -f "$PLATFORM/servers/alpha/data/alpha/level.dat" ]
    [ ! -e "$PLATFORM/worlds/alpha" ]
}

@test "delete: a destination appearing between moves stops and reports what moved (#652)" {
    mk_world "$PLATFORM/servers/alpha/data/alpha"
    mk_world "$PLATFORM/servers/alpha/data/alpha_nether"
    # Another process creates worlds/alpha_nether while alpha is being moved.
    fake_cmd mv 'case "$1" in */data/alpha) mkdir -p "$(dirname "$2")/alpha_nether" ;; esac
exec /bin/mv "$@"'
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 1 ]
    [ -f "$PLATFORM/worlds/alpha/level.dat" ]
    [ -f "$PLATFORM/servers/alpha/data/alpha_nether/level.dat" ]
    [ ! -e "$PLATFORM/worlds/alpha_nether/alpha_nether" ]
    [[ "$output" == *"worlds/alpha"* ]]
}
