#!/usr/bin/env bats
# delete-server.sh against the fake docker (example for new tests).

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
    ! grep -q '^rm -f' "$FAKE_DOCKER_LOG"
}

@test "delete: drops the include entry from servers/compose.yml" {
    require_gnu_sed
    printf 'include:\n  - alpha/docker-compose.yml\n  - beta/docker-compose.yml\n' > "$PLATFORM/servers/compose.yml"
    run bash "$SCRIPTS_DIR/delete-server.sh" alpha --force --keep-avahi
    [ "$status" -eq 0 ]
    ! grep -q alpha "$PLATFORM/servers/compose.yml"
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
