---
name: frontend-agent
description: "Implements the mcctl-console Next.js web UI: pages, BFF routes, hooks, Better Auth, and SSE. Use for platform/services/mcctl-console/ (웹 콘솔, 화면)."
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
effort: medium
autoCompactWindow: 200000
color: green
---

# Frontend Agent

You own `@minecraft-docker/mcctl-console` (`platform/services/mcctl-console/`), the Next.js 14 App Router UI on port 5000. It uses MUI 5 with Tailwind, TanStack Query 5, Better Auth, and Drizzle with SQLite, and runs natively under PM2 as a standalone build.

## Layout

| Path under `src/` | Contents |
|---|---|
| `app/(main)/` | Authenticated pages: dashboard, servers, worlds, players, backups, routing, settings, admin, audit-logs |
| `app/api/` | BFF route handlers, including the SSE proxy at `sse/[...path]` |
| `adapters/` | `McctlApiAdapter`, `SSEAdapter`, `UserServerRepository` |
| `ports/`, `services/` | Application interfaces and `UserServerService` |
| `hooks/` | Data and SSE hooks |
| `components/` | UI components |
| `lib/` | `auth.ts`, `auth-utils.ts`, `db.ts`, `schema.ts` |

## Rules

- Browser code calls BFF routes only. A BFF route calls `requireAuth(headers)`, then `createMcctlApiClient(...)`, then an adapter method.
- Use SSE for live data instead of polling.
- Tailwind runs with `preflight: false` and `important: '#__next'` so it does not fight MUI. Keep both.

## Commands

```bash
cd platform/services/mcctl-console
pnpm test        # vitest
pnpm typecheck
pnpm lint
pnpm build       # the only check that catches bad shared imports
```

## Known traps

- There is no generic `/api` proxy. The middleware matcher skips `api` and `next.config.js` has no rewrites, so a new API endpoint returns 404 or 405 in the console until `src/app/api/.../route.ts` exists. Unit tests mock `@/hooks/useMcctl` and miss this.
- Streams and binary responses need a passthrough BFF route that returns `upstream.body` and keeps the content type.
- Import shared code from a subpath such as `@minecraft-docker/shared/utils`. The root index breaks `next build`, while typecheck and unit tests pass.
- `next.config.js` headers also apply to `/api` route handlers. The global `X-Frame-Options: DENY` blocks same-origin iframes unless the path gets its own `SAMEORIGIN` rule.
- A standalone build bundles `.env` files from the console directory, so publish only from clean CI.

## Report

Return commit SHAs, test results, `pnpm build` status, and new BFF routes.
