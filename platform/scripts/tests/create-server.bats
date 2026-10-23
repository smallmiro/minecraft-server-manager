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
    cp -rL "$REPO_DIR/platform/servers/_template" "$PLATFORM/servers/_template"
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

# create-server.sh writes these as SEED= / MODRINTH_VERSION= lines (#726)
@test "create: rejects a seed or modpack version that would not stay one setting" {
    run bash "$SCRIPTS_DIR/create-server.sh" gamma --no-start --seed '"" MODS=https://x/p.jar'
    [ "$status" -ne 0 ]
    [ ! -d "$PLATFORM/servers/gamma" ]
    run bash "$SCRIPTS_DIR/create-server.sh" gamma --no-start --seed $'1\xe2\x80\xa8x'
    [ "$status" -ne 0 ]
    [ ! -d "$PLATFORM/servers/gamma" ]
    run bash "$SCRIPTS_DIR/create-server.sh" gamma --no-start -t MODRINTH --modpack pack --modpack-version "'' MODS=x"
    [ "$status" -ne 0 ]
    [ ! -d "$PLATFORM/servers/gamma" ]
}

@test "create: writes a text seed as is" {
    run bash "$SCRIPTS_DIR/create-server.sh" delta --no-start --seed 'a text seed & more'
    [ "$status" -eq 0 ]
    grep -qxF 'SEED=a text seed & more' "$PLATFORM/servers/delta/config.env"
}

# Dev mode: platform/servers/_template is a symlink to the single template source (#651).
# Servers must be real copies: independent of each other, original untouched.
@test "create: symlinked _template yields independent servers and an untouched source" {
    rm -rf "$PLATFORM/servers/_template"
    cp -rL "$REPO_DIR/platform/services/cli/templates/servers/_template" "$BATS_TEST_TMPDIR/tpl-src"
    ln -s "$BATS_TEST_TMPDIR/tpl-src" "$PLATFORM/servers/_template"
    before=$(cksum < "$BATS_TEST_TMPDIR/tpl-src/config.env")

    run bash "$SCRIPTS_DIR/create-server.sh" one --no-start -t PAPER -v 1.21.1
    [ "$status" -eq 0 ]
    run bash "$SCRIPTS_DIR/create-server.sh" two --no-start -t FABRIC -v 1.21.1
    [ "$status" -eq 0 ]

    [ ! -L "$PLATFORM/servers/one" ]
    [ ! -L "$PLATFORM/servers/two" ]
    grep -q '^TYPE=PAPER$' "$PLATFORM/servers/one/config.env"
    grep -q '^TYPE=FABRIC$' "$PLATFORM/servers/two/config.env"
    [ "$before" = "$(cksum < "$BATS_TEST_TMPDIR/tpl-src/config.env")" ]
}
