# Shared helpers for the bats tests. Load with: load helpers
# Portable on bash 3.2 / BSD userland: no GNU-only options in this file.

TESTS_DIR="$(cd "$BATS_TEST_DIRNAME" && pwd)"
SCRIPTS_DIR="$(dirname "$TESTS_DIR")"
