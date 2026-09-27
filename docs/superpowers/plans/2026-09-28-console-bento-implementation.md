# Console Bento UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the approved dashboard Bento UI hierarchy across every mcctl console screen while preserving existing operational behavior and information density.

**Architecture:** Add four presentational primitives under `src/components/bento/`, refactor the dashboard pilot onto them, and migrate one route at a time. Pages continue to own hooks, derived state, permissions, and mutations; Bento components receive display-ready props and never fetch or cache data.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, MUI 5, TanStack Query, Vitest, Testing Library, Playwright, pnpm, Node 22.

**Spec:** `docs/superpowers/specs/2026-09-28-console-bento-design.md`

## Global Constraints

- Preserve existing API calls, hooks, permissions, navigation, actions, and domain behavior.
- Add no backend, database, API contract, component-library, CSS-framework, or runtime-dependency changes.
- Use one column below `sm`, six columns from `sm`, and twelve columns from `md`; gaps are `16px` on mobile and `20px` from `sm` upward.
- Standard Bento surfaces use a `16px` radius and divider-colored border; only heroes use strong gradients or shadows.
- Color never communicates status without text or an icon, and mobile DOM order is the reading order.
- Dense tables, forms, tabs, file browsers, and terminals stay dense inside Bento surfaces.
- Use only metrics available from existing page data; do not invent trends or add duplicate data requests for decoration.
- Initial skeletons match loaded grid spans, and no screen may create document-level horizontal scrolling at 375px.
- Run all console commands with `PATH=/home/smallmiro/.nvm/versions/node/v22.22.0/bin:$PATH`.

## Review Focus

- Stale SSE data: dashboard and operational status must say `Reconnecting` or `Disconnected`, never `Live`; Tasks 1, 2, 4, and 9 pin this behavior.
- Long server, world, hostname, and user text: content must wrap or truncate inside `minmax(0, 1fr)` tracks without page overflow; Tasks 1, 2, 3, 5, and 11 cover style invariants and representative long values.
- Destructive actions after layout moves: server/world delete confirmations and disabled states must remain intact; Tasks 3 and 5 retain interaction tests.
- Permission-sensitive controls: page shells must not bypass or replace existing guarded feature components; Tasks 2, 3, and 11 exercise existing child components and admin boundaries.
- Loading, empty, API-error, and partial-data states: every migrated page must retain a useful landmark and action without a geometry collapse; each page task adds or updates these tests.

---

### Task 1: Shared Bento primitives and dashboard adoption

**Files:**
- Create: `platform/services/mcctl-console/src/components/bento/BentoGrid.tsx`
- Create: `platform/services/mcctl-console/src/components/bento/BentoPanel.tsx`
- Create: `platform/services/mcctl-console/src/components/bento/PageHero.tsx`
- Create: `platform/services/mcctl-console/src/components/bento/BentoMetricCard.tsx`
- Create: `platform/services/mcctl-console/src/components/bento/index.ts`
- Create: `platform/services/mcctl-console/src/components/bento/BentoGrid.test.tsx`
- Create: `platform/services/mcctl-console/src/components/bento/BentoPanel.test.tsx`
- Create: `platform/services/mcctl-console/src/components/bento/PageHero.test.tsx`
- Create: `platform/services/mcctl-console/src/components/bento/BentoMetricCard.test.tsx`
- Modify: `platform/services/mcctl-console/src/components/dashboard/DashboardHero.tsx`
- Modify: `platform/services/mcctl-console/src/components/dashboard/StatCard.tsx`
- Modify: `platform/services/mcctl-console/src/app/(main)/dashboard/page.tsx`
- Modify: `platform/services/mcctl-console/src/app/(main)/dashboard/page.test.tsx`

**Interfaces:**
- Produces: `BentoGrid(props: BoxProps): JSX.Element` with the fixed responsive column/gap system.
- Produces: `BentoAccent = 'neutral' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error'`.
- Produces: `BentoPanelProps extends PaperProps { accent?: BentoAccent; interactive?: boolean }` and `BentoPanel(props): JSX.Element`.
- Produces: `PageHeroProps extends Omit<PaperProps, 'title'> { title: ReactNode; description?: ReactNode; eyebrow?: ReactNode; icon?: ReactNode; status?: ReactNode; actions?: ReactNode; compact?: boolean; children?: ReactNode }` and `PageHero(props): JSX.Element`.
- Produces: `BentoMetricCardProps { title: string; value: ReactNode; unit?: string; icon?: ReactNode; accent?: BentoAccent; description?: string; progress?: number }` and `BentoMetricCard(props): JSX.Element`.
- Preserves: `StatCard` as a compatibility export backed by `BentoMetricCard`.

- [ ] **Step 1: Write failing primitive tests**

  Add tests named `uses responsive grid tracks without reordering children`, `renders a neutral semantic panel by default`, `limits hover lift to interactive panels`, `renders one level-one heading with status and actions in DOM order`, `uses compact spacing without dropping content`, `clamps progress to zero and one hundred`, and `omits progress when no real ratio is supplied`. Assert roles, heading level, child order, `data-testid` progress width, and style invariants including `minWidth: 0` and reduced-motion rules where observable.

- [ ] **Step 2: Run primitive tests and verify RED**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/components/bento`

  Expected: FAIL because the Bento module does not exist.

- [ ] **Step 3: Implement the four primitives and public barrel**

  Keep all components presentational. Merge caller `sx` after required base styles, use semantic MUI palette values, add `@media (prefers-reduced-motion: reduce)`, and keep responsive layout in DOM order.

- [ ] **Step 4: Refactor the dashboard onto the primitives**

  Use `BentoGrid` for the page, `BentoPanel` inside `DashboardHero`, and `BentoMetricCard` through the `StatCard` compatibility export. Preserve existing grid spans, skeleton geometry, attention calculations, and SSE connection labels.

- [ ] **Step 5: Run focused dashboard and primitive tests**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/components/bento src/components/dashboard/StatCard.test.tsx src/app/\(main\)/dashboard/page.test.tsx`

  Expected: PASS, including unhealthy-running attention and disconnected `Reconnecting` coverage.

- [ ] **Step 6: Run the foundation phase gate**

  Run: `pnpm --filter @minecraft-docker/mcctl-console test -- --reporter=dot && pnpm --filter @minecraft-docker/mcctl-console type-check && pnpm --filter @minecraft-docker/mcctl-console lint && pnpm --filter @minecraft-docker/mcctl-console build`

  Expected: all checks PASS, allowing only the two documented pre-existing hook dependency warnings.

- [ ] **Step 7: Commit**

  Run: `git add platform/services/mcctl-console/src/components/bento platform/services/mcctl-console/src/components/dashboard platform/services/mcctl-console/src/app/'(main)'/dashboard && git commit -m "refactor: extract shared Bento primitives"`

### Task 2: Servers list

**Files:**
- Create: `platform/services/mcctl-console/src/app/(main)/servers/page.test.tsx`
- Modify: `platform/services/mcctl-console/src/app/(main)/servers/page.tsx`
- Verify: `platform/services/mcctl-console/src/components/servers/ServerList.test.tsx`
- Verify: `platform/services/mcctl-console/src/components/servers/ServerCard.test.tsx`

**Interfaces:**
- Consumes: `BentoGrid`, `BentoPanel`, `PageHero`, and `BentoMetricCard` from Task 1.
- Preserves: existing `ServerList`, create dialog, SSE overlay, start/stop mutations, and router callbacks.

- [ ] **Step 1: Write failing route tests**

  Mock the existing hooks and child list. Add tests named `renders an operational hero with one h1`, `derives running and attention counts from SSE-overlaid status and health`, `keeps Create Server as the primary action`, `renders matching skeleton landmarks while loading`, `shows the API error without hiding the page context`, and `keeps a very long server name inside the content region`.

- [ ] **Step 2: Verify RED**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/servers/page.test.tsx`

  Expected: FAIL on the missing hero metrics and Bento landmarks.

- [ ] **Step 3: Implement the servers composition**

  Replace the page-local gradient header with a compact `PageHero`, compute total/running/attention from the same SSE-overlaid data passed to `ServerList`, place available metrics in the grid, and wrap the existing list/control area in one full-width panel. Do not move mutations or permission checks into shared components.

- [ ] **Step 4: Run focused tests**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/servers/page.test.tsx src/components/servers/ServerList.test.tsx src/components/servers/ServerCard.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit**

  Run: `git add platform/services/mcctl-console/src/app/'(main)'/servers/page.tsx platform/services/mcctl-console/src/app/'(main)'/servers/page.test.tsx && git commit -m "feat: apply Bento layout to servers"`

### Task 3: Server detail

**Files:**
- Create: `platform/services/mcctl-console/src/app/(main)/servers/[name]/page.test.tsx`
- Modify: `platform/services/mcctl-console/src/app/(main)/servers/[name]/page.tsx`
- Modify: `platform/services/mcctl-console/src/components/servers/ServerDetail.tsx`
- Modify: `platform/services/mcctl-console/src/components/servers/ServerDetail.test.tsx`
- Delete after confirming no consumers: `platform/services/mcctl-console/src/components/servers/ResourceStatCard.tsx`
- Delete after confirming no consumers: `platform/services/mcctl-console/src/components/servers/ResourceStatCard.test.tsx`

**Interfaces:**
- Consumes: Task 1 primitives.
- Preserves: `ServerDetail({ server, onSendCommand })`, all ten existing tabs, lifecycle mutations, hostname display, command behavior, and typed-name delete confirmation.

- [ ] **Step 1: Write failing page-shell tests**

  Mock `ServerDetail` and existing hooks. Assert one `h1` for the server name, explicit status and health text, back navigation, responsive action region, the correct Start versus Stop/Restart actions from SSE-overlaid state, error context, a matching loading hero, and the unchanged delete-confirmation gate.

- [ ] **Step 2: Extend `ServerDetail` tests before changing its surfaces**

  Add assertions that CPU, memory, and world-size metrics are rendered through the shared metric contract, tab buttons stay in DOM order, the selected tab retains dense full-width content, long hostnames can shrink, and the Overview console still reports connection text in addition to color.

- [ ] **Step 3: Verify RED**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/servers/\[name\]/page.test.tsx src/components/servers/ServerDetail.test.tsx`

  Expected: FAIL on PageHero/Bento panel expectations.

- [ ] **Step 4: Implement the detail composition**

  Convert the identity block to `PageHero`, place resource metrics in responsive Bento spans, and wrap the existing tab navigation/content in full-width `BentoPanel` surfaces. Replace `ResourceStatCard` usage with `BentoMetricCard` using already-computed percentages; do not change parsing, commands, tabs, mutations, or dialogs.

- [ ] **Step 5: Remove the obsolete resource-card component only after `rg` finds no consumers**

  Run: `rg -n "ResourceStatCard" platform/services/mcctl-console/src`

  Expected before deletion: only the obsolete component and its test; expected after deletion: no matches.

- [ ] **Step 6: Run focused tests and type-check**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/servers/\[name\]/page.test.tsx src/components/servers/ServerDetail.test.tsx src/components/servers/ConnectionInfoCard.test.tsx && pnpm --filter @minecraft-docker/mcctl-console type-check`

  Expected: PASS.

- [ ] **Step 7: Commit**

  Run: `git add -A platform/services/mcctl-console/src/app/'(main)'/servers/'[name]'/page.tsx platform/services/mcctl-console/src/app/'(main)'/servers/'[name]'/page.test.tsx platform/services/mcctl-console/src/components/servers && git commit -m "feat: apply Bento hierarchy to server details"`

### Task 4: Focused server console

**Files:**
- Create: `platform/services/mcctl-console/src/app/(main)/servers/[name]/console/page.test.tsx`
- Modify: `platform/services/mcctl-console/src/app/(main)/servers/[name]/console/page.tsx`
- Modify: `platform/services/mcctl-console/src/components/servers/ServerConsole.tsx`
- Modify: `platform/services/mcctl-console/src/components/servers/ServerConsole.test.tsx`

**Interfaces:**
- Extends: `ServerConsoleProps` with optional `onConnectionStateChange?: (state: { isConnected: boolean; retryCount: number }) => void`.
- Consumes: `PageHero` and `BentoPanel` from Task 1.
- Preserves: log filtering, ANSI rendering, history keys, quick commands, reconnect, clear, auto-scroll, RCON filtering, and command POST behavior.

- [ ] **Step 1: Write failing console-page tests**

  Assert the decoded server name is the single `h1`, breadcrumbs/back action remain reachable, the hero status changes from `Connected` to `Disconnected (Retry N)` through the callback, and the terminal panel follows the hero in DOM order.

- [ ] **Step 2: Extend component tests**

  Assert `onConnectionStateChange` fires only when `isConnected` or `retryCount` changes, disconnected state exposes text and the reconnect button, long unbroken log lines remain contained, and existing keyboard/command tests still pass.

- [ ] **Step 3: Verify RED**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/servers/\[name\]/console/page.test.tsx src/components/servers/ServerConsole.test.tsx`

  Expected: FAIL because the callback and focused Bento shell do not exist.

- [ ] **Step 4: Implement the focused layout**

  Use a compact `PageHero` with server identity, breadcrumb/back action, and connection status supplied by the console callback. Give the terminal the dominant viewport height in a single `BentoPanel`; stack/wrap controls on small screens without changing terminal logic.

- [ ] **Step 5: Run focused tests**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/servers/\[name\]/console/page.test.tsx src/components/servers/ServerConsole.test.tsx`

  Expected: PASS.

- [ ] **Step 6: Run the primary-operations phase gate**

  Run: `pnpm --filter @minecraft-docker/mcctl-console test -- --reporter=dot && pnpm --filter @minecraft-docker/mcctl-console type-check && pnpm --filter @minecraft-docker/mcctl-console lint && pnpm --filter @minecraft-docker/mcctl-console build`

  Expected: all checks PASS with no new warnings.

- [ ] **Step 7: Commit**

  Run: `git add platform/services/mcctl-console/src/app/'(main)'/servers/'[name]'/console platform/services/mcctl-console/src/components/servers/ServerConsole.tsx platform/services/mcctl-console/src/components/servers/ServerConsole.test.tsx && git commit -m "feat: focus Bento layout on server console"`

### Task 5: Worlds

**Files:**
- Modify: `platform/services/mcctl-console/src/app/(main)/worlds/page.tsx`
- Modify: `platform/services/mcctl-console/src/app/(main)/worlds/page.test.tsx`
- Verify: `platform/services/mcctl-console/src/components/worlds/WorldList.test.tsx`
- Verify: `platform/services/mcctl-console/src/components/worlds/WorldCard.test.tsx`

**Interfaces:**
- Consumes: Task 1 primitives.
- Preserves: create/upload, assign/release, info, delete, small-screen dialogs, and every existing world-list callback.

- [ ] **Step 1: Add failing composition and edge-case tests**

  Assert one hero `h1`, total/assigned/free values derived from `isLocked`, Create World action, matched loading structure, error and empty states, long world-name containment, and the existing typed-name delete confirmation.

- [ ] **Step 2: Verify RED**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/worlds/page.test.tsx`

  Expected: FAIL on hero metrics and Bento landmarks.

- [ ] **Step 3: Implement the worlds composition**

  Replace the local header with `PageHero`, add only the total/assigned/free metrics available from `useWorlds`, and place `WorldList` in the primary full-width surface. Preserve dialog mounts outside the visual grid to avoid focus and stacking regressions.

- [ ] **Step 4: Run focused tests**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/worlds/page.test.tsx src/components/worlds/WorldList.test.tsx src/components/worlds/WorldCard.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit**

  Run: `git add platform/services/mcctl-console/src/app/'(main)'/worlds && git commit -m "feat: apply Bento layout to worlds"`

### Task 6: Players

**Files:**
- Create: `platform/services/mcctl-console/src/app/(main)/players/page.test.tsx`
- Modify: `platform/services/mcctl-console/src/app/(main)/players/page.tsx`
- Verify: `platform/services/mcctl-console/src/components/players/PlayerList.test.tsx`
- Verify: `platform/services/mcctl-console/src/components/players/WhitelistManager.test.tsx`
- Verify: `platform/services/mcctl-console/src/components/players/OpManager.test.tsx`
- Verify: `platform/services/mcctl-console/src/components/players/BanManager.test.tsx`

**Interfaces:**
- Consumes: Task 1 primitives.
- Preserves: active-tab state, selected-server state, automatic first-server selection, disabled tabs without a server, and all existing manager-owned requests.

- [ ] **Step 1: Write failing page tests**

  Mock the four managers and `useServers`. Assert one compact hero, available/running server metrics from existing server data, selector behavior, all four tabs in DOM order, disabled server-specific tabs with no selection, loading/empty server states, and one dense full-width panel for the active manager.

- [ ] **Step 2: Verify RED**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/players/page.test.tsx`

  Expected: FAIL on Bento landmarks and summary metrics.

- [ ] **Step 3: Implement without duplicate data requests**

  Use `PageHero` and metrics derived only from `useServers`. Keep online-player, whitelist, operator, and ban counts/status inside their existing manager components so switching tabs remains the only trigger for manager-owned requests. Replace outer MUI Grid wrappers with Bento spans but do not rewrite the managers.

- [ ] **Step 4: Run focused tests**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/players/page.test.tsx src/components/players/PlayerList.test.tsx src/components/players/WhitelistManager.test.tsx src/components/players/OpManager.test.tsx src/components/players/BanManager.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Run the resource-operations phase gate**

  Run: `pnpm --filter @minecraft-docker/mcctl-console test -- --reporter=dot && pnpm --filter @minecraft-docker/mcctl-console type-check && pnpm --filter @minecraft-docker/mcctl-console lint && pnpm --filter @minecraft-docker/mcctl-console build`

  Expected: all checks PASS with no new warnings.

- [ ] **Step 6: Commit**

  Run: `git add platform/services/mcctl-console/src/app/'(main)'/players && git commit -m "feat: apply Bento layout to player management"`

### Task 7: Backups

**Files:**
- Create: `platform/services/mcctl-console/src/app/(main)/backups/page.test.tsx`
- Modify: `platform/services/mcctl-console/src/app/(main)/backups/page.tsx`

**Interfaces:**
- Consumes: Task 1 primitives.
- Preserves: `BackupPageTabs`, URL-driven tab state, `BackupPushButton`, `BackupStatus`, `BackupScheduleList`, `BackupHistory`, and configured gating.

- [ ] **Step 1: Write failing route tests**

  Mock backup components, `useBackupStatus`, and navigation. Assert one hero, explicit configured/not-configured status, backup action disabled when unconfigured, URL tab preservation, loading/partial status safety, and one full-width active content panel.

- [ ] **Step 2: Verify RED**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/backups/page.test.tsx`

  Expected: FAIL on Bento composition.

- [ ] **Step 3: Implement the backups page shell**

  Replace only the page shell; retain tab routing and backup feature components unchanged.

- [ ] **Step 4: Run the focused test**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/backups/page.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit**

  Run: `git add platform/services/mcctl-console/src/app/'(main)'/backups && git commit -m "feat: apply Bento layout to backups"`

### Task 8: Routing

**Files:**
- Modify: `platform/services/mcctl-console/src/app/(main)/routing/page.tsx`
- Modify: `platform/services/mcctl-console/src/app/(main)/routing/page.test.tsx`
- Verify: `platform/services/mcctl-console/src/components/settings/RouterStatus.test.tsx`
- Verify: `platform/services/mcctl-console/src/components/settings/NetworkSettings.test.tsx`
- Verify: `platform/services/mcctl-console/src/components/settings/PlayitSection.test.tsx`

**Interfaces:**
- Consumes: Task 1 primitives.
- Preserves: router, platform, network, Avahi, and Playit components and their existing hook ownership.

- [ ] **Step 1: Extend tests for hero status and responsive sections**

  Assert one `h1`, router status and route-count values from the existing response, explicit unavailable/error state, matched skeleton panels, and named regions for platform, network, Avahi, and Playit content.

- [ ] **Step 2: Verify RED**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/routing/page.test.tsx`

  Expected: FAIL on the shared hero and panel expectations.

- [ ] **Step 3: Implement the routing page shell**

  Replace local loading cards/header/Grid composition with shared primitives. Do not change the child settings components or add Playit requests.

- [ ] **Step 4: Run focused tests**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/routing/page.test.tsx src/components/settings/RouterStatus.test.tsx src/components/settings/NetworkSettings.test.tsx src/components/settings/PlayitSection.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit**

  Run: `git add platform/services/mcctl-console/src/app/'(main)'/routing && git commit -m "feat: apply Bento layout to routing"`

### Task 9: Audit logs

**Files:**
- Create: `platform/services/mcctl-console/src/app/(main)/audit-logs/page.test.tsx`
- Modify: `platform/services/mcctl-console/src/app/(main)/audit-logs/page.tsx`

**Interfaces:**
- Consumes: Task 1 primitives.
- Preserves: query-string filters, stats hook, audit SSE subscription, new-log count, refresh, row detail, export dialog, and table pagination.

- [ ] **Step 1: Write failing audit-page tests**

  Mock hooks and feature components. Assert one `h1`, current stats passed without recomputation, `Live` only when SSE is connected, `Disconnected` otherwise, new-log refresh behavior, filters before the full-width table in DOM order, export action, loading/empty/error states, and no loss of current query parameters.

- [ ] **Step 2: Verify RED**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/audit-logs/page.test.tsx`

  Expected: FAIL on hero and explicit disconnected status.

- [ ] **Step 3: Implement the audit composition**

  Move the existing stats and SSE chip into a compact hero/metric hierarchy, wrap filters and new-log notice together, and keep `AuditLogTable` full width. Keep detail/export dialogs outside the grid and retain all callbacks.

- [ ] **Step 4: Run focused tests**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/audit-logs/page.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Run the supporting-operations phase gate**

  Run: `pnpm --filter @minecraft-docker/mcctl-console test -- --reporter=dot && pnpm --filter @minecraft-docker/mcctl-console type-check && pnpm --filter @minecraft-docker/mcctl-console lint && pnpm --filter @minecraft-docker/mcctl-console build`

  Expected: all checks PASS with no new warnings.

- [ ] **Step 6: Commit**

  Run: `git add platform/services/mcctl-console/src/app/'(main)'/audit-logs && git commit -m "feat: apply Bento layout to audit logs"`

### Task 10: Settings and authentication surfaces

**Files:**
- Create: `platform/services/mcctl-console/src/app/(main)/settings/page.test.tsx`
- Modify: `platform/services/mcctl-console/src/app/(main)/settings/page.tsx`
- Create: `platform/services/mcctl-console/src/app/login/page.test.tsx`
- Create: `platform/services/mcctl-console/src/app/signup/page.test.tsx`
- Modify: `platform/services/mcctl-console/src/app/login/page.tsx`
- Modify: `platform/services/mcctl-console/src/app/signup/page.tsx`
- Verify: `platform/services/mcctl-console/src/components/auth/LoginForm.test.tsx`
- Verify: `platform/services/mcctl-console/src/components/auth/SignUpForm.test.tsx`
- Verify: `platform/services/mcctl-console/src/components/settings/PlatformInfo.test.tsx`

**Interfaces:**
- Consumes: `BentoGrid`, `BentoPanel`, and compact `PageHero`.
- Preserves: profile/password/account component callbacks, snackbar feedback, login/signup form callbacks, redirects, and cross-links.

- [ ] **Step 1: Write failing page-shell tests**

  Settings tests assert one `h1`, three named panels in DOM order, snackbar success/error behavior, and compact layout. Auth-page tests assert one `h1`, one centered `BentoPanel`, unchanged form callback/redirect, and reciprocal login/signup links.

- [ ] **Step 2: Verify RED**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/settings/page.test.tsx src/app/login/page.test.tsx src/app/signup/page.test.tsx`

  Expected: FAIL on shared surface expectations.

- [ ] **Step 3: Implement presentation-only migrations**

  Replace settings Grid with Bento spans and standardize the auth Card surfaces using `BentoPanel`. Do not change forms, validation, account mutation behavior, redirects, or auth layout height.

- [ ] **Step 4: Run focused tests**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/settings/page.test.tsx src/app/login/page.test.tsx src/app/signup/page.test.tsx src/components/auth/LoginForm.test.tsx src/components/auth/SignUpForm.test.tsx src/components/settings/PlatformInfo.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Commit**

  Run: `git add platform/services/mcctl-console/src/app/'(main)'/settings platform/services/mcctl-console/src/app/login platform/services/mcctl-console/src/app/signup && git commit -m "feat: align settings and auth with Bento surfaces"`

### Task 11: Admin users

**Files:**
- Modify: `platform/services/mcctl-console/src/app/(main)/admin/users/page.tsx`
- Modify: `platform/services/mcctl-console/src/app/(main)/admin/users/page.test.tsx`
- Verify: `platform/services/mcctl-console/src/app/(main)/admin/layout.test.tsx`
- Verify: `platform/services/mcctl-console/src/components/admin/UserList.test.tsx`
- Verify: `platform/services/mcctl-console/src/components/admin/UserDetailDialog.test.tsx`

**Interfaces:**
- Consumes: Task 1 primitives.
- Preserves: admin layout authorization, `useAdminUsers`, list selection, detail dialog, roles, bans, and confirmation behavior.

- [ ] **Step 1: Extend tests before changing layout**

  Assert one compact hero, total/admin/banned counts from the existing user array, long email containment, full-width user-list panel, loading/error/empty states with page context, and unchanged detail-dialog opening. Retain admin layout authorization tests.

- [ ] **Step 2: Verify RED**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/admin/users/page.test.tsx src/app/\(main\)/admin/layout.test.tsx src/components/admin/UserList.test.tsx src/components/admin/UserDetailDialog.test.tsx`

  Expected: FAIL on Bento hero and metrics expectations while authorization tests remain green.

- [ ] **Step 3: Implement the admin-users composition**

  Use existing user data for metrics and keep all authorization and mutations outside shared components.

- [ ] **Step 4: Run focused tests**

  Run: `pnpm --filter @minecraft-docker/mcctl-console exec vitest run src/app/\(main\)/admin/users/page.test.tsx src/app/\(main\)/admin/layout.test.tsx src/components/admin/UserList.test.tsx src/components/admin/UserDetailDialog.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Run the administration phase gate**

  Run: `pnpm --filter @minecraft-docker/mcctl-console test -- --reporter=dot && pnpm --filter @minecraft-docker/mcctl-console type-check && pnpm --filter @minecraft-docker/mcctl-console lint && pnpm --filter @minecraft-docker/mcctl-console build`

  Expected: all checks PASS with no new warnings.

- [ ] **Step 6: Commit**

  Run: `git add platform/services/mcctl-console/src/app/'(main)'/admin/users && git commit -m "feat: apply Bento layout to user administration"`

### Task 12: Whole-console consistency and release verification

**Files:**
- Modify only if checks find drift: migrated page/component files from Tasks 1–11.
- Modify if a public responsive assertion is useful: `platform/services/mcctl-console/e2e/home.spec.ts`

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: a clean, verified feature branch with no superseded page-local header gradients or unused layout imports.

- [ ] **Step 1: Scan for incomplete migration and dead code**

  Run: `rg -n "Page Header|gradient\(|<Grid|ResourceStatCard|DashboardHero|StatCard" platform/services/mcctl-console/src/app platform/services/mcctl-console/src/components`

  Review each match; keep intentional hero gradients and dense internal grids, remove only superseded page-shell code and unused imports. Run `git diff --check`.

- [ ] **Step 2: Run the complete automated verification suite**

  Run:

  `pnpm --filter @minecraft-docker/mcctl-console test -- --reporter=dot`

  `pnpm --filter @minecraft-docker/mcctl-console type-check`

  `pnpm --filter @minecraft-docker/mcctl-console lint`

  `pnpm --filter @minecraft-docker/mcctl-console build`

  Expected: all tests and build pass; lint has no new warnings beyond the two documented pre-existing hook dependency warnings.

- [ ] **Step 3: Run authenticated browser QA against an isolated local database**

  Start the feature build on a free non-production port with a temporary `DATABASE_URL`, local auth secret, and the existing mcctl API credentials. Test dashboard, servers, one server detail, server console, worlds, players, backups, routing, audit logs, settings, and admin users at widths `375`, `768`, and `1440`.

  For every route verify: exactly one visible `h1`, no document-level horizontal overflow, primary action reachable, no clipped menus/dialogs, keyboard focus visible, status includes text, and loading/error/disconnected states do not masquerade as live data.

- [ ] **Step 4: Review the complete diff**

  Run: `git status --short && git diff --check && git diff 7ee2d05...HEAD --stat`

  Confirm no API, schema, hook ownership, permission, or dependency changes slipped into the presentation work.

- [ ] **Step 5: Commit any final consistency fixes**

  If Step 1–4 required changes, run: `git add platform/services/mcctl-console && git commit -m "fix: finish console Bento consistency pass"`. If no files changed, do not create an empty commit.

- [ ] **Step 6: Request final code review and re-run affected checks**

  Use `superpowers:requesting-code-review` for the whole branch. Address Critical and Important findings with focused failing tests, then repeat the full verification commands before declaring completion.
