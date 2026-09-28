# Console Bento UI Design

## Purpose

Extend the approved dashboard Bento UI pilot across the mcctl console without reducing the information density needed for day-to-day Minecraft server operations. The result should feel like one coherent control surface: important state and actions are visually prominent, dense operational data remains easy to scan, and every page works from a 375px mobile viewport through a wide desktop.

The primary users are server administrators and delegated operators. Success means they can identify system state, find the primary action, and reach detailed data at least as quickly as before while the console gains a consistent visual hierarchy.

## Chosen Approach

Use a small set of shared Bento layout primitives, proven by the dashboard pilot, and migrate screens incrementally. The alternatives were a theme-only restyle, which cannot express page-level hierarchy, and page-local restyles, which would duplicate layout rules and drift over time. Shared primitives give the console a common grammar while leaving each operational page free to choose the layout its content needs.

This is not a tile-everything redesign. Bento composition is used for page hierarchy, summaries, status, filters, and primary actions. Tables, forms, tab panels, file browsers, and terminal output retain their dense task-oriented presentation inside a suitable surface.

## Scope

### Included

- Extract the dashboard's responsive grid, elevated surface, page hero, and metric presentation into reusable console components.
- Refactor the dashboard to consume those components without changing its behavior.
- Apply the system to the server list, server detail, server console, worlds, players, backups, routing, audit logs, settings, and admin users pages.
- Align loading, empty, error, and disconnected states with the final page geometry.
- Preserve existing API calls, hooks, permissions, navigation, actions, and domain behavior.
- Validate desktop, tablet, and 375px mobile layouts.

### Excluded

- Backend, database, or API contract changes.
- Navigation information-architecture changes.
- New charts, fabricated trends, or metrics not already available from existing data.
- A new component library, CSS framework, or runtime dependency.
- A light theme.
- Redesigning login and signup flows beyond applying the shared surface and spacing language.

## Visual System

The current dark Modrinth-inspired palette remains the foundation. Bento UI adds hierarchy through scale, span, spacing, subtle accent gradients, and restrained elevation rather than introducing a second visual identity.

- Breakpoints follow the existing MUI theme: one column below `sm`, six columns from `sm`, and twelve columns from `md`.
- Grid gaps are `16px` on mobile and `20px` from `sm` upward.
- Standard Bento surfaces use a `16px` corner radius, a divider-colored border, and no background image.
- Hero surfaces may use a semantic accent gradient and stronger shadow. Ordinary content panels stay neutral.
- Accent colors come only from the existing MUI semantic palette. Color never carries status without text or an icon.
- Hover lift is limited to interactive or summary cards. Static data panels do not move.
- Motion is removed when `prefers-reduced-motion` is enabled.
- Mobile DOM order is the reading order; CSS placement must not create a different visual sequence.

## Shared Components

Create a focused `src/components/bento/` module rather than expanding global MUI overrides.

### `BentoGrid`

A semantic `Box` wrapper that supplies the one/six/twelve-column responsive grid, standard gaps, stretched items, and `minmax(0, 1fr)` tracks. Pages choose their own spans through `sx`; the component does not encode page-specific templates.

### `BentoPanel`

A `Paper`-based surface for bounded sections. It owns the standard radius, border, overflow behavior, and optional semantic accent. It accepts normal MUI `Paper` properties and `sx` so dense existing components can be placed inside without wrappers fighting their layout.

### `PageHero`

A responsive page introduction with one `h1`, optional eyebrow/icon, description, status, metrics, and action slot. On mobile, actions wrap below the title. Destructive actions remain visually separated from the primary action. Pages with no useful summary use the compact variant rather than filling space.

### `BentoMetricCard`

The reusable form of the dashboard `StatCard`. It supports a label, value, optional unit, icon, description, semantic accent, and an optional computed progress value clamped to 0–100. It does not calculate business metrics. Dashboard keeps a compatibility export while migrating to the shared implementation.

Page-specific skeletons use these primitives and match the loaded geometry. A generic skeleton abstraction is intentionally excluded because each screen's information hierarchy differs.

## Page Composition

### Dashboard

Keep the approved pilot composition: status hero, four metrics, server overview, routing summary, recent activity, and changelog. Refactor only the visual primitives. SSE-overlay status, unhealthy-server attention counts, and `Live`/`Reconnecting` behavior must remain unchanged.

### Servers

The list page uses a compact operational hero with total/running/attention counts and the create-server action. Search and filters sit in a full-width control panel directly above the server collection. Server cards retain all current controls and permissions.

The server detail page uses a status hero for identity, health, address, and lifecycle actions. Resource summaries form a metric row. Existing tabs remain the primary detail navigation and occupy one full-width panel so configuration, files, backups, access, mods, and world controls remain dense and predictable.

The server console is a focus screen, not a decorative mosaic. A compact hero shows server and connection state; the terminal receives the dominant remaining viewport area; command and connection controls form one adjacent or stacked panel depending on width. Log lines and terminal keyboard behavior are unchanged.

### Worlds and Players

Worlds uses a summary hero, availability metrics, then filter/actions and the world collection. Map, analysis, upload, lock, and assignment behavior stay unchanged.

Players uses a summary hero and server selector, followed by online/known/whitelist/operator summaries. Existing rosters and management controls stay in dense panels. Loading one server or roster must not reflow unrelated sections.

### Backups, Routing, and Audit Logs

Backups places backup health, last run, schedules, and primary backup action near the top; schedules and history remain full-width operational panels.

Routing emphasizes router state and exposed destinations. Status and summary cards use Bento hierarchy, while hostname and tunnel records remain dense lists.

Audit logs keeps filters and export action prominent, uses summary metrics only where the existing endpoint supplies them, and keeps the log table full width. Live-stream disconnection is shown as explicit status text.

### Settings and Admin Users

Settings uses a compact hero and groups platform, network, and other existing settings into stable panels. Forms keep their current validation and submission behavior.

Admin users uses a compact hero with user counts and the existing management list in a full-width panel. Permission and destructive account actions remain explicit and require the same confirmations as today.

Login and signup remain centered task pages; only surface radius, border, spacing, and accents are aligned with the shared visual language.

## Data and State Flow

Pages continue to own data fetching and business-derived values through the current hooks. Shared Bento components are presentational and receive already-derived values through props. They do not call APIs, subscribe to SSE, inspect permissions, or cache state.

Existing behavior remains authoritative:

1. Page hooks fetch data and expose loading/error state.
2. Existing SSE hooks overlay live status where currently supported.
3. The page derives display metrics and passes them to heroes or metric cards.
4. Existing feature components render actions and dense details inside Bento surfaces.

This boundary keeps visual migration independent from backend behavior and makes each page reversible without changing data contracts.

## Loading, Empty, and Error States

- Initial loading renders a skeleton with the same grid spans and approximate heights as the loaded content.
- Section-level refresh keeps established content visible when the existing query behavior supports it.
- Empty states explain what is absent and preserve the existing creation or recovery action.
- Page-level fetch errors use one prominent panel with retry behavior when already available.
- SSE disconnection changes live-status text and icon; it does not imply that cached server state is live.
- Long labels, hostnames, server names, and translated browser-generated text must wrap or truncate without horizontal page overflow.

## Accessibility

- Each page has exactly one `h1` in its hero or compact header.
- Major groups use named `section` landmarks where this improves navigation.
- Icon-only actions retain accessible labels and visible tooltips.
- Status is always communicated by text in addition to color.
- Focus order follows DOM and mobile reading order.
- Existing keyboard interactions for dialogs, tabs, tables, file tools, and the terminal remain intact.
- Progress indicators expose accessible labels and determinate values only when a real ratio exists.

## Migration Order

1. **Foundation:** add shared Bento primitives and refactor the dashboard onto them.
2. **Primary operations:** migrate servers list, server detail, and server console.
3. **Resource operations:** migrate worlds and players.
4. **Supporting operations:** migrate backups, routing, and audit logs.
5. **Administration:** migrate settings, admin users, login, and signup surface styling.
6. **Consistency pass:** remove superseded page-local layout styles and verify the whole console together.

Each phase must leave the console usable and testable. A phase is committed only after its focused tests and repository checks pass.

## Testing and Acceptance

Implementation follows test-driven development for shared behavior and page structure.

- Shared component tests cover semantic elements, variants, progress clamping, action rendering, and reduced-motion styling where practical.
- Page tests verify the hero title/status, primary actions, critical metrics, loading geometry, and existing permission-sensitive behavior.
- Existing feature tests remain unchanged unless markup movement requires queries to target accessible roles instead of implementation details.
- Focused tests run after each red/green cycle.
- Each phase runs the console test suite, type check, lint, and production build under the repository-supported Node 22 environment.
- Browser QA covers 375px mobile, a tablet width, and desktop. No page may create document-level horizontal scrolling.
- Visual QA checks light-on-dark contrast, focus visibility, long content, empty data, loading data, API failure, and disconnected SSE state.

The migration is accepted when every included page uses the shared hierarchy, all existing actions remain reachable, the verification suite passes, and manual responsive checks reveal no clipped controls or document-level overflow.

## Rollback and Risk Control

The migration changes presentation in page-sized commits and introduces no data migration. If a page regresses, its composition can be reverted independently while retaining the shared primitives for completed pages. The highest-risk screens are server detail and server console because of their dense interactions; they are migrated early enough to validate the system before repetitive support pages are changed.

No global `MuiCard` or `MuiPaper` change will be used to force Bento styling onto untouched areas. This avoids accidental changes to dialogs, menus, and specialized feature components.
