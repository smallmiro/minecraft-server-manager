# PRD: mcctl-console - Management Console

## 상위 문서
- [전체 프로젝트 PRD](../../../prd.md) - Section 10

## 1. 개요

### 1.1 목적
마인크래프트 서버 관리를 위한 웹 기반 관리 콘솔입니다. BFF(Backend-For-Frontend) 패턴을 사용하여 mcctl-api와 통신합니다.

### 1.2 범위
- 사용자 인증 및 세션 관리
- 서버 관리 대시보드
- 월드 관리 UI
- 플레이어 관리 UI
- 백업 관리 UI
- BFF 프록시 (클라이언트 → mcctl-api)

### 1.3 비목표
- 직접 Docker API 호출 (mcctl-api 담당)
- 사용자 정보 저장 (shared의 UserRepository 사용)
- 외부 API 노출 (내부 통신만)

## 2. 기술 스택

| 구성요소 | 기술 | 버전 |
|---------|------|------|
| Framework | Next.js (App Router) | 14.x |
| Language | TypeScript | 5.x |
| Auth | NextAuth.js | 5.x |
| Styling | Tailwind CSS | 3.x |
| UI Components | shadcn/ui | - |
| State | React Query | 5.x |
| Shared | @minecraft-docker/shared | workspace |

## 3. 아키텍처

### 3.1 BFF 패턴

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

### 3.2 디렉토리 구조

```
platform/services/mcctl-console/
├── prd.md                      # 이 문서
├── plan.md                     # 구현 계획
├── package.json                # @minecraft-docker/mcctl-console
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── src/
│   ├── app/
│   │   ├── layout.tsx          # 루트 레이아웃
│   │   ├── page.tsx            # 홈 (→ 대시보드 리다이렉트)
│   │   ├── login/
│   │   │   └── page.tsx        # 로그인 페이지
│   │   ├── dashboard/
│   │   │   └── page.tsx        # 대시보드
│   │   ├── servers/
│   │   │   ├── page.tsx        # 서버 목록
│   │   │   └── [name]/
│   │   │       └── page.tsx    # 서버 상세
│   │   ├── worlds/
│   │   │   └── page.tsx        # 월드 관리
│   │   ├── players/
│   │   │   └── page.tsx        # 플레이어 관리
│   │   ├── backup/
│   │   │   └── page.tsx        # 백업 관리
│   │   └── api/
│   │       └── [...path]/
│   │           └── route.ts    # BFF 프록시
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 기본 컴포넌트
│   │   ├── server/             # 서버 관련 컴포넌트
│   │   ├── world/              # 월드 관련 컴포넌트
│   │   ├── player/             # 플레이어 관련 컴포넌트
│   │   └── layout/             # 레이아웃 컴포넌트
│   ├── lib/
│   │   ├── api-client.ts       # mcctl-api 클라이언트
│   │   └── utils.ts            # 유틸리티
│   ├── hooks/
│   │   ├── useServers.ts       # 서버 데이터 훅
│   │   ├── useWorlds.ts        # 월드 데이터 훅
│   │   └── usePlayers.ts       # 플레이어 데이터 훅
│   └── auth/
│       └── auth.ts             # NextAuth 설정
├── tests/
└── Dockerfile
```

## 4. 페이지 구조

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | Home | 대시보드로 리다이렉트 |
| `/login` | Login | 로그인 페이지 |
| `/dashboard` | Dashboard | 전체 현황 대시보드 |
| `/servers` | Server List | 서버 목록 및 관리 |
| `/servers/:name` | Server Detail | 서버 상세 정보 |
| `/worlds` | World Manager | 월드 목록 및 할당 |
| `/players` | Player Manager | 플레이어 관리 |
| `/backup` | Backup Manager | 백업 관리 |

## 5. 인증

### 5.1 NextAuth 설정

Credentials Provider를 사용하여 mcctl-api를 통해 사용자 인증합니다.

### 5.2 역할별 권한

| 역할 | 서버 | 월드 | 플레이어 | 백업 | 설정 |
|------|------|------|---------|------|------|
| admin | 모든 권한 | 모든 권한 | 모든 권한 | 모든 권한 | 모든 권한 |
| operator | 조회/시작/중지 | 조회 | 모든 권한 | 조회 | 읽기 전용 |
| viewer | 조회만 | 조회만 | 조회만 | 조회만 | 읽기 전용 |

## 6. 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `INTERNAL_API_URL` | mcctl-api 내부 URL | `http://mcctl-api:3001` |
| `NEXTAUTH_SECRET` | NextAuth 암호화 키 | - (필수) |
| `NEXTAUTH_URL` | 외부 접근 URL | `http://localhost:3000` |

## 7. UI/UX 가이드라인

### 7.1 디자인 원칙
- 심플하고 직관적인 인터페이스
- 다크 모드 기본 (마인크래프트 테마)
- 실시간 상태 업데이트
- 반응형 디자인 (모바일 지원)

### 7.2 컬러 팔레트

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

## 8. 의존성

### 8.1 내부 의존성

```json
{
  "dependencies": {
    "@minecraft-docker/shared": "workspace:*"
  }
}
```

### 8.2 외부 의존성

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

## 9. 테스트 계획

- 컴포넌트 테스트 (React Testing Library)
- E2E 테스트 (Playwright)

## 10. Revision History

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0.0 | 2025-01-25 | - | 초기 PRD 작성 |
