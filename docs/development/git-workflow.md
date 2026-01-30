# Git Workflow Guide

This project follows Git-Flow branching strategy with strict conventions for commits, versioning, and development practices.

## Git-Flow Branching Strategy

```
main (production)
  │
  └── develop (integration)
        │
        ├── feature/xxx (new features)
        ├── bugfix/xxx (bug fixes)
        └── release/x.x.x (release preparation)
```

### Branch Naming Convention

| Branch Type | Pattern | Example |
|-------------|---------|---------|
| Feature | `feature/<issue-number>-<description>` | `feature/12-add-backup-script` |
| Bugfix | `bugfix/<issue-number>-<description>` | `bugfix/15-fix-lock-release` |
| Release | `release/<version>` | `release/1.0.0` |
| Hotfix | `hotfix/<issue-number>-<description>` | `hotfix/20-critical-fix` |

### Standard Workflow

1. Create GitHub Issue for task
2. Create feature branch from `develop`
3. Implement and commit with issue reference (`#issue-number`)
4. Create PR to `develop`
5. Merge after review
6. Delete feature branch

---

## Commit Message Format

```
<type>: <description> (#<issue-number>)

<body>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Commit Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat: add world backup command (#12)` |
| `fix` | Bug fix | `fix: resolve lock file race condition (#15)` |
| `docs` | Documentation | `docs: update CLI reference (#20)` |
| `refactor` | Code refactoring | `refactor: extract validation logic (#25)` |
| `test` | Tests | `test: add world locking tests (#30)` |
| `chore` | Maintenance | `chore: bump dependencies (#35)` |

---

## Semantic Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/).

**Format**: `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)

| Version | When to Increment | Example |
|---------|-------------------|---------|
| **MAJOR** | Incompatible API/breaking changes | `1.0.0` → `2.0.0` |
| **MINOR** | New features (backward compatible) | `1.0.0` → `1.1.0` |
| **PATCH** | Bug fixes (backward compatible) | `1.0.0` → `1.0.1` |

### Key Rules

- `0.x.x`: Initial development, API may change anytime
- `1.0.0`: First stable release, public API defined
- When MAJOR increments → reset MINOR and PATCH to 0
- When MINOR increments → reset PATCH to 0

### Pre-release & Build Metadata

```
1.0.0-alpha      # Pre-release (lower precedence than 1.0.0)
1.0.0-alpha.1    # Pre-release with identifier
1.0.0-beta       # Beta release
1.0.0-rc.1       # Release candidate
1.0.0+20250117   # Build metadata (ignored in precedence)
```

**Version Precedence**: `1.0.0-alpha` < `1.0.0-alpha.1` < `1.0.0-beta` < `1.0.0-rc.1` < `1.0.0`

---

## TDD (Test-Driven Development)

Follow the **Red → Green → Refactor** cycle:

1. **Red**: Write a failing test first
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Clean up while keeping tests green

```bash
# Example for Bash scripts
# 1. Write test case in tests/test_lock.sh
# 2. Run test - expect failure
# 3. Implement in scripts/lock.sh
# 4. Run test - expect success
# 5. Refactor and verify tests still pass
```

---

## Tidy First

**Never mix structural and behavioral changes in the same commit.**

| Change Type | Examples | Commit Separately |
|-------------|----------|-------------------|
| Structural | Rename, extract function, move file | Yes |
| Behavioral | New feature, bug fix, logic change | Yes |

### Good Example

```bash
# Two separate commits
git commit -m "refactor: extract validate_world function"
git commit -m "feat: add world existence check (#7)"
```

### Bad Example

```bash
# Mixed in one commit - AVOID THIS
git commit -m "feat: add validation with new helper function"
```

---

## Task Checkpoint (task.md)

During development, use `task.md` to track work-in-progress:

```markdown
# Current Task

## Working On
- [ ] Implementing lock.sh (#5)

## Context
- Started: 2025-01-17 14:00
- Branch: feature/5-world-locking

## Notes
- lock file format decided: <server>:<timestamp>:<pid>
- Need to handle stale locks

## Next Steps
- [ ] Test concurrent lock attempts
- [ ] Add to mcctl.sh
```

**Important**: `task.md` is in `.gitignore` - for local tracking only, not committed.

---

## Using plan.md

The `plan.md` file serves as the implementation roadmap:

1. **Before starting work**: Read `plan.md` to understand the overall architecture
2. **Check current phase**: Find the next unmarked task in the current phase
3. **Update as you go**: Mark completed items, add discovered tasks
4. **Sync with GitHub Issues**: Each phase/task maps to GitHub Issues

### Workflow

```bash
1. Read plan.md → Identify next task
2. Create GitHub Issue (if not exists)
3. Create feature branch
4. Implement following TDD
5. Mark task complete in plan.md
6. Commit and PR
```

---

## Code Quality Standards

- **Eliminate duplication**: Extract common patterns into reusable functions
- **Clear naming**: Variables and functions should be self-documenting
- **Single responsibility**: Each function does one thing well
- **Small commits**: Atomic changes that are easy to review and revert
