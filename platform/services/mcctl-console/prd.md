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
│   │   │       ├── page.tsx    # 서버 상세
│   │   │       ├── console/
│   │   │       │   └── page.tsx # RCON 콘솔
│   │   │       └── config/
│   │   │           └── page.tsx # 서버 설정
│   │   ├── worlds/
│   │   │   └── page.tsx        # 월드 관리
│   │   ├── players/
│   │   │   └── page.tsx        # 플레이어 관리
│   │   ├── backup/
│   │   │   └── page.tsx        # 백업 관리
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts # NextAuth 라우트
│   │       └── [...path]/
│   │           └── route.ts    # BFF 프록시
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 기본 컴포넌트
│   │   ├── server/             # 서버 관련 컴포넌트
│   │   │   ├── ServerCard.tsx
│   │   │   ├── ServerStatus.tsx
│   │   │   ├── ServerActions.tsx
│   │   │   └── RconConsole.tsx
│   │   ├── world/              # 월드 관련 컴포넌트
│   │   │   ├── WorldList.tsx
│   │   │   └── WorldAssign.tsx
│   │   ├── player/             # 플레이어 관련 컴포넌트
│   │   │   ├── PlayerList.tsx
│   │   │   ├── WhitelistManager.tsx
│   │   │   └── BanManager.tsx
│   │   └── layout/             # 레이아웃 컴포넌트
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       └── Navigation.tsx
│   ├── lib/
│   │   ├── api-client.ts       # mcctl-api 클라이언트
│   │   ├── utils.ts            # 유틸리티
│   │   └── constants.ts        # 상수 정의
│   ├── hooks/
│   │   ├── useServers.ts       # 서버 데이터 훅
│   │   ├── useWorlds.ts        # 월드 데이터 훅
│   │   └── usePlayers.ts       # 플레이어 데이터 훅
│   └── auth/
│       ├── auth.ts             # NextAuth 설정
│       └── auth.config.ts      # 인증 옵션
├── public/
│   └── favicon.ico
├── tests/
│   ├── components/
│   └── e2e/
└── Dockerfile
```

## 4. 페이지 구조

### 4.1 페이지 맵

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | Home | 대시보드로 리다이렉트 |
| `/login` | Login | 로그인 페이지 |
| `/dashboard` | Dashboard | 전체 현황 대시보드 |
| `/servers` | Server List | 서버 목록 및 관리 |
| `/servers/:name` | Server Detail | 서버 상세 정보 |
| `/servers/:name/console` | RCON Console | 웹 RCON 콘솔 |
| `/servers/:name/config` | Server Config | 서버 설정 |
| `/worlds` | World Manager | 월드 목록 및 할당 |
| `/players` | Player Manager | 플레이어 관리 |
| `/backup` | Backup Manager | 백업 관리 |

### 4.2 대시보드 위젯

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard                                                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ Running: 3/5    │  │ Players: 12     │  │ Worlds: 8   │  │
│  │ [■■■□□]         │  │ Online Now      │  │ Total       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
│                                                              │
│  Servers                                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ mc-survival   │ 1.21.1 │ PAPER │ ● Running │ 5 players│   │
│  │ mc-creative   │ 1.21.1 │ PAPER │ ○ Stopped │ -        │   │
│  │ mc-modded     │ 1.20.4 │ FORGE │ ● Running │ 3 players│   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Recent Activity                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • Player "Steve" joined mc-survival (2m ago)         │   │
│  │ • Server "mc-modded" started (15m ago)               │   │
│  │ • Backup completed (1h ago)                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 5. BFF 프록시

### 5.1 프록시 라우트

```typescript
// src/app/api/[...path]/route.ts
import { auth } from '@/auth/auth';

const API_BASE = process.env.INTERNAL_API_URL || 'http://mcctl-api:3001';

export async function GET(request: Request, { params }: { params: { path: string[] } }) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = params.path.join('/');
  const url = new URL(request.url);

  const response = await fetch(`${API_BASE}/api/${path}${url.search}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response;
}

// POST, PUT, DELETE도 동일 패턴
```

### 5.2 API 클라이언트

```typescript
// src/lib/api-client.ts
class ApiClient {
  private baseUrl = '/api';

  async getServers(): Promise<Server[]> {
    const res = await fetch(`${this.baseUrl}/servers`);
    const data = await res.json();
    return data.data;
  }

  async startServer(name: string): Promise<void> {
    await fetch(`${this.baseUrl}/servers/${name}/start`, { method: 'POST' });
  }

  async stopServer(name: string): Promise<void> {
    await fetch(`${this.baseUrl}/servers/${name}/stop`, { method: 'POST' });
  }

  // ... 기타 메서드
}

export const apiClient = new ApiClient();
```

## 6. 인증

### 6.1 NextAuth 설정

```typescript
// src/auth/auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        // IUserRepository를 통한 인증
        const { username, password } = credentials;

        const res = await fetch(`${process.env.INTERNAL_API_URL}/api/auth/verify`, {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });

        if (!res.ok) return null;

        const user = await res.json();
        return user;
      },
    }),
  ],
});
```

### 6.2 세션 구조

```typescript
interface Session {
  user: {
    username: string;
    role: 'admin' | 'operator' | 'viewer';
  };
  expires: string;
}
```

### 6.3 역할별 권한

| 역할 | 서버 | 월드 | 플레이어 | 백업 | 설정 |
|------|------|------|---------|------|------|
| admin | 모든 권한 | 모든 권한 | 모든 권한 | 모든 권한 | 모든 권한 |
| operator | 조회/시작/중지 | 조회 | 모든 권한 | 조회 | 읽기 전용 |
| viewer | 조회만 | 조회만 | 조회만 | 조회만 | 읽기 전용 |

## 7. 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `INTERNAL_API_URL` | mcctl-api 내부 URL | `http://mcctl-api:3001` |
| `NEXTAUTH_SECRET` | NextAuth 암호화 키 | - (필수) |
| `NEXTAUTH_URL` | 외부 접근 URL | `http://localhost:3000` |

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
    "react-dom": "^18.x",
    "@tanstack/react-query": "^5.x",
    "tailwindcss": "^3.x"
  }
}
```

## 9. UI/UX 가이드라인

### 9.1 디자인 원칙
- 심플하고 직관적인 인터페이스
- 다크 모드 기본 (마인크래프트 테마)
- 실시간 상태 업데이트 (polling/SSE)
- 반응형 디자인 (모바일 지원)

### 9.2 컬러 팔레트

```css
:root {
  --bg-primary: #1a1a2e;       /* 배경 */
  --bg-secondary: #16213e;     /* 카드 배경 */
  --accent-primary: #4ade80;   /* 성공/실행 중 */
  --accent-warning: #fbbf24;   /* 경고 */
  --accent-danger: #ef4444;    /* 에러/중지 */
  --text-primary: #f1f5f9;     /* 주요 텍스트 */
  --text-secondary: #94a3b8;   /* 보조 텍스트 */
}
```

## 10. 테스트 계획

### 10.1 단위 테스트
- 컴포넌트 테스트 (React Testing Library)
- 훅 테스트
- 유틸리티 함수 테스트

### 10.2 E2E 테스트
- Playwright를 사용한 E2E 테스트
- 로그인 플로우
- 서버 관리 플로우
- 플레이어 관리 플로우

## 11. Revision History

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0.0 | 2025-01-25 | - | 초기 PRD 작성 |
