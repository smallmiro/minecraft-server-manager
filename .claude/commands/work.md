# GitHub Issue/Milestone Work Execution

This command executes development work based on GitHub Issues or Milestones following the project workflow.

## Usage

```bash
/project:work --issue <number>        # Single issue implementation
/project:work --milestone <number>    # All issues in milestone (Ralph Loop)
```

## Options

| Option | Description |
|--------|-------------|
| `--issue <N>` | Implement single issue #N |
| `--milestone <N>` | Process all issues in milestone N |
| `--dry-run` | Show plan only, no execution |
| `--skip-review` | Skip code review (emergency fixes only) |
| `--parallel` | Auto-detect and execute parallelizable issues |

---

## Single Issue Mode (`--issue`)

### Workflow

1. **Load Issue Context**
   ```bash
   gh issue view <number> --json number,title,body,labels,milestone
   ```
   - Read and understand issue requirements
   - Check for dependencies ("depends on #N", "blocked by #N")

2. **Prepare Work**
   - Create feature branch from `develop`:
     ```bash
     git checkout develop
     git pull origin develop
     git checkout -b feature/<number>-<description>
     ```
   - Initialize `task.md` with issue context

3. **Implementation (TDD Cycle)**
   - Red: Write failing test
   - Green: Implement minimal code
   - Refactor: Clean up

   **At each checkpoint:**
   - Commit with issue reference: `feat: <description> (#<number>)`
   - Update `task.md` history
   - Update `plan.md` checkbox (mark with ✅)
   - Update GitHub Issue body checkboxes:
     ```bash
     gh issue edit <number> --body "$(updated body with checked items)"
     ```

4. **Create Pull Request**
   ```bash
   gh pr create --base develop --title "<type>: <description> (#<number>)" --body "..."
   ```

5. **Code Review**
   - Execute `/code-review:code-review`
   - Address any feedback

6. **Merge (on approval)**
   ```bash
   gh pr merge --squash --delete-branch
   ```
   - Issue auto-closes via "Closes #N" in PR

---

## Milestone Mode (`--milestone`)

### Workflow

1. **Load Milestone Context** ⚠️ IMPORTANT
   ```bash
   gh api repos/{owner}/{repo}/milestones/<number>
   ```
   - Read milestone title, description, due date
   - **Remember the milestone goals throughout the work**
   - Ensure all implementations align with milestone objectives

2. **List Issues in Milestone**
   ```bash
   gh issue list --milestone <number> --state open --json number,title,body,labels
   ```

3. **Analyze Parallelization**

   **Parallel-capable (can run simultaneously):**
   - Different files/directories
   - No "depends on" references
   - No "blocked" label

   **Sequential-required:**
   - "depends on #N" or "blocked by #N" in body
   - Same file modifications expected
   - Phase order dependency

4. **Start Ralph Loop**
   ```bash
   /ralph-loop:ralph-loop
   ```
   - `max_iterations`: (issue count) + 3
   - Exit condition: All issues closed & merged

5. **Execute Each Issue**
   - Follow Single Issue workflow for each
   - Maintain milestone context throughout

---

## Checkpoint Updates

### task.md Format

```markdown
## Milestone: v0.2.0 - Infrastructure (if applicable)
**Goal**: Phase 1, 2 completion - Directory structure and Docker/Lazymc setup
**Issues**: #1, #2, #3, #4, #5, #6

---

### 2025-01-17 14:00 - Issue #1 (Create Directory Structure)
**Branch**: feature/1-directory-structure

#### Checkpoints
- [x] 14:00 - Branch created
- [x] 14:10 - servers/ directory created → commit abc1234
- [x] 14:15 - worlds/, shared/ created → commit def5678
- [x] 14:20 - PR #13 created
- [x] 14:25 - Code review passed
- [x] 14:30 - Merged

#### Updated Documents
- plan.md: Phase 1.1 ✅
- Issue #1: All checkboxes completed
```

### plan.md Update

```markdown
# Before
### 1.1 Create Directory Structure ([#1](...))

# After
### 1.1 Create Directory Structure ([#1](...)) ✅
```

### GitHub Issue Body Update

```bash
# Update checkbox in issue body
BODY=$(gh issue view 7 --json body -q .body)
UPDATED=$(echo "$BODY" | sed 's/- \[ \] Task item/- [x] Task item/')
gh issue edit 7 --body "$UPDATED"
```

---

## Parallelization Analysis

### Parallel-Capable Examples
| Issues | Reason |
|--------|--------|
| #8 mcctl.sh & #9 logs.sh | Different script files |
| #10 CLAUDE.md & #11 README.md | Different documentation files |

### Sequential-Required Examples
| Issues | Reason |
|--------|--------|
| #1 → #2 → #3 | Phase order dependency |
| #4 → #5 | docker-compose.yml needed before lazymc.toml |

---

## Execution Principles

1. **Follow CLAUDE.md workflow**: Git-Flow, TDD, Tidy First
2. **Atomic commits**: One logical change per commit
3. **Update tracking files**: task.md, plan.md, GitHub Issue
4. **Code review required**: Unless `--skip-review` specified
5. **Milestone alignment**: Keep work consistent with milestone goals

---

## Error Handling

| Situation | Action |
|-----------|--------|
| Test failure | Fix before proceeding, do not skip |
| Merge conflict | Resolve, re-run tests, then continue |
| Review rejection | Address feedback, push fixes, re-request review |
| Blocked issue | Skip for now, mark in task.md, process after dependency |

---

## Example Execution

### Single Issue
```
User: /project:work --issue 7

Claude:
1. Loading Issue #7: "Implement lock.sh"
2. Creating branch: feature/7-world-locking
3. Reading issue body for requirements...
4. Starting TDD implementation...
   [checkpoint] lock_world function → commit
   [checkpoint] unlock_world function → commit
   [checkpoint] tests passing → commit
5. Creating PR #15
6. Running code review...
7. Review passed, merging...
8. Issue #7 closed, branch deleted
```

### Milestone
```
User: /project:work --milestone 1

Claude:
1. Loading Milestone #1: "v0.2.0 - Infrastructure"
   Goal: Phase 1, 2 completion
   Issues: #1, #2, #3, #4, #5, #6

2. Parallelization analysis:
   - Sequential: #1 → #2 → #3 (Phase 1)
   - Sequential: #4 → #5 → #6 (Phase 2)

3. Starting Ralph Loop (max 9 iterations)...

4. Processing Issue #1...
   [... single issue workflow ...]

5. Processing Issue #2...
   [... continues until all closed ...]

6. Milestone complete!
```
