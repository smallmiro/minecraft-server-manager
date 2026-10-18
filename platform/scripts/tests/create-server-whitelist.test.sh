#!/bin/bash
# =============================================================================
# Tests for create-server.sh whitelist options (#679)
# =============================================================================
# Whitelist is off by default. ENABLE_WHITELIST=TRUE / WHITELIST=... are
# written to config.env only when enabled, and at most once:
# - (no option)          -> disabled
# - --whitelist a,b      -> enabled + players
# - --enable-whitelist   -> enabled, no players
# - --no-whitelist       -> disabled (wins over --whitelist, any order)
# All three templates are checked: templates/, platform/servers/ and the
# npm-bundled platform/services/cli/templates/ (what mcctl actually uses).
#
# Runs the real script in a temp platform dir with fake docker/ip/hostname/sudo
# on PATH. HOST_IP resolves to empty, so avahi registration is skipped and no
# system file (/etc/avahi/hosts) is read or written.
#
# Run: bash platform/scripts/tests/create-server-whitelist.test.sh
# =============================================================================

set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(dirname "$TEST_DIR")"
REPO_DIR="$(cd "$SCRIPTS_DIR/../.." && pwd)"

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

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"

# Fake commands: docker succeeds silently; ip/hostname print nothing so
# HOST_IP is empty; sudo must never be reached (logged + fails).
printf '#!/bin/bash\nexit 0\n' > "$WORK/bin/docker"
printf '#!/bin/bash\nexit 0\n' > "$WORK/bin/ip"
printf '#!/bin/bash\nexit 0\n' > "$WORK/bin/hostname"
printf '#!/bin/bash\necho "$*" >> "%s/sudo.log"\nexit 1\n' "$WORK" > "$WORK/bin/sudo"
chmod +x "$WORK/bin/"*

PLATFORM="$WORK/platform"
mkdir -p "$PLATFORM/servers"
: > "$PLATFORM/docker-compose.yml"
cp -r "$REPO_DIR/platform/servers/_template" "$PLATFORM/servers/_template"

# create <templates-dir|""> <server> [options...]
# Empty templates-dir -> script uses $PLATFORM/servers/_template.
create() {
    local templates="$1" name="$2"
    shift 2
    env -u MCCTL_SUDO_PASSWORD \
        PATH="$WORK/bin:$PATH" \
        MCCTL_ROOT="$PLATFORM" \
        MCCTL_SCRIPTS="$SCRIPTS_DIR" \
        MCCTL_TEMPLATES="$templates" \
        bash "$SCRIPTS_DIR/create-server.sh" "$name" --no-start "$@" > "$WORK/$name.out" 2>&1
    echo $?
}

count() {
    grep -c "$1" "$PLATFORM/servers/$2/config.env"
}

run_cases() {
    local label="$1" templates="$2" p="$3"

    echo "# $label"

    assert_eq "$label: default exits 0" "0" "$(create "$templates" "${p}def")"
    assert_eq "$label: default -> no ENABLE_WHITELIST" "0" "$(count '^ENABLE_WHITELIST=' "${p}def")"
    assert_eq "$label: default -> no WHITELIST" "0" "$(count '^WHITELIST=' "${p}def")"

    create "$templates" "${p}wl" --whitelist a,b > /dev/null
    assert_eq "$label: --whitelist -> ENABLE_WHITELIST=TRUE once" "1" "$(count '^ENABLE_WHITELIST=TRUE$' "${p}wl")"
    assert_eq "$label: --whitelist -> WHITELIST=a,b once" "1" "$(count '^WHITELIST=a,b$' "${p}wl")"
    assert_eq "$label: --whitelist -> single ENABLE_WHITELIST line" "1" "$(count '^ENABLE_WHITELIST=' "${p}wl")"

    create "$templates" "${p}en" --enable-whitelist > /dev/null
    assert_eq "$label: --enable-whitelist -> ENABLE_WHITELIST=TRUE once" "1" "$(count '^ENABLE_WHITELIST=TRUE$' "${p}en")"
    assert_eq "$label: --enable-whitelist -> no WHITELIST" "0" "$(count '^WHITELIST=' "${p}en")"

    create "$templates" "${p}no" --no-whitelist > /dev/null
    assert_eq "$label: --no-whitelist -> no ENABLE_WHITELIST" "0" "$(count '^ENABLE_WHITELIST=' "${p}no")"

    create "$templates" "${p}nowl" --no-whitelist --whitelist a > /dev/null
    assert_eq "$label: --no-whitelist --whitelist -> disabled" "0" "$(count '^ENABLE_WHITELIST=' "${p}nowl")"
    assert_eq "$label: --no-whitelist --whitelist -> no WHITELIST" "0" "$(count '^WHITELIST=' "${p}nowl")"

    create "$templates" "${p}wlno" --whitelist a --no-whitelist > /dev/null
    assert_eq "$label: --whitelist --no-whitelist -> disabled" "0" "$(count '^ENABLE_WHITELIST=' "${p}wlno")"
}

run_cases "templates/" "$REPO_DIR/templates" "t"
run_cases "platform/servers/" "" "p"
run_cases "cli/templates/" "$REPO_DIR/platform/services/cli/templates" "c"

assert_eq "sudo never called" "no" "$([[ -f "$WORK/sudo.log" ]] && echo yes || echo no)"

echo ""
if [[ "$FAILED" -eq 0 ]]; then
    echo "All tests passed"
    exit 0
fi
echo "$FAILED test(s) failed"
exit 1
