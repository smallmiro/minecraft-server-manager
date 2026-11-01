#!/bin/bash
# Tests for verify-kb.sh. Run: bash .claude/skills/build-kb/scripts/verify-kb.test.sh
set -u
dir=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
failures=0

sections=("Overview" "System Requirements" "Installation" "Architecture" "CLI Command" "Server Types"
  "Configuration" "REST API" "Web Console" "itzg" "mc-router" "docker-compose" "Common Use Cases"
  "Troubleshooting" "FAQ" "Version History" "Glossary" "External Resources")

# Prints a KB that passes: every section heading plus enough body lines.
good_kb() {
  printf '## %s\n' "${sections[@]}"
  yes body | head -n "${1:-2600}"
}

check() {
  local name=$1 want=$2 file=$3
  bash "$dir/verify-kb.sh" "$file" > /dev/null
  local got=$?
  if [[ "$got" == "$want" ]]; then
    echo "  ok   - $name"
  else
    echo "  FAIL - $name (exit $got, want $want)"
    failures=$((failures + 1))
  fi
}

good_kb > "$tmp/good.md"
check "complete document passes" 0 "$tmp/good.md"

good_kb 100 > "$tmp/short.md"
check "too few lines fails" 1 "$tmp/short.md"

good_kb 3100 > "$tmp/long.md"
check "too many lines fails" 1 "$tmp/long.md"

grep -v 'Glossary' "$tmp/good.md" > "$tmp/missing.md"
check "missing section fails" 1 "$tmp/missing.md"

sed 's/^## //' "$tmp/good.md" > "$tmp/flat.md"
check "fewer than 18 headings fails" 1 "$tmp/flat.md"

{ cat "$tmp/good.md"; echo TODO; } > "$tmp/todo.md"
check "placeholder fails" 1 "$tmp/todo.md"

(( failures == 0 )) && echo "all passed"
exit "$failures"
