#!/usr/bin/env bats
# mcctl.sh config <server> <key> <value>: the API sets LEVEL/SEED through it
# (ShellAdapter.setServerConfig), so the value is untrusted text (#726).

load helpers

setup() {
    make_platform
    add_server alpha
    printf 'TYPE=PAPER\nLEVEL=alpha\nSEED=1\n' > "$PLATFORM/servers/alpha/config.env"
    CONFIG="$PLATFORM/servers/alpha/config.env"
}

config() { run bash "$SCRIPTS_DIR/mcctl.sh" config alpha "$@"; }

@test "config: replaces an existing key in place" {
    config SEED 42
    [ "$status" -eq 0 ]
    [ "$(cat "$CONFIG")" = "$(printf 'TYPE=PAPER\nLEVEL=alpha\nSEED=42')" ]
}

@test "config: appends a missing key" {
    config MOTD 'Hello world'
    [ "$status" -eq 0 ]
    [ "$(tail -n 1 "$CONFIG")" = "MOTD=Hello world" ]
}

@test "config: writes sed metacharacters literally" {
    config SEED 'a|b&c\d/e'
    [ "$status" -eq 0 ]
    grep -qxF 'SEED=a|b&c\d/e' "$CONFIG"
}

@test "config: a value cannot run a command through sed's e flag" {
    config SEED "\$(touch $BATS_TEST_TMPDIR/pwned)|e;#"
    [ ! -e "$BATS_TEST_TMPDIR/pwned" ]
    grep -qxF "SEED=\$(touch $BATS_TEST_TMPDIR/pwned)|e;#" "$CONFIG"
}

@test "config: rejects a value with a line break or control character" {
    local before
    before="$(cat "$CONFIG")"
    for value in $'1\nMODS=http://evil/x.jar' $'1\rMODS=x' $'1\tx' $'1\x1bx'; do
        config SEED "$value"
        [ "$status" -eq 1 ]
        [ "$(cat "$CONFIG")" = "$before" ]
    done
    config NEWKEY $'1\nMODS=http://evil/x.jar'
    [ "$status" -eq 1 ]
    [ "$(cat "$CONFIG")" = "$before" ]
}

@test "config: rejects an invalid key name" {
    local before
    before="$(cat "$CONFIG")"
    for key in 'SEED=.*|' 'A B' $'A\nB' '1A'; do
        config "$key" x
        [ "$status" -eq 1 ]
        [ "$(cat "$CONFIG")" = "$before" ]
    done
}
