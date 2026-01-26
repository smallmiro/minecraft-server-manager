# PRD: mcctl-console - Management Console

## Parent Document
- [Project PRD](../../../prd.md) - Section 10

## Agent Assignment

| Role | Agent | Label |
|------|-------|-------|
| **Owner** | 🎨 Frontend Agent | `agent:frontend` |
| **Spec File** | [.claude/agents/frontend-agent.md](../../../.claude/agents/frontend-agent.md) | - |

**Responsibilities**:
- Next.js App Router implementation
- NextAuth.js authentication
- BFF proxy (client → mcctl-api)
- Dashboard and management UI components
- Tailwind CSS + shadcn/ui styling
- Dockerfile for containerization

**Collaboration**:
- Imports types from `@minecraft-docker/shared`
- Consumes REST API from mcctl-api (Backend Agent)
- Depends on Backend Agent for OpenAPI specification

## 1. Overview

### 1.1 Purpose
Web-based management console for Minecraft servers. Uses BFF (Backend-For-Frontend) pattern to communicate with mcctl-api.

### 1.2 Scope
- User authentication and session management
- Server management dashboard
- World management UI
- Player management UI
- Backup management UI
- BFF proxy (client → mcctl-api)

### 1.3 Non-Goals
- Direct Docker API calls (handled by mcctl-api)
- User data storage (uses shared UserRepository)
- External API exposure (internal communication only)

## 2. Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Next.js (App Router) | 14.x |
| Language | TypeScript | 5.x |
| Auth | NextAuth.js | 5.x |
| Styling | Tailwind CSS | 3.x |
| UI Components | shadcn/ui | - |
| State | React Query | 5.x |
| Shared | @minecraft-docker/shared | workspace |

## 3. Architecture

### 3.1 BFF Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER                                  │
│                   (React Client)                             │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP (localhost:3000)
┌─────────────────────────▼───────────────────────────────────┐
│                  mcctl-console                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Next.js App Router                      │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │    │
│  │  │ Server      │  │ BFF API      │  │ NextAuth   │  │    │
│  │  │ Components  │  │ Routes       │  │ Session    │  │    │
│  │  └─────────────┘  └──────┬───────┘  └────────────┘  │    │
│  └──────────────────────────┼──────────────────────────┘    │
└─────────────────────────────┼───────────────────────────────┘
                              │ HTTP (Docker network)
┌─────────────────────────────▼───────────────────────────────┐
│                      mcctl-api                               │
│              (Internal REST API)                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Directory Structure

```
platform/services/mcctl-console/
├── prd.md                      # This document
├── plan.md                     # Implementation plan
├── package.json                # @minecraft-docker/mcctl-console
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home (→ dashboard redirect)
│   │   ├── login/
│   │   │   └── page.tsx        # Login page
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Dashboard
│   │   ├── servers/
│   │   │   ├── page.tsx        # Server list
│   │   │   └── [name]/
│   │   │       └── page.tsx    # Server details
│   │   ├── worlds/
│   │   │   └── page.tsx        # World management
│   │   ├── players/
│   │   │   └── page.tsx        # Player management
│   │   ├── backup/
│   │   │   └── page.tsx        # Backup management
│   │   └── api/
│   │       └── [...path]/
│   │           └── route.ts    # BFF proxy
│   ├── components/
│   │   ├── ui/                 # shadcn/ui base components
│   │   ├── server/             # Server-related components
│   │   ├── world/              # World-related components
│   │   ├── player/             # Player-related components
│   │   └── layout/             # Layout components
│   ├── lib/
│   │   ├── api-client.ts       # mcctl-api client
│   │   └── utils.ts            # Utilities
│   ├── hooks/
│   │   ├── useServers.ts       # Server data hook
│   │   ├── useWorlds.ts        # World data hook
│   │   └── usePlayers.ts       # Player data hook
│   └── auth/
│       └── auth.ts             # NextAuth configuration
├── tests/
└── Dockerfile
```

## 4. Page Structure

| Path | Page | Description |
|------|------|-------------|
| `/` | Home | Redirect to dashboard |
| `/login` | Login | Login page |
| `/dashboard` | Dashboard | Overall status dashboard |
| `/servers` | Server List | Server list and management |
| `/servers/:name` | Server Detail | Server details |
| `/worlds` | World Manager | World list and assignment |
| `/players` | Player Manager | Player management |
| `/backup` | Backup Manager | Backup management |

## 5. Authentication

### 5.1 NextAuth Configuration

Uses Credentials Provider to authenticate users via mcctl-api.

### 5.2 Role-based Permissions

| Role | Servers | Worlds | Players | Backup | Settings |
|------|---------|--------|---------|--------|----------|
| admin | All | All | All | All | All |
| operator | View/Start/Stop | View | All | View | Read-only |
| viewer | View only | View only | View only | View only | Read-only |

## 6. Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `INTERNAL_API_URL` | mcctl-api internal URL | `http://mcctl-api:3001` |
| `NEXTAUTH_SECRET` | NextAuth encryption key | - (required) |
| `NEXTAUTH_URL` | External access URL | `http://localhost:3000` |

## 7. UI/UX Guidelines

### 7.1 Design Principles
- Simple and intuitive interface
- Dark mode default (Minecraft theme)
- Real-time status updates
- Responsive design (mobile support)

### 7.2 Color Palette

```css
:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --accent-primary: #4ade80;
  --accent-warning: #fbbf24;
  --accent-danger: #ef4444;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
}
```

## 8. Dependencies

### 8.1 Internal Dependencies

```json
{
  "dependencies": {
    "@minecraft-docker/shared": "workspace:*"
  }
}
```

### 8.2 External Dependencies

```json
{
  "dependencies": {
    "next": "^14.x",
    "next-auth": "^5.x",
    "react": "^18.x",
    "@tanstack/react-query": "^5.x",
    "tailwindcss": "^3.x"
  }
}
```

## 9. Test Plan

- Component tests (React Testing Library)
- E2E tests (Playwright)

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-25 | - | Initial PRD |
