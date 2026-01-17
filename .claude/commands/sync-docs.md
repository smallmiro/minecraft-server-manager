# Sync Project Documentation

This command analyzes the codebase and updates project documentation to reflect the current state.

## Target Files (Editable)

- `CLAUDE.md` - Project guide and development reference
- `README.md` - Main documentation and quick start guide
- `prd.md` - Product Requirements Document (if exists)

## Protected Files (DO NOT EDIT)

- `docs/*` - All files under docs/ directory are **READ-ONLY**
- These files are managed by `/project:update-docs` command

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
   - Mark completed requirements
   - Add discovered requirements from codebase analysis

## Analysis Checklist

- [ ] Read docker-compose.yml for current configuration
- [ ] List all environment variables in use
- [ ] Check directory structure changes
- [ ] Identify new mods/plugins configured
- [ ] Check for new volume mounts
- [ ] Verify port mappings

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

## Important Notes

- **NEVER edit files in docs/** - These are synced from official documentation
- **Always read files before editing** - Understand current content first
- **Preserve user customizations** - Don't overwrite intentional modifications
- **English only** - All documentation must be in English for open-source

## Execution

When this command is executed:
1. Analyze the codebase thoroughly
2. Compare with current documentation
3. Update only the target files (CLAUDE.md, README.md, prd.md)
4. Report what changes were made
