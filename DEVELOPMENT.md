# Development Guide

This guide is for open-source developers who want to contribute to `minecraft-server-manager`. It covers the development rules, the issue-per-PR workflow (issue in the original repository, work in your fork, PR back to the original), and how to develop with Claude Code using this project's commands and subagents.

## At a Glance

```
Create issue in the original repo → Fork → Create branch → Tests first (TDD) → Implement → Open PR to the original repo → Address review → Merge
```

| Rule | Details |
|------|---------|
| Unit of work | **One issue = one branch = one PR** |
| Where things live | **Issues live in the original repository.** Work happens in your fork. The PR goes from your fork back to the original repository. |
| Base branch | `develop` (branch from `develop`, and open the PR against `develop`) |
| Method | TDD (Red → Green → Refactor), Tidy First |
| Architecture | Hexagonal / Clean Architecture |
| Documentation | Keep English (`.md`) and Korean (`.ko.md`) versions together |

---

## 1. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18 or later (CI uses 20) | All packages |
| pnpm | 9 (pinned in `packageManager`) | Monorepo management |
| Docker / Docker Compose | Engine 24+, Compose 2.20+ | Server containers, E2E |
| Git, GitHub CLI (`gh`) | Latest | Fork, issues, PRs |

Supported operating systems are Linux and macOS, because the `mcctl` CLI depends on bash scripts.

## 2. Fork and Set Up Locally

Create (or pick) the issue in the original repository first (section 4.1), then fork it.

```bash
# 1) Fork smallmiro/minecraft-server-manager on GitHub, then:
git clone https://github.com/<your-account>/minecraft-server-manager.git
cd minecraft-server-manager

# 2) Register the original repository as "upstream"
git remote add upstream https://github.com/smallmiro/minecraft-server-manager.git

# 3) Make gh target the original repository for issues and PRs
gh repo set-default smallmiro/minecraft-server-manager

# 4) Install dependencies and build
pnpm install
pnpm build
```

Before starting any work, bring `develop` up to date:

```bash
git checkout develop
git fetch upstream
git merge --ff-only upstream/develop
git push origin develop
```

## 3. Repository Layout

| Path | Description |
|------|-------------|
| `platform/services/shared/` | `@minecraft-docker/shared`: domain entities, value objects, use cases, ports/adapters |
| `platform/services/cli/` | `@minecraft-docker/mcctl`: the CLI (Hexagonal Architecture) |
| `platform/services/mcctl-api/` | Fastify REST API (port 5001) |
| `platform/services/mcctl-console/` | Next.js web UI (port 5000) |
| `platform/services/mod-source-modrinth/` | Modrinth adapter |
| `platform/scripts/` | Bash management scripts (tests in `platform/scripts/tests/`) |
| `templates/` | npm package templates used by `mcctl init` |
| `e2e/` | Playwright E2E tests |
| `docs/` | MkDocs documentation (English/Korean) |
| `.claude/` | Claude Code subagents, commands, and hooks |

## 4. Issue-Driven Development Rules

### 4.1 Create the issue first, in the original repository

Create the issue in the **original repository** (`smallmiro/minecraft-server-manager`), not in your fork. Search the existing issues first; if one already covers your change, comment on it instead of opening a duplicate. Create the issue yourself when you can: as its author you can edit its body, which is how the acceptance-criteria checkboxes are kept up to date. Include:

- **Summary**: the problem or feature
- **Root Cause** (bugs) or **Requirements** (features)
- **Solution / Implementation Plan**
- **Files to Modify**
- **Acceptance Criteria**: a checkbox list (`- [ ]`). Check items off as you progress.

Trivial one-line changes such as typo fixes may skip the issue.

### 4.2 Branches

In your fork, branch from `develop` and put the original repository's issue number in the name.

| Type | Pattern | Example |
|------|---------|---------|
| Feature, improvement, refactoring | `feature/<issue>-<description>` | `feature/12-add-backup` |
| Bug fix | `bugfix/<issue>-<description>` | `bugfix/15-fix-lock` |

Never work directly on `develop` or `main`.

### 4.3 TDD

Every feature, bug fix, and improvement starts with a test.

1. **Red**: write a failing test that defines the expected behavior.
2. **Green**: write the minimum code that makes it pass.
3. **Refactor**: clean up while the tests stay green.

PRs without tests are not accepted, except for documentation-only changes and configuration changes with no logic.

### 4.4 Tidy First

Never mix structural changes (refactoring) and behavioral changes (features, fixes) in one commit. Reviews get easier and rollbacks get safer.

```bash
git commit -m "refactor: extract validate_world function (#7)"
git commit -m "feat: add world existence check (#7)"
```

### 4.5 Commit messages

```
<type>: <description> (#<issue-number>)
```

`type` is one of `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. Avoid vague messages such as "fix", "update", or "changes".

### 4.6 Architecture rules

TypeScript code follows the layers: Presentation (CLI, API routes) → Application (use cases) → Domain (entities, value objects, ports) → Infrastructure (adapters for DB, external APIs, file system).

- The domain layer has no external dependencies.
- All I/O goes through adapters, and dependencies are injected.
- Details: [CLI Architecture](docs/development/cli-architecture.md)

### 4.7 Opening the PR

Push the branch to your fork, then open one PR per issue from your fork to `develop` of the original repository. `Closes #12` in the PR body links to the issue in the original repository.

```bash
git push -u origin feature/12-add-backup
gh pr create --repo smallmiro/minecraft-server-manager --base develop \
  --head <your-account>:feature/12-add-backup \
  --title "feat: add backup script (#12)" --body "Closes #12 ..."
```

PR checklist:

- [ ] All checkboxes in the issue are checked
- [ ] Tests were written first and all pass (`pnpm test`)
- [ ] `pnpm lint` and `pnpm build` pass
- [ ] E2E tests are added if externally visible behavior changed
- [ ] Documentation is updated in both English and Korean if users are affected
- [ ] Structural and behavioral changes are in separate commits

CI checks on PRs against `develop` must pass before merge. They are path-filtered:

| Workflow | Runs when | What it does |
|----------|-----------|--------------|
| `cli-test` | The PR touches `platform/services/cli/**` or `platform/services/shared/**` | Builds `mcctl` and its dependencies, runs the CLI tests |
| `shared-test` | The PR touches `platform/services/shared/**` | Runs the shared package tests |
| `e2e` | Daily at 03:00 KST and on manual dispatch, **not on PRs** | Starts mcctl-api and mcctl-console, runs the Playwright suite |

Because `e2e` does not run on PRs, run `pnpm test:e2e` locally when you change API or console behavior. CI does not run `pnpm lint`, so run it yourself.

## 5. Build and Test

```bash
pnpm build                                   # build everything
pnpm test                                    # all unit tests
pnpm lint                                    # lint everything

pnpm --filter @minecraft-docker/shared test  # a single package
pnpm --filter @minecraft-docker/mcctl test

pnpm test:e2e                                # Management Console E2E: mcctl-api + mcctl-console (Playwright)
cd platform/services/cli && pnpm test:e2e    # CLI E2E (Vitest)

bash platform/scripts/tests/<name>.test.sh   # bash script tests
```

Add E2E tests for new REST endpoints in `e2e/tests/api-*.spec.ts`, for console UI flows in `e2e/tests/*.spec.ts`, and for new CLI commands or options in `platform/services/cli/tests/e2e/cli-*.test.ts`.

## 6. Documentation

Update documentation together with any user-visible change. Keep an English page (`page.md`) and a Korean page (`page.ko.md`) as a pair. Do not translate code, commands, file paths, or variable names. The `/write-docs` command (see section 7) applies these rules.

Do not edit `docs/itzg-reference/` directly; it is synced from the official documentation.

---

## 7. Developing with Claude Code

This repository ships Claude Code configuration. Run `claude` from the repository root and `CLAUDE.md` (the development rules) plus the subagents and commands in `.claude/` are loaded automatically. There is nothing extra to install.

### 7.1 Setup

- Install Claude Code and sign in.
- Run `gh auth login` (used for issues and PRs), then `gh repo set-default smallmiro/minecraft-server-manager` so `gh` reads issues from and sends PRs to the original repository.
- `/work` uses `/code-review:code-review` for code review. Install the `code-review` plugin.
- Optional: set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` to run subagents as a team in parallel. Without it you can still parallelize with the `Agent` tool and git worktrees.

### 7.2 Commands

| Command | Purpose |
|---------|---------|
| `/plan-work` | Plan the work before starting (`--issue <N>`, `--milestone <N>`, `--issues <N1,N2>`). Plans only; does not execute. |
| `/work` | Run an issue or milestone **through to completion**: branch, TDD implementation, PR, and code review. |
| `/write-docs` | Write bilingual (English/Korean) technical documentation. |
| `/sync-docs` | Sync `CLAUDE.md`, `README.md`, and other docs with the code. |
| `/update-docs` | Refresh `docs/itzg-reference/` from the official documentation. |
| `/build-kb` | Analyze the source in depth and build an LLM knowledge base. |

### 7.3 Subagents

Specialized subagents are defined in `.claude/agents/`. Models are assigned by task difficulty.

| Agent | Responsibility | Model |
|-------|----------------|-------|
| `orchestrator-agent` | Entry point for all work. Analyzes the request, delegates to specialists, and coordinates them. | opus |
| `core-agent` | Domain design in `platform/services/shared/` | opus |
| `cli-agent` | `platform/services/cli/` and bash scripts | sonnet |
| `backend-agent` | `platform/services/mcctl-api/` (Fastify, OpenAPI) | sonnet |
| `frontend-agent` | `platform/services/mcctl-console/` (Next.js, React) | sonnet |
| `devops-agent` | Docker, CI, `e2e/` | sonnet |
| `technical-writer` | Bilingual documentation in `docs/` | sonnet |
| `release-manager` | Version tagging and releases (for maintainers) | sonnet |

### 7.4 Recommended flow

1. Describe what you want in conversation. By this repository's rules, requests are first received by `orchestrator-agent`, which analyzes them and delegates to specialists. No code is modified at this stage.
2. Create an issue from the analysis.
3. Plan with `/plan-work --issue <N>` and review the plan (`orchestrator-agent` runs it first on intake; inside `/work` it runs only for T4 work spanning 3+ modules).
4. Once you agree with the plan, run `/work --issue <N>`.
5. When the PR is open, read through the changes yourself and review them.

```text
> I want to add a sort option to the server list. Analyze it and create an issue.
> /plan-work --issue 42
> /work --issue 42
```

To hand a specific area to one agent, name it directly:

```text
> Use cli-agent to add a --dry-run option to the mcctl backup command (issue #42)
```

### 7.5 What `/work` does

Running `/work` is your approval to carry that work through to the end. The steps are:

1. Read the issue and create a branch from `develop`.
2. Implement with TDD. At each checkpoint it makes a commit that references the issue and updates the issue's checkboxes.
3. Add E2E tests when needed.
4. Open the PR, run the code review, and fix the findings.
5. Merge.

**Completion is enforced by a hook.** When it starts, `/work` records the job in `.claude/work-state.<session_id>` (git-ignored; one file per session, so concurrent sessions don't interfere). Every time Claude tries to stop, `.claude/hooks/work-done-check.sh` checks the real GitHub and git state. If conditions are unmet, it lists what remains and sends Claude back to work.

| Mode | Complete when |
|------|---------------|
| Issue | All checkboxes in the issue body are checked, the PR is merged, code review is done, and there are no uncommitted changes |
| Milestone | The milestone has no open issues and there are no uncommitted changes |

As safety valves, the check is skipped if `gh` fails, and the hook gives up after 30 blocked stops. If Claude hits a problem it cannot resolve, it reports the reason, deletes its `.claude/work-state.<session_id>`, and stops. Parallel `/work` sessions share the checkout's branch and working tree, so run them in separate `git worktree` folders.

### 7.6 Using `/work` from a fork

The intended flow is: the issue is in the original repository, you run Claude Code in your fork's clone, and the PR goes back to the original repository.

- Sync your fork's `develop` first (section 2). `/work` branches from `develop`, so a stale `develop` produces a stale branch.
- With `gh repo set-default` set (section 7.1), `/work` reads the issue and updates its checkboxes in the original repository. You can edit the body of issues you authored; for someone else's issue, ask a maintainer to check items off.
- `/work` detects that you lack write access to the original repository (or you can pass `--contributor`) and switches to contributor mode: it opens the PR from your fork, runs the code review, and does not merge. The hook treats the job as finished once the PR is open and reviewed; a maintainer performs the merge.

### 7.7 Ground rules

- Never edit `develop` or `main` directly. Always work on an issue branch.
- Never skip or comment out failing tests to make them pass.
- You own the changes Claude makes. Read `git diff` yourself before opening a PR.
- When several agents edit code at the same time, separate their working directories with `isolation: "worktree"` to avoid conflicts.

---

## 8. Review and Merge

- A maintainer reviews the PR. Address review comments by adding commits to the same branch.
- If the PR gets stale, pull `upstream/develop`, resolve conflicts, and re-run the tests.
- After merge, delete the working branch locally and on your fork.

```bash
git branch -d feature/12-add-backup
git push origin --delete feature/12-add-backup
```

## References

- [Git Workflow](docs/development/git-workflow.md): full description of branch, commit, and versioning rules
- [CLI Architecture](docs/development/cli-architecture.md): CLI layering
- [Agent Collaboration](docs/development/agent-collaboration.md): how the agents collaborate
- [CLI Commands](docs/cli/commands.md)
