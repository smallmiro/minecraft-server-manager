#!/usr/bin/env bats
# create-server.sh happy path against the fake docker (example for new tests).

bats_require_minimum_version 1.5.0
load helpers

setup() {
    require_gnu_sed
    use_fake_docker
    fake_cmd ip 'exit 0'
    fake_cmd hostname 'exit 0'
    make_platform
    cp -r "$REPO_DIR/platform/servers/_template" "$PLATFORM/servers/_template"
}

@test "create: writes server dir, config and compose include; validates compose via docker" {
    run bash "$SCRIPTS_DIR/create-server.sh" alpha --no-start -t PAPER -v 1.21.1
    [ "$status" -eq 0 ]
    grep -q '^TYPE=PAPER$' "$PLATFORM/servers/alpha/config.env"
    grep -q '^VERSION=1.21.1$' "$PLATFORM/servers/alpha/config.env"
    grep -q 'alpha/docker-compose.yml' "$PLATFORM/servers/compose.yml"
    grep -q 'compose -f .*docker-compose.yml config' "$FAKE_DOCKER_LOG"
    run ! grep -q ' up ' "$FAKE_DOCKER_LOG"   # --no-start
}

@test "create: aborts and reports when docker compose config fails" {
    FAKE_DOCKER_CONFIG_RC=1 run bash "$SCRIPTS_DIR/create-server.sh" beta --no-start
    [ "$status" -ne 0 ]
}

@test "create: rejects a reserved server name before creating anything (#649)" {
    run bash "$SCRIPTS_DIR/create-server.sh" router --no-start
    [ "$status" -eq 1 ]
    [[ "$output" == *"reserved"* ]] || return 1
    [ ! -e "$PLATFORM/servers/router" ]
}

@test "create: rejects a --world name that is not a valid world name (#649)" {
    run bash "$SCRIPTS_DIR/create-server.sh" gamma --no-start -w ../escape
    [ "$status" -eq 1 ]
    [[ "$output" == *"World name"* ]] || return 1
    [ ! -e "$PLATFORM/servers/gamma" ]
    run ! grep -q 'escape' "$PLATFORM/servers/_template/config.env"
}
