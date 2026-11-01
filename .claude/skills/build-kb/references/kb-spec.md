# Knowledge Base Specification

## Contents

- 18-section structure
- Analysis targets
- Gap analysis
- Writing rules

## 18-section structure

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
| 10 | itzg/minecraft-server Reference | docs/itzg-reference/, docs/configuration/server-types.md |
| 11 | mc-router Reference | docker-compose.yml mc-router config, docs |
| 12 | docker-compose.yml Examples | Server type templates, compose patterns |
| 13 | Common Use Cases | Step-by-step workflows from actual features |
| 14 | Troubleshooting | Symptom-diagnosis-solution format |
| 15 | FAQ | 50+ Q&A, categorized |
| 16 | Version History | CHANGELOG.md, git tags |
| 17 | Glossary | Domain-specific terms |
| 18 | External Resources & Links | GitHub, docs, Docker Hub, itzg docs |

## Analysis targets

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
- **Extract**: Service definitions, environment variables, volume mounts, network config

#### 1f. Version & Changelog
- **Path**: `platform/services/cli/package.json` (version)
- **Also read**: `CHANGELOG.md`
- **Also read**: Git tags via `git tag --sort=-version:refname | head -20`
- **Extract**: Current version, full release history with dates and changes

#### 1g. Server Configuration Reference
- **Path**: `docs/configuration/server-types.md`, `docs/configuration/environment.md`, `docs/configuration/server-yaml.md`
- **Also read**: `docs/itzg-reference/**/*.md`
- **Extract**: All itzg environment variables, server types, Java options, mod loaders

## Gap analysis

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

## Writing rules

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
