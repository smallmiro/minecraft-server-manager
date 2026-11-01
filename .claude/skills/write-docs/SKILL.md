---
description: "Creates, translates, reviews, and syncs bilingual EN/KO MkDocs pages and the GitHub Wiki. Use for documentation under docs/ (문서 작성, 번역)."
argument-hint: "<create|translate|review|sync|wiki-sync> [path] [options]"
model: sonnet
---

# Technical Documentation Writer

Bilingual (English/Korean) technical documentation writer for MkDocs + Read the Docs.

## Commands

### Write New Document
```
/write-docs create <path> [--title "Title"] [--template basic|reference|tutorial|guide]

Example:
/write-docs create getting-started/installation --title "Installation Guide" --template guide
```

Creates both English and Korean versions:
- `docs/getting-started/installation.md`
- `docs/getting-started/installation.ko.md`

### Translate Existing Document
```
/write-docs translate <path> [--from en|ko] [--to en|ko]

Example:
/write-docs translate cli/commands --from en --to ko
```

### Review Documentation
```
/write-docs review <path> [--check grammar|technical|consistency|all]

Example:
/write-docs review getting-started/ --check all
```

### Sync Translations
```
/write-docs sync <path>

Example:
/write-docs sync .
```
Checks for missing translations and outdated content.

### Sync to GitHub Wiki
```
/write-docs wiki-sync [--dry-run]

Example:
/write-docs wiki-sync
/write-docs wiki-sync --dry-run
```
Syncs docs/ to GitHub Wiki repository. Automatically:
- Converts file paths to Wiki page names
- Updates internal links
- Creates/updates _Sidebar.md navigation
- Pushes changes to wiki repository

**Wiki File Mapping:**
| docs/ Path | Wiki Page |
|------------|-----------|
| `index.md` | `Home.md` |
| `index.ko.md` | `Home-ko.md` |
| `getting-started/quickstart.md` | `Getting-Started-Quickstart.md` |
| `cli/commands.ko.md` | `CLI-Commands-ko.md` |

**Naming Convention:**
- Directory separators (`/`) → hyphens (`-`)
- Capitalize first letter of each segment
- Korean suffix (`.ko.md`) → `-ko.md`

## Workflow

1. **Plan**: Identify documentation needs from issues/PRs
2. **Outline**: Create structure before writing
3. **Draft (EN)**: Write English version first
4. **Translate (KO)**: Create Korean version
5. **Review**: Technical and language review
6. **Test**: Verify all code examples
7. **Publish**: Commit and push to main repo
8. **Wiki Sync**: Run `/write-docs wiki-sync` to update GitHub Wiki

## Documentation Structure

### MkDocs i18n Pattern
```
docs/
├── index.md              # English (default)
├── index.ko.md           # Korean translation
├── section/
│   ├── page.md           # English
│   └── page.ko.md        # Korean
```

### File Naming Convention
- English: `{name}.md` (default)
- Korean: `{name}.ko.md` (suffix pattern)

## Writing Guidelines

### Style Principles
1. **Clarity First**: Technical accuracy over marketing language
2. **Task-Oriented**: Focus on what users need to accomplish
3. **Progressive Disclosure**: Start simple, add complexity gradually
4. **Code Examples**: Every concept includes working examples
5. **Consistent Terminology**: Use glossary terms consistently

### Korean Translation Rules
1. **Technical Terms**: Keep English for widely-used terms (Docker, Kubernetes, API)
2. **Commands/Code**: Never translate code, commands, or file paths
3. **Tone**: Use formal polite style (합니다/습니다)
4. **Headers**: Translate conceptually, not literally
5. **Examples**: Adapt cultural context where appropriate


Use the templates in [references/templates.md](references/templates.md).

## Quality Checklist

### Before Publishing
- [ ] Both English and Korean versions exist
- [ ] All code examples are tested and working
- [ ] Internal links are valid
- [ ] Images have alt text
- [ ] Consistent heading hierarchy (H1 → H2 → H3)
- [ ] No broken external links
- [ ] Terminology matches glossary
- [ ] Korean translation reviewed for natural flow
- [ ] GitHub Wiki synced (`/write-docs wiki-sync`)

### Technical Accuracy
- [ ] Commands work as documented
- [ ] Configuration options are current
- [ ] Version numbers are accurate
- [ ] Screenshots match current UI/output

## Integration with MkDocs

### Navigation Update
After creating new documents, update `mkdocs.yml`:

```yaml
nav:
  - Home: index.md
  - New Section:
      - New Page: section/page.md
```

### Local Preview
```bash
# Install dependencies
pip install -r requirements-docs.txt

# Start local server
mkdocs serve

# Build static site
mkdocs build
```

## Project-Specific Context

This project documents:
- **@minecraft-docker/mcctl**: CLI for managing Minecraft Docker servers
- **@minecraft-docker/shared**: Shared library with domain logic
- **Platform**: Docker Compose based multi-server infrastructure
- **Key Features**: mc-router, nip.io DNS, auto-scaling, world management
