#!/usr/bin/env bats
# create-server.sh get_host_ip() / register_avahi_hostname() (#682).
# The avahi hosts entry must hold exactly one valid IPv4 address:
# - HOST_IP="a,b " in .env -> first IP only, whitespace removed
# - values that are not IPv4 are never written (warning instead)
# Fake sudo/systemctl/avahi-daemon on PATH and a temp AVAHI_HOSTS file; no
# system file is touched.

load helpers

setup() {
    unset MCCTL_ROOT MCCTL_SUDO_PASSWORD
    # Source the script under test (create flow is skipped via its source-guard).
    # shellcheck source=../create-server.sh
    source "$SCRIPTS_DIR/create-server.sh"
    set +u  # the script sets -u; keep bats internals lenient

    export FAKE_SUDO_CALLS="$BATS_TEST_TMPDIR/sudo-calls"
    : > "$FAKE_SUDO_CALLS"
    # Fake sudo: log the call, then run the command (as the current user).
    fake_cmd sudo 'echo "$*" >> "$FAKE_SUDO_CALLS"
while [[ "${1:-}" == -* ]]; do shift; done
exec "$@"'
    fake_cmd systemctl 'exit 0'
    fake_cmd avahi-daemon 'exit 0'

    ENV_FILE="$BATS_TEST_TMPDIR/.env"
    AVAHI_HOSTS="$BATS_TEST_TMPDIR/avahi-hosts"
    : > "$AVAHI_HOSTS"
}

@test "get_host_ip: 'a,b ' -> first IP, no whitespace" {
    printf 'HOST_IP=192.168.1.10,100.64.0.5 \n' > "$ENV_FILE"
    [ "$(get_host_ip)" = "192.168.1.10" ]
}

@test "get_host_ip: quoted 'a , b' -> first IP" {
    printf 'HOST_IP="192.168.1.10 , 100.64.0.5"\n' > "$ENV_FILE"
    [ "$(get_host_ip)" = "192.168.1.10" ]
}

@test "get_host_ip: single IP unchanged" {
    printf 'HOST_IP=192.168.1.10\n' > "$ENV_FILE"
    [ "$(get_host_ip)" = "192.168.1.10" ]
}

@test "get_host_ip: HOST_IPS takes precedence, first IP" {
    printf 'HOST_IPS=100.64.0.5,192.168.1.10\nHOST_IP=192.168.1.10\n' > "$ENV_FILE"
    [ "$(get_host_ip)" = "100.64.0.5" ]
}

@test "register_avahi_hostname: valid IPv4 -> entry has first IP only" {
    printf 'HOST_IP=192.168.1.10,100.64.0.5 \n' > "$ENV_FILE"
    register_avahi_hostname "myserver.local" "$(get_host_ip)" > /dev/null 2>&1
    [ "$(cat "$AVAHI_HOSTS")" = "192.168.1.10 myserver.local" ]
}

@test "register_avahi_hostname: non-IPv4 is rejected, nothing written, sudo not called" {
    for bad in "192.168.1.10,100.64.0.5" "999.1.1.1" "192.168.1" "not-an-ip" "192.168.1.10 extra"; do
        : > "$AVAHI_HOSTS"; : > "$FAKE_SUDO_CALLS"
        run register_avahi_hostname "myserver.local" "$bad"
        [ "$status" -ne 0 ]
        [ -z "$(cat "$AVAHI_HOSTS")" ]
        [ -z "$(cat "$FAKE_SUDO_CALLS")" ]
        [[ "$output" == *"not a valid IPv4"* ]] || return 1
    done
}

@test "register_avahi_hostname: ironwood.local present -> wood.local is still registered (#660)" {
    printf '10.0.0.1 ironwood.local\n10.0.0.1 woodXlocal\n' > "$AVAHI_HOSTS"
    register_avahi_hostname "wood.local" "192.168.1.10" > /dev/null 2>&1
    grep -qx '192.168.1.10 wood.local' "$AVAHI_HOSTS"
}

@test "register_avahi_hostname: exact wood.local present -> not added twice (#660)" {
    printf '10.0.0.1 wood.local\n' > "$AVAHI_HOSTS"
    run register_avahi_hostname "wood.local" "192.168.1.10"
    [ "$status" -eq 0 ]
    [ "$(cat "$AVAHI_HOSTS")" = "10.0.0.1 wood.local" ]
}

@test "register_avahi_hostname: wood.local only in a comment -> registered (#660)" {
    printf '# wood.local\n' > "$AVAHI_HOSTS"
    register_avahi_hostname "wood.local" "192.168.1.10" > /dev/null 2>&1
    grep -qx '192.168.1.10 wood.local' "$AVAHI_HOSTS"
}
