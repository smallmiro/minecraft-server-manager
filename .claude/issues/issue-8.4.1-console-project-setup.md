# Issue: mcctl-console Project Foundation

## Phase
8.4.1 - mcctl-console Service

## Title
feat(mcctl-console): Setup Next.js project foundation

## Description
Set up the basic Next.js project structure for the mcctl-console management console service.

## Tasks
- [ ] Create `package.json` (`@minecraft-docker/mcctl-console`)
- [ ] Configure `tsconfig.json`
- [ ] Configure `next.config.js`
- [ ] Configure `tailwind.config.js`
- [ ] `src/app/layout.tsx` - Root layout
- [ ] `src/app/page.tsx` - Home (dashboard redirect)
- [ ] `src/components/layout/Sidebar.tsx`
- [ ] `src/components/layout/Header.tsx`
- [ ] Setup shadcn/ui
- [ ] Add package to pnpm-workspace.yaml
- [ ] Build test

## Dependencies

```json
{
  "dependencies": {
    "next": "^14.x",
    "react": "^18.x",
    "tailwindcss": "^3.x",
    "@tanstack/react-query": "^5.x"
  }
}
```

## UI Color Palette (Dark Theme)

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

## Related Documents
- [mcctl-console PRD](../../platform/services/mcctl-console/prd.md)
- [mcctl-console Plan](../../platform/services/mcctl-console/plan.md) - Phase 1

## Labels
- `phase:8-admin`
- `type:feature`
- `package:mcctl-console`
