# Implementation Plan: mcctl-console

## 상위 문서
- [전체 프로젝트 Plan](../../../plan.md) - Phase 8

## 개요

mcctl-console 관리 콘솔 서비스의 구현 계획입니다.

## Phase 1: 프로젝트 기반 구조

### 1.1 패키지 설정
- [ ] `package.json` 생성 (`@minecraft-docker/mcctl-console`)
- [ ] `tsconfig.json` 설정
- [ ] `next.config.js` 설정
- [ ] `tailwind.config.js` 설정
- [ ] pnpm-workspace.yaml에 패키지 추가

### 1.2 기본 레이아웃
- [ ] `src/app/layout.tsx` - 루트 레이아웃
- [ ] `src/app/page.tsx` - 홈 (리다이렉트)
- [ ] `src/components/layout/Sidebar.tsx` - 사이드바
- [ ] `src/components/layout/Header.tsx` - 헤더
- [ ] `src/components/layout/Navigation.tsx` - 네비게이션

### 1.3 UI 컴포넌트
- [ ] shadcn/ui 설정
- [ ] 기본 컴포넌트 추가 (Button, Card, Input, etc.)

## Phase 2: 인증 시스템

### 2.1 NextAuth 설정
- [ ] `src/auth/auth.ts` - NextAuth 설정
- [ ] `src/auth/auth.config.ts` - 인증 옵션
- [ ] `src/app/api/auth/[...nextauth]/route.ts` - 인증 라우트

### 2.2 로그인 페이지
- [ ] `src/app/login/page.tsx` - 로그인 페이지
- [ ] 로그인 폼 컴포넌트
- [ ] 에러 처리

### 2.3 세션 관리
- [ ] 미들웨어 설정 (보호된 라우트)
- [ ] 세션 갱신 로직
- [ ] 로그아웃 처리

## Phase 3: BFF 프록시

### 3.1 API 프록시
- [ ] `src/app/api/[...path]/route.ts` - BFF 프록시
- [ ] GET, POST, PUT, DELETE 핸들러
- [ ] 인증 토큰 전달
- [ ] 에러 처리

### 3.2 API 클라이언트
- [ ] `src/lib/api-client.ts` - API 클라이언트
- [ ] 서버 API 메서드
- [ ] 월드 API 메서드
- [ ] 플레이어 API 메서드
- [ ] 백업 API 메서드

### 3.3 React Query 설정
- [ ] QueryClient 설정
- [ ] 커스텀 훅 작성
  - [ ] `useServers()`
  - [ ] `useWorlds()`
  - [ ] `usePlayers()`
  - [ ] `useBackup()`

## Phase 4: 대시보드

### 4.1 대시보드 페이지
- [ ] `src/app/dashboard/page.tsx` - 대시보드
- [ ] 통계 위젯 (서버 수, 플레이어 수, 월드 수)
- [ ] 서버 목록 카드
- [ ] 최근 활동 로그

### 4.2 대시보드 컴포넌트
- [ ] `src/components/dashboard/StatsCard.tsx`
- [ ] `src/components/dashboard/ServerOverview.tsx`
- [ ] `src/components/dashboard/ActivityLog.tsx`

## Phase 5: 서버 관리

### 5.1 서버 목록
- [ ] `src/app/servers/page.tsx` - 서버 목록
- [ ] `src/components/server/ServerCard.tsx`
- [ ] `src/components/server/ServerStatus.tsx`
- [ ] 필터링 및 검색

### 5.2 서버 상세
- [ ] `src/app/servers/[name]/page.tsx` - 서버 상세
- [ ] 서버 정보 표시
- [ ] 시작/중지/재시작 버튼
- [ ] 온라인 플레이어 목록

### 5.3 RCON 콘솔
- [ ] `src/app/servers/[name]/console/page.tsx`
- [ ] `src/components/server/RconConsole.tsx`
- [ ] 명령어 입력
- [ ] 응답 표시

### 5.4 서버 설정
- [ ] `src/app/servers/[name]/config/page.tsx`
- [ ] 설정 편집 폼
- [ ] 설정 저장

## Phase 6: 월드 관리

### 6.1 월드 목록
- [ ] `src/app/worlds/page.tsx` - 월드 관리
- [ ] `src/components/world/WorldList.tsx`
- [ ] 월드 상태 표시 (할당됨/가용)

### 6.2 월드 할당
- [ ] `src/components/world/WorldAssign.tsx`
- [ ] 월드-서버 할당 UI
- [ ] 할당 해제 UI

## Phase 7: 플레이어 관리

### 7.1 플레이어 목록
- [ ] `src/app/players/page.tsx` - 플레이어 관리
- [ ] `src/components/player/PlayerList.tsx`
- [ ] 온라인/오프라인 필터

### 7.2 화이트리스트
- [ ] `src/components/player/WhitelistManager.tsx`
- [ ] 추가/제거 UI
- [ ] 검색 기능

### 7.3 밴 관리
- [ ] `src/components/player/BanManager.tsx`
- [ ] 밴/언밴 UI
- [ ] 밴 사유 표시

### 7.4 OP 관리
- [ ] `src/components/player/OpManager.tsx`
- [ ] OP 추가/제거 UI

## Phase 8: 백업 관리

### 8.1 백업 페이지
- [ ] `src/app/backup/page.tsx` - 백업 관리
- [ ] 백업 상태 표시
- [ ] 백업 이력 목록

### 8.2 백업 기능
- [ ] 수동 백업 트리거
- [ ] 백업 복원 UI
- [ ] 백업 메시지 입력

## Phase 9: Docker 설정

### 9.1 Dockerfile
- [ ] `Dockerfile` 작성
- [ ] Multi-stage 빌드
- [ ] Next.js 최적화 설정

### 9.2 CI/CD
- [ ] GitHub Actions 워크플로우
- [ ] ghcr.io 이미지 푸시

## Phase 10: 테스트

### 10.1 단위 테스트
- [ ] 컴포넌트 테스트 (React Testing Library)
- [ ] 훅 테스트
- [ ] 유틸리티 함수 테스트

### 10.2 E2E 테스트
- [ ] Playwright 설정
- [ ] 로그인 플로우 테스트
- [ ] 서버 관리 플로우 테스트
- [ ] 플레이어 관리 플로우 테스트

## 의존성

### 내부 의존성
- `@minecraft-docker/shared` - 타입 정의

### 외부 의존성
```json
{
  "dependencies": {
    "next": "^14.x",
    "next-auth": "^5.x",
    "react": "^18.x",
    "react-dom": "^18.x",
    "@tanstack/react-query": "^5.x",
    "tailwindcss": "^3.x",
    "class-variance-authority": "^0.7.x",
    "clsx": "^2.x",
    "lucide-react": "^0.x"
  },
  "devDependencies": {
    "@testing-library/react": "^14.x",
    "@playwright/test": "^1.x",
    "vitest": "^1.x"
  }
}
```

## 완료 기준

1. 모든 페이지 구현 및 정상 동작
2. NextAuth 인증 정상 동작
3. BFF 프록시 통한 API 호출 성공
4. 반응형 디자인 (모바일 지원)
5. Docker 이미지 빌드 성공
6. mcctl-api와의 통합 테스트 통과

## Revision History

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0.0 | 2025-01-25 | - | 초기 계획 작성 |
