#!/bin/bash
# =============================================================================
# /work Stop hook: keeps the session going until the recorded work is done.
# =============================================================================
# /work writes .claude/work-state.<session_id> (gitignored) when it starts:
#   MODE=issue|milestone   ISSUE=<n> | MILESTONE=<n>   REVIEW=pending|done|skipped
#   ROLE=contributor (optional, issue mode): no write access to the origin repo,
#   so done = PR open (or merged) + review done; checkboxes/merge not required.
# Each time Claude tries to stop, this hook checks the real GitHub/git state and
# blocks the stop with the list of unmet conditions. No state file = no-op.
#
# Safety valves: gh failure allows the stop; more than WORK_MAX_LOOPS blocks
# gives up; a met condition deletes the state file.
# =============================================================================

set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
MAX_LOOPS="${WORK_MAX_LOOPS:-30}"

# State is per session (.claude/work-state.<session_id>) so concurrent /work
# sessions in one checkout don't read, block on, or count loops for each other.
# Without a session_id in the hook input, fall back to the legacy shared file.
sid=$(jq -r '.session_id // empty' 2>/dev/null)  # top-level only; no jq = legacy shared file
STATE="${WORK_STATE_FILE:-$ROOT/.claude/work-state${sid:+.$sid}}"
[[ -f "$STATE" ]] || exit 0

get() { sed -n "s/^$1=//p" "$STATE" | tail -1; }
allow() { [[ -n "${1:-}" ]] && printf '{"systemMessage":"%s"}\n' "$1"; exit 0; }

loops=$(( $(get LOOPS) + 1 )) 2>/dev/null || loops=1
if (( loops > MAX_LOOPS )); then
    rm -f "$STATE"
    allow "/work: 반복 한도(${MAX_LOOPS}회)를 넘어 자동 진행을 중단합니다. 남은 작업을 확인하세요."
fi
{ grep -v '^LOOPS=' "$STATE"; echo "LOOPS=$loops"; } > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"

GH_FAIL="gh 조회에 실패해 완료 검증을 건너뜁니다."
missing=()

case "$(get MODE)" in
    issue)
        n=$(get ISSUE)
        body=$(gh issue view "$n" --json body -q .body 2>/dev/null) || allow "$GH_FAIL"
        if [[ "$(get ROLE)" == contributor ]]; then
            # Closed-unmerged PRs don't count. Fork PRs are listed by number, not branch.
            prs=$(gh pr list --state all --limit 100 --json title,headRefName,state \
                --jq "[.[] | select(.state != \"CLOSED\") | select((.title | contains(\"(#$n)\")) or (.headRefName | test(\"^(feature|bugfix)/$n-\")))] | length" \
                2>/dev/null) || allow "$GH_FAIL"
            (( ${prs:-0} > 0 )) || missing+=("이슈 #$n의 PR이 아직 생성되지 않음")
        else
            grep -qE '^[[:space:]]*- \[ \]' <<< "$body" \
                && missing+=("이슈 #$n 본문에 미완료 체크박스가 있음")
            merged=$(gh pr list --state merged --limit 100 --json title,headRefName \
                --jq "[.[] | select((.title | contains(\"(#$n)\")) or (.headRefName | test(\"^(feature|bugfix)/$n-\")))] | length" \
                2>/dev/null) || allow "$GH_FAIL"
            (( ${merged:-0} > 0 )) || missing+=("이슈 #$n의 PR이 아직 merge되지 않음")
        fi
        case "$(get REVIEW)" in
            done|skipped) ;;
            *) missing+=("코드 리뷰 미완료 (끝나면 REVIEW=done 기록)") ;;
        esac
        ;;
    milestone)
        m=$(get MILESTONE)
        # The milestones API fails on an unknown number; `gh issue list` would not.
        open_count=$(gh api "repos/{owner}/{repo}/milestones/$m" --jq .open_issues 2>/dev/null) \
            || allow "$GH_FAIL"
        if (( ${open_count:-0} > 0 )); then
            open=$(gh issue list --milestone "$m" --state open --limit 200 --json number \
                --jq '[.[].number | "#\(.)"] | join(", ")' 2>/dev/null) || open="${open_count}건"
            missing+=("마일스톤 $m에 열린 이슈: $open")
        fi
        ;;
    *)
        rm -f "$STATE"
        allow "/work: work-state의 MODE를 알 수 없어 검증을 건너뜁니다."
        ;;
esac

[[ -z "$(git -C "$ROOT" status --porcelain -uno 2>/dev/null)" ]] \
    || missing+=("커밋되지 않은 변경이 있음")

if (( ${#missing[@]} == 0 )); then
    rm -f "$STATE"
    allow "/work 완료 조건을 모두 충족했습니다."
fi

reason=$(IFS=';'; echo "${missing[*]}")
printf '{"decision":"block","reason":"/work 완료 조건 미충족 (%s/%s): %s. 남은 작업을 이어서 진행하세요."}\n' \
    "$loops" "$MAX_LOOPS" "$reason"
