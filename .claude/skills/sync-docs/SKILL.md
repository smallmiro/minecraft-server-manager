---
description: "Syncs CLAUDE.md, README.md, prd.md, and the lightweight LLM knowledge base with the current codebase (문서 동기화)."
disable-model-invocation: true
model: sonnet
---

# Sync Project Documentation

This command analyzes the codebase and updates project documentation to reflect the current state.

## Target Files (Editable)

- `CLAUDE.md` - Project guide and development reference
- `README.md` - Main documentation and quick start guide
- `prd.md` - Product Requirements Document (if exists)
- `docs/documentforllmagent.md` - **LLM Knowledge Base** (auto-generated from docs/)

## Protected Files (DO NOT EDIT)

- `docs/itzg-reference/*` - All files under docs/itzg-reference/ directory are **READ-ONLY**
- These files are managed by `/update-docs` command

## Procedure

1. **Analyze Codebase**:
   - Read `platform/docker-compose.yml` and `platform/services/cli/templates/` for the current configuration
   - Identify new packages, commands, or directories
   - Check for new environment variables in use

2. **Generate docs/documentforllmagent.md** (LLM Knowledge Base):
   - Read version from `platform/services/cli/package.json`
   - Read all source docs (English only, exclude `.ko.md`)
   - Consolidate into single knowledge base document
   - Follow [references/kb-generation.md](references/kb-generation.md)
   - Update version and date in header

3. **Update CLAUDE.md**:
   - Fix rules, gotchas, and pointers that no longer match the code
   - Add only what a session cannot learn by reading the code. Every subagent loads this file, so skip directory listings, dependency lists, and standard commands

4. **Update README.md**:
   - Sync quick start example with actual docker-compose.yml
   - Update environment variable quick reference
   - Verify all internal links are valid
   - Update useful commands section if new patterns exist

5. **Update prd.md** (if exists):
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

## Analysis Checklist

- [ ] Read `platform/docker-compose.yml` for current configuration
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
- [ ] **docs/documentforllmagent.md auto-generation**:
  - [ ] Read version from `platform/services/cli/package.json`
  - [ ] Read all source docs in `docs/` (exclude `.ko.md`, `itzg-reference/`, `development/`, `usage/`)
  - [ ] Consolidate into structured sections (Overview, Commands, Use Cases, FAQ, etc.)
  - [ ] Keep under 400 lines for LLM context efficiency
  - [ ] Verify all command syntax matches CLI implementation

## Update Rules

1. **Preserve existing format** - Maintain markdown structure and style
2. **Add, don't remove** - Only remove content that is clearly obsolete
3. **Be conservative** - When uncertain, add a comment rather than modify
4. **Document changes** - Note what was updated in your response

## Important Notes

- **NEVER edit files in docs/itzg-reference/** - These are synced from official documentation
- **Always read files before editing** - Understand current content first
- **Preserve user customizations** - Don't overwrite intentional modifications
- **LLM 문서 입력은 영어만** - `documentforllmagent.md`는 영어 원본(`.ko.md` 제외)으로만 생성한다. 한국어 문서(`.ko.md`)는 별도로 유지한다.
- **docs/documentforllmagent.md is auto-generated** - Do not manually edit
  - Generated from docs/ source files (exclude `.ko.md`, `itzg-reference/`, `development/`)
  - Users upload this to ChatGPT/Gemini/Claude for mcctl Q&A
  - Always regenerate when docs/ content changes

## Execution

When this command is executed:
1. Analyze the codebase thoroughly
2. Compare with current documentation
3. **Generate docs/documentforllmagent.md** from source docs
4. Update target files (CLAUDE.md, README.md, prd.md)
5. Report what changes were made
