# Git Workflow

This project follows the Git-Flow branching strategy with Semantic Versioning. Every change starts from a GitHub issue and lands on `develop` through a pull request.

## Branches

```text
main      ← released state, updated from develop by maintainers
  │
develop   ← integration branch; every PR targets develop
  │
  ├── feature/<issue>-<description>   new features, improvements, refactoring
  ├── bugfix/<issue>-<description>    non-urgent bug fixes
  ├── release/<version>               release preparation (maintainers)
  └── hotfix/<version>                urgent production fixes (maintainers)
```

| Type | Pattern | Example | When |
|------|---------|---------|------|
| Feature | `feature/<issue>-<description>` | `feature/12-add-backup` | New features, improvements, refactoring |
| Bugfix | `bugfix/<issue>-<description>` | `bugfix/15-fix-lock` | Regular, non-urgent bugs |
| Release | `release/<version>` | `release/2.30.0` | Preparing a release |
| Hotfix | `hotfix/<version>` | `hotfix/2.30.1` | Production incidents, urgent bugs, risk of data loss |

Never commit directly to `develop` or `main`.

## Standard Workflow

1. Create the GitHub issue in the original repository (`smallmiro/minecraft-server-manager`) with Summary, Root Cause or Requirements, Solution / Implementation Plan, Files to Modify, and Acceptance Criteria as checkboxes.
2. Create a branch from an up-to-date `develop` in your fork, with the issue number in its name.
3. Implement with TDD and commit with the issue reference (`#<issue>`). Check off acceptance criteria as you go.
4. Open one PR per issue against `develop` of the original repository, with `Closes #<issue>` in the body.
5. Address review comments with new commits on the same branch.
6. After merge, delete the branch locally and on your fork.

Setup commands for the fork and the `upstream` remote are in the [Development Guide](index.md#fork-and-set-up).

## Commit Messages

```text
<type>: <description> (#<issue-number>)

<body>
```

A scope is optional, for example `feat(cli): add mod search (#123)`. Commits written with Claude Code end with a `Co-Authored-By: Claude ... <noreply@anthropic.com>` trailer.

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat: add world backup command (#12)` |
| `fix` | Bug fix | `fix: resolve lock file race condition (#15)` |
| `docs` | Documentation | `docs: update CLI reference (#20)` |
| `refactor` | Refactoring with no behavior change | `refactor: extract validation logic (#25)` |
| `test` | Tests | `test: add world locking tests (#30)` |
| `chore` | Maintenance, releases | `chore(release): bump version to v2.30.0` |

Avoid vague messages such as "fix", "update", or "changes".

## TDD

Every feature, bug fix, and improvement follows **Red → Green → Refactor**:

1. **Red**: write a failing test that defines the expected behavior.
2. **Green**: write the minimum code that makes it pass.
3. **Refactor**: clean up while the tests stay green.

PRs without tests are not accepted, except for documentation-only changes and configuration changes with no logic. Where tests live is listed in the [Development Guide](index.md#build-and-test).

## Tidy First

Never mix structural and behavioral changes in the same commit.

| Change type | Examples |
|-------------|----------|
| Structural | Rename, extract function, move file |
| Behavioral | New feature, bug fix, logic change |

```bash
# Good: two separate commits
git commit -m "refactor: extract validate_world function (#7)"
git commit -m "feat: add world existence check (#7)"

# Bad: mixed in one commit
git commit -m "feat: add validation with new helper function (#7)"
```

## Task Checkpoint (`task.md`)

`task.md` in the repository root is git-ignored and used for local work-in-progress notes. `/work` appends a checkpoint to it at each commit.

```markdown
## Working On
- [ ] Implementing lock.sh (#5)

## Context
- Branch: feature/5-world-locking

## Notes
- lock file format: <server>:<timestamp>:<pid>
```

Planning happens on GitHub: issue bodies hold the requirements and acceptance criteria, and `/plan-work` produces the plan for larger work.

## Semantic Versioning

The project follows [Semantic Versioning 2.0.0](https://semver.org/). All five npm packages (`@minecraft-docker/shared`, `mod-source-modrinth`, `mcctl`, `mcctl-api`, `mcctl-console`) and the root `package.json` share one version.

| Part | Increment when | Example |
|------|----------------|---------|
| **MAJOR** | Incompatible or breaking changes | `1.9.0` → `2.0.0` |
| **MINOR** | New backward-compatible features | `2.29.1` → `2.30.0` |
| **PATCH** | Backward-compatible bug fixes | `2.29.0` → `2.29.1` |

Incrementing MAJOR resets MINOR and PATCH to 0; incrementing MINOR resets PATCH to 0.

## Release Process

Releases are run by maintainers, usually through the `release-manager` agent.

1. **Branch**: create `release/<version>` from `develop`.
2. **Prepare**: in one `chore(release): bump version to v<version>` commit, bump the version in the root and all five package `package.json` files, add the version to `CHANGELOG.md`, copy it to `platform/services/cli/CHANGELOG.md`, update the Changelog section of `platform/services/cli/README.md` (shown on the npm page), and update `README.md` and `docs/documentforllmagent.md` as needed.
3. **Merge and tag**: merge the release branch into `develop`, then create and push an annotated tag.

    ```bash
    git tag -a v2.30.0 -m "Release v2.30.0"
    git push origin v2.30.0
    ```

4. **CI**: the `v*` tag triggers `.github/workflows/release.yml`, which builds the workspace, publishes the five packages to npm, creates the GitHub Release, and deploys the MkDocs site to GitHub Pages.
5. **Verify**: check that `npm view <package> version` returns the new version for all five packages. CI generates the release notes from the commit list, so apply curated notes only after CI finishes (`gh release edit v<version> --notes-file ...`).

### CI Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Every PR to `develop`/`main`, push to `develop`, called by `release.yml` | Build, lint, typecheck and test all packages; script tests on Linux and macOS; compose validation |
| `e2e.yml` | Daily at 03:00 KST, manual dispatch | Management Console E2E (Playwright) |
| `release.yml` | Push of a `v*` tag | Runs `ci.yml` first, then npm publish, GitHub Release, docs deploy |
| `deploy-website.yml` | Push to `main` touching `website/**`, manual dispatch | Deploy the landing page |

## Code Quality

- Remove duplication by extracting shared logic.
- Use names that describe intent.
- Keep each function to one responsibility.
- Keep commits small and atomic so they are easy to review and revert.
