# Issue: mcctl-console 프로젝트 기반 구조

## Phase
8.4.1 - mcctl-console 서비스

## 제목
feat(mcctl-console): Setup Next.js project foundation

## 설명
mcctl-console 관리 콘솔 서비스의 기본 Next.js 프로젝트 구조를 설정합니다.

## 작업 내용
- [ ] `package.json` 생성 (`@minecraft-docker/mcctl-console`)
- [ ] `tsconfig.json` 설정
- [ ] `next.config.js` 설정
- [ ] `tailwind.config.js` 설정
- [ ] `src/app/layout.tsx` - 루트 레이아웃
- [ ] `src/app/page.tsx` - 홈 (대시보드 리다이렉트)
- [ ] `src/components/layout/Sidebar.tsx`
- [ ] `src/components/layout/Header.tsx`
- [ ] shadcn/ui 설정
- [ ] pnpm-workspace.yaml에 패키지 추가
- [ ] 빌드 테스트

## 의존성

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

## UI 컬러 팔레트 (다크 테마)

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

## 관련 문서
- [mcctl-console PRD](../../platform/services/mcctl-console/prd.md)
- [mcctl-console Plan](../../platform/services/mcctl-console/plan.md) - Phase 1

## 라벨
- `phase:8-admin`
- `type:feature`
- `package:mcctl-console`
