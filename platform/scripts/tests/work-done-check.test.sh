#!/bin/bash
# =============================================================================
# Tests for .claude/hooks/work-done-check.sh (the /work Stop hook)
# =============================================================================
# gh and git are replaced by stubs driven by files in a temp dir, so the hook's
# decision logic runs without network access.
#
# Run: bash platform/scripts/tests/work-done-check.test.sh
# =============================================================================

set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$(cd "$TEST_DIR/../../.." && pwd)/.claude/hooks/work-done-check.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"

cat > "$TMP/bin/gh" <<'STUB'
#!/bin/bash
[[ -f "$STUB_DIR/gh_fail" ]] && exit 1
case "$1 $2" in
    "api repos/{owner}/{repo}/milestones/3") cat "$STUB_DIR/open_count" ;;
    "api repos/{owner}/{repo}/milestones/99") exit 1 ;;
    "issue view") cat "$STUB_DIR/issue_body" ;;
    "pr list")
        if [[ "$*" == *"--state all"* ]]; then cat "$STUB_DIR/pr_count"; else cat "$STUB_DIR/merged_count"; fi ;;
    "issue list") cat "$STUB_DIR/open_issues" ;;
esac
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

# reset <state-file-content> : fresh stubs where everything is complete
reset() {
    rm -rf "$STUB_DIR"; mkdir -p "$STUB_DIR"
    printf -- '- [x] done\n' > "$STUB_DIR/issue_body"
    echo 1 > "$STUB_DIR/merged_count"
    : > "$STUB_DIR/open_issues"
    echo 0 > "$STUB_DIR/open_count"
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
printf -- '- [x] a\n- [ ] b\n' > "$STUB_DIR/issue_body"
assert_contains "unchecked box blocks" '"decision":"block"' "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=done\n'
echo 0 > "$STUB_DIR/merged_count"
assert_contains "unmerged PR blocks" "merge되지 않음" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=pending\n'
assert_contains "pending review blocks" "코드 리뷰 미완료" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=skipped\n'
assert_contains "skipped review is accepted" "완료 조건을 모두 충족" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=done\n'
echo ' M file.ts' > "$STUB_DIR/git_status"
assert_contains "dirty tree blocks" "커밋되지 않은 변경" "$(run)"

echo "contributor mode"
reset 'MODE=issue\nISSUE=7\nREVIEW=done\nROLE=contributor\n'
printf -- '- [ ] b\n' > "$STUB_DIR/issue_body"
echo 1 > "$STUB_DIR/pr_count"; echo 0 > "$STUB_DIR/merged_count"
assert_contains "open PR + unchecked boxes allows stop" "완료 조건을 모두 충족" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=done\nROLE=contributor\n'
echo 0 > "$STUB_DIR/pr_count"
assert_contains "no PR blocks" "PR이 아직 생성되지 않음" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=pending\nROLE=contributor\n'
echo 1 > "$STUB_DIR/pr_count"
assert_contains "pending review still blocks" "코드 리뷰 미완료" "$(run)"

reset 'MODE=issue\nISSUE=7\nREVIEW=done\n'
echo 1 > "$STUB_DIR/pr_count"; echo 0 > "$STUB_DIR/merged_count"
assert_contains "maintainer still requires merge" "merge되지 않음" "$(run)"

echo "milestone mode"
reset 'MODE=milestone\nMILESTONE=3\n'
echo '#4, #5' > "$STUB_DIR/open_issues"; echo 2 > "$STUB_DIR/open_count"
assert_contains "open issues block and are listed" "#4, #5" "$(run)"

reset 'MODE=milestone\nMILESTONE=3\n'
assert_contains "no open issues allows stop" "완료 조건을 모두 충족" "$(run)"

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
assert_file "no shared work-state file is created" "$PROJ/.claude/work-state" missing

echo
if (( FAILED == 0 )); then echo "all passed"; else echo "$FAILED failed"; exit 1; fi
