# Build LLM Knowledge Base (Deep)

Build the comprehensive LLM Knowledge Base (`docs/documentforllmagent.md`) through deep source code analysis. This produces a 2,500-3,000 line document covering all 18 sections with maximum depth.

> **This is NOT `/sync-docs`**. `/sync-docs` generates a lightweight (~400 line) KB from docs/ files only. `/build-kb` performs deep source code analysis to build a comprehensive knowledge base.

## Comparison

| Aspect | `/sync-docs` | `/build-kb` (this) |
|--------|-------------|---------------------|
| Purpose | Sync project docs (CLAUDE.md, README, etc.) | Deep LLM KB build only |
| Analysis | docs/ files only | Source code + docs + config + infra |
| Output Size | ~400 lines | 2,500-3,000 lines |
| Agents | None (direct execution) | orchestrator + technical-writer |
| Target | Multiple files | `docs/documentforllmagent.md` only |
| Use When | Quick docs refresh | Major version release, deep rebuild |

## Output File

`docs/documentforllmagent.md` - Single comprehensive knowledge base document

## 18-Section Structure

The output MUST contain all 18 sections in this order:

| # | Section | Key Sources |
|---|---------|-------------|
| 1 | Overview | README.md, docs/getting-started/index.md |
| 2 | System Requirements | CLAUDE.md, package.json engines |
| 3 | Installation & Quick Start | docs/getting-started/installation.md, quickstart.md |
| 4 | Architecture | docker-compose.yml, directory tree, connection flow |
| 5 | Complete CLI Command Reference | `cli/src/commands/**/*.ts` (ALL commands, options, examples) |
| 6 | Server Types | docs/configuration/server-types.md, shared domain |
| 7 | Configuration | .env.example, config.env, environment variables |
| 8 | REST API Reference | `mcctl-api/src/routes/**/*.ts` (ALL endpoints, curl examples) |
| 9 | Web Console | `mcctl-console/src/app/**/*` (pages, components, SSE) |
| 10 | itzg/minecraft-server Reference | docs/itzg-reference/, server-configuration-reference.md |
| 11 | mc-router Reference | docker-compose.yml mc-router config, docs |
| 12 | docker-compose.yml Examples | Server type templates, compose patterns |
| 13 | Common Use Cases | Step-by-step workflows from actual features |
| 14 | Troubleshooting | Symptom-diagnosis-solution format |
| 15 | FAQ | 50+ Q&A, categorized |
| 16 | Version History | CHANGELOG.md, git tags |
| 17 | Glossary | Domain-specific terms |
| 18 | External Resources & Links | GitHub, docs, Docker Hub, itzg docs |

---

## 3-Step Workflow

### Step 1: Deep Source Code Analysis (orchestrator-agent)

Use `orchestrator-agent` to launch parallel analysis agents. Each agent reads specific source paths and extracts structured data.

**Analysis Targets (run in parallel where possible):**

#### 1a. CLI Commands Analysis
- **Path**: `platform/services/cli/src/commands/**/*.ts`
- **Extract**: Command name, description, all options/flags with types and defaults, subcommands, examples
- **Depth**: Read every command file, document every option including hidden ones
- **Cross-reference**: `platform/services/cli/src/index.ts` for command registration

#### 1b. REST API Endpoints Analysis
- **Path**: `platform/services/mcctl-api/src/routes/**/*.ts`
- **Extract**: HTTP method, path, query params, request body schema, response schema, auth requirements
- **Also read**: `platform/services/mcctl-api/src/plugins/auth.ts` for auth modes
- **Also read**: `platform/services/mcctl-api/src/plugins/swagger.ts` for OpenAPI spec

#### 1c. Web Console Pages Analysis
- **Path**: `platform/services/mcctl-console/src/app/**/*`
- **Extract**: Page routes, components used, SSE connections, API calls, features per page
- **Also read**: `platform/services/mcctl-console/src/components/**/*`
- **Also read**: `platform/services/mcctl-console/src/hooks/**/*`

#### 1d. Domain Model Analysis
- **Path**: `platform/services/shared/src/domain/**/*.ts`
- **Extract**: Entities (Server, World, AuditLog), Value Objects (ServerName, ServerType, AuditAction), ports/interfaces
- **Also read**: `platform/services/shared/src/application/use-cases/**/*.ts`
- **Also read**: `platform/services/shared/src/application/ports/**/*.ts`

#### 1e. Infrastructure & Config Analysis
- **Path**: `platform/docker-compose.yml`
- **Also read**: `platform/.env.example`
- **Also read**: `platform/servers/_template/config.env`
- **Also read**: `platform/servers/_template/docker-compose.yml`
- **Also read**: `platform/scripts/**/*.sh`
- **Extract**: Service definitions, environment variables, volume mounts, network config, script capabilities

#### 1f. Version & Changelog
- **Path**: `platform/services/cli/package.json` (version)
- **Also read**: `CHANGELOG.md`
- **Also read**: Git tags via `git tag --sort=-version:refname | head -20`
- **Extract**: Current version, full release history with dates and changes

#### 1g. Server Configuration Reference
- **Path**: `docs/server-configuration-reference.md`
- **Also read**: `docs/itzg-reference/**/*.md`
- **Extract**: All itzg environment variables, server types, Java options, mod loaders

### Step 2: Gap Analysis (technical-writer agent)

Use `technical-writer` agent to compare Step 1 analysis results against the current `docs/documentforllmagent.md`.

**Tasks:**
1. Read current `docs/documentforllmagent.md` in full
2. For each of the 18 sections, identify:
   - Missing content (new commands, new API endpoints, new features)
   - Outdated content (changed options, removed features, version mismatch)
   - Incomplete content (missing examples, missing options, shallow coverage)
3. Read supplementary docs for context:
   - `docs/console/api-reference.md`
   - `docs/console/web-console.md`
   - `docs/cli/commands.md`
   - `docs/configuration/server-types.md`
   - `docs/configuration/environment.md`
   - `docs/advanced/networking.md`
   - `docs/advanced/backup.md`
4. Produce a gap report listing exactly what needs to be added, updated, or expanded

### Step 3: Full Document Generation (technical-writer agent)

Use `technical-writer` agent to write the complete `docs/documentforllmagent.md` using:
- Step 1 deep analysis data
- Step 2 gap report
- Existing document as baseline (preserve good content, fix gaps)

**Writing Rules:**

#### Header
```markdown
# mcctl - Docker Minecraft Server Management CLI

> **Version**: [from cli/package.json]
> **Last Updated**: [today's date YYYY-MM-DD]
> **Purpose**: Comprehensive knowledge base for LLM agents (ChatGPT, Gemini, Claude, NotebookLM) to answer all mcctl questions
```

#### Content Rules
1. **All 18 sections required** - Every section must have substantive content
2. **2,500-3,000 lines target** - Aim for maximum depth within this range
3. **Every CLI command documented** - ALL options, ALL flags, with examples
4. **Every API endpoint documented** - Method, path, params, request/response, curl example
5. **Code blocks for all commands** - Never describe a command without showing it
6. **Practical examples** - Show real-world usage, not just syntax
7. **Tables for structured data** - Environment variables, options, server types
8. **FAQ: 50+ Q&A minimum** - Categorized by topic (Installation, Configuration, Server Types, Mods, Networking, Troubleshooting)
9. **English only** - This is for LLM consumption, English maximizes compatibility
10. **No TODOs, no placeholders** - Every section must be complete

#### Section Depth Guidelines

| Section | Min Lines | Key Content |
|---------|-----------|-------------|
| 5. CLI Commands | 400+ | Every command with all options and examples |
| 7. Configuration | 200+ | Every env var with description and defaults |
| 8. REST API | 200+ | Every endpoint with curl examples and response schemas |
| 10. itzg Reference | 200+ | Autopause, mods, Java, volumes, healthcheck |
| 15. FAQ | 200+ | 50+ categorized Q&A pairs |

---

## Execution Procedure

When `/build-kb` is invoked:

### Phase 1: Preparation
```bash
# Get current version
cat platform/services/cli/package.json | jq -r '.version'

# Get current date
date +%Y-%m-%d

# Count current KB lines
wc -l docs/documentforllmagent.md
```

### Phase 2: Deep Analysis (Step 1)
Launch orchestrator-agent with parallel analysis tasks (1a through 1g).

Each analysis task should output structured findings like:
```
## CLI Command: create
- Description: Create a new Minecraft server
- Options:
  - --name, -n (string): Server name [required]
  - --type, -t (ServerType): Server type [default: VANILLA]
  - ...
- Subcommands: none
- Example: mcctl create myserver -t PAPER -v 1.21.1
```

### Phase 3: Gap Analysis (Step 2)
Launch technical-writer agent to compare analysis results with current document.

### Phase 4: Document Generation (Step 3)
Launch technical-writer agent to produce the final document.

### Phase 5: Verification
```bash
# Line count check (target: 2,500-3,000)
wc -l docs/documentforllmagent.md

# Section count check (must be >= 18)
grep -c "^## " docs/documentforllmagent.md

# Verify all 18 sections exist
for section in \
  "Overview" \
  "System Requirements" \
  "Installation" \
  "Architecture" \
  "CLI Command" \
  "Server Types" \
  "Configuration" \
  "REST API" \
  "Web Console" \
  "itzg" \
  "mc-router" \
  "docker-compose" \
  "Common Use Cases" \
  "Troubleshooting" \
  "FAQ" \
  "Version History" \
  "Glossary" \
  "External Resources"; do
  if grep -qi "$section" docs/documentforllmagent.md; then
    echo "OK: $section"
  else
    echo "MISSING: $section"
  fi
done

# Verify no placeholder content
grep -n "TODO\|PLACEHOLDER\|TBD\|FIXME" docs/documentforllmagent.md && echo "FAIL: Placeholders found" || echo "OK: No placeholders"
```

---

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
- **Agents handle the heavy lifting** - The orchestrator parallelizes analysis, technical-writer handles writing
