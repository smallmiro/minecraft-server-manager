# Issue: mcctl-console Dashboard Page

## Phase
8.4.4 - mcctl-console Service

## Title
feat(mcctl-console): Implement dashboard page with server overview

## Description
Implement a dashboard page that provides an at-a-glance view of server status.

## Prerequisites
- #8.4.1 mcctl-console project foundation
- #8.4.2 mcctl-console NextAuth authentication
- #8.4.3 mcctl-console BFF proxy

## Tasks
- [ ] `src/app/dashboard/page.tsx` - Dashboard page
- [ ] `src/components/server/ServerCard.tsx` - Server card component
- [ ] `src/components/server/ServerStats.tsx` - Stats widget
- [ ] `src/components/server/PlayerList.tsx` - Online player list
- [ ] `src/hooks/useServers.ts` - Server data hook (React Query)
- [ ] Real-time status updates (polling)
- [ ] Responsive design
- [ ] Tests

## Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Servers     │ │ Online      │ │ Memory      │           │
│  │ 3 / 5      │ │ 12 players  │ │ 8.2GB/16GB  │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Servers                                              │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ● survival   PAPER 1.21.1  3/20  ▶ Running         │   │
│  │ ● creative   PAPER 1.21.1  0/20  ■ Stopped         │   │
│  │ ● modded     FORGE 1.20.4  9/50  ▶ Running         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Component Props

```typescript
interface ServerCardProps {
  name: string;
  type: string;
  version: string;
  status: 'running' | 'stopped';
  players: { online: number; max: number };
  onStart: () => void;
  onStop: () => void;
}
```

## Related Documents
- [mcctl-console PRD](../../platform/services/mcctl-console/prd.md) - Section 4

## Labels
- `phase:8-admin`
- `type:feature`
- `package:mcctl-console`
