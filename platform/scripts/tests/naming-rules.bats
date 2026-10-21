#!/usr/bin/env bats
# lib/common.sh validate_server_name / validate_world_name (#649): the bash
# mirror of @minecraft-docker/shared ServerName / WorldName. Keep the cases in
# sync with platform/services/shared/tests/ServerName.test.ts and WorldName.test.ts.

load helpers

setup() {
    unset MCCTL_ROOT
    # shellcheck source=../lib/common.sh
    source "$SCRIPTS_DIR/lib/common.sh"
    LONG32=$(printf '%032d' 0 | tr 0 a)
}

@test "validate_server_name: accepts DNS-1123 names of 2-32 chars" {
    for name in ab survival my-server a1 srv-2-test "$LONG32" routers x-router; do
        run validate_server_name "$name"
        [ "$status" -eq 0 ]
    done
}

@test "validate_server_name: rejects length, format and case violations" {
    for name in "" a "${LONG32}a" 1server server- -ab my--server My-Server my_server my.server "my server" ../etc; do
        run validate_server_name "$name"
        [ "$status" -eq 1 ]
        [ -n "$output" ]
    done
}

@test "validate_server_name: rejects reserved names" {
    run validate_server_name router
    [ "$status" -eq 1 ]
    [[ "$output" == *"reserved"* ]]
}

@test "validate_world_name: accepts letters, digits, hyphens and underscores" {
    for name in world My_World survival-2 a 0; do
        run validate_world_name "$name"
        [ "$status" -eq 0 ]
    done
}

@test "validate_world_name: rejects path, space and shell characters" {
    for name in "" . .. ../x a/b "my world" world.old "a;b" '$(id)'; do
        run validate_world_name "$name"
        [ "$status" -eq 1 ]
    done
}

@test "validate_*: ASCII ranges even under a UTF-8 locale" {
    locale -a 2> /dev/null | grep -qiE '^en_US\.utf-?8$' || skip "en_US.UTF-8 locale not installed"
    export LC_ALL=en_US.UTF-8
    for name in 'cafeé' 'ünder'; do
        run validate_server_name "$name"
        [ "$status" -eq 1 ]
    done
    run validate_world_name 'wörld'
    [ "$status" -eq 1 ]
    # the caller's locale is restored
    [ "$LC_ALL" = en_US.UTF-8 ]
}
