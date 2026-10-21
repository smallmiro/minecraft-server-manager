#!/bin/bash
# =============================================================================
# Tests for lib/common.sh run_with_sudo / run_with_sudo_stdin (issue #682)
# =============================================================================
# MCCTL_SUDO_PASSWORD must only be used to authenticate sudo. It must never
# reach the stdin of the command being run, even when sudo does not ask for a
# password (cached credentials, NOPASSWD).
#
# A fake `sudo` placed first on PATH models sudo's behavior; no real sudo,
# no real password and no system file is touched.
#
# Run: bash platform/scripts/tests/sudo-password.test.sh
# =============================================================================

set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(dirname "$TEST_DIR")"

unset MCCTL_ROOT MCCTL_SUDO_PASSWORD
# shellcheck source=../lib/common.sh
source "$SCRIPTS_DIR/lib/common.sh"

FAILED=0

assert_eq() {
    local desc="$1" expected="$2" actual="$3"
    if [[ "$expected" == "$actual" ]]; then
        echo "  ok   - $desc"
    else
        echo "  FAIL - $desc"
        echo "         expected: '$expected'"
        echo "         actual:   '$actual'"
        FAILED=$((FAILED + 1))
    fi
}

assert_contains() {
    local desc="$1" needle="$2" haystack="$3"
    if [[ "$haystack" == *"$needle"* ]]; then
        echo "  ok   - $desc"
    else
        echo "  FAIL - $desc"
        echo "         expected to contain: '$needle'"
        echo "         actual:              '$haystack'"
        FAILED=$((FAILED + 1))
    fi
}

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"

# Fake sudo. FAKE_SUDO_MODE:
#   password - credentials not cached; needs the password (read from stdin with -S)
#   cached   - credentials cached; sudo does NOT read a password from stdin
#   nopasswd - NOPASSWD in sudoers; sudo does NOT read a password from stdin
# Each call is logged as "ppid=<n> <args>" to $FAKE_SUDO_DIR/calls.
cat > "$WORK/bin/sudo" <<'FAKE'
#!/bin/bash
echo "ppid=$PPID $*" >> "$FAKE_SUDO_DIR/calls"
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
exec "$@"
FAKE
chmod +x "$WORK/bin/sudo"
export PATH="$WORK/bin:$PATH"
export FAKE_SUDO_PASS="example-secret"

# Reset fake sudo state for a scenario.
fake_sudo() {
    export FAKE_SUDO_MODE="$1"
    export FAKE_SUDO_DIR="$WORK/state-$1-$RANDOM"
    mkdir -p "$FAKE_SUDO_DIR"
}

ENTRY="192.168.1.10 myserver.local"

# --- run_with_sudo_stdin: password must never reach the command ---------------

for mode in cached nopasswd password; do
    fake_sudo "$mode"
    hosts="$FAKE_SUDO_DIR/hosts"
    : > "$hosts"
    MCCTL_SUDO_PASSWORD="$FAKE_SUDO_PASS"
    echo "$ENTRY" | run_with_sudo_stdin tee -a "$hosts" > /dev/null
    rc=$?
    assert_eq "stdin ($mode): exit 0" "0" "$rc"
    assert_eq "stdin ($mode): file holds only the entry, no password" \
        "$ENTRY" "$(cat "$hosts")"
done

# --- run_with_sudo: password must never reach the command's stdin ------------

for mode in cached nopasswd; do
    fake_sudo "$mode"
    MCCTL_SUDO_PASSWORD="$FAKE_SUDO_PASS"
    out="$(run_with_sudo cat < /dev/null)"
    assert_eq "run_with_sudo ($mode): command stdin is empty" "" "$out"
done

# --- wrong password: fail, write nothing, report the cause --------------------

fake_sudo password
hosts="$FAKE_SUDO_DIR/hosts"
: > "$hosts"
MCCTL_SUDO_PASSWORD="wrong-password"
err="$(echo "$ENTRY" | run_with_sudo_stdin tee -a "$hosts" 2>&1 > /dev/null)"
rc=$?
assert_eq "wrong password: non-zero exit" "1" "$([[ $rc -ne 0 ]] && echo 1 || echo 0)"
assert_eq "wrong password: nothing written" "" "$(cat "$hosts")"
assert_contains "wrong password: error names the cause" "MCCTL_SUDO_PASSWORD" "$err"
assert_contains "wrong password: sudo's own message is shown" "incorrect password" "$err"

fake_sudo password
MCCTL_SUDO_PASSWORD="wrong-password"
out="$(run_with_sudo true 2>&1)"
rc=$?
assert_eq "run_with_sudo wrong password: non-zero exit" "1" "$([[ $rc -ne 0 ]] && echo 1 || echo 0)"
assert_contains "run_with_sudo wrong password: error names the cause" "MCCTL_SUDO_PASSWORD" "$out"

# --- password starting with '-n' is passed literally (printf, not echo) ------

fake_sudo password
FAKE_SUDO_PASS="-n" MCCTL_SUDO_PASSWORD="-n" run_with_sudo true
assert_eq "password '-n': authenticates" "0" "$?"

# --- auth and command share the same parent process --------------------------
# Without a tty, sudo keys cached credentials by parent PID (timestamp_type
# tty -> ppid). The `sudo -v` and `sudo -n` calls must come from the same shell.

fake_sudo password
: > "$FAKE_SUDO_DIR/hosts"
MCCTL_SUDO_PASSWORD="$FAKE_SUDO_PASS"
echo "$ENTRY" | run_with_sudo_stdin tee -a "$FAKE_SUDO_DIR/hosts" > /dev/null
ppid_v="$(grep -- ' -v' "$FAKE_SUDO_DIR/calls" | head -1 | cut -d' ' -f1)"
ppid_n="$(grep -- ' -n ' "$FAKE_SUDO_DIR/calls" | head -1 | cut -d' ' -f1)"
assert_eq "auth (-v) and command (-n) run from the same parent" "$ppid_v" "$ppid_n"
assert_contains "auth call recorded" "ppid=" "$ppid_v"

# --- interactive mode (no MCCTL_SUDO_PASSWORD) is unchanged -------------------

fake_sudo nopasswd
unset MCCTL_SUDO_PASSWORD
out="$(echo "$ENTRY" | run_with_sudo_stdin cat)"
assert_eq "interactive: stdin passed through" "$ENTRY" "$out"
assert_eq "interactive: plain sudo, no -n" "1" "$(grep -c -- '^ppid=[0-9]* cat$' "$FAKE_SUDO_DIR/calls")"

# -----------------------------------------------------------------------------
echo ""
if [[ $FAILED -eq 0 ]]; then
    echo "All tests passed."
    exit 0
else
    echo "$FAILED test(s) failed."
    exit 1
fi
