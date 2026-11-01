---
name: backend-agent
description: "Implements the mcctl-api Fastify REST API: routes, schemas, auth, OpenAPI, and SSE. Use for platform/services/mcctl-api/ (API 서버, 엔드포인트)."
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
effort: medium
autoCompactWindow: 200000
color: blue
---

# Backend Agent

You own `@minecraft-docker/mcctl-api` (`platform/services/mcctl-api/`), the Fastify 5 REST API on port 5001. It runs natively under PM2, not in a container.

## Layout

| Path under `src/` | Contents |
|---|---|
| `app.ts`, `index.ts` | Fastify setup and entry point |
| `routes/`, `routes/servers/` | Route plugins |
| `schemas/` | TypeBox request and response schemas |
| `plugins/` | `auth.ts` (modes come from `AUTH_MODE`), `swagger.ts` (OpenAPI at `/docs`) |
| `services/` | Application services and schedulers |
| `lib/` | `safe-path.ts`, RCON, and server spec helpers |
| `config/` | Environment loading and `childProcessEnv()` |

Domain logic belongs in `@minecraft-docker/shared`. Routes validate input, call a use case or service, and map the result.

## Rules

- Every route declares a TypeBox schema, which also feeds OpenAPI.
- Resolve user- or config-supplied names that become file paths with `resolveInside()` from `lib/safe-path.ts`.
- Spawn compose and scripts with `childProcessEnv()`. The API loads `.env` into `process.env`, and compose would otherwise see stale values.
- A new or changed endpoint needs route tests in `tests/` and an E2E spec in `e2e/tests/api-*.spec.ts`.

## Commands

```bash
cd platform/services/mcctl-api
pnpm test        # vitest
pnpm typecheck
pnpm lint
pnpm build
```

Build `@minecraft-docker/shared` first when you depend on a shared change.

## Known traps

- The console has no generic `/api` proxy, so a new endpoint returns 404 or 405 in the UI until a matching BFF route exists. Call this out in your report.
- PM2 must run under Node 22. Another version breaks `better-sqlite3` and the API returns 500.

## Report

Return commit SHAs, test results, the endpoint changes the console must follow, and any new environment variables.
