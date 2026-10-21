# Shared helpers for the bats tests. Load with: load helpers
# Portable on bash 3.2 / BSD userland: no GNU-only options in this file.

TESTS_DIR="$(cd "$BATS_TEST_DIRNAME" && pwd)"
SCRIPTS_DIR="$(dirname "$TESTS_DIR")"
REPO_DIR="$(cd "$SCRIPTS_DIR/../.." && pwd)"

# Fake docker first on PATH; calls land in $FAKE_DOCKER_LOG (see fake-bin/docker).
use_fake_docker() {
    export FAKE_DOCKER_LOG="$BATS_TEST_TMPDIR/docker.log"
    : > "$FAKE_DOCKER_LOG"
    PATH="$TESTS_DIR/fake-bin:$PATH"
}

# fake_cmd <name> <body>: executable stub in $BATS_TEST_TMPDIR/bin (first on PATH).
fake_cmd() {
    mkdir -p "$BATS_TEST_TMPDIR/bin"
    printf '#!/bin/bash\n%s\n' "$2" > "$BATS_TEST_TMPDIR/bin/$1"
    chmod +x "$BATS_TEST_TMPDIR/bin/$1"
    case ":$PATH:" in *":$BATS_TEST_TMPDIR/bin:"*) ;; *) PATH="$BATS_TEST_TMPDIR/bin:$PATH" ;; esac
}

# Temp MCCTL_ROOT with servers/, worlds/, .env and docker-compose.yml.
make_platform() {
    PLATFORM="$BATS_TEST_TMPDIR/platform"
    mkdir -p "$PLATFORM/servers" "$PLATFORM/worlds"
    : > "$PLATFORM/.env"
    : > "$PLATFORM/docker-compose.yml"
    export MCCTL_ROOT="$PLATFORM" MCCTL_SCRIPTS="$SCRIPTS_DIR"
    unset MCCTL_SUDO_PASSWORD
}

# add_server <name>: servers/<name>/{config.env,docker-compose.yml}
add_server() {
    mkdir -p "$PLATFORM/servers/$1"
    echo "LEVEL=$1" > "$PLATFORM/servers/$1/config.env"
    : > "$PLATFORM/servers/$1/docker-compose.yml"
}

# Skips for scripts that are not yet macOS-portable (decision D-3 gaps).
require_gnu_sed() { sed --version > /dev/null 2>&1 || skip "script uses GNU 'sed -i' (not macOS-portable yet)"; }
require_flock() { command -v flock > /dev/null || skip "flock not installed (lock.sh needs it; absent on stock macOS)"; }
require_bash4() { [ "${BASH_VERSINFO[0]}" -ge 4 ] || skip "script needs bash >= 4 (declare -A); running ${BASH_VERSION}"; }
