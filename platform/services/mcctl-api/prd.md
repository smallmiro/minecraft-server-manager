# PRD: mcctl-api - REST API Service

## 상위 문서
- [전체 프로젝트 PRD](../../../prd.md) - Section 10

## 1. 개요

### 1.1 목적
마인크래프트 서버 관리를 위한 내부 REST API 서비스입니다. mcctl CLI와 동일한 기능을 HTTP API로 제공합니다.

### 1.2 범위
- 서버 관리 API (생성, 삭제, 시작, 중지)
- 월드 관리 API (목록, 할당, 해제)
- 플레이어 관리 API (화이트리스트, 밴, 킥, OP)
- 백업 API (푸시, 복원, 이력)
- 헬스 체크 API

### 1.3 비목표
- 사용자 인터페이스 제공 (mcctl-console 담당)
- 사용자 세션 관리 (mcctl-console 담당)
- 직접적인 클라이언트 접근 지원 (BFF 패턴 사용)

## 2. 기술 스택

| 구성요소 | 기술 | 버전 |
|---------|------|------|
| Runtime | Node.js | 18+ |
| Framework | Fastify | 4.x |
| Language | TypeScript | 5.x |
| API Docs | @fastify/swagger | 8.x |
| Shared | @minecraft-docker/shared | workspace |

## 3. 아키텍처

### 3.1 Hexagonal Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│              Fastify Routes (REST API)                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   APPLICATION LAYER                          │
│   Use Cases: CreateServer, DeleteServer, WorldManagement     │
│   (imported from @minecraft-docker/shared)                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    DOMAIN LAYER                              │
│   Entities, Value Objects                                    │
│   (imported from @minecraft-docker/shared)                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                         │
│   ApiPromptAdapter, ShellAdapter, Repositories               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 디렉토리 구조

```
platform/services/mcctl-api/
├── prd.md                      # 이 문서
├── plan.md                     # 구현 계획
├── package.json                # @minecraft-docker/mcctl-api
├── tsconfig.json
├── src/
│   ├── index.ts                # 진입점
│   ├── server.ts               # Fastify 서버 설정
│   ├── config.ts               # 설정 로더
│   ├── routes/
│   │   ├── index.ts            # 라우트 등록
│   │   ├── servers.ts          # /api/servers/*
│   │   ├── worlds.ts           # /api/worlds/*
│   │   ├── players.ts          # /api/players/*
│   │   ├── backup.ts           # /api/backup/*
│   │   └── health.ts           # /api/health
│   ├── plugins/
│   │   ├── auth.ts             # API Key/IP 인증
│   │   ├── swagger.ts          # OpenAPI 문서
│   │   └── error-handler.ts    # 에러 핸들링
│   ├── adapters/
│   │   └── ApiPromptAdapter.ts # 비대화형 IPromptPort
│   └── di/
│       └── container.ts        # DI 컨테이너
├── tests/
│   ├── routes/
│   └── plugins/
└── Dockerfile
```

## 4. API 접근 모드

### 4.1 접근 모드 종류

| 모드 | 포트 노출 | 인증 방식 | 용도 |
|------|----------|----------|------|
| `internal` | 없음 (Docker 네트워크만) | 없음 | 기본값, mcctl-console 전용 |
| `api-key` | 3001 노출 | X-API-Key 헤더 | 외부 도구 연동 |
| `ip-whitelist` | 3001 노출 | IP 검증 | 신뢰된 네트워크 |
| `api-key-ip` | 3001 노출 | 둘 다 | 최고 보안 |
| `open` | 3001 노출 | 없음 | 개발 전용 |

### 4.2 인증 플러그인 구현

```typescript
// plugins/auth.ts
export interface AuthPluginOptions {
  accessMode: 'internal' | 'api-key' | 'ip-whitelist' | 'api-key-ip' | 'open';
  apiKey?: string;
  apiKeyHeader?: string;
  ipWhitelist?: string[];
}

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (fastify, options) => {
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip health checks
    if (request.url === '/api/health') return;

    switch (options.accessMode) {
      case 'internal':
        if (!isDockerNetwork(request.ip)) {
          return reply.status(403).send({ error: 'Internal access only' });
        }
        break;

      case 'api-key':
        if (request.headers[options.apiKeyHeader!] !== options.apiKey) {
          return reply.status(401).send({ error: 'Invalid API key' });
        }
        break;

      case 'ip-whitelist':
        if (!isIpAllowed(request.ip, options.ipWhitelist!)) {
          return reply.status(403).send({ error: 'IP not whitelisted' });
        }
        break;

      case 'api-key-ip':
        // Both checks required
        break;

      case 'open':
        // No restrictions
        break;
    }
  });
};
```

## 5. API 엔드포인트

### 5.1 서버 관리

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/servers` | 서버 목록 |
| GET | `/api/servers/:name` | 서버 상세 정보 |
| POST | `/api/servers` | 서버 생성 |
| DELETE | `/api/servers/:name` | 서버 삭제 |
| POST | `/api/servers/:name/start` | 서버 시작 |
| POST | `/api/servers/:name/stop` | 서버 중지 |
| POST | `/api/servers/:name/restart` | 서버 재시작 |
| GET | `/api/servers/:name/logs` | 서버 로그 |
| POST | `/api/servers/:name/exec` | RCON 명령 실행 |

### 5.2 월드 관리

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/worlds` | 월드 목록 |
| POST | `/api/worlds` | 월드 생성 |
| POST | `/api/worlds/:name/assign` | 월드 할당 |
| POST | `/api/worlds/:name/release` | 월드 해제 |

### 5.3 플레이어 관리

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/servers/:name/players` | 온라인 플레이어 |
| GET | `/api/players/:username` | 플레이어 정보 |
| GET | `/api/servers/:name/whitelist` | 화이트리스트 |
| POST | `/api/servers/:name/whitelist` | 화이트리스트 추가 |
| DELETE | `/api/servers/:name/whitelist/:player` | 화이트리스트 제거 |
| GET | `/api/servers/:name/bans` | 밴 목록 |
| POST | `/api/servers/:name/bans` | 플레이어 밴 |
| DELETE | `/api/servers/:name/bans/:player` | 밴 해제 |
| POST | `/api/servers/:name/kick` | 플레이어 킥 |
| GET | `/api/servers/:name/ops` | OP 목록 |
| POST | `/api/servers/:name/ops` | OP 추가 |
| DELETE | `/api/servers/:name/ops/:player` | OP 제거 |

### 5.4 백업

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/backup/status` | 백업 상태 |
| POST | `/api/backup/push` | 백업 푸시 |
| GET | `/api/backup/history` | 백업 이력 |
| POST | `/api/backup/restore` | 백업 복원 |

### 5.5 시스템

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/health` | 헬스 체크 |
| GET | `/api/router/status` | mc-router 상태 |

## 6. 응답 형식

### 6.1 성공 응답

```json
{
  "success": true,
  "data": { ... }
}
```

### 6.2 에러 응답

```json
{
  "success": false,
  "error": {
    "code": "SERVER_NOT_FOUND",
    "message": "Server 'myserver' not found"
  }
}
```

### 6.3 에러 코드

| 코드 | HTTP | 설명 |
|------|------|------|
| `UNAUTHORIZED` | 401 | 인증 실패 |
| `FORBIDDEN` | 403 | 접근 거부 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `CONFLICT` | 409 | 리소스 충돌 (서버 실행 중 삭제 등) |
| `INTERNAL_ERROR` | 500 | 내부 오류 |

## 7. 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `MCCTL_ROOT` | 데이터 디렉토리 | `/data` |
| `API_ACCESS_MODE` | 접근 모드 | `internal` |
| `API_KEY` | API 키 (api-key 모드) | - |
| `API_KEY_HEADER` | API 키 헤더 이름 | `X-API-Key` |
| `API_IP_WHITELIST` | IP 화이트리스트 (쉼표 구분) | - |
| `API_PORT` | 리스닝 포트 | `3001` |
| `USER_STORE_TYPE` | 사용자 저장소 타입 | `yaml` |

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
    "fastify": "^4.x",
    "@fastify/swagger": "^8.x",
    "@fastify/swagger-ui": "^2.x",
    "@fastify/cors": "^8.x"
  }
}
```

## 9. 테스트 계획

### 9.1 단위 테스트
- 라우트 핸들러 테스트
- 인증 플러그인 테스트
- 에러 핸들러 테스트

### 9.2 통합 테스트
- supertest를 사용한 API 엔드포인트 테스트
- 인증 모드별 접근 테스트

### 9.3 수동 테스트

```bash
# 헬스 체크
curl http://localhost:3001/api/health

# 서버 목록 (api-key 모드)
curl -H "X-API-Key: mctk_xxx" http://localhost:3001/api/servers

# 서버 생성
curl -X POST -H "Content-Type: application/json" \
  -H "X-API-Key: mctk_xxx" \
  -d '{"name":"myserver","type":"PAPER","version":"1.21.1"}' \
  http://localhost:3001/api/servers
```

## 10. Revision History

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0.0 | 2025-01-25 | - | 초기 PRD 작성 |
