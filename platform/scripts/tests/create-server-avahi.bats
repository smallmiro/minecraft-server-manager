#!/bin/bash
# =============================================================================
# Tests for create-server.sh get_host_ip() / register_avahi_hostname() (#682)
# =============================================================================
# The avahi hosts entry must hold exactly one valid IPv4 address:
# - HOST_IP="a,b " in .env -> first IP only, whitespace removed
# - values that are not IPv4 are never written (warning instead)
#
# Fake sudo/systemctl/avahi-daemon on PATH and a temp AVAHI_HOSTS file; no
# system file is touched.
#
# Run: bash platform/scripts/tests/create-server-avahi.test.sh
# =============================================================================

set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(dirname "$TEST_DIR")"

unset MCCTL_ROOT MCCTL_SUDO_PASSWORD
# Source the script under test (create flow is skipped via its source-guard).
# shellcheck source=../create-server.sh
source "$SCRIPTS_DIR/create-server.sh"
set +eu  # keep the harness lenient regardless of the script's `set -e`

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

# Fake sudo: log the call, then run the command (as the current user).
cat > "$WORK/bin/sudo" <<'FAKE'
#!/bin/bash
echo "$*" >> "$FAKE_SUDO_CALLS"
while [[ "${1:-}" == -* ]]; do shift; done
exec "$@"
FAKE
printf '#!/bin/sh\nexit 0\n' > "$WORK/bin/systemctl"
printf '#!/bin/sh\nexit 0\n' > "$WORK/bin/avahi-daemon"
chmod +x "$WORK/bin/"*
export PATH="$WORK/bin:$PATH"
export FAKE_SUDO_CALLS="$WORK/sudo-calls"

ENV_FILE="$WORK/.env"
AVAHI_HOSTS="$WORK/avahi-hosts"

reset_hosts() { : > "$AVAHI_HOSTS"; : > "$FAKE_SUDO_CALLS"; }

# --- get_host_ip ---------------------------------------------------------------

printf 'HOST_IP=192.168.1.10,100.64.0.5 \n' > "$ENV_FILE"
assert_eq "HOST_IP='a,b ' -> first IP, no whitespace" "192.168.1.10" "$(get_host_ip)"

printf 'HOST_IP="192.168.1.10 , 100.64.0.5"\n' > "$ENV_FILE"
assert_eq "HOST_IP quoted 'a , b' -> first IP" "192.168.1.10" "$(get_host_ip)"

printf 'HOST_IP=192.168.1.10\n' > "$ENV_FILE"
assert_eq "HOST_IP single IP unchanged" "192.168.1.10" "$(get_host_ip)"

printf 'HOST_IPS=100.64.0.5,192.168.1.10\nHOST_IP=192.168.1.10\n' > "$ENV_FILE"
assert_eq "HOST_IPS takes precedence, first IP" "100.64.0.5" "$(get_host_ip)"

# --- register_avahi_hostname: valid IPv4 is written --------------------------

reset_hosts
printf 'HOST_IP=192.168.1.10,100.64.0.5 \n' > "$ENV_FILE"
register_avahi_hostname "myserver.local" "$(get_host_ip)" > /dev/null 2>&1
assert_eq "HOST_IP='a,b ' -> avahi entry has first IP only" \
    "192.168.1.10 myserver.local" "$(cat "$AVAHI_HOSTS")"

# --- register_avahi_hostname: non-IPv4 is rejected ---------------------------

for bad in "192.168.1.10,100.64.0.5" "999.1.1.1" "192.168.1" "not-an-ip" "192.168.1.10 extra"; do
    reset_hosts
    out="$(register_avahi_hostname "myserver.local" "$bad" 2>&1)"
    rc=$?
    assert_eq "invalid '$bad': non-zero exit" "1" "$([[ $rc -ne 0 ]] && echo 1 || echo 0)"
    assert_eq "invalid '$bad': nothing written" "" "$(cat "$AVAHI_HOSTS")"
    assert_eq "invalid '$bad': sudo not called" "" "$(cat "$FAKE_SUDO_CALLS")"
    assert_contains "invalid '$bad': warning shown" "not a valid IPv4" "$out"
done

# -----------------------------------------------------------------------------
echo ""
if [[ $FAILED -eq 0 ]]; then
    echo "All tests passed."
    exit 0
else
    echo "$FAILED test(s) failed."
    exit 1
fi
