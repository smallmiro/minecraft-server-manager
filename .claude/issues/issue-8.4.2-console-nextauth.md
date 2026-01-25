# Issue: mcctl-console NextAuth Authentication System

## Phase
8.4.2 - mcctl-console Service

## Title
feat(mcctl-console): Implement NextAuth.js authentication

## Description
Implement Credentials Provider based authentication system using NextAuth.js.

## Prerequisites
- #8.4.1 mcctl-console project foundation
- #8.3.1 mcctl-api project foundation

## Tasks
- [ ] `src/auth/auth.ts` - NextAuth configuration
- [ ] `src/auth/auth.config.ts` - Configuration separation
- [ ] `src/app/login/page.tsx` - Login page
- [ ] Implement Credentials Provider (authenticate via mcctl-api)
- [ ] Session management
- [ ] Role-based permission check middleware
- [ ] Tests

## Role-based Permissions

| Role | Servers | Worlds | Players | Backup |
|------|---------|--------|---------|--------|
| admin | All permissions | All permissions | All permissions | All permissions |
| operator | View/Start/Stop | View | All permissions | View |
| viewer | View only | View only | View only | View only |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXTAUTH_SECRET` | Encryption key (required) |
| `NEXTAUTH_URL` | External access URL |
| `INTERNAL_API_URL` | mcctl-api internal URL |

## Related Documents
- [mcctl-console PRD](../../platform/services/mcctl-console/prd.md) - Section 5

## Labels
- `phase:8-admin`
- `type:feature`
- `package:mcctl-console`
