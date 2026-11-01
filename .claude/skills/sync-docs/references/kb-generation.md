# LLM Knowledge Base Generation

## Contents

- Sources and exclusions
- Generation rules
- Execution steps
- Source mapping

The `docs/documentforllmagent.md` file is **automatically generated** by aggregating user-facing documentation.

## Sources and exclusions

```
docs/
├── getting-started/     # ✅ Include (installation, quickstart)
├── configuration/       # ✅ Include (server-types, environment)
├── cli/                 # ✅ Include (commands reference)
├── mods-and-plugins/    # ✅ Include (modrinth, curseforge, etc.)
├── advanced/            # ✅ Include (backup, networking, rcon)
├── console/       # ✅ Include (API, web console)
├── itzg-reference/      # ❌ Exclude (external reference docs)
├── development/         # ❌ Exclude (developer-only docs)
└── usage/               # ❌ Exclude (legacy usage examples)
```

## Generation rules

1. **Read source docs** in this order:
   - `docs/getting-started/index.md`, `quickstart.md`, `installation.md`
   - `docs/configuration/index.md`, `server-types.md`, `environment.md`
   - `docs/cli/index.md`, `commands.md`
   - `docs/mods-and-plugins/index.md`, `modrinth.md`, `curseforge.md`, `spiget.md`, `direct-download.md`, `modpacks.md`
   - `docs/advanced/index.md`, `backup.md`, `networking.md`, `rcon.md`
   - `docs/console/index.md`, `installation.md`, `cli-commands.md`, `api-reference.md`, `web-console.md`

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

## Execution steps

```bash
# Step 1: Get current version
cat platform/services/cli/package.json | jq -r '.version'

# Step 2: Read source docs (English only)
for doc in getting-started configuration cli mods-and-plugins advanced console; do
  find docs/$doc -name "*.md" ! -name "*.ko.md"
done

# Step 3: Generate consolidated document
# Write to docs/documentforllmagent.md
```

## Source mapping

```
# Auto-generation reads these source files:
docs/getting-started/*.md     → Overview, Installation sections
docs/configuration/*.md       → Environment Variables section
docs/cli/*.md                 → Command Reference section (main source)
docs/mods-and-plugins/*.md    → Mod commands in Command Reference
docs/advanced/*.md            → FAQ, Troubleshooting sections
docs/console/*.md       → Console Management section

# Excludes:
docs/itzg-reference/          → External reference (managed by /update-docs)
docs/development/             → Developer-only documentation
docs/usage/                   → Legacy usage examples
*.ko.md                       → Korean translations
```
