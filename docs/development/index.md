# Development Guide

This guide covers the development environment, repository layout, and contribution workflow for `minecraft-server-manager`.

!!! tip "Contributor guide"
    The canonical contributor guide is [`DEVELOPMENT.md`](https://github.com/smallmiro/minecraft-server-manager/blob/develop/DEVELOPMENT.md) in the repository root. This page summarizes it for the documentation site.

## At a Glance

```text
Create issue in the original repo → Fork → Create branch → Tests first (TDD) → Implement → Open PR to the original repo → Address review → Merge
```

| Rule | Details |
|------|---------|
| Unit of work | **One issue = one branch = one PR** |
| Where things live | Issues live in the original repository. Work happens in your fork. The PR goes from your fork back to the original repository. |
| Base branch | `develop` (branch from `develop`, and open the PR against `develop`) |
| Method | TDD (Red → Green → Refactor), Tidy First |
| Architecture | Hexagonal / Clean Architecture |
| Documentation | Keep English (`.md`) and Korean (`.ko.md`) versions together |

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18 or later (CI uses 20) | All packages |
| pnpm | 9 (pinned in `packageManager`) | Monorepo management |
| Docker / Docker Compose | Engine 24+, Compose 2.20+ | Server containers, E2E |
| Git, GitHub CLI (`gh`) | Latest | Fork, issues, PRs |

Supported operating systems are Linux and macOS, because the `mcctl` CLI depends on bash scripts. `better-sqlite3` (a dependency of mcctl-console) is a native module, so some environments need a build toolchain (gcc, make, python).

## Fork and Set Up

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

### Running the CLI from Source

```bash
# Link the local build as the global mcctl command
cd platform/services/cli
pnpm link --global
mcctl --version

# Or run the build output directly
node platform/services/cli/dist/index.js --version
```

## Repository Layout

| Path | Description |
|------|-------------|
| `platform/services/shared/` | `@minecraft-docker/shared`: domain entities, value objects, use cases, ports/adapters |
| `platform/services/cli/` | `@minecraft-docker/mcctl`: the CLI (Hexagonal Architecture) |
| `platform/services/mcctl-api/` | `@minecraft-docker/mcctl-api`: Fastify REST API (port 5001) |
| `platform/services/mcctl-console/` | `@minecraft-docker/mcctl-console`: Next.js web UI (port 5000) |
| `platform/services/mod-source-modrinth/` | `@minecraft-docker/mod-source-modrinth`: Modrinth adapter |
| `platform/scripts/` | Bash management scripts (tests in `platform/scripts/tests/`) |
| `platform/services/cli/templates/` | Single source of the platform templates copied by `mcctl init` (`platform/docker-compose.yml` and `platform/servers/_template` link to it) |
| `e2e/` | Playwright E2E tests for the Management Console |
| `docs/` | MkDocs documentation (English/Korean) |
| `website/` | Project landing page |
| `.github/workflows/` | CI, release, and website deployment workflows |
| `.claude/` | Claude Code subagents, commands, and hooks |

### Packages and Build Order

`pnpm build` runs `pnpm -r build`, which builds the workspace packages in dependency order:

```text
1. @minecraft-docker/shared                (no workspace dependencies)
2. @minecraft-docker/mod-source-modrinth   (shared)
3. @minecraft-docker/mcctl                 (shared, mod-source-modrinth)
   @minecraft-docker/mcctl-api             (shared, mod-source-modrinth)
   @minecraft-docker/mcctl-console         (shared)
```

All five packages are published to npm with the same version when a release tag is pushed. See [Git Workflow](git-workflow.md#release-process).

## Scripts

### Root Level

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages in dependency order |
| `pnpm dev` | Run every package's `dev` script in parallel (`tsc --watch` for shared/cli, `tsx watch` for mcctl-api, `next dev -p 5000` for mcctl-console) |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run all unit tests |
| `pnpm clean` | Remove build outputs |
| `pnpm test:e2e` | Run the Management Console E2E suite (Playwright, mcctl-api + mcctl-console) |
| `pnpm test:e2e:ui` | Run the same suite in Playwright UI mode |

### Build and Test

```bash
pnpm build                                   # build everything
pnpm test                                    # all unit tests
pnpm lint                                    # lint everything

pnpm --filter @minecraft-docker/shared test  # a single package
pnpm --filter @minecraft-docker/mcctl test

pnpm test:e2e                                # Management Console E2E (Playwright)
cd platform/services/cli && pnpm test:e2e    # CLI E2E (Vitest)

pnpm test:scripts                            # bash script tests (bats, *.bats)
```

Add E2E tests for new REST endpoints in `e2e/tests/api-*.spec.ts`, for console UI flows in `e2e/tests/*.spec.ts`, and for new CLI commands or options in `platform/services/cli/tests/e2e/cli-*.test.ts`.

## Contribution Workflow

1. **Create the issue first, in the original repository.** Include Summary, Root Cause (bugs) or Requirements (features), Solution / Implementation Plan, Files to Modify, and Acceptance Criteria as a checkbox list. Trivial one-line changes such as typo fixes may skip the issue.
2. **Branch from `develop` in your fork**: `feature/<issue>-<description>` or `bugfix/<issue>-<description>`. Never work directly on `develop` or `main`.
3. **TDD**: write a failing test, make it pass with minimal code, then refactor. PRs without tests are not accepted, except for documentation-only changes and configuration changes with no logic.
4. **Tidy First**: never mix structural changes (refactoring) and behavioral changes (features, fixes) in one commit.
5. **Commit** as `<type>: <description> (#<issue-number>)`, where `type` is `feat`, `fix`, `docs`, `refactor`, `test`, or `chore`.
6. **Open one PR per issue** from your fork to `develop` of the original repository, with `Closes #<issue>` in the body.

```bash
git push -u origin feature/12-add-backup
gh pr create --repo smallmiro/minecraft-server-manager --base develop \
  --head <your-account>:feature/12-add-backup \
  --title "feat: add backup script (#12)" --body "Closes #12 ..."
```

### CI

PR checks against `develop` must pass before merge. `ci.yml` runs on every PR, with no path filter:

| Job | What it does |
|-----|--------------|
| `lint, typecheck, test` | Builds every package, then runs `pnpm lint`, `pnpm typecheck`, the tests of every package except `e2e`, and the cli `verify:package` drift check |
| `script tests` (ubuntu, macos) | `pnpm test:scripts` (bats) and `pnpm lint:scripts` (shellcheck) |
| `docker compose config` (platform, templates) | Validates both compose files |

`e2e.yml` runs daily at 03:00 KST and on manual dispatch, **not on PRs**: it starts mcctl-api and mcctl-console and runs the Playwright suite. Run `pnpm test:e2e` locally when you change API or console behavior.

Branch naming, commit rules, versioning, and the release process are described in [Git Workflow](git-workflow.md).

## Developing with Claude Code

The repository ships Claude Code configuration. Run `claude` from the repository root and `CLAUDE.md` plus the subagents, commands, and hooks in `.claude/` are loaded automatically.

| Command | Purpose |
|---------|---------|
| `/plan-work` | Plan the work before starting (`--issue <N>`, `--milestone <N>`, `--issues <N1,N2>`). Plans only; does not execute. |
| `/work` | Run an issue or milestone through to completion: branch, TDD implementation, PR, and code review. |
| `/write-docs` | Write bilingual (English/Korean) technical documentation. |
| `/sync-docs` | Sync `CLAUDE.md`, `README.md`, and other docs with the code. |
| `/update-docs` | Refresh `docs/itzg-reference/` from the official documentation. |
| `/build-kb` | Analyze the source in depth and build an LLM knowledge base. |

A typical flow: describe the change, create an issue from the analysis, plan larger work with `/plan-work --issue <N>`, then run `/work --issue <N>`. See [Agent Collaboration](agent-collaboration.md) for the subagents, the `/work` routing, and how completion is enforced.

## Architecture Overview

TypeScript code follows **Hexagonal Architecture** (Ports & Adapters) with **Clean Architecture** layering:

```text
+---------------------+
| Presentation Layer  |  CLI commands, API routes
+----------+----------+
           |
+----------v----------+
| Application Layer   |  Use cases, application services
+----------+----------+
           |
+----------v----------+
|    Domain Layer     |  Entities, value objects, ports
+----------+----------+
           |
+----------v----------+
| Infrastructure      |  Adapters: file system, Docker, external APIs
+---------------------+
```

- The domain layer has no external dependencies.
- All I/O goes through adapters, and dependencies are injected.

See [CLI Architecture](cli-architecture.md) for details.

## Related Documentation

- [`DEVELOPMENT.md`](https://github.com/smallmiro/minecraft-server-manager/blob/develop/DEVELOPMENT.md) - Full contributor guide
- [Git Workflow](git-workflow.md) - Branches, commits, versioning, and releases
- [CLI Architecture](cli-architecture.md) - CLI layering and how to add commands
- [Agent Collaboration](agent-collaboration.md) - Claude Code subagents and the `/work` workflow
- [CLI Commands](../cli/commands.md) - Complete CLI reference

## Troubleshooting

### Build Errors

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

### `mcctl` Not Found After Linking

```bash
# Check the global bin directory used by pnpm
pnpm bin --global

# Add it to PATH if needed (pnpm setup does this for you)
pnpm setup
```

### Docker Permission Denied

```bash
docker --version
docker compose version

# Add your user to the docker group
sudo usermod -aG docker $USER
newgrp docker
```
