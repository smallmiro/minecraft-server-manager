# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.13] - 2026-01-31

### Fixed
- Sync CHANGELOG.md to CLI package for npm page display
- Add automatic CHANGELOG sync to release workflow

## [1.6.12] - 2026-01-31

### Fixed
- **Critical**: Add missing `EXTRA_ARGS=--universe /worlds/` to npm package template (#165)
  - **Problem**: Servers created with `mcctl create` stored worlds in `/data/` instead of shared `/worlds/` directory
  - **Impact**: Shared world storage feature was non-functional; worlds were recreated on server restart
  - **Affected versions**: 1.6.8 ~ 1.6.11 (npm package users only)

### Migration Guide for Affected Users

If you created servers with mcctl versions 1.6.8 ~ 1.6.11, follow these steps:

#### Option 1: Use Migration Command (Recommended)

```bash
# Check which servers need migration
mcctl migrate status

# Migrate all servers (moves world data and updates config)
mcctl migrate worlds --all

# Or migrate specific server
mcctl migrate worlds myserver
```

#### Option 2: Manual Fix

**Step 1**: Add `EXTRA_ARGS` to server's config.env:

```bash
# For each affected server
echo 'EXTRA_ARGS=--universe /worlds/' >> ~/minecraft-servers/servers/<server-name>/config.env
```

Or add to global `.env` (applies to all servers):

```bash
echo 'EXTRA_ARGS=--universe /worlds/' >> ~/minecraft-servers/.env
```

**Step 2**: Move existing world data:

```bash
cd ~/minecraft-servers

# Stop server first
mcctl stop <server-name>

# Move world from data/ to worlds/
mv servers/<server-name>/data/<level-name> worlds/<level-name>

# Start server
mcctl start <server-name>
```

**Step 3**: Verify world is loading correctly:

```bash
mcctl logs <server-name> -f
# Should NOT see "No existing world data, creating new world"
```

#### How to Check if Affected

Your server is affected if:

1. Created with `mcctl create` (versions 1.6.8 ~ 1.6.11)
2. World data exists in `servers/<name>/data/<world>/` instead of `worlds/<world>/`
3. Server logs show "No existing world data, creating new world" on restart

```bash
# Quick check: If this shows world folders, you're affected
ls ~/minecraft-servers/servers/*/data/*/level.dat 2>/dev/null
```

## [1.6.11] - 2026-01-31

### Fixed
- Include CHANGELOG.md in npm package for proper changelog display on npmjs.com

## [1.6.10] - 2026-01-30

### Added
- System Requirements section in README.md
- Admin Service (Web Console + REST API) in Features list
- AI Assistant link for user support
- CHANGELOG.md with version history

### Changed
- Reorganized README.md Documentation section with Read the Docs links
- Updated External Links to include project-specific resources

### Fixed
- Broken documentation links in README.md

## [1.6.9] - 2026-01-30

### Fixed
- Fix template file naming for npm compatibility (`.gitignore` → `gitignore.template`)
- Fix `-v` flag conflict with `--version` in CLI argument parsing

### Changed
- Sync shared package version for release consistency

## [1.6.8] - 2026-01-30

### Fixed
- Add missing template files to npm package distribution
- Include `templates/` directory in package.json files array

## [1.6.7] - 2026-01-29

### Added
- Version update check with 24-hour cache (#160, #161)
- Display notification when newer version available on npm

## [1.6.6] - 2026-01-29

### Fixed
- Correct system architecture diagram in documentation
- Convert ASCII diagrams to Mermaid for proper rendering

### Changed
- Rename NotebookLM to AI Assistant chatbot
- Simplify mcctl-api Internal Architecture diagram

## [1.6.5] - 2026-01-28

### Added
- REST API reference documentation
- AI Assistant help section to homepage
- NotebookLM AI Assistant link to navigation

### Fixed
- Remove mcctl-console from E2E tests (not yet implemented)

## [1.6.4] - 2026-01-27

### Fixed
- Skip already published npm packages in release workflow
- Add mod-source-modrinth package to release workflow (#158, #159)

## [1.6.3] - 2026-01-27

### Added
- Comprehensive LLM knowledge base update for ChatGPT integration

### Fixed
- World new command to create directory and .meta file correctly

## [1.6.2] - 2026-01-26

### Added
- API documentation with implementation status and SSE streaming
- Admin service documentation for native PM2 services (#142, #153)
- E2E tests using PM2 instead of Docker (#141, #152)
- Console init for native PM2 execution (#137, #151)
- PM2 service management types (#135, #144)
- PM2 ecosystem template (#139, #143)
- Console remove command
- Port configuration to console init

### Changed
- Optimize console for native PM2 execution (#140, #150)
- Remove Docker configs from API and Console (#147, #148, #149)
- Remove Docker dependencies from API for native execution (#138, #145)
- Migrate console service commands to PM2 (#146)

### Fixed
- Auto-build Docker images from source when missing

## [1.6.1] - 2026-01-25

### Changed
- Major refactoring for PM2 native service execution
- Remove Docker dependency for Admin Service

## [1.6.0] - 2026-01-24

### Added
- Admin Service: REST API (mcctl-api) + Web Console (mcctl-console)
- `mcctl console` commands for admin service management
- User management with role-based access
- API key authentication support

### Changed
- Deprecated `mcctl admin` commands (use `mcctl console` instead)

## [1.5.0] - 2026-01-20

### Added
- Mod management commands (`mcctl mod search/add/remove/list/sources`)
- Modrinth, CurseForge, Spiget, and direct URL mod sources
- Server backup/restore commands (`mcctl server-backup`, `mcctl server-restore`)

## [1.4.0] - 2026-01-15

### Added
- Player management commands (whitelist, ban, op, kick)
- World management improvements with `.meta` file support
- Interactive world selection in `mcctl create`

## [1.3.0] - 2026-01-10

### Added
- nip.io magic DNS support for hostname routing
- VPN mesh network support (Tailscale, ZeroTier)
- Migration script for existing servers to nip.io

### Changed
- Dual hostname generation: `.local` and `.nip.io`

---

For older versions, see [GitHub Releases](https://github.com/smallmiro/minecraft-server-manager/releases).
