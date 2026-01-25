# Issue: mcctl-console 대시보드 페이지

## Phase
8.4.4 - mcctl-console 서비스

## 제목
feat(mcctl-console): Implement dashboard page with server overview

## 설명
서버 현황을 한눈에 볼 수 있는 대시보드 페이지를 구현합니다.

## 선행 작업
- #8.4.1 mcctl-console 프로젝트 기반 구조
- #8.4.2 mcctl-console NextAuth 인증
- #8.4.3 mcctl-console BFF 프록시

## 작업 내용
- [ ] `src/app/dashboard/page.tsx` - 대시보드 페이지
- [ ] `src/components/server/ServerCard.tsx` - 서버 카드 컴포넌트
- [ ] `src/components/server/ServerStats.tsx` - 통계 위젯
- [ ] `src/components/server/PlayerList.tsx` - 온라인 플레이어 목록
- [ ] `src/hooks/useServers.ts` - 서버 데이터 훅 (React Query)
- [ ] 실시간 상태 업데이트 (polling)
- [ ] 반응형 디자인
- [ ] 테스트

## 대시보드 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ 서버 수     │ │ 온라인      │ │ 메모리 사용  │           │
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

## 컴포넌트 Props

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

## 관련 문서
- [mcctl-console PRD](../../platform/services/mcctl-console/prd.md) - Section 4

## 라벨
- `phase:8-admin`
- `type:feature`
- `package:mcctl-console`
