# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.15.3] - 2026-02-22

### Changed
- **README.md** - Major update with Management Console section, Architecture diagram, and Quick Start guide (#412, #413)
  - Added Management Console section with setup instructions and feature overview
  - Updated Architecture diagram with Console components (mcctl-api, mcctl-console)
  - Added Console Setup to Quick Start guide
  - Updated Documentation table with Console and API docs links

## [2.15.2] - 2026-02-22

### Changed
- **Web Console Documentation** - Added server Overview/Mods tab screenshots with detailed descriptions (#409)
  - Server Overview tab screenshot and feature walkthrough
  - Server Mods tab screenshot with mod management UI description
- **Integrated Setup Guide** - New comprehensive guide for mcctl init to console init flow (#410)
  - Step-by-step installation guide covering mcctl CLI setup through console initialization
  - Bilingual documentation (English/Korean)

## [2.15.1] - 2026-02-22

### Changed
- **Web Console Documentation** - Comprehensive update with screenshots and detailed feature descriptions (#407, #408)
  - Added screenshots for all major console features (Dashboard, Server Management, World Management, etc.)
  - Updated feature descriptions with step-by-step usage guides
  - Enhanced documentation structure for better readability

### Fixed
- **pnpm-lock.yaml** - Sync lockfile with mcctl-api package.json for node-cron dependency

## [2.15.0] - 2026-02-22

### Added
- **Automated Backup Scheduling** - Cron-based backup scheduler with full-stack implementation (#394, #395)
  - **Domain Layer**: `CronExpression` and `BackupRetentionPolicy` value objects, `BackupSchedule` entity with validation
  - **Use Cases**: `BackupScheduleUseCase` with CRUD operations and `IBackupScheduleRepository` port
  - **Infrastructure**: `SqliteBackupScheduleRepository` adapter with SQLite persistence
  - **CLI**: `mcctl backup schedule` subcommand with `list`, `add`, `remove`, `enable`, `disable` operations
    - Cron preset support (hourly, daily, weekly, monthly) and custom expressions
    - Optional retention policy configuration (maxCount, maxAgeDays)
  - **API**: RESTful backup schedule endpoints (GET/POST/PUT/PATCH/DELETE `/api/backup/schedules`)
    - `BackupSchedulerService` with `node-cron` integration for automated backup execution
    - Typebox validation schemas for request/response
    - Audit logging for all schedule mutations
  - **Console**: Backup Schedule management UI with CRUD and toggle
    - `BackupScheduleList` component with enable/disable toggle
    - `BackupScheduleDialog` for creating and editing schedules
    - BFF proxy routes and React Query hooks
  - **Security**: Shell injection prevention using `execFile()` instead of `exec()`
  - **Tests**: 54+ tests across CLI (24), API routes (14), and scheduler service (16)

### Note
- Retention policy pruning deferred to separate implementation (#396)
- Domain layer (`BackupRetentionPolicy`, `shouldPrune`) remains intact for future use

## [2.14.0] - 2026-02-21

### Added
- **Console Mod Detail Cards** - Enhanced installed mods display with rich card UI in Server Detail Mods tab
  - Replace simple slug Chip display with card UI showing mod icon, title, description, download count, author, and Modrinth link
  - Batch API endpoint using Modrinth `GET /v2/projects?ids=[]` for efficient metadata retrieval
  - 3-state rendering: Skeleton (loading), Detail Card (full info), Fallback Card (slug only on API failure)
  - React Query caching with staleTime 5min, gcTime 30min for mod metadata
  - BFF proxy route for mod projects API

### Changed
- **Modrinth Adapter** - Add `getProjects()` batch method with parallel team member resolution
- **IModSourcePort** - Add optional `getProjects?()` method to mod source port interface

## [2.13.0] - 2026-02-21

### Added
- **Console Server Activity Tab Redesign** - Improve Server Activity tab to match Audit Logs page UI (#391, #392)
  - Convert Server Activity tab from simple List to reusable `AuditLogTable` component
  - Add Action/Status inline filters for activity filtering
  - Add pagination support with configurable rows per page (25/50)
  - Add `hideTargetColumn` and `rowsPerPageOptions` props to `AuditLogTable` for reusability

### Documentation
- **mcctl update Command** - Add documentation for `mcctl update` command usage

## [2.12.1] - 2026-02-20

### Added
- **Server Management Guide** - New bilingual (EN/KO) documentation for server start/stop operations
  - Comprehensive guide covering `mcctl start`, `mcctl stop`, `mcctl up`, `mcctl down` commands
  - Server lifecycle management with auto-scaling behavior
  - Added to MkDocs navigation under Usage section

### Removed
- **World Storage Bug Warning** - Remove obsolete v1.6.8~v1.6.11 bug warning from documentation
  - Issue was fully resolved in v1.6.12; warning no longer relevant

## [2.12.0] - 2026-02-20

### Changed
- **Console File Editors Inline Redesign** - Convert TextEditor and PlayerEditorDialog from fullScreen Dialog overlays to inline Card-based views (#389, #390)
  - All file editors now use consistent inline replacement rendering pattern
  - Shared header pattern with back button, icon, title, and actions
  - Matches ServerPropertiesView inline design for unified UX
  - Eliminates modal overlays in favor of in-page navigation

## [2.11.0] - 2026-02-19

### Added
- **Console Tab-Specific Console Section** - Show Console section only on Overview tab (#387, #388)
  - Console section now appears exclusively in the Overview tab for cleaner UX
  - Console open state resets automatically when leaving Overview tab
  - Unit tests added for console visibility on tab switch

### Changed
- **Console server.properties Editor Redesign** - Replace modal dialog with inline view
  - `ServerPropertiesDialog` (modal overlay) replaced with `ServerPropertiesView` (inline full-page view)
  - New `RawPropertiesEditor` component for raw properties editing
  - Properties editor now renders within the Files tab instead of as a dialog overlay
  - Improved UX with back navigation instead of dialog close

## [2.10.0] - 2026-02-19

### Added
- **Console File Upload/Download** - Phase 5: Streaming file transfers with drag-and-drop support (#379, #386)
  - File upload with streaming proxy via `@fastify/multipart`
  - Drag-and-drop file upload interface
  - File download with streaming response
  - Progress indicators for upload/download operations
- **Console File Operations** - Phase 6: File management actions (delete, rename, new folder) (#380, #385)
  - Delete confirmation dialog with safety checks
  - Rename dialog for files and directories
  - New folder creation dialog
  - Contextual file operation menus

## [2.9.0] - 2026-02-18

### Added
- **Console File Browser** - Phase 1: Directory navigation and file listing for server files management (#375, #381)
  - Browse server file system with directory tree navigation
  - File listing with name, size, and modification date
  - Breadcrumb navigation for directory path
- **Console Text Editor** - Phase 2: Read and write text files directly from the web console (#376, #382)
  - View and edit server configuration files (server.properties, config files, etc.)
  - Syntax-aware text editing with save functionality
- **Console Player Editor Smart Routing** - Phase 3: Smart routing for player management files (#377, #383)
  - Automatic detection and routing for whitelist.json, ops.json, banned-players.json
  - Dedicated player editor UI for player management files
  - Smart file type detection with specialized editing interfaces
- **Console server.properties Form Editor** - Phase 4: Visual form-based editor for server.properties (#378, #384)
  - Form-based editing with field descriptions and validation
  - Grouped settings by category (gameplay, world, network, etc.)
  - Type-safe inputs (boolean toggles, number fields, dropdowns)

### Changed
- **Console Font Cleanup** - Remove Roboto Mono font, use MUI default font stack (#373, #374)
  - Cleaner typography using Material UI default fonts
  - Reduced bundle size by removing custom font dependency

## [2.8.1] - 2026-02-18

### Changed
- **Console Responsive Design Overhaul** - Improve responsive design across 14 components for mobile, tablet, and desktop (#371, #372)
  - **P0 Critical**: ServerCard/WorldCard responsive height, page headers responsive flexDirection, NetworkSettings/PlayitSection table mobile scroll
  - **P1 Important**: ServerDetail responsive tabs and console height, CreateServerDialog fullScreen on mobile, ServerConsole responsive header, StickyActionBar responsive padding
  - **P2 Nice to have**: Dashboard responsive breakpoints, ServerOverview chip flex-wrap, ConnectionInfoCard word-break, UserList table overflow
  - Accessibility: Add aria-label to console close button, fullScreen close button for dialogs

## [2.8.0] - 2026-02-18

### Added
- **Console HostnameDisplay Common Component** - Reusable hostname display with popover for multiple hostnames (#369, #370)
  - Shows primary hostname with (+N) Chip for servers with multiple hostnames
  - Clicking Chip opens Popover with all hostnames and copy buttons
  - Applied to 5 locations: ServerCard, ServerOverview, ServerDetailPage header, ServerDetail InfoRow, ConnectionInfoCard LAN Address
  - Extracted `parseHostnames` and `getPrimaryHostname` utilities into `src/utils/hostname.ts`
  - Extracted `CopyButton` into shared common component with configurable icon size

### Fixed
- **Console DOM Nesting Warning** - Change InfoRow value wrapper to `component="div"` to prevent invalid DOM nesting with HostnameDisplay
- **Console InfoRow Null Behavior** - Preserve undefined hostname handling for hidden InfoRow display

### Tests
- **HostnameDisplay Component Tests** - Cover all render paths, Popover interaction, copy-to-clipboard, port suffix formatting, and event propagation prevention

## [2.7.0] - 2026-02-18

### Changed
- **Console Font Overhaul** - Replace Ubuntu font with Roboto Mono (Google Fonts) across all console components
  - Layout: Switch from `Ubuntu` to `Roboto_Mono` with CSS variable support
  - MUI Theme: Update global fontFamily to Roboto Mono
  - 11 components: Unify monospace/code font references from mixed (JetBrains Mono, Fira Code, generic monospace) to Roboto Mono
  - Minecraft font preserved for game-related branding elements

## [2.6.1] - 2026-02-17

### Fixed
- **Console Restart Badge UX** - Remove individual Restart badges from each settings field and consolidate restart information in StickyActionBar
  - Reduces visual clutter in Server Properties tab
  - StickyActionBar now shows specific field names requiring restart (e.g., "difficulty, pvp require restart")

## [2.6.0] - 2026-02-17

### Added
- **Console Server Properties Full UI** - Complete server configuration management with 6 sections and ~40 fields using Progressive Disclosure pattern (#365, #366)
  - General section: server name, MOTD, max players, difficulty, game mode, hardcore
  - World section: level name, seed, level type, world generation settings
  - Performance section: view distance, simulation distance, max tick time, network compression
  - Network section: server port, enable query, enable RCON, connection settings
  - Advanced section: spawn protection, max world size, entity limits, function permission level
  - Operators section: enforce whitelist, enforce secure profile, OP permission level
  - Collapsible sections with Progressive Disclosure for reduced cognitive load
  - Real-time config updates via ConfigService REST API

### Tests
- **ConfigService Field Tests** - Add 22 unit tests for new ConfigService fields and 6 API integration tests (#367, #368)
  - Full coverage for all ~40 config fields across 6 sections
  - GET/PUT API endpoint tests for server configuration

## [2.5.0] - 2026-02-17

### Added
- **Console Security Settings UI** - Online Mode and Whitelist settings in server detail page (#357, #358, #362)
  - Toggle Online Mode on/off with safety confirmation dialog
  - Toggle Whitelist on/off directly from server settings
  - Real-time config updates via REST API

### Fixed
- **API Memory Parameter** - Pass `--memory` parameter to `create-server.sh` when creating servers via REST API (#356, #360)
- **Console Player List Field** - Align player list field name (`players` to `list`) with backend API response format (#359, #361)
- **API Whitelist Remove RCON Fallback** - Detect RCON error in whitelist remove and fall back to direct file editing (#363, #364)
  - RCON `whitelist remove` sometimes fails silently; now detects error response and edits whitelist.json directly

### Infrastructure
- **Scripts**: Add `--memory` option support to `create-server.sh`
- **Template**: Add `ONLINE_MODE` section to server `config.env` template

## [2.4.1] - 2026-02-14

### Fixed
- **CI/CD**: Fix `mcctl-api` npm publish missing `workspace:*` replacement for `@minecraft-docker/mod-source-modrinth` dependency

## [2.4.0] - 2026-02-14

### Added
- **CLI `mcctl upgrade` Command** - Upgrade mcctl and all services to latest version with automatic restart (#326, #355)
  - Replaces manual npm update workflow with single command
  - Automatically restarts PM2 services after upgrade
  - Supports `--check` flag to preview available updates without installing
- **CLI Creeper ASCII Banner** - Display creeper ASCII art with version check on `mcctl init` (#353, #354)
  - Visual branding during platform initialization
  - Automatic latest version check with update notification
- **CLI `mcctl playit domain` Subcommand** - Manage playit.gg domain assignments per server (#347, #348)
  - Add, remove, and list playit.gg domain mappings for servers
  - Interactive server and domain selection

### Changed
- **Console Mods Tab** - Rename 'Content' tab to 'Mods' in server detail page (#349, #350)
  - Clearer tab naming that directly reflects functionality
- **Console Mods Tab Functionality** - Implement full Mods tab with mod listing and management (#351, #352)
  - View installed mods per server
  - Mod search and installation from Modrinth

### Documentation
- Update documentation for v2.4.0 with upgrade command and playit.gg guides

## [2.3.5] - 2026-02-12

### Fixed
- **Playit.gg Container Name** - Use correct container name `playit-agent` in `getPlayitAgentStatus()` (#345, #346)
  - Previously used incorrect container name when checking playit agent status
  - Now correctly references the `playit-agent` container for status checks
- **Console Playit Error Feedback** - Add error feedback for playit start/stop actions (#343)
  - Previously, playit start/stop failures were silent in the web console
  - Now displays error messages when playit operations fail
- **Console Playit Layout** - Improve playit section header layout and server domains display (#343, #344)
  - Better visual alignment of playit section headers
  - Improved server domains display in playit configuration

## [2.3.4] - 2026-02-12

### Fixed
- **Playit.gg Docker Compose Setup** - Add playit service to docker-compose.yml during setup (#341, #342)
  - Previously, `mcctl init` and `mcctl playit setup` did not add the playit-agent service to docker-compose.yml
  - Now properly injects the playit service definition into docker-compose.yml during platform setup
  - Ensures playit.gg tunneling works immediately after initial setup

## [2.3.3] - 2026-02-12

### Fixed
- **Playit.gg Docker Compose CWD** - Pass `cwd` to docker compose commands in playit start/stop (#339, #340)
  - Previously, `docker compose --profile playit start/stop` commands did not receive the correct working directory
  - Now passes `cwd` parameter to ensure docker compose runs in the platform root directory
  - Fixes playit-agent start/stop failures when CLI is invoked from a different directory

## [2.3.2] - 2026-02-12

### Fixed
- **Playit.gg Status Detection** - Check `.mcctl.json` for playit enabled state instead of container existence (#337, #338)
  - Previously relied on Docker container inspection to determine playit status
  - Now reads `playit.enabled` flag from `.mcctl.json` configuration file
  - More reliable detection that works even when containers are not running

## [2.3.1] - 2026-02-12

### Fixed
- **API TypeScript Build Error** - Resolve TypeScript build error in audit-logs purge catch block
- **CLI Init Reconfigure** - Handle missing `.mcctl.json` in `mcctl init --reconfigure` (#335, #336)
  - Previously crashed when `.mcctl.json` file was not present
  - Now gracefully handles missing config file during reconfiguration

### Documentation
- Update documentation for v2.3.0 release

## [2.3.0] - 2026-02-12

### Added
- **playit.gg External Access** - Allow external players to join without port forwarding using [playit.gg](https://playit.gg) tunneling (Milestone 9)
  - **Domain Model & Docker Helpers** - `PlayitConfig` type and Docker Compose profile support in shared package (#291, #328)
  - **Docker Compose Templates** - playit-agent service with `network_mode: host` and `profiles: [playit]` (#270, #327)
  - **CLI `mcctl init --playit-key`** - Interactive playit.gg setup during platform initialization (#271, #329)
  - **CLI `mcctl create --playit-domain`** - Register playit.gg domain when creating servers (#272, #330)
  - **CLI `mcctl playit` subcommand** - start/stop/status/setup commands for playit-agent management (#273, #331)
  - **API Endpoints** - `GET /api/playit/status`, `POST /api/playit/start`, `POST /api/playit/stop` (#292, #332)
  - **Console UI** - PlayitSummaryCard on dashboard, ConnectionInfoCard with external domain, PlayitSection on routing page (#274, #333)
  - **Documentation** - Comprehensive playit.gg integration guide in English and Korean (#275, #334)
- **Comprehensive API Audit Logging** - Add audit logging to all mutating API routes (#324, #325)
  - Player management routes (whitelist, ban, op, kick)
  - Server config and hostname routes
  - World management routes
  - New audit action types for config and hostname changes

### Fixed
- **Console Whitelist Button Sizes** - Unify Add and Bulk button sizes in WhitelistManager (#322, #323)

## [2.2.0] - 2026-02-11

### Added
- **Whitelist Console UI** - Full whitelist management in Web Console (#283, #321)
  - Whitelist ON/OFF toggle switch for enabling/disabling whitelist per server
  - Bulk player add functionality for adding multiple players at once
  - Search and filter for quick player lookup in whitelist
  - Whitelist status API endpoint (`GET /api/servers/:name/whitelist/status`)
  - WhitelistStatusAdapter, BFF route, and React Query hooks
  - Comprehensive test coverage for whitelist status endpoints
- **Whitelist Default on Create** - Enable whitelist by default when creating servers via `mcctl create` (#282, #320)
- **Hostname/Domain Management** - Server hostname and domain management in Options tab (#314, #315)
  - HostnameSection component for viewing and managing server hostnames
  - API endpoints for hostname configuration
  - HostnameService for hostname operations

### Fixed
- **Console Unit Tests** - Fix 23 pre-existing failing unit tests (#296, #316)
- **Console Navigation** - Rename "Audit Log" to "Audit" in navigation menu

### Documentation
- **Upstream Docs Update** - Update itzg reference docs for itzg 2026.2.0 and mc-router v1.39.1 (#317, #318)

### Chore
- Restore workspace:* dependencies after release merge

## [2.1.3] - 2026-02-09

### Fixed
- **API Whitelist RCON UUID Enrichment** - Enrich whitelist RCON response with UUIDs from whitelist.json file (#312, #313)
  - RCON `whitelist list` command returns only player names without UUIDs
  - API now supplements RCON response with UUID data from server's whitelist.json file
  - Enables Console UI to display accurate player UUIDs in whitelist management

## [2.1.2] - 2026-02-09

### Added
- **CLI Update Loading Indicator** - Improve mcctl update command with loading indicator for better UX (#306, #307)

### Fixed
- **Console Admin/Users Route Group** - Move admin/users page to (main) route group for proper GNB/Footer layout (#308, #309)

### Changed
- **Console Settings Responsive Layout** - Apply responsive grid layout to Settings page (#310, #311)

## [2.1.1] - 2026-02-09

### Fixed
- **Console GNB Admin Menu Cleanup** - Remove admin menu from GNB, rename UserMenu "Admin Panel" to "Users" (#302, #304)
  - Admin menu in GNB was redundant with UserMenu admin link
  - Simplified navigation by consolidating admin access to UserMenu
- **API Whitelist/Banned-Players UUID Display** - Return UUID in whitelist and ban API responses (#303, #305)
  - UUID was missing from player list API responses for whitelist and banned-players
  - PlayerFileService now returns full player objects including UUID
- **API PlayerFileService Test Assertions** - Update test assertions for object return types (#303)

## [2.1.0] - 2026-02-09

### Added
- **Modrinth Modpack CLI/API Support** - Full modpack server creation and management (#244, #245)
  - CLI `mcctl create --modpack` with Modrinth modpack search, version selection, and loader detection
  - API endpoints for modpack server creation with validation
  - MODRINTH modpack server validation in CLI
- **Admin User Management Console UI** - Web-based admin user management (#189)
  - Admin user list page with search and filtering
  - User detail dialog with role and status management
  - Admin menu in GNB for admin users
  - Admin layout with UserMenu admin panel link
- **OP Level Domain Model** - Structured OP level support across all layers (#284)
  - `OpLevel` value object in shared domain layer
  - OP level semantics: 1 (bypass spawn), 2 (cheat commands), 3 (multiplayer management), 4 (server management)
- **OP Level CLI Commands** - Interactive OP level management (#285)
  - `mcctl op set <player> --level <1-4>` for setting OP levels
  - Interactive OP level selection with level descriptions
  - `OpsJsonAdapter` for direct ops.json file management
- **OP Level API Endpoints** - REST API for OP level management (#286)
  - `PUT /api/servers/:name/ops/:player/level` endpoint
  - OP level infrastructure with validation
- **OP Level Console Web UI** - Web interface for OP level management (#287)
  - `OpLevelBadge` component for visual OP level display
  - `OpLevelSelector` component for interactive level selection
  - OP level management integrated into OpManager

### Fixed
- **Console Sign-out 403 LAN IP Bug** - Fix typed `getServerSession` wrapper and allow private network origins (#300, #301)
  - Sign-out was failing with 403 error when accessing from LAN IP addresses
  - Added private network IP ranges to trusted origins
- **Offline Player Management** - Support for managing players who are not currently online (#288, #289)

### Changed
- **User Profile Settings** - Add password change functionality to user profile page (#265, #266)
- **Service Isolation** - Isolate service node_modules into `.services/` directory (#262, #267)
- **Template Path Resolution** - Fix MCCTL_TEMPLATES path resolution and console modLoader validation (#263, #264)

## [1.15.5] - 2026-02-08

### Fixed
- **CLI Better Auth Password Hashing** - Fix scrypt salt to use hex string instead of raw bytes in console-db.ts
  - Better Auth uses hex-encoded salt STRING as the scrypt salt parameter, not raw bytes
  - Previously, CLI-created passwords were incompatible with Better Auth's verification
  - Now matches Better Auth's exact hashing behavior for cross-system password compatibility
- **CLI ecosystem.config.cjs MCCTL_API_KEY** - Add `MCCTL_API_KEY` environment variable to mcctl-console PM2 config (#261)
  - Console service now receives the API key for authenticated API communication
  - Only added when API key is configured during `mcctl console init`

## [1.15.4] - 2026-02-08

### Fixed
- **Console Better Auth Config** - Explicitly pass `baseURL` and `secret` to Better Auth configuration
  - Better Auth was not auto-detecting environment variables in some deployment scenarios
  - Now reads `BETTER_AUTH_BASE_URL` and `BETTER_AUTH_SECRET` explicitly in config
- **Console HTTP Session Persistence** - Fix login redirect loop in HTTP environments
  - Added `advanced.useSecureCookies` toggle based on protocol detection
  - Previously, production mode defaulted to Secure cookies, causing browsers to reject cookies over HTTP (e.g., `http://192.168.x.x:5000`)
  - Resolves 307 redirect loop after successful login on HTTP deployments
- **Console trustedOrigins Dedup** - Remove duplicate `localhost:5000` entry from trustedOrigins
  - Only add `baseURL` to trustedOrigins when it differs from the default `http://localhost:5000`

## [1.15.3] - 2026-02-08

### Fixed
- **CLI BETTER_AUTH_BASE_URL** - Fix environment variable name from `BETTER_AUTH_URL` to `BETTER_AUTH_BASE_URL` in ecosystem.config.cjs generation
  - Better Auth reads `BETTER_AUTH_BASE_URL`, not `BETTER_AUTH_URL`
  - Resolves authentication failures in Management Console when deployed via PM2
- **Console trustedOrigins Env Var** - Fix `process.env.BETTER_AUTH_URL` to `process.env.BETTER_AUTH_BASE_URL` in auth.ts trustedOrigins
  - Ensures production-deployed console correctly includes the base URL in trusted origins
- **Console DB Path with MCCTL_ROOT** - Use `MCCTL_ROOT` environment variable for database path resolution in db.ts
  - `process.cwd()` fallback preserved when MCCTL_ROOT is not set
  - Fixes DB path issues in standalone Next.js where cwd may differ from expected
- **Console user_servers Table Missing** - Add `user_servers` table to auto-creation DDL in db.ts
  - Previously only 4 of 5 required tables were auto-created (users, accounts, sessions, verifications)
  - Now creates all 5 tables including user_servers with proper index
- **Audit DB Path** - Move audit.db from `MCCTL_ROOT/audit.db` to `MCCTL_ROOT/data/audit.db`
  - Aligns with mcctl.db location in the same `data/` directory
  - Applied to both CLI (container.ts) and API (audit-log-service.ts)
- **Console .env.example Sync** - Update `BETTER_AUTH_URL` to `BETTER_AUTH_BASE_URL` in .env.example and auth.test.ts

## [1.15.2] - 2026-02-08

### Fixed
- **CLI ecosystem.config.cjs Environment Variables** - Replace `NEXTAUTH_SECRET`/`NEXTAUTH_URL` with `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` in `generateEcosystemConfig()`
  - Better Auth reads `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, not NEXTAUTH variants
  - Resolves 500 Internal Server Error when accessing Management Console after `mcctl console init`
- **Console SQLite Table Auto-Creation** - Add `CREATE TABLE IF NOT EXISTS` for Better Auth core tables on app startup
  - Auto-creates `users`, `accounts`, `sessions`, `verifications` tables when DB file is empty or tables are missing
  - Prevents crash on first run or when DB is recreated
  - Enables `foreign_keys` pragma for referential integrity

## [1.15.1] - 2026-02-08

### Fixed
- **Console Auth BaseURL** - Change Better Auth client baseURL default from `http://localhost:5000` to empty string for production deployment
  - Browser previously sent auth requests to `localhost:5000` instead of the deployed host
  - Now uses relative URLs that correctly match the deployed server address
- **Console Trusted Origins** - Add `NEXT_PUBLIC_APP_URL` environment variable support to trustedOrigins
  - Enables flexible production origin configuration for cross-origin auth requests

## [1.15.0] - 2026-02-08

### Added
- **Console Auto-Install in Console Init** - `mcctl console init` now automatically installs `@minecraft-docker/mcctl-console` package if not already present (#dbfeb38)
  - Detects missing mcctl-console package during initialization
  - Prompts user for auto-installation with npm
  - Streamlines Management Console setup to a single command

### Fixed
- **Service Script Path Resolution** - Resolve service script paths independently for each service (#4243391)
  - Previously, service scripts shared a single path resolution, causing errors when services were installed in different locations
  - Each service now resolves its own script path independently
- **Modpack Version Prompt Trim Error** - Add defaultValue to modpack version prompt to prevent trim error on undefined values (#62c9068)
  - Fix crash when modpack version selection returned undefined
  - Add safe default value handling for version prompt

## [1.14.0] - 2026-02-08

### Added
- **MODRINTH Modpack Server Creation (CLI)** - Create servers from Modrinth modpacks with interactive search (#244)
  - `mcctl create --modpack` flag enables modpack server creation flow
  - Modrinth API integration for modpack search, version listing, and loader detection
  - Dynamic mod loader filtering: only show loaders the modpack actually supports
  - Automatic environment variable configuration (TYPE=MODRINTH, MODRINTH_MODPACK, etc.)
- **MODRINTH Modpack Server Creation (Web Console)** - Modpack server creation UI in Management Console (#246)
  - Modpack search with debounced input in CreateServerDialog
  - Version and loader selection with dynamic filtering
  - Extended `CreateServerRequest` type with modpack fields (modpackSlug, modpackVersion, modpackLoader)
- **NeoForge Mod Loader Option** - NeoForge added to mod loader selection in CLI, API, and Web Console
  - Available as mod loader choice when creating modpack servers
  - Filtered dynamically based on modpack support via Modrinth API

## [1.13.0] - 2026-02-07

### Added
- **Unified Prerequisite Checker** - Consolidated dependency validation for `mcctl init` and `mcctl console init` (#241)
  - `PrerequisiteChecker` in shared package with `checkPlatformPrerequisites()` and `checkConsolePrerequisites()`
  - `getDockerVersion()` and `getDockerComposeVersion()` version parsing functions
  - `satisfiesMinVersion()` semver comparison utility
  - `displayPrerequisiteReport()` CLI display helper with color-coded output
  - 20 unit tests added, total 120 tests passing
- **Console npm Publishing** - `@minecraft-docker/mcctl-console` now published to npm as standalone package
  - `bin/start.js` entry script supporting monorepo and flat standalone builds
  - Release workflow updated with mcctl-console publish step
- **Console --force Option** - `mcctl console service stop/restart --force` for forceful PM2 process termination (#238)
- **Console Routing Page** - Settings renamed to Routing with Avahi mDNS monitoring (#240)

### Fixed
- **Console Build** - Add `export const dynamic = 'force-dynamic'` to all 22 API routes to prevent `SQLITE_BUSY` error during Next.js static page data collection at build time

### Changed
- **init Command** - Replace inline Docker/Compose/avahi checks with unified `checkPlatformPrerequisites()`
- **console init Command** - Replace inline Node.js/PM2 checks with unified `checkConsolePrerequisites()`
- **System Requirements** - CLAUDE.md updated with runtime/development separation, PM2 requirement, port table

### Infrastructure
- **E2E Workflow** - Add mcctl-console to PM2 config, health checks, and error log collection
- **DevContainer** - Forward port 5000 for console access

## [1.12.1] - 2026-02-07

### Fixed
- **Console TypeScript Types** - Add `not_created` status to all SSE and API interface type definitions
  - `useServerStatus` hook status union type
  - `useServersSSE` hook `ServerStatusMap` and `onStatusChange` callback
  - `IMcctlApiClient` `ServerSummary` interface
  - `ServerStatusEvent` type in events.ts

## [1.12.0] - 2026-02-06

### Added
- **All-Servers SSE Status Endpoint** - `GET /api/servers-status` for streaming all server statuses via Server-Sent Events
- **Server Detail Delete Menu** - MoreVert button with delete option and confirmation dialog on server detail page
- **API Audit Logging** - Automatic audit log recording for server create, delete, start, stop, and restart actions via REST API
  - `writeAuditLog()` helper function in audit-log-service for consistent logging
  - Audit events logged in server actions endpoint (start/stop/restart)

### Fixed
- **SSE URL Path** - Update SSE URL to `/api/sse/servers-status` in useServersSSE hook
- **Not Created Status Handling** - Handle `not_created` server status in card, list, and detail page views
- **Assign World Dialog** - Show all non-running servers in assign world dialog

### Refactored
- Extract `mapContainerStatus()` and `mapHealthStatus()` to module-level functions in servers route

## [1.11.0] - 2026-02-06

### Added
- **World Management UI** - Full world management interface in Web Console (#175)
  - World list page with size, lock status, and server assignment display
  - World reset functionality with safety confirmation dialog
  - Integration with server detail page for per-server world operations
- **Server Options Tab** - Configuration management UI in Web Console (#229)
  - Server config viewing and editing through web interface
  - Real-time config updates via REST API
- **SSE Real-time Server Status** - Replace polling with Server-Sent Events for live server status updates (#223)
  - Efficient real-time updates without polling overhead
  - Automatic reconnection on connection loss
- **Server Config & World Reset API** - New REST endpoints for server configuration and world management (#229)
  - `GET/PUT /api/servers/:name/config` - Server configuration endpoints
  - `POST /api/servers/:name/world/reset` - World reset endpoint with safety checks
- **Shared Package in Update** - Add `@minecraft-docker/shared` to `mcctl update --all` scope

### Fixed
- **Path Traversal Prevention** - Security fix to prevent path traversal attacks in world reset endpoint
- **Container Status Checks** - Verify container is stopped before allowing world reset operations
- **Force Update Check** - Always perform update check when running `mcctl update` (bypass cache)

### Tests
- Add tests for ConfigService, config routes, and useServersSSE hook

## [1.10.0] - 2026-02-05

### Added
- **Audit Log System** - Comprehensive activity tracking across CLI, API, and Web Console (#234, #235)
  - **Domain**: `AuditLog` entity with `AuditActionEnum` value object supporting 13 action types (server lifecycle, player management, audit purge)
  - **Infrastructure**: `SqliteAuditLogRepository` adapter with better-sqlite3, WAL mode, auto-migration, and configurable auto-cleanup
  - **CLI**: `mcctl audit` command with `list`, `purge`, and `stats` subcommands, supporting filtering by action, actor, target, status, and date range
  - **API**: 5 REST endpoints - list (GET /api/audit), stats (GET /api/audit/stats), detail (GET /api/audit/:id), purge (DELETE /api/audit), and SSE stream (GET /api/audit/stream)
  - **Web UI**: Full audit log page with `AuditLogTable`, `AuditLogFilters`, `AuditLogStats`, `AuditLogDetail`, and `AuditLogExport` components
  - **Dashboard**: `RecentActivityFeed` widget showing latest audit events
  - **Server Detail**: Activity tab with per-server audit log view
  - **Audit Integration**: Automatic logging in CreateServerUseCase, DeleteServerUseCase, start/stop commands, and all player management commands (whitelist, ban, op, kick)
  - **Configuration**: `AUDIT_AUTO_CLEANUP` (default: true) and `AUDIT_RETENTION_DAYS` (default: 90) environment variables
  - **Tests**: 29 CLI tests + 16 domain/infrastructure tests for comprehensive coverage

## [1.9.0] - 2026-02-05

### Added
- **`mcctl update --all` flag** - Update CLI and all installed services (mcctl-api, mcctl-console) in a single command
  - Automatically runs `npm install <package>@latest` for each installed service
  - Restarts PM2 processes after successful update
  - Supports `--check --all` to view available service updates without installing
  - Shows version comparison and update status for each service

## [1.8.0] - 2026-02-05

### Added
- **Web Console sudo password support** - Pass sudo password from CreateServerDialog to server creation API for mDNS hostname registration (#230)
- **Dashboard ChangelogFeed** - Replace placeholder ActivityFeed with real ChangelogFeed component that fetches CHANGELOG.md from GitHub

### Changed
- **CreateServerRequest schema** - Add optional `sudoPassword` field (writeOnly) to server creation API
- **Dashboard layout** - Replace ActivityFeed with ChangelogFeed showing recent project updates

## [1.7.12] - 2026-02-05

### Fixed
- **TEMPLATE_DIR path duplication** - Correct TEMPLATE_DIR path in create-server.sh that caused duplicate directory segments (#230)
- **API error reporting** - Improve error reporting for server creation script failures with stderr capture (#230)

## [1.7.11] - 2026-02-04

### Fixed
- **World size calculation** - Check LEVEL config before WORLD_NAME for correct world directory resolution
  - itzg/minecraft-server uses LEVEL to specify the world directory name
  - Servers configured with LEVEL (like Wild-Deity) were showing "0 B" for world size
  - Now properly checks LEVEL first, then falls back to WORLD_NAME

## [1.7.10] - 2026-02-04

### Added
- **Console UI ANSI color support** - Display colored log output using ansi-to-html library
- **Loading indicator** - nprogress loading bar for page navigation
- **Console UX improvements** - Hide RCON toggle, fullscreen console dialog, Ubuntu font
- **SSE streaming for server creation** - Real-time progress updates during server creation (#227, #228)

### Fixed
- **MCCTL_ROOT path resolution** - Fix relative path '.' to absolute path
- **Player list parsing** - Remove ANSI escape codes from RCON response for correct parsing

## [1.7.9] - 2026-02-03

### Fixed
- Fix YAML syntax error in E2E workflow configuration
- Resolve CI pipeline failure due to malformed YAML

## [1.7.8] - 2026-01-31

### Added
- **Selective console service support** - Choose which services to start (api/console/all) during `mcctl console init` (#203)
- Improved service selection prompts for Management Console setup

### Fixed
- Correct environment variable names for mcctl-api authentication (`MCCTL_*` prefix) (#203)
- Fix PM2 service management with selective service control

## [1.7.7] - 2026-01-31

### Added
- **Auto-install mcctl-api on console init** - When running `mcctl console init`, mcctl-api package is now automatically installed if not already present
- Streamlined Management Console setup process

## [1.7.6] - 2026-01-31

### Added
- **mcctl-api npm publishing support** - First npm release of REST API package
- Add @minecraft-docker/mcctl-api package to npm registry
- Update release workflow to include mcctl-api in npm publish step

## [1.7.5] - 2026-01-31

### Fixed
- Fix Edge runtime error in mcctl-console middleware (#201)
- Resolve `@better-auth/*` package compatibility issue with Next.js Edge runtime
- Move middleware to use Node.js runtime instead of Edge runtime

## [1.7.4] - 2026-01-31

### Fixed
- Add CHANGELOG.md with v1.7.1-1.7.3 hotfix history

## [1.7.3] - 2026-01-31

### Fixed
- Fix Docker network warning when running `mcctl up` (#199)
- Mark `minecraft-net` as external network in docker-compose.yml

## [1.7.2] - 2026-01-31

### Fixed
- Fix "Unknown error occurred" when avahi-daemon is not installed (#197)
- Add `|| true` to prevent script exit on optional avahi registration

## [1.7.1] - 2026-01-31

### Fixed
- Fix "Script not found: create-server.sh" error when mcctl installed via npm (#195)
- Bundle scripts/ and templates/ directories with CLI npm package
- Add `getCliPackageRoot()` function for correct path resolution

## [1.7.0] - 2026-01-31

### Added
- **Router Status API** (`GET /api/router/status`) - Real-time mc-router status (#157, #171)
- **Server Create/Delete API** (`POST/DELETE /api/servers/:name`) - REST API for server management (#154, #172)
- **Player Management API** - Whitelist, ban, op, kick operations via REST (#155, #173)
- **Backup API** (`POST /api/backup/:name`) - Trigger backups via REST (#156, #173)
- **mcctl init --reconfigure** - Reconfigure existing installation (#170)
- **E2E Tests** - Comprehensive API tests for router, players, backup, server create/delete
- **CLI E2E Tests** - Vitest-based e2e tests for CLI commands

### Changed
- Update XP methodology documentation in PRD
- Improve /work command with context mode and e2e test requirements
- Add issue checkbox update instructions to /work command
- Agent documentation updates for multi-agent collaboration

### Documentation
- Add mcctl-console implementation plan with GitHub issues #174-#190
- Update Management Console documentation for new API endpoints

## [1.6.16] - 2026-01-31

### Changed
- Add README Changelog sync instructions to release-manager and technical-writer agents
- Ensure npm package page displays latest changelog entries in README.md

## [1.6.15] - 2026-01-31

### Added
- New `mcctl backup init` command for interactive GitHub backup setup (#167)
  - Guided prompts for GitHub token, repository, and branch configuration
  - Automatic `.env` file update with backup settings
  - Token validation and repository existence check

### Fixed
- Include `scripts/` directory in npm package for template initialization

### Tests
- Add comprehensive tests for BackupUseCase.init() (12 test cases)

## [1.6.14] - 2026-01-31

### Fixed
- Sync all package versions to tag version before npm publish
- CI workflow now automatically updates all monorepo package versions to match Git tag

### Changed
- Split CLAUDE.md into modular files for better performance

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
- Management Console (Web Console + REST API) in Features list
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
- Remove Docker dependency for Management Console

## [1.6.0] - 2026-01-24

### Added
- Management Console: REST API (mcctl-api) + Web Console (mcctl-console)
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
