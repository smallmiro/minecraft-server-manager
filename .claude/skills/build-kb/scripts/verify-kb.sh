#!/bin/bash
# Checks docs/documentforllmagent.md against the /build-kb targets. Run from the repo root.
set -u
KB="${1:-docs/documentforllmagent.md}"
fail=0

lines=$(wc -l < "$KB")
echo "Lines: $lines (target 2500-3000)"
(( lines >= 2500 && lines <= 3000 )) || fail=1

for section in "Overview" "System Requirements" "Installation" "Architecture" "CLI Command" \
  "Server Types" "Configuration" "REST API" "Web Console" "itzg" "mc-router" "docker-compose" \
  "Common Use Cases" "Troubleshooting" "FAQ" "Version History" "Glossary" "External Resources"; do
  grep -qi "$section" "$KB" || { echo "MISSING: $section"; fail=1; }
done

if grep -n 'TODO\|PLACEHOLDER\|TBD\|FIXME' "$KB"; then
  echo "FAIL: placeholders found"
  fail=1
fi

(( fail == 0 )) && echo "OK"
exit "$fail"
