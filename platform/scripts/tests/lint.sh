#!/bin/bash
# Lint gate for platform/scripts (pnpm lint:scripts), using shellcheck.
# Gates at severity=error (baseline: 0). warning/info/style counts and how to
# raise the bar: see DEVELOPMENT.md "Bash script tests".
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v shellcheck > /dev/null; then
    echo "shellcheck not found. Install it: 'brew install shellcheck' (macOS) or 'sudo apt-get install shellcheck' (Debian/Ubuntu)." >&2
    exit 127
fi

shellcheck -x --severity=error -- lib/*.sh tests/lint.sh
echo "shellcheck $(shellcheck --version | sed -n 's/^version: //p'): OK"
