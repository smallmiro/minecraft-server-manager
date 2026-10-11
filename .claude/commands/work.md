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
| `--contributor` | Fork/contributor mode: no merge; done = PR open + review done. Auto-detected when `viewerPermission` is not WRITE/MAINTAIN/ADMIN |
| `--skip-review` | Skip code review (emergency fixes only); records `REVIEW=skipped` |
| `--parallel` | Milestone mode only: run independent issues concurrently, each Agent with `isolation: "worktree"` |

---

## Completion Contract

A Stop hook (`.claude/hooks/work-done-check.sh`, declared in this file's frontmatter) checks the real GitHub/git state every time you try to stop, and sends you back to work with the list of unmet conditions. It reads `.claude/work-state.${CLAUDE_SESSION_ID}` (gitignored), one file per session, so concurrent sessions never block each other. **Write it before starting work** (skip for `--dry-run`):

```bash
# Single issue (also used by Context mode, after the issue is created)
printf 'MODE=issue\nISSUE=%s\nREVIEW=pending\n' <N> > .claude/work-state.${CLAUDE_SESSION_ID}
# Contributor (no write access): add ROLE=contributor
printf 'MODE=issue\nISSUE=%s\nREVIEW=pending\nROLE=contributor\n' <N> > .claude/work-state.${CLAUDE_SESSION_ID}
# Milestone
printf 'MODE=milestone\nMILESTONE=%s\n' <N> > .claude/work-state.${CLAUDE_SESSION_ID}
```

| Mode | Work is complete when |
|------|-----------------------|
| issue | Issue body has no unchecked `- [ ]`, a PR for the issue is merged, `REVIEW` is `done` or `skipped`, no uncommitted changes |
| issue, `ROLE=contributor` | A non-closed PR for the issue exists in the origin repo, `REVIEW` is `done` or `skipped`, no uncommitted changes (issue boxes and merge not required) |
| milestone | The milestone has no open issues, no uncommitted changes |

After the code review passes, record it: `sed -i.bak 's/^REVIEW=.*/REVIEW=done/' .claude/work-state.${CLAUDE_SESSION_ID} && rm .claude/work-state.${CLAUDE_SESSION_ID}.bak`.

The hook deletes the state file when the conditions are met. It gives up after 30 blocked stops and skips verification if `gh` fails. If you hit a blocker you cannot resolve (failing tests you cannot fix, a merge conflict needing a human decision), say so, delete `.claude/work-state.${CLAUDE_SESSION_ID}`, and stop.

**Concurrent sessions**: state is per session, but the checkout (branch, working tree) is still shared. Run parallel `/work` sessions in separate `git worktree` folders, not in one folder.

---

## Contributor Mode

Contributor mode is on with `--contributor`, or automatically when
`gh repo view --json viewerPermission -q .viewerPermission` is not `WRITE`, `MAINTAIN` or `ADMIN`. Write `ROLE=contributor` to the state file, then follow Single Issue Mode with these changes:

- Step 2: sync the fork's `develop` first (`git fetch upstream && git checkout develop && git merge --ff-only upstream/develop && git push origin develop`), then branch.
- Step 5: update issue checkboxes only if you can edit the issue; otherwise skip and list the completed items in the PR body.
- Step 7: push the branch to the fork and run `gh pr create --repo <origin> --base develop --head <user>:<branch> ...`.
- Step 9: do not merge. Done once the PR is open and the review is `done`.

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
   ## Files to Modify
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
3. **Route**: the main session acts as orchestrator. Pick the owner agent from the issue's `Files to Modify` and a tier from the tables in [Agent Routing](#agent-routing). T0 means do it yourself (add one line to the PR body: `직접 처리: <reason>`); otherwise delegate.
4. **Implement with TDD** (Red → Green → Refactor), by the assigned agent or by you for T0. At each checkpoint: commit as `<type>: <description> (#<N>)`, append to `task.md`, mark the item in `plan.md` if it tracks this issue.
5. **Issue checkboxes**: check items off as they are completed. Edit the body as a file instead of with `sed`, which breaks on special characters:
   ```bash
   f=$(mktemp); gh issue view <N> --json body -q .body > "$f"
   # edit $f: "- [ ] <task>" -> "- [x] <task>"
   gh issue edit <N> --body-file "$f"; rm "$f"
   ```
   Update after each commit that completes an item, and make sure every box is checked before the PR is created.
6. **E2E tests** for new or changed external behavior (see below). Run them before the PR.
7. **Create PR**: `gh pr create --base develop --title "<type>: <description> (#<N>)" --body "Closes #<N> ..."`.
8. **Code review**: run `/code-review:code-review`, fix every finding, push, then set `REVIEW=done`. Skipped with `--skip-review` (`REVIEW=skipped`).
9. **Merge**: `gh pr merge --merge --delete-branch` (the repository uses merge commits), then `git checkout develop && git pull origin develop`. Confirm the issue is closed and all boxes are checked.

---

## Agent Routing

Applies to Single Issue Mode step 3 (Milestone Mode inherits it per issue). Most specific path wins.

| Paths in `Files to Modify` | Owner |
|----------------------------|-------|
| `platform/services/shared/**`, `platform/services/mod-source-*/**` | core-agent |
| `platform/services/cli/**`, `platform/scripts/**`, `templates/**` | cli-agent |
| `platform/services/mcctl-api/**` | backend-agent |
| `platform/services/mcctl-console/**` | frontend-agent |
| rest of `platform/**`, `e2e/**`, `.github/workflows/**`, `.claude/hooks/**` (hook logic and its tests) | devops-agent |
| `docs/**`, `README*`, `CHANGELOG.md` | technical-writer |
| `.claude/commands/**`, `.claude/agents/**`, `CLAUDE.md`, `DEVELOPMENT.md`, prose only | handle directly; if they change together with logic files, the logic owner handles them too |

| Tier | Condition | Handling | `model` | `effort` |
|------|-----------|----------|---------|----------|
| T0 direct | 1 module, ≤2 files, no new public interface, bug has confirmed root cause; or typo/comment/instruction prose only | main session | - | - |
| T1 single | 1 module, 3-8 files, root cause confirmed | one owner agent | agent default | omit |
| T2 hardened | shared domain change, unconfirmed root cause, `security` label, data-loss risk, 9+ files | owner agent (analysis first if unconfirmed) | `opus` | `high` |
| T3 multi-module | 2 modules | delegate per module, core first, independent ones in parallel (worktree) | per module T1/T2 | per module T1/T2 |
| T4 design | 3+ modules, architecture change | `/plan-work` + architect, then T3 | architect `opus` | `high` |

Set `model` (aliases only) and `effort` only when the table gives a value that differs from the agent default.

**Delegation prompt** must contain: issue number and body, the checked-out branch, the files the agent owns, TDD, the commit format and Tidy First, and "commit at every checkpoint". Forbidden for the agent: switching branches, creating PRs or merging, editing the issue body, touching `.claude/work-state.${CLAUDE_SESSION_ID}`, invoking `/work`. It returns: commit SHAs, test results, completed items.

**Worktrees**: a single agent works on the feature branch directly, no worktree. Use `isolation: "worktree"` only for parallel delegation inside one issue, and merge those branches into the feature branch before the PR.

**Async delegation**: delegated agents run in the background. If the Stop hook blocks you while one is running, wait for its completion notification and do not edit its files yourself.

**Review fixes** (step 8): confirm you are back on the feature branch first (`/code-review` may leave a `pr-NNN` checkout). Fix small findings yourself; resume the same agent for large ones.

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
| Unresolvable blocker | Report it, delete `.claude/work-state.${CLAUDE_SESSION_ID}`, stop |

Follow CLAUDE.md throughout: Git-Flow, TDD, Tidy First (structural and behavioral changes in separate commits), small atomic commits.
