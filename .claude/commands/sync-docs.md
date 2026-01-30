# Sync Project Documentation

This command analyzes the codebase and updates project documentation to reflect the current state.

## Target Files (Editable)

- `CLAUDE.md` - Project guide and development reference
- `README.md` - Main documentation and quick start guide
- `prd.md` - Product Requirements Document (if exists)
- `plan.md` - Implementation roadmap (if exists)
- `docs/documentforllmagent.md` - **LLM Knowledge Base** (auto-generated from docs/)

## Protected Files (DO NOT EDIT)

- `docs/itzg-reference/*` - All files under docs/itzg-reference/ directory are **READ-ONLY**
- These files are managed by `/update-docs` command

## LLM Knowledge Base Auto-Generation

The `docs/documentforllmagent.md` file is **automatically generated** by aggregating user-facing documentation.

### Source Files (English only, exclude `.ko.md`)

```
docs/
├── getting-started/     # ✅ Include (installation, quickstart)
├── configuration/       # ✅ Include (server-types, environment)
├── cli/                 # ✅ Include (commands reference)
├── mods-and-plugins/    # ✅ Include (modrinth, curseforge, etc.)
├── advanced/            # ✅ Include (backup, networking, rcon)
├── admin-service/       # ✅ Include (API, web console)
├── itzg-reference/      # ❌ Exclude (external reference docs)
├── development/         # ❌ Exclude (developer-only docs)
└── usage/               # ❌ Exclude (legacy usage examples)
```

### Generation Rules

1. **Read source docs** in this order:
   - `docs/getting-started/index.md`, `quickstart.md`, `installation.md`
   - `docs/configuration/index.md`, `server-types.md`, `environment.md`
   - `docs/cli/index.md`, `commands.md`
   - `docs/mods-and-plugins/index.md`, `modrinth.md`, `curseforge.md`, `spiget.md`, `direct-download.md`, `modpacks.md`
   - `docs/advanced/index.md`, `backup.md`, `networking.md`, `rcon.md`
   - `docs/admin-service/index.md`, `installation.md`, `cli-commands.md`, `api-reference.md`, `web-console.md`

2. **Extract and consolidate** into these sections:
   - **Overview**: Project purpose and capabilities
   - **Installation**: npm/pnpm install commands
   - **Command Reference**: All mcctl commands with syntax and examples
   - **Common Use Cases**: Step-by-step workflows
   - **FAQ**: Frequently asked questions
   - **Architecture**: System diagram (simplified)
   - **Environment Variables**: Key configuration options
   - **Troubleshooting**: Common issues and solutions
   - **Links**: GitHub, docs, Docker Hub

3. **Output format** (template):
   ```markdown
   # mcctl - Minecraft Server Management CLI

   > **Version**: [from package.json]
   > **Last Updated**: [current date]
   > **Purpose**: Knowledge base for LLM agents (ChatGPT, Gemini, Claude) to answer mcctl questions

   ## Overview
   [Consolidated from getting-started/index.md]

   ## Installation
   [From getting-started/installation.md]

   ## Command Reference
   [From cli/commands.md - ALL commands with syntax]

   ### Platform Management
   ### Server Management
   ### Server Configuration
   ### Player Management
   ### World Management
   ### Mod Management
   ### Backup Management
   ### Console Management (v2.0.0)

   ## Common Use Cases
   [Step-by-step examples from various docs]

   ## FAQ
   [Consolidated Q&A from across docs]

   ## Architecture
   [Simplified diagram]

   ## Environment Variables
   [Key variables table]

   ## Troubleshooting
   [Common issues from advanced/ and getting-started/]

   ## Links
   - GitHub, Documentation, Docker Hub
   ```

4. **Quality rules**:
   - Keep under 400 lines (LLM context-friendly)
   - Use code blocks for all commands
   - Include practical examples, not just syntax
   - Prioritize most-used commands
   - Skip verbose explanations, keep concise

### Execution Steps for LLM KB Generation

```bash
# Step 1: Get current version
cat platform/services/cli/package.json | jq -r '.version'

# Step 2: Read source docs (English only)
for doc in getting-started configuration cli mods-and-plugins advanced admin-service; do
  find docs/$doc -name "*.md" ! -name "*.ko.md"
done

# Step 3: Generate consolidated document
# Write to docs/documentforllmagent.md
```

## Procedure

1. **Analyze Codebase**:
   - Read `docker-compose.yml` and extract current configuration
   - Check `data/`, `config/`, `secrets/` directory structure
   - Identify any new files or directories
   - Check for new environment variables in use

2. **Generate docs/documentforllmagent.md** (LLM Knowledge Base):
   - Read version from `platform/services/cli/package.json`
   - Read all source docs (English only, exclude `.ko.md`)
   - Consolidate into single knowledge base document
   - Follow the template and quality rules defined above
   - Update version and date in header

3. **Update CLAUDE.md**:
   - Verify project structure section matches actual directory layout
   - Update environment variables table if new ones are used
   - Add new common tasks if patterns are found
   - Update troubleshooting section based on any issues encountered
   - Keep checklists current with project state

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

6. **Update plan.md** (if exists):
   - Update phase status (In Progress → Completed)
   - Mark implementation tasks as done
   - Add new files to file checklist
   - Update architecture diagrams if structure changed

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

### docs/documentforllmagent.md - Auto-generation process
```
# Auto-generation reads these source files:
docs/getting-started/*.md     → Overview, Installation sections
docs/configuration/*.md       → Environment Variables section
docs/cli/*.md                 → Command Reference section (main source)
docs/mods-and-plugins/*.md    → Mod commands in Command Reference
docs/advanced/*.md            → FAQ, Troubleshooting sections
docs/admin-service/*.md       → Console Management section

# Excludes:
docs/itzg-reference/          → External reference (managed by /update-docs)
docs/development/             → Developer-only documentation
docs/usage/                   → Legacy usage examples
*.ko.md                       → Korean translations
```

### docs/documentforllmagent.md - Why this file matters
```
┌─────────────────────────────────────────────────────────────┐
│  This file is auto-generated and uploaded to LLM projects  │
│  (ChatGPT/Gemini/Claude) for mcctl Q&A support.            │
│                                                             │
│  User: "How do I create a Forge server?"                   │
│  LLM: (reads documentforllmagent.md) → accurate answer     │
│                                                             │
│  ✅ Auto-generated from docs/ ensures consistency          │
│  ✅ Always reflects current CLI implementation             │
│  ✅ Single source of truth for LLM knowledge base          │
└─────────────────────────────────────────────────────────────┘
```

## Important Notes

- **NEVER edit files in docs/itzg-reference/** - These are synced from official documentation
- **Always read files before editing** - Understand current content first
- **Preserve user customizations** - Don't overwrite intentional modifications
- **English only** - All documentation must be in English for open-source
- **docs/documentforllmagent.md is auto-generated** - Do not manually edit
  - Generated from docs/ source files (exclude `.ko.md`, `itzg-reference/`, `development/`)
  - Users upload this to ChatGPT/Gemini/Claude for mcctl Q&A
  - Always regenerate when docs/ content changes

## Execution

When this command is executed:
1. Analyze the codebase thoroughly
2. Compare with current documentation
3. **Generate docs/documentforllmagent.md** from source docs
4. Update target files (CLAUDE.md, README.md, prd.md, plan.md)
5. Report what changes were made
