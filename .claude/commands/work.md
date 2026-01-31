# GitHub Issue/Milestone Work Execution

This command executes development work based on GitHub Issues or Milestones following the project workflow.

## Usage

```bash
/project:work                         # Context mode: create issue from conversation and execute
/project:work --issue <number>        # Single issue implementation
/project:work --milestone <number>    # All issues in milestone (Ralph Loop)
```

## Options

| Option | Description |
|--------|-------------|
| (none) | **Context Mode**: Analyze conversation, create GitHub issue, then execute |
| `--issue <N>` | Implement single issue #N |
| `--milestone <N>` | Process all issues in milestone N |
| `--dry-run` | Show plan only, no execution |
| `--skip-review` | Skip code review (emergency fixes only) |
| `--parallel` | Auto-detect and execute parallelizable issues |

---

## Context Mode (no options)

When `/work` is invoked **without any options**, analyze the current conversation context and create a GitHub issue automatically.

### Workflow

1. **Analyze Conversation Context**
   - Review the conversation history
   - Identify the task/feature being discussed
   - Extract requirements, acceptance criteria, and implementation details

2. **Create GitHub Issue**
   ```bash
   gh issue create --title "<type>: <description>" --body "$(cat <<'EOF'
   ## Summary
   <extracted summary from conversation>

   ## Requirements
   - [ ] <requirement 1>
   - [ ] <requirement 2>

   ## Acceptance Criteria
   - [ ] <criteria 1>
   - [ ] <criteria 2>

   ## Technical Notes
   <any technical details discussed>

   ---
   *Auto-generated from conversation context*
   EOF
   )"
   ```

3. **Execute the Created Issue**
   - Automatically proceed with Single Issue Mode workflow
   - Use the newly created issue number

### Example

```
User: 로그인 페이지에 "비밀번호 찾기" 링크를 추가해주세요.
      클릭하면 이메일 입력 모달이 뜨고, 이메일로 재설정 링크를 보내야 해요.

User: /work

Claude:
1. Analyzing conversation context...
   - Task: Add "Forgot Password" feature to login page
   - Requirements: Link + Modal + Email sending

2. Creating GitHub Issue #175...
   Title: "feat(auth): add forgot password functionality"
   Body: [auto-generated from context]

3. Proceeding with Issue #175...
   [... single issue workflow continues ...]
```

### Issue Title Format

| Type | Prefix | Example |
|------|--------|---------|
| Feature | `feat(<scope>):` | `feat(auth): add forgot password` |
| Bug Fix | `fix(<scope>):` | `fix(login): resolve session timeout` |
| Refactor | `refactor(<scope>):` | `refactor(api): extract validation logic` |
| Docs | `docs(<scope>):` | `docs(readme): update installation guide` |

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
   - **Update GitHub Issue body checkboxes** (see details below)

4. **GitHub Issue Checkbox Updates** ⚠️ CRITICAL

   **When to update checkboxes:**
   - ✅ After completing each requirement item
   - ✅ After completing each acceptance criteria
   - ✅ After completing each sub-task in the issue body

   **How to update checkboxes:**
   ```bash
   # 1. Fetch current issue body
   BODY=$(gh issue view <number> --json body -q .body)

   # 2. Update specific checkbox (unchecked → checked)
   # Replace the exact task text that was completed
   UPDATED=$(echo "$BODY" | sed 's/- \[ \] <completed task>/- [x] <completed task>/')

   # 3. Apply the update
   gh issue edit <number> --body "$UPDATED"
   ```

   **Progress tracking pattern:**
   | Status | Checkbox | Example |
   |--------|----------|---------|
   | Not started | `- [ ]` | `- [ ] Implement login API` |
   | In progress | `- [ ]` + comment | `- [ ] Implement login API (WIP)` |
   | Completed | `- [x]` | `- [x] Implement login API` |

   **Example: Progressive updates during development**
   ```bash
   # Initial issue body:
   # - [ ] Create database schema
   # - [ ] Implement API endpoint
   # - [ ] Add unit tests
   # - [ ] Add E2E tests

   # After completing database schema:
   gh issue edit 175 --body "$(gh issue view 175 --json body -q .body | sed 's/- \[ \] Create database schema/- [x] Create database schema/')"

   # After completing API endpoint:
   gh issue edit 175 --body "$(gh issue view 175 --json body -q .body | sed 's/- \[ \] Implement API endpoint/- [x] Implement API endpoint/')"

   # Continue until all checkboxes are checked...
   ```

5. **Add E2E Tests** (if applicable)
   - For API changes: Add tests to `e2e/tests/api-*.spec.ts`
   - For CLI changes: Add tests to `platform/services/cli/tests/e2e/`
   - Run and verify tests pass before PR
   - **Update issue checkbox**: `- [x] Add E2E tests`

6. **Create Pull Request**
   ```bash
   gh pr create --base develop --title "<type>: <description> (#<number>)" --body "..."
   ```

7. **Code Review**
   - Execute `/code-review:code-review`
   - Address any feedback

8. **Merge (on approval)**
   ```bash
   gh pr merge --squash --delete-branch
   ```
   - Issue auto-closes via "Closes #N" in PR
   - **Final checkbox update**: Ensure ALL checkboxes in issue body are checked

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

### GitHub Issue Body Update ⚠️ IMPORTANT

Issue body checkboxes must be updated at each development checkpoint to reflect progress.

**Update Frequency:**
| Timing | Action |
|--------|--------|
| After each commit | Check completed items |
| Before PR creation | Verify all implementation items checked |
| After merge | Ensure 100% completion |

**Command Pattern:**
```bash
# Single checkbox update
BODY=$(gh issue view <number> --json body -q .body)
UPDATED=$(echo "$BODY" | sed 's/- \[ \] <task text>/- [x] <task text>/')
gh issue edit <number> --body "$UPDATED"
```

**Multiple checkboxes update (batch):**
```bash
# Update multiple items at once
BODY=$(gh issue view 7 --json body -q .body)
UPDATED=$(echo "$BODY" | \
  sed 's/- \[ \] Create component/- [x] Create component/' | \
  sed 's/- \[ \] Add styles/- [x] Add styles/' | \
  sed 's/- \[ \] Write tests/- [x] Write tests/')
gh issue edit 7 --body "$UPDATED"
```

**Progress indicator in comments:**
```bash
# Add progress comment to issue
gh issue comment 7 --body "Progress update: 3/5 tasks completed

✅ Create component
✅ Add styles
✅ Write tests
⬜ Add E2E tests
⬜ Update documentation"
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
6. **E2E tests required**: Add e2e tests for new features (see below)
7. **Issue checkbox sync**: Update GitHub issue body checkboxes at each checkpoint

---

## E2E Test Requirements

When implementing new features, **e2e tests must be added** for the following:

### API Endpoints (mcctl-api)
- Location: `e2e/tests/api-*.spec.ts`
- Framework: Playwright
- Required for:
  - New REST API endpoints
  - Modified API response structures
  - New query parameters or request bodies

**Example:**
```typescript
// e2e/tests/api-newfeature.spec.ts
test.describe('New Feature API', () => {
  test('should return correct structure', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/newfeature`);
    expect(response.status()).toBe(200);
  });
});
```

### CLI Commands (mcctl)
- Location: `platform/services/cli/tests/e2e/cli-*.test.ts`
- Framework: Vitest
- Required for:
  - New CLI commands
  - New command flags/options
  - Modified command output

**Example:**
```typescript
// tests/e2e/cli-newcmd.test.ts
describe('mcctl newcmd', () => {
  it('should display help', async () => {
    const result = await runCli(['newcmd', '--help']);
    expect(result.exitCode).toBe(0);
  });
});
```

### Test Scripts
```bash
# Run API e2e tests
cd e2e && npx playwright test

# Run CLI e2e tests
cd platform/services/cli && pnpm test:e2e
```

### When to Skip E2E Tests
- Documentation-only changes
- Internal refactoring with no external behavior change
- Bug fixes covered by existing tests

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
   Issue body checkboxes:
   - [ ] Implement lock_world function
   - [ ] Implement unlock_world function
   - [ ] Add unit tests
   - [ ] Add E2E tests

2. Creating branch: feature/7-world-locking

3. Reading issue body for requirements...

4. Starting TDD implementation...
   [checkpoint] lock_world function → commit
   → Update issue: ✅ Implement lock_world function

   [checkpoint] unlock_world function → commit
   → Update issue: ✅ Implement unlock_world function

   [checkpoint] tests passing → commit
   → Update issue: ✅ Add unit tests

5. Adding E2E tests...
   → Update issue: ✅ Add E2E tests

6. Creating PR #15
   Final issue state:
   - [x] Implement lock_world function
   - [x] Implement unlock_world function
   - [x] Add unit tests
   - [x] Add E2E tests

7. Running code review...

8. Review passed, merging...

9. Issue #7 closed, branch deleted
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
