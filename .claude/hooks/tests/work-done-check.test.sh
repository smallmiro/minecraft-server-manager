#!/bin/bash
# =============================================================================
# Tests for .claude/hooks/work-done-check.sh (the /work Stop hook)
# =============================================================================
# gh and git are replaced by stubs driven by files in a temp dir, so the hook's
# decision logic runs without network access.
#
# Run: bash .claude/hooks/tests/work-done-check.test.sh
# =============================================================================

set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$(cd "$TEST_DIR/.." && pwd)/work-done-check.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"

cat > "$TMP/bin/gh" <<'STUB'
#!/bin/bash
# REST-only stub: `gh api <path> [--jq <filter>]` answers from JSON files and applies the
# hook's own --jq filter with jq, so the filters are tested too. Any other gh call fails,
# which keeps the hook off the GraphQL-backed subcommands (#789).
[[ -f "$STUB_DIR/gh_fail" ]] && exit 1
[[ "$1" == api ]] || exit 1
path="$2"; filter="."
shift 2
while [[ $# -gt 0 ]]; do [[ "$1" == --jq ]] && filter="$2"; shift; done
case "$path" in
    "repos/{owner}/{repo}/milestones/3") file=milestone ;;
    "repos/{owner}/{repo}/milestones/"*) exit 1 ;;
    "repos/{owner}/{repo}/issues?milestone=3&state=open&per_page=100") file=milestone_issues ;;
    "repos/{owner}/{repo}/issues/7") file=issue ;;
    "repos/{owner}/{repo}/pulls?state=all&per_page=100") file=pulls ;;
    "repos/{owner}/{repo}/pulls?state=closed&per_page=100") file=pulls_closed ;;
    *) exit 1 ;;
esac
jq -r "$filter" "$STUB_DIR/$file.json"
STUB
cat > "$TMP/bin/git" <<'STUB'
#!/bin/bash
cat "$STUB_DIR/git_status"
STUB
chmod +x "$TMP/bin/gh" "$TMP/bin/git"

export STUB_DIR="$TMP/stub" WORK_STATE_FILE="$TMP/work-state" PATH="$TMP/bin:$PATH"
FAILED=0

assert_contains() {
    local desc="$1" needle="$2" haystack="$3"
    if [[ "$haystack" == *"$needle"* ]]; then
        echo "  ok   - $desc"
    else
        echo "  FAIL - $desc"; echo "         expected to contain: '$needle'"; echo "         actual: '$haystack'"
        FAILED=$((FAILED + 1))
    fi
}

assert_empty() {
    local desc="$1" actual="$2"
    if [[ -z "$actual" ]]; then echo "  ok   - $desc"; else
        echo "  FAIL - $desc"; echo "         actual: '$actual'"; FAILED=$((FAILED + 1)); fi
}

assert_file() {
    local desc="$1" path="$2" want="$3"   # want: exists|missing
    if [[ ( "$want" == exists && -e "$path" ) || ( "$want" == missing && ! -e "$path" ) ]]; then
        echo "  ok   - $desc"; else echo "  FAIL - $desc"; FAILED=$((FAILED + 1)); fi
}

# JSON helpers for the REST stubs
issue_body() { jq -n --arg b "$1" '{body: $b}' > "$STUB_DIR/issue.json"; }
# pull <title> <head-ref> <state> <merged:true|false>
pull() { jq -n --arg t "$1" --arg r "$2" --arg s "$3" --argjson m "$4" \
    '{title: $t, head: {ref: $r}, state: $s, merged_at: (if $m then "2026-01-01T00:00:00Z" else null end)}'; }
set_pulls() {
    printf '%s\n' "$@" | jq -s . > "$STUB_DIR/pulls.json"
    jq '[.[] | select(.state == "closed")]' "$STUB_DIR/pulls.json" > "$STUB_DIR/pulls_closed.json"
}

# reset <state-file-content> : fresh stubs where everything is complete
reset() {
    rm -rf "$STUB_DIR"; mkdir -p "$STUB_DIR"
    issue_body '- [x] done'
    set_pulls "$(pull 'feat: x (#7)' 'feature/7-x' closed true)"
    echo '{"open_issues": 0}' > "$STUB_DIR/milestone.json"
    echo '[]' > "$STUB_DIR/milestone_issues.json"
    : > "$STUB_DIR/git_status"
    printf '%b' "$1" > "$WORK_STATE_FILE"
}
run() { bash "$HOOK" < /dev/null; }

echo "no state file"
rm -f "$WORK_STATE_FILE"
assert_empty "is a no-op" "$(run)"

echo "issue mode"
reset 'MODE=issue\nISSUE=7\nREVIEW=done\n'
out=$(run)
assert_contains "all conditions met allows stop" "완료 조건을 모두 충족" "$out"
assert_file "state file removed on completion" "$WORK_STATE_FILE" missing

reset 'MODE=issue\nISSUE=7\nREVIEW=done\n'
issue_body $'- [x] a\n- [ ] b'
assert_contains "unchecked box blocks" '"decision":"block"' "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=done\n'
set_pulls "$(pull 'feat: x (#7)' 'feature/7-x' open false)"
assert_contains "unmerged PR blocks" "merge되지 않음" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=pending\n'
assert_contains "pending review blocks" "코드 리뷰 미완료" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=skipped\n'
assert_contains "skipped review is accepted" "완료 조건을 모두 충족" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=done\n'
echo ' M file.ts' > "$STUB_DIR/git_status"
assert_contains "dirty tree blocks" "커밋되지 않은 변경" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=done\n'
set_pulls "$(pull 'feat: x (#7)' 'feature/7-x' closed false)"
assert_contains "a closed, unmerged PR is not a merge" "merge되지 않음" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=done\n'
set_pulls "$(pull 'feat: other' 'bugfix/7-fix' closed true)"
assert_contains "a merged bugfix/<n>- branch counts" "완료 조건을 모두 충족" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=done\n'
set_pulls "$(pull 'feat: x (#77)' 'feature/77-x' closed true)"
assert_contains "issue #77's PR does not count for #7" "merge되지 않음" "$(run)"

echo "contributor mode"
reset 'MODE=issue\nISSUE=7\nREVIEW=done\nROLE=contributor\n'
issue_body '- [ ] b'
set_pulls "$(pull 'feat: x (#7)' 'contributor:feature/7-x' open false)"
assert_contains "open PR + unchecked boxes allows stop" "완료 조건을 모두 충족" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=done\nROLE=contributor\n'
set_pulls
assert_contains "no PR blocks" "PR이 아직 생성되지 않음" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=pending\nROLE=contributor\n'
set_pulls "$(pull 'feat: x (#7)' 'feature/7-x' open false)"
assert_contains "pending review still blocks" "코드 리뷰 미완료" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=done\nROLE=contributor\n'
set_pulls "$(pull 'feat: x (#7)' 'feature/7-x' closed false)"
assert_contains "only a closed, unmerged PR blocks" "PR이 아직 생성되지 않음" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=done\n'
set_pulls "$(pull 'feat: x (#7)' 'feature/7-x' open false)"
assert_contains "maintainer still requires merge" "merge되지 않음" "$(run)"

echo "milestone mode"
reset 'MODE=milestone\nMILESTONE=3\n'
echo '{"open_issues": 2}' > "$STUB_DIR/milestone.json"
echo '[{"number": 4}, {"number": 5}]' > "$STUB_DIR/milestone_issues.json"
assert_contains "open issues block and are listed" "#4, #5" "$(run)"

reset 'MODE=milestone\nMILESTONE=3\n'
assert_contains "no open issues allows stop" "완료 조건을 모두 충족" "$(run)"

reset 'MODE=milestone\nMILESTONE=3\n'
echo '{"open_issues": 1}' > "$STUB_DIR/milestone.json"
echo '[{"number": 6, "pull_request": {"url": "x"}}]' > "$STUB_DIR/milestone_issues.json"
assert_contains "an open PR in the milestone is not an open issue" "완료 조건을 모두 충족" "$(run)"

reset 'MODE=milestone\nMILESTONE=99\n'
assert_contains "unknown milestone is not treated as complete" "건너뜁니다" "$(run)"

echo "safety valves"
reset 'MODE=issue\nISSUE=7\nREVIEW=done\n'
touch "$STUB_DIR/gh_fail"
assert_contains "gh failure allows stop" "건너뜁니다" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=pending\nLOOPS=30\n'
out=$(WORK_MAX_LOOPS=30 run)
assert_contains "loop cap gives up" "반복 한도" "$out"
assert_file "state removed after giving up" "$WORK_STATE_FILE" missing

reset 'MODE=issue\nISSUE=7\nREVIEW=pending\n'
run > /dev/null
assert_contains "loop counter is persisted" "LOOPS=1" "$(cat "$WORK_STATE_FILE")"

echo "concurrent sessions"
# Sessions A and B share one checkout; state is keyed by the session_id in the hook input.
PROJ="$TMP/proj"; mkdir -p "$PROJ/.claude"
run_as() { WORK_STATE_FILE= CLAUDE_PROJECT_DIR="$PROJ" bash "$HOOK" <<< "{\"session_id\":\"$1\"}"; }
reset 'MODE=issue\nISSUE=7\nREVIEW=pending\n'
cp "$WORK_STATE_FILE" "$PROJ/.claude/work-state.A"
assert_empty "session B is not blocked by session A's state" "$(run_as B)"
assert_contains "session B's stop leaves A's LOOPS untouched" "REVIEW=pending" "$(cat "$PROJ/.claude/work-state.A")"
assert_empty "A's LOOPS not incremented by B" "$(grep LOOPS "$PROJ/.claude/work-state.A")"
assert_contains "session A is still blocked by its own state" '"decision":"block"' "$(run_as A)"
assert_contains "A's LOOPS counted in its own file" "LOOPS=1" "$(cat "$PROJ/.claude/work-state.A")"
run_as A > /dev/null
assert_contains "A's LOOPS keeps counting" "LOOPS=2" "$(cat "$PROJ/.claude/work-state.A")"
# a session_id-looking string inside another field must not hijack the lookup
out=$(WORK_STATE_FILE= CLAUDE_PROJECT_DIR="$PROJ" bash "$HOOK" <<< '{"session_id":"A","last_assistant_message":"x \"session_id\": \"Z\" y"}')
assert_contains "nested session_id text does not bypass the hook" '"decision":"block"' "$out"
assert_file "no shared work-state file is created" "$PROJ/.claude/work-state" missing

echo
if (( FAILED == 0 )); then echo "all passed"; else echo "$FAILED failed"; exit 1; fi
