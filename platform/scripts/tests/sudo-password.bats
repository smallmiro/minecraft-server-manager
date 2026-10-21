#!/usr/bin/env bats
# lib/common.sh run_with_sudo / run_with_sudo_stdin (#682).
# MCCTL_SUDO_PASSWORD must only be used to authenticate sudo. It must never
# reach the stdin of the command being run, even when sudo does not ask for a
# password (cached credentials, NOPASSWD).
#
# A fake `sudo` placed first on PATH models sudo's behavior; no real sudo,
# no real password and no system file is touched.

load helpers

setup() {
    unset MCCTL_ROOT MCCTL_SUDO_PASSWORD
    # shellcheck source=../lib/common.sh
    source "$SCRIPTS_DIR/lib/common.sh"
    set +u  # keep bats internals lenient

    # Fake sudo. FAKE_SUDO_MODE:
    #   password - credentials not cached; needs the password (read from stdin with -S)
    #   cached   - credentials cached; sudo does NOT read a password from stdin
    #   nopasswd - NOPASSWD in sudoers; sudo does NOT read a password from stdin
    # Each call is logged as "ppid=<n> <args>" to $FAKE_SUDO_DIR/calls.
    fake_cmd sudo 'echo "ppid=$PPID $*" >> "$FAKE_SUDO_DIR/calls"
stdin_pw=false validate=false noninteractive=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        -S) stdin_pw=true; shift ;;
        -p) shift 2 ;;
        -v) validate=true; shift ;;
        -n) noninteractive=true; shift ;;
        --) shift; break ;;
        -*) shift ;;
        *) break ;;
    esac
done
if [[ "$FAKE_SUDO_MODE" == password && ! -f "$FAKE_SUDO_DIR/timestamp" ]]; then
    if $noninteractive; then echo "sudo: a password is required" >&2; exit 1; fi
    if ! $stdin_pw; then echo "sudo: a terminal is required" >&2; exit 1; fi
    IFS= read -r pw || pw=""
    if [[ "$pw" != "$FAKE_SUDO_PASS" ]]; then
        echo "sudo: 1 incorrect password attempt" >&2
        exit 1
    fi
    touch "$FAKE_SUDO_DIR/timestamp"
fi
$validate && exit 0
exec "$@"'
    export FAKE_SUDO_PASS="example-secret"
    ENTRY="192.168.1.10 myserver.local"
}

# fake_sudo <mode>: reset fake sudo state for a scenario.
fake_sudo() {
    export FAKE_SUDO_MODE="$1"
    export FAKE_SUDO_DIR="$BATS_TEST_TMPDIR/state-$1"
    mkdir -p "$FAKE_SUDO_DIR"
}

@test "run_with_sudo_stdin: password never reaches the command (cached/nopasswd/password)" {
    for mode in cached nopasswd password; do
        fake_sudo "$mode"
        hosts="$FAKE_SUDO_DIR/hosts"
        : > "$hosts"
        export MCCTL_SUDO_PASSWORD="$FAKE_SUDO_PASS"
        echo "$ENTRY" | run_with_sudo_stdin tee -a "$hosts" > /dev/null
        [ "$(cat "$hosts")" = "$ENTRY" ]
    done
}

@test "run_with_sudo: password never reaches the command's stdin (cached/nopasswd)" {
    for mode in cached nopasswd; do
        fake_sudo "$mode"
        export MCCTL_SUDO_PASSWORD="$FAKE_SUDO_PASS"
        out="$(run_with_sudo cat < /dev/null)"
        [ -z "$out" ]
    done
}

@test "wrong password: run_with_sudo_stdin fails, writes nothing, names the cause" {
    fake_sudo password
    hosts="$FAKE_SUDO_DIR/hosts"
    : > "$hosts"
    export MCCTL_SUDO_PASSWORD="wrong-password"
    err="$(echo "$ENTRY" | run_with_sudo_stdin tee -a "$hosts" 2>&1 > /dev/null)" || true
    [ -z "$(cat "$hosts")" ]
    [[ "$err" == *"MCCTL_SUDO_PASSWORD"* ]]
    [[ "$err" == *"incorrect password"* ]]
}

@test "wrong password: run_with_sudo fails and names the cause" {
    fake_sudo password
    export MCCTL_SUDO_PASSWORD="wrong-password"
    run run_with_sudo true
    [ "$status" -ne 0 ]
    [[ "$output" == *"MCCTL_SUDO_PASSWORD"* ]]
}

@test "password starting with '-n' is passed literally (printf, not echo)" {
    fake_sudo password
    FAKE_SUDO_PASS="-n" MCCTL_SUDO_PASSWORD="-n" run_with_sudo true
}

@test "auth (-v) and command (-n) run from the same parent process" {
    # Without a tty, sudo keys cached credentials by parent PID (timestamp_type
    # tty -> ppid). The `sudo -v` and `sudo -n` calls must come from the same shell.
    fake_sudo password
    : > "$FAKE_SUDO_DIR/hosts"
    export MCCTL_SUDO_PASSWORD="$FAKE_SUDO_PASS"
    echo "$ENTRY" | run_with_sudo_stdin tee -a "$FAKE_SUDO_DIR/hosts" > /dev/null
    ppid_v="$(grep -- ' -v' "$FAKE_SUDO_DIR/calls" | head -1 | cut -d' ' -f1)"
    ppid_n="$(grep -- ' -n ' "$FAKE_SUDO_DIR/calls" | head -1 | cut -d' ' -f1)"
    [[ "$ppid_v" == ppid=* ]]
    [ "$ppid_v" = "$ppid_n" ]
}

@test "interactive mode (no MCCTL_SUDO_PASSWORD) is unchanged" {
    fake_sudo nopasswd
    unset MCCTL_SUDO_PASSWORD
    out="$(echo "$ENTRY" | run_with_sudo_stdin cat)"
    [ "$out" = "$ENTRY" ]
    [ "$(grep -c -- '^ppid=[0-9]* cat$' "$FAKE_SUDO_DIR/calls")" = "1" ]
}
