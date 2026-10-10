---
model: sonnet
hooks:
  Stop:
    - hooks:
        - type: command
          command: "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/work-done-check.sh"
---

# GitHub Issue/Milestone Work Execution

`/work` carries the given work through to completion on its own: branch, TDD implementation, PR, code review, merge. Invoking `/work` is the approval to do all of it.

## Usage

```bash
/work                         # Context mode: create issue from conversation and execute
/work --issue <number>        # Single issue implementation
/work --milestone <number>    # All issues in milestone
```

| Option | Description |
|--------|-------------|
| (none) | **Context Mode**: Analyze conversation, create GitHub issue, then execute |
| `--issue <N>` | Implement single issue #N |
| `--milestone <N>` | Process all issues in milestone N, in dependency order |
| `--dry-run` | Print the plan (issues, order, branches) and stop. No state file, no changes |
| `--skip-review` | Skip code review (emergency fixes only); records `REVIEW=skipped` |
| `--parallel` | Milestone mode only: run independent issues concurrently, each Agent with `isolation: "worktree"` |

---

## Completion Contract

A Stop hook (`.claude/hooks/work-done-check.sh`, declared in this file's frontmatter) checks the real GitHub/git state every time you try to stop, and sends you back to work with the list of unmet conditions. It reads `.claude/work-state` (gitignored). **Write it before starting work** (skip for `--dry-run`):

```bash
# Single issue (also used by Context mode, after the issue is created)
printf 'MODE=issue\nISSUE=%s\nREVIEW=pending\n' <N> > .claude/work-state
# Milestone
printf 'MODE=milestone\nMILESTONE=%s\n' <N> > .claude/work-state
```

| Mode | Work is complete when |
|------|-----------------------|
| issue | Issue body has no unchecked `- [ ]`, a PR for the issue is merged, `REVIEW` is `done` or `skipped`, no uncommitted changes |
| milestone | The milestone has no open issues, no uncommitted changes |

After the code review passes, record it: `sed -i.bak 's/^REVIEW=.*/REVIEW=done/' .claude/work-state && rm .claude/work-state.bak`.

The hook deletes the state file when the conditions are met. It gives up after 30 blocked stops and skips verification if `gh` fails. If you hit a blocker you cannot resolve (failing tests you cannot fix, a merge conflict needing a human decision), say so, delete `.claude/work-state`, and stop.

---

## Context Mode (no options)

1. Review the conversation and extract the task, requirements and acceptance criteria.
2. Create the issue:
   ```bash
   gh issue create --title "<type>(<scope>): <description>" --body "$(cat <<'EOF'
   ## Summary
   ## Requirements
   - [ ] <requirement>
   ## Acceptance Criteria
   - [ ] <criterion>
   ## Technical Notes
   ---
   *Auto-generated from conversation context*
   EOF
   )"
   ```
   Title prefixes: `feat`, `fix`, `refactor`, `docs`.
3. Continue with Single Issue Mode using the new issue number.

---

## Single Issue Mode

1. **Load context**: `gh issue view <N> --json number,title,body,labels,milestone`. Note dependencies ("depends on #N", "blocked by #N") and resolve them first. Write the state file.
2. **Prepare**: `git checkout develop && git pull origin develop && git checkout -b feature/<N>-<description>` (`bugfix/` for bug fixes). Initialize `task.md` with the issue context.
3. **Implement with TDD** (Red → Green → Refactor). At each checkpoint: commit as `<type>: <description> (#<N>)`, append to `task.md`, mark the item in `plan.md` if it tracks this issue.
4. **Issue checkboxes**: check items off as they are completed. Edit the body as a file instead of with `sed`, which breaks on special characters:
   ```bash
   f=$(mktemp); gh issue view <N> --json body -q .body > "$f"
   # edit $f: "- [ ] <task>" -> "- [x] <task>"
   gh issue edit <N> --body-file "$f"; rm "$f"
   ```
   Update after each commit that completes an item, and make sure every box is checked before the PR is created.
5. **E2E tests** for new or changed external behavior (see below). Run them before the PR.
6. **Create PR**: `gh pr create --base develop --title "<type>: <description> (#<N>)" --body "Closes #<N> ..."`.
7. **Code review**: run `/code-review:code-review`, fix every finding, push, then set `REVIEW=done`. Skipped with `--skip-review` (`REVIEW=skipped`).
8. **Merge**: `gh pr merge --merge --delete-branch` (the repository uses merge commits), then `git checkout develop && git pull origin develop`. Confirm the issue is closed and all boxes are checked.

---

## Milestone Mode

1. **Load context**: `gh api repos/{owner}/{repo}/milestones/<N>` and `gh issue list --milestone <N> --state open --json number,title,body,labels`. Keep the milestone goal in mind; every implementation must serve it. Write the state file.
2. **Order the issues**. Sequential: "depends on #N"/"blocked by #N", `blocked` label, same files, phase order. Parallel-capable: different files or directories with no dependency.
3. **Process each issue** with the Single Issue workflow, in order. Do not overwrite the milestone state file: skip the state-file steps (write, `REVIEW=done`) of the single-issue workflow; each issue still gets its own review.
4. **Blocked issue**: note it in `task.md`, continue with the others, return when its dependency is merged.

`--parallel`: dispatch the parallel-capable issues as separate Agents with `isolation: "worktree"`, then merge them one at a time and re-run tests after each.

---

## task.md

Local, gitignored progress log:

```markdown
## Milestone: v0.2.0 - Infrastructure (if applicable)
**Goal**: <milestone goal>
**Issues**: #1, #2, #3

### 2025-01-17 14:00 - Issue #1 (Create Directory Structure)
**Branch**: feature/1-directory-structure
- [x] 14:10 servers/ created → commit abc1234
- [x] 14:20 PR #13 created
- [x] 14:25 Code review passed
- [x] 14:30 Merged
```

---

## E2E Test Requirements

| Change | Location | Framework |
|--------|----------|-----------|
| New or changed REST API endpoint, response structure, query/body | `e2e/tests/api-*.spec.ts` | Playwright (`cd e2e && npx playwright test`) |
| New CLI command, flag, or output | `platform/services/cli/tests/e2e/cli-*.test.ts` | Vitest (`cd platform/services/cli && pnpm test:e2e`) |

Skip for documentation-only changes, internal refactoring without external behavior change, and bug fixes already covered by existing tests.

---

## Error Handling

| Situation | Action |
|-----------|--------|
| Test failure | Fix before proceeding; never skip or disable tests |
| Merge conflict | Resolve, re-run tests, continue |
| Review findings | Fix, push, re-run the review |
| Blocked issue | See Milestone Mode step 4 |
| Unresolvable blocker | Report it, delete `.claude/work-state`, stop |

Follow CLAUDE.md throughout: Git-Flow, TDD, Tidy First (structural and behavioral changes in separate commits), small atomic commits.
