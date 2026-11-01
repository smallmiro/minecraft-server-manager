---
description: "Rebuilds docs/documentforllmagent.md through deep source analysis (2,500-3,000 lines). Use after major releases (LLM 지식 베이스 재구축)."
disable-model-invocation: true
model: opus
---

# Build LLM Knowledge Base (Deep)

Build the comprehensive LLM Knowledge Base (`docs/documentforllmagent.md`) through deep source code analysis. This produces a 2,500-3,000 line document covering all 18 sections with maximum depth.

> **This is NOT `/sync-docs`**. `/sync-docs` generates a lightweight (~400 line) KB from docs/ files only. `/build-kb` performs deep source code analysis to build a comprehensive knowledge base.

## Comparison

| Aspect | `/sync-docs` | `/build-kb` (this) |
|--------|-------------|---------------------|
| Purpose | Sync project docs (CLAUDE.md, README, etc.) | Deep LLM KB build only |
| Analysis | docs/ files only | Source code + docs + config + infra |
| Output Size | ~400 lines | 2,500-3,000 lines |
| Agents | None (direct execution) | Parallel analysis agents + technical-writer |
| Target | Multiple files | `docs/documentforllmagent.md` only |
| Use When | Quick docs refresh | Major version release, deep rebuild |

## Output File

`docs/documentforllmagent.md` - Single comprehensive knowledge base document

## Procedure

1. **Prepare**: read the version from `platform/services/cli/package.json`, today's date, and the current `wc -l docs/documentforllmagent.md`.
2. **Deep analysis**: run analysis tasks 1a through 1g as parallel `general-purpose` agents with `model: sonnet`. Each task reports structured findings:
   ```
   ## CLI Command: create
   - Description: Create a new Minecraft server
   - Options:
     - --name, -n (string): Server name [required]
     - --type, -t (ServerType): Server type [default: VANILLA]
   - Subcommands: none
   - Example: mcctl create myserver -t PAPER -v 1.21.1
   ```
3. **Gap analysis**: `technical-writer` compares the findings with the current document and reports what to add, update, or expand.
4. **Generate**: `technical-writer` writes the complete document from the findings, the gap report, and the existing document.
5. **Verify**: run `bash "${CLAUDE_SKILL_DIR}/scripts/verify-kb.sh"` from the repo root, fix what it reports, and run it again.

The section list, analysis targets, gap analysis tasks, and writing rules are in [references/kb-spec.md](references/kb-spec.md). Read it before step 2.

## Quality Checklist

- [ ] Version matches `platform/services/cli/package.json`
- [ ] Date is today's date
- [ ] All 18 sections present with substantive content
- [ ] Line count is 2,500-3,000
- [ ] Every CLI command from source code is documented
- [ ] Every REST API endpoint from source code is documented
- [ ] Web Console pages and features documented
- [ ] All environment variables documented with defaults
- [ ] Server types include comparison table
- [ ] FAQ has 50+ Q&A entries
- [ ] All code examples use proper code blocks
- [ ] No TODO/PLACEHOLDER/TBD content
- [ ] Table of Contents matches actual sections
- [ ] Internal consistency (command names, flags match throughout)

## Error Handling

| Situation | Action |
|-----------|--------|
| Source file not found | Skip and note in gap report |
| Section too short | Expand with examples and details |
| Line count < 2,500 | Add more examples, FAQ entries, troubleshooting |
| Line count > 3,000 | Consolidate verbose sections, remove redundancy |
| Missing CLI command | Re-read command files, ensure complete coverage |
| Verification fails | Fix and re-verify before completion |

## Important Notes

- **This command replaces the entire file** - It writes a complete new version of `docs/documentforllmagent.md`
- **Run after major releases** - Best used when significant features have been added
- **For quick updates use `/sync-docs`** - If only docs/ content changed, `/sync-docs` is faster
- **English only** - The KB file is English-only for maximum LLM compatibility
- **Agents handle the heavy lifting** - Parallel agents analyze, technical-writer writes
