# Sync Project Documentation

This command analyzes the codebase and updates project documentation to reflect the current state.

## Target Files (Editable)

- `CLAUDE.md` - Project guide and development reference
- `README.md` - Main documentation and quick start guide
- `prd.md` - Product Requirements Document (if exists)
- `plan.md` - Implementation roadmap (if exists)
- `docs/documentforllmagent.md` - **LLM Knowledge Base** (ChatGPT/Gemini/Claude용)

## Protected Files (DO NOT EDIT)

- `docs/itzg-reference/*` - All files under docs/itzg-reference/ directory are **READ-ONLY**
- These files are managed by `/update-docs` command

## Procedure

1. **Analyze Codebase**:
   - Read `docker-compose.yml` and extract current configuration
   - Check `data/`, `config/`, `secrets/` directory structure
   - Identify any new files or directories
   - Check for new environment variables in use

2. **Update CLAUDE.md**:
   - Verify project structure section matches actual directory layout
   - Update environment variables table if new ones are used
   - Add new common tasks if patterns are found
   - Update troubleshooting section based on any issues encountered
   - Keep checklists current with project state

3. **Update README.md**:
   - Sync quick start example with actual docker-compose.yml
   - Update environment variable quick reference
   - Verify all internal links are valid
   - Update useful commands section if new patterns exist

4. **Update prd.md** (if exists):
   - Update feature list based on implemented configurations
   - Mark completed requirements (FR-xxx checkboxes)
   - Add discovered requirements from codebase analysis
   - **Verify FR completion status**:
     - Check CLI commands in `platform/services/cli/src/commands/`
     - Compare with FR acceptance criteria checkboxes
     - Update status badges (✅ Completed) for fully implemented features
   - **Update Implementation Plan phases**:
     - Check Phase completion status against actual implementation
     - Update Phase checkboxes based on code existence
   - **Update Migration Path (Section 9.9)**:
     - Verify which migration phases are completed
     - Check for adapter implementations, use cases, and commands
   - **Update Revision History**:
     - Add new entry when updating PRD
     - Format: `| x.x.x | YYYY-MM-DD | - | Description |`

5. **Update plan.md** (if exists):
   - Update phase status (In Progress → Completed)
   - Mark implementation tasks as done
   - Add new files to file checklist
   - Update architecture diagrams if structure changed

6. **Update docs/documentforllmagent.md** (LLM Knowledge Base) ⚠️ ALWAYS UPDATE:
   - This file is the knowledge base for **ChatGPT, Gemini, Claude** projects
   - Users upload this file to LLM projects for mcctl Q&A support
   - **MUST be updated whenever mcctl commands change**

   Update checklist:
   - [ ] Run `mcctl --help` to get current command list
   - [ ] Check for new commands in `platform/services/cli/src/commands/`
   - [ ] Update **Command Reference** section with new commands
   - [ ] Add examples for new features
   - [ ] Update **FAQ** section if new common questions arise
   - [ ] Update **Common Use Cases** if new workflows are added
   - [ ] Verify all command syntax matches current implementation
   - [ ] Update version number if changed

## Analysis Checklist

- [ ] Read docker-compose.yml for current configuration
- [ ] List all environment variables in use
- [ ] Check directory structure changes
- [ ] Identify new mods/plugins configured
- [ ] Check for new volume mounts
- [ ] Verify port mappings
- [ ] **prd.md specific**:
  - [ ] List CLI commands in `platform/services/cli/src/commands/`
  - [ ] Compare commands with FR acceptance criteria
  - [ ] Check implementation status of each FR feature
  - [ ] Verify Phase completion in Implementation Plan
  - [ ] Check Migration Path status (Section 9.9)
- [ ] **docs/documentforllmagent.md specific** (LLM Knowledge Base):
  - [ ] Run `mcctl --help` and compare with documented commands
  - [ ] Check for new command files in `platform/services/cli/src/commands/`
  - [ ] Verify all command syntax is up-to-date
  - [ ] Add new commands to Command Reference section
  - [ ] Update FAQ if new features need explanation
  - [ ] Add practical examples for new commands

## Update Rules

1. **Preserve existing format** - Maintain markdown structure and style
2. **Add, don't remove** - Only remove content that is clearly obsolete
3. **Be conservative** - When uncertain, add a comment rather than modify
4. **Document changes** - Note what was updated in your response

## Example Changes

### docker-compose.yml added new environment variable
```yaml
# Before (not in CLAUDE.md)
environment:
  CUSTOM_VAR: "value"

# After (add to CLAUDE.md environment variables table)
| `CUSTOM_VAR` | Optional | Custom configuration value |
```

### New directory created
```
# Before (CLAUDE.md project structure)
minecraft/
├── data/
└── config/

# After (update to reflect new directory)
minecraft/
├── data/
├── config/
└── backups/        # New: Backup storage
```

### prd.md FR feature implemented
```markdown
# Before (FR not checked)
#### FR-015: Player Management Commands
- **Acceptance Criteria**:
  - [ ] `mcctl whitelist <server> <add|remove|list|on|off> [player]`
  - [ ] `mcctl ban <server> <add|remove|list> [player]`

# After (verify commands exist in CLI, then check)
#### FR-015: Player Management Commands ✅
- **Status**: ✅ Completed
- **Acceptance Criteria**:
  - [x] `mcctl whitelist <server> <add|remove|list|on|off> [player]`
  - [x] `mcctl ban <server> <add|remove|list> [player]`
```

### prd.md Phase completed
```markdown
# Before
### Phase 5: Documentation
- [ ] Update `CLAUDE.md`
- [ ] Update `README.md`

# After (verify docs are up-to-date)
### Phase 5: Documentation ✅
- [x] Update `CLAUDE.md`
- [x] Update `README.md`
```

### docs/documentforllmagent.md - New mcctl command added
```markdown
# When a new command like 'mcctl mod' is added:

# 1. Add to Command Reference section
## mod search
Search for mods on Modrinth.
**Syntax**: `mcctl mod search <query> [--json]`
**Example**: `mcctl mod search sodium`

# 2. Add to FAQ section
### Q: How do I add mods to my server?
A: Use `mcctl mod add <server> <mod-name>` to add mods from Modrinth.

# 3. Add to Common Use Cases section
### Setting Up a Modded Server
1. Create server: `mcctl create myserver -t FORGE -v 1.20.4`
2. Search mods: `mcctl mod search lithium`
3. Add mods: `mcctl mod add myserver lithium sodium`
```

### docs/documentforllmagent.md - Why this file matters
```
┌─────────────────────────────────────────────────────────────┐
│  This file is uploaded to LLM projects (ChatGPT/Gemini/    │
│  Claude) so users can ask questions about mcctl.           │
│                                                             │
│  User: "How do I create a Forge server?"                   │
│  LLM: (reads documentforllmagent.md) → accurate answer     │
│                                                             │
│  ⚠️ If this file is outdated, LLMs give wrong answers!     │
│  ✅ ALWAYS update when mcctl commands change               │
└─────────────────────────────────────────────────────────────┘
```

## Important Notes

- **NEVER edit files in docs/itzg-reference/** - These are synced from official documentation
- **Always read files before editing** - Understand current content first
- **Preserve user customizations** - Don't overwrite intentional modifications
- **English only** - All documentation must be in English for open-source
- **⚠️ ALWAYS update docs/documentforllmagent.md** - This is the LLM knowledge base
  - Users rely on this file for ChatGPT/Gemini/Claude mcctl Q&A
  - Outdated information = wrong answers from LLMs
  - Update whenever mcctl commands are added, changed, or removed

## Execution

When this command is executed:
1. Analyze the codebase thoroughly
2. Compare with current documentation
3. Update only the target files (CLAUDE.md, README.md, prd.md, plan.md)
4. Report what changes were made
