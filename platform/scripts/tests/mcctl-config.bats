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

# Compose closes a value that starts with a quote and reads the rest of the
# line as more settings (MOTD="" MODS=<url>); checked with
# `docker compose config --format json` (Compose v5.0.2).
@test "config: rejects a value whose first non-blank character is a quote, in any locale" {
    local before
    before="$(cat "$CONFIG")"
    for loc in C C.UTF-8; do
        for value in '"" MODS=https://x/p.jar' '""MODS=x' "'' MODS=x" '`` MODS=x' \
            ' "" MODS=x' $'\t"" MODS=x' $'\xc2\xa0"" MODS=x'; do
            LC_ALL=$loc run bash "$SCRIPTS_DIR/mcctl.sh" config alpha SEED "$value"
            [ "$status" -eq 1 ] || { echo "accepted $loc: $value"; return 1; }
            [ "$(cat "$CONFIG")" = "$before" ]
        done
    done
}

@test "config: rejects C1 controls and U+2028/U+2029, in any locale" {
    local before
    before="$(cat "$CONFIG")"
    for loc in C C.UTF-8; do
        for value in $'x\xc2\x85MODS=x' $'x\xc2\x9fy' $'x\xe2\x80\xa8MODS=x' $'x\xe2\x80\xa9y'; do
            LC_ALL=$loc run bash "$SCRIPTS_DIR/mcctl.sh" config alpha SEED "$value"
            [ "$status" -eq 1 ] || { echo "accepted $loc: $value"; return 1; }
            [ "$(cat "$CONFIG")" = "$before" ]
        done
    done
}

@test "config: keeps normal values, in any locale" {
    for loc in C C.UTF-8; do
        for value in '§6Welcome §lto my server' 'https://example.com/p.zip?v=1&dl=true' '-123' \
            'The "best" server' $'caf\xc3\xa9\xc2\xa0cr\xc3\xa8me'; do
            LC_ALL=$loc run bash "$SCRIPTS_DIR/mcctl.sh" config alpha MOTD "$value"
            [ "$status" -eq 0 ] || { echo "rejected $loc: $value"; return 1; }
            grep -qxF "MOTD=$value" "$CONFIG"
        done
    done
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
