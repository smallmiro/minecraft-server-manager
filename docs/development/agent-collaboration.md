# Agent Collaboration

This page describes how the Claude Code subagents and skills (slash commands) in `.claude/` work together on this repository: who owns what, how work is planned, how `/work` routes it, and how completion is enforced.

!!! note "Source of truth"
    The behavior described here is defined by the files in `.claude/agents/`, `.claude/skills/`, and `.claude/hooks/`, plus `CLAUDE.md` and `DEVELOPMENT.md` in the repository root. If this page and those files disagree, the files win.

## Overview and Principles

- **Issue-driven.** Every change starts from a GitHub Issue. One issue = one branch = one PR. See [Git Workflow](git-workflow.md).
- **Plan first, then execute.** `/plan-work` produces a plan and does not change code. `/work` executes.
- **Specialists own modules.** Each agent owns a set of paths. The main session receives requests and routes work to the owner.
- **No message bus.** Agents do not exchange messages through a runtime protocol. Work is handed over through the `Agent` tool call: the prompt in, the agent's final report out.
- **Progress lives in Git and GitHub.** Local progress is written to `task.md` (gitignored). Issue checkboxes track completed items.

## Agents

All agent definitions are in `.claude/agents/`. Each agent declares a `tools` allowlist and an `effort` level. Every agent except `orchestrator-agent` and `release-manager` sets `autoCompactWindow: 200000`, and `core-agent` also sets `maxTurns: 300`. Model names are aliases (`opus`, `sonnet`) so files do not need editing when a new model ships.

| Agent | Owns | Model | Effort | Label |
|-------|------|-------|--------|-------|
| `orchestrator-agent` | Coordinates work that spans three or more modules: plans, delegates, integrates. Does not write code. | opus | high | `agent:orchestrator` |
| `core-agent` | `platform/services/shared/`, `platform/services/mod-source-*/` (domain entities, value objects, use cases, ports/adapters) | sonnet | high | `agent:core` |
| `cli-agent` | `platform/services/cli/` | sonnet | medium | `agent:cli` |
| `backend-agent` | `platform/services/mcctl-api/` (Fastify, OpenAPI) | sonnet | medium | `agent:backend` |
| `frontend-agent` | `platform/services/mcctl-console/` (Next.js, React, MUI 5.x, Better Auth) | sonnet | medium | `agent:frontend` |
| `devops-agent` | Docker files and the rest of `platform/`, `e2e/`, `.github/workflows/`, `.claude/hooks/` | sonnet | medium | `agent:devops` |
| `technical-writer` | `docs/`, `README*`, `CHANGELOG.md` (English and Korean) | sonnet | medium | `agent:docs` |
| `release-manager` | Version bumps, `v*` tags, GitHub releases, post-release verification | sonnet | medium | `agent:release` |

The skills `/plan-work` and `/build-kb` also run on `opus`; `/work`, `/write-docs`, `/sync-docs`, and `/update-docs` run on `sonnet`. `/work` switches a single delegation to `opus` at tier T2 (see Routing tiers).

Notes on specific agents:

- `mcctl-console` runs natively under PM2, not in Docker.
- `release-manager` handles npm packages, not Docker images. Pushing a `v*` tag triggers `.github/workflows/release.yml`, which publishes five packages (`shared`, `mod-source-modrinth`, `mcctl-api`, `mcctl-console`, `mcctl`) and creates the GitHub Release.
- The `agent:*` values in the Label column are the label each agent definition declares in its Identity table.
- `orchestrator-agent` has no `Edit` or `Write` tool. It has `Agent` to dispatch the owner agents and `Skill` to run `/plan-work`. `technical-writer` has `Skill` for `/write-docs`, and `release-manager` has `Agent`.
- Design is done by the main session or the owner agent of the affected module. For UI and UX design, use the `frontend-design` skill before `frontend-agent` starts.

## Workflow

```mermaid
flowchart LR
    A[Request] --> B[Main session<br/>intake and analysis]
    B --> C[GitHub Issue]
    C --> D["/plan-work<br/>plan only"]
    D --> E{Plan approved?}
    E -- no --> D
    E -- yes --> F["/work<br/>branch, TDD, PR, review, merge"]
    F --> G[Done: Stop hook verifies]
```

1. **Intake.** By the repository rules in `CLAUDE.md`, the main session receives a request using the orchestrator protocol: it analyzes the request, identifies the affected modules, and delegates analysis to the owner agents. `orchestrator-agent` is only for coordinating work across three or more modules. No code is modified in this phase.
2. **Issue.** The analysis becomes a GitHub Issue (summary, root cause or requirements, plan, files to modify, branch strategy, acceptance criteria).
3. **Plan.** `/plan-work` produces a plan: work breakdown, dependencies, parallel groups, agent assignment, and an execution proposal (parallel `Agent` runs in worktrees, or sequential sub-agents). It never edits code or creates branches.
4. **Approval.** You review the plan.
5. **Execute.** `/work` carries the work through to completion. Invoking `/work` is the approval to branch, commit, open the PR, run the review, and merge.

### `/plan-work`

```bash
/plan-work                           # Plan from the conversation
/plan-work --issue <N>               # One issue
/plan-work --milestone <N>           # Every open issue in a milestone
/plan-work --issues <N1,N2,...>      # Several issues
```

### How "plan first" applies

- The main session analyzes a request, then plans it with `/plan-work` or turns it into an issue before delegating. `orchestrator-agent` runs `/plan-work` first and does not dispatch before the plan is approved.
- Inside `/work`, the main session routes by tier (below). It runs `/plan-work` itself only at tier T4. Smaller tiers use the issue's `Files to Modify` and go straight to implementation.

## `/work` Modes and Routing

```bash
/work                         # Context mode: create an issue from the conversation, then execute
/work --issue <N>             # Single issue
/work --milestone <N>         # All issues in a milestone, in dependency order
```

| Option | Description |
|--------|-------------|
| `--dry-run` | Print the plan (issues, order, branches) and stop. No state file, no changes. |
| `--contributor` | Fork mode: no merge. See the Contributor Mode section below. |
| `--skip-review` | Skip the code review (emergency fixes only). Records `REVIEW=skipped`. |
| `--parallel` | Milestone mode only. Run independent issues concurrently, each Agent with `isolation: "worktree"`. Branches are merged one at a time, with tests re-run after each. |

For a single issue, `/work`:

1. Loads the issue and writes the state file.
2. Creates `feature/<N>-<description>` (or `bugfix/...`) from an updated `develop`.
3. Routes the work (below) and implements it with TDD, committing as `<type>: <description> (#<N>)` at each checkpoint.
4. Ticks the issue checkboxes as items complete.
5. Adds E2E tests for new or changed external behavior (REST API: Playwright in `e2e/`; CLI: Vitest in `platform/services/cli/tests/e2e/`).
6. Opens the PR, runs `/code-review:code-review`, fixes every finding, and sets `REVIEW=done`.
7. Merges with a merge commit and returns to `develop`.

In milestone mode, each issue goes through the same steps. A blocked issue is noted in `task.md` and revisited after its dependency is merged.

### Module routing

The main session acts as the orchestrator. The most specific path wins.

| Paths in `Files to Modify` | Owner |
|----------------------------|-------|
| `platform/services/shared/**`, `platform/services/mod-source-*/**` | core-agent |
| `platform/services/cli/**` | cli-agent |
| `platform/services/mcctl-api/**` | backend-agent |
| `platform/services/mcctl-console/**` | frontend-agent |
| rest of `platform/**`, `e2e/**`, `.github/workflows/**`, `.claude/hooks/**` | devops-agent |
| `docs/**`, `README*`, `CHANGELOG.md` | technical-writer |
| `.claude/skills/**`, `.claude/agents/**`, `CLAUDE.md`, `DEVELOPMENT.md`, prose only | handled directly by the main session |

If prose files change together with logic files, the logic owner handles both.

### Routing tiers

| Tier | Condition | Handling |
|------|-----------|----------|
| T0 direct | One module, 2 files or fewer, no new public interface, confirmed root cause; or typo/comment/instruction prose only | Main session. The PR body gets one line noting the direct handling. |
| T1 single | One module, 3-8 files, confirmed root cause | One owner agent, default model |
| T2 hardened | New or changed entity, value object, or port in shared; unconfirmed root cause; `security` label; data-loss risk; or 9+ files | Owner agent (analysis first if the cause is unconfirmed), `model: opus`, `effort: high` |
| T3 multi-module | Two modules | Delegate per module, core first, independent parts in parallel (worktrees) |
| T4 design | Three or more modules, or architecture change | `/plan-work`, then T3 |

`model` and `effort` are set on the delegation only when the tier gives a value that differs from the agent's default.

!!! info "Not every task goes to an agent"
    Tier T0 work and prose-only files are handled by the main session. Small code-review findings are also fixed directly; large ones go back to the same agent. The rule is not "never touch another agent's files" but "route by the table, and do not edit files a running agent owns".

## Delegation Contract

A delegation prompt must contain:

- the issue number and body
- the branch that is already checked out
- the files the agent owns
- TDD, the commit format, and Tidy First (structural and behavioral changes in separate commits)
- "commit at every checkpoint"

The agent must **not**: switch branches, create PRs or merge, edit the issue body, touch the `work-state` file, or invoke `/work`.

The agent returns: commit SHAs, test results, and the list of completed items.

Delegated agents run in the background. If the Stop hook blocks the main session while one is running, wait for its completion notification and do not edit its files.

## Parallel Work

| Mechanism | When | Notes |
|-----------|------|-------|
| Single agent | One owner for the issue | Works directly on the feature branch. **No worktree.** |
| `Agent` tool + `isolation: "worktree"` | Parallel delegation (T3, or `--parallel` in milestone mode) | Each agent gets its own worktree. Merge the branches into the feature branch before the PR. |

Parallel work is parallel `Agent` runs, each with `isolation: "worktree"`, integrated one at a time: merge a branch, re-run the tests, then merge the next. Dependencies between tasks come from the plan (`/plan-work`), and the main session or `orchestrator-agent` passes each agent's result on to the next one.

Worktrees are for parallel delegation, not for every agent. Separately, concurrent `/work` **sessions** share one checkout's branch and working tree, so run them in separate `git worktree` folders.

## Completion Enforcement

`/work` declares a Stop hook in its frontmatter: `.claude/hooks/work-done-check.sh`. When `/work` starts (not for `--dry-run`), it writes `.claude/work-state.<session_id>` (gitignored; one file per session so concurrent sessions do not block each other):

```bash
# Issue mode
printf 'MODE=issue\nISSUE=%s\nREVIEW=pending\n' <N> > .claude/work-state.${CLAUDE_SESSION_ID}
# Milestone mode
printf 'MODE=milestone\nMILESTONE=%s\n' <N> > .claude/work-state.${CLAUDE_SESSION_ID}
```

Each time Claude tries to stop, the hook checks the real GitHub and git state and, if conditions are unmet, blocks the stop and lists what remains.

| Mode | Work is complete when |
|------|-----------------------|
| Issue | No unchecked `- [ ]` in the issue body, a PR for the issue is merged, `REVIEW` is `done` or `skipped`, no uncommitted changes |
| Issue, `ROLE=contributor` | A non-closed PR for the issue exists, `REVIEW` is `done` or `skipped`, no uncommitted changes |
| Milestone | The milestone has no open issues, no uncommitted changes |

Safety valves:

- The hook gives up after **30** blocked stops (`WORK_MAX_LOOPS` overrides the limit).
- If `gh` fails, verification is skipped.
- On an unresolvable blocker, the session reports it, deletes its state file, and stops.
- No state file means the hook does nothing.

## Contributor Mode

For people without write access to the original repository. It turns on with `--contributor`, or automatically when `gh repo view --json viewerPermission` reports something other than `WRITE`, `MAINTAIN`, or `ADMIN`. The state file gets `ROLE=contributor`, and the flow changes as follows:

- Sync the fork's `develop` first, then branch.
- Tick issue checkboxes only if you can edit the issue; otherwise list completed items in the PR body.
- Push to the fork and open the PR against the original repository's `develop`.
- Do not merge. The job is done when the PR is open and the review is `done`.

See `DEVELOPMENT.md` (section 7.6) in the repository root for the contributor-facing steps.

## Handoffs

Agents do not see each other's context. The main session or `orchestrator-agent` passes what one agent produced to the next one in the delegation prompt, and each agent returns its final report (commit SHAs, test results, completed items). `orchestrator-agent` tracks three sync points:

| Sync point | From | To | Purpose |
|------------|------|----|---------|
| Interface ready | `core-agent` | all | Shared types and ports can be used |
| API ready | `backend-agent` | `frontend-agent` | BFF routes can be built |
| Services ready | `backend-agent`, `frontend-agent` | `devops-agent` | E2E tests can run |

## Commands

Slash commands are skills: each one is defined in `.claude/skills/<name>/SKILL.md`.

| Command | Purpose | Started by |
|---------|---------|------------|
| `/plan-work` | Plan before starting (`--issue`, `--milestone`, `--issues`). Plans only. | You or an agent |
| `/work` | Run an issue or milestone through to completion: branch, TDD, PR, code review, merge. | You only |
| `/write-docs` | Write bilingual (English/Korean) technical documentation. | You or an agent |
| `/sync-docs` | Sync `CLAUDE.md`, `README.md`, and other docs with the code. | You only |
| `/update-docs` | Refresh `docs/itzg-reference/` from the official documentation. | You only |
| `/build-kb` | Analyze the source in depth and build an LLM knowledge base. | You only |

`/work`, `/build-kb`, `/sync-docs`, and `/update-docs` set `disable-model-invocation: true`, so the model cannot start them on its own. `/plan-work` and `/write-docs` stay available to agents because `orchestrator-agent` runs `/plan-work` and `technical-writer` runs `/write-docs`.

The contributor-facing description is in `DEVELOPMENT.md` (section 7). For the surrounding development rules, see the [Development Guide](index.md).

## Agent Prompt Files

| File | Agent |
|------|-------|
| `.claude/agents/orchestrator-agent.md` | Orchestrator |
| `.claude/agents/core-agent.md` | Core |
| `.claude/agents/cli-agent.md` | CLI |
| `.claude/agents/backend-agent.md` | Backend |
| `.claude/agents/frontend-agent.md` | Frontend |
| `.claude/agents/devops-agent.md` | DevOps |
| `.claude/agents/technical-writer.md` | Technical Writer |
| `.claude/agents/release-manager.md` | Release Manager |

To hand a specific area to one agent directly, name it in the conversation, for example: "Use cli-agent to add a `--dry-run` option to `mcctl backup` (issue #42)".
