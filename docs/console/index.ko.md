# Management Console 개요

Management Console는 Docker Minecraft 서버를 위한 웹 기반 관리 인터페이스와 REST API를 제공합니다. 현대적인 웹 콘솔을 통해 원격 서버 관리, 모니터링, 운영이 가능합니다.

!!! info "상태"
    **mcctl-api**(REST API)와 **mcctl-console**(웹 UI)은 mcctl 릴리스마다 함께 npm에 배포됩니다. `mcctl console init`으로 설치하세요.

## 아키텍처

```
                              +---------------------+
                              |    Web Browser      |
                              |  (Admin Console)    |
                              +----------+----------+
                                         |
                                    :5000 (HTTP)
                                         |
+------------------------+     +---------v---------+
|                        |     |                   |
|  Minecraft Servers     |     |  mcctl-console    |
|  (mc-xxx containers)   |     |  (Next.js + Auth) |
|                        |     |                   |
+----------+-------------+     +---------+---------+
           ^                             |
           |                      :5001 (Internal)
           |                             |
           |                   +---------v---------+
           |                   |                   |
           +-------------------+    mcctl-api      |
            docker CLI         |  (Fastify REST)   |
            (compose)          |                   |
                               +-------------------+
```

## 구성 요소

### mcctl-api (REST API 서버)

Fastify 기반의 REST API 서버로 다음 기능을 제공합니다:

- **서버 관리**: Minecraft 서버 목록 조회, 시작, 중지, 재시작
- **서버 정보**: 상태, 플레이어, 리소스 사용량 확인
- **RCON 통합**: 원격으로 콘솔 명령 실행
- **Swagger 문서**: `NODE_ENV`가 `production`이 아니거나 `SWAGGER_ENABLED=true`가 설정된 경우 `/docs`에서 자동 생성된 API 문서 확인 (`mcctl console init`은 API를 `NODE_ENV=production`으로 실행하므로 기본적으로 꺼져 있음)
- **상태 확인**: `/health`에서 내장 헬스 체크

기본 포트: `5001`

### mcctl-console (웹 관리 UI)

Next.js 웹 애플리케이션으로 다음 기능을 제공합니다:

- **대시보드**: 서버, 플레이어, 월드, mc-router를 한눈에 보여주며 실시간 SSE 상태, 빠른 서버 작업, 최근 활동 제공
- **서버**: 서버 목록, 서버 생성, 그리고 콘솔, 플레이어, 월드, 활동, 모드, 파일, 설정 이력, 백업, 접근 권한, 옵션 탭이 있는 상세 페이지
- **월드**: 월드 목록, 생성 또는 업로드, 할당, 해제, 삭제, 그리고 지도와 블록 통계가 있는 월드 상세 정보
- **플레이어**: 서버별 화이트리스트, 운영자, 차단 관리와 모든 서버의 접속 중인 플레이어
- **감사**: 필터, 통계, 실시간 업데이트, 내보내기를 갖춘 활동 로그
- **백업**: Git 저장소로의 월드 백업, 백업 스케줄, 설정 스냅샷
- **라우팅**: mc-router 라우팅 테이블, 라우터 상태와 재시작, 실시간 라우터 로그, playit.gg 외부 접근
- **설정과 사용자**: 모든 사용자의 계정 설정, 관리자용 Platform Settings(플랫폼 `.env`)와 읽기 전용 사용자 목록
- **사용자 인증**: Better Auth를 통한 보안 로그인
- **BFF 프록시**: 안전한 API 접근을 위한 Backend-for-Frontend 패턴
- **React Query 훅**: 자동 캐싱을 갖춘 타입 안전 데이터 페칭

기본 포트: `5000`

#### BFF 프록시 라우트

콘솔은 모든 API 요청을 `/api/` 아래의 Next.js 서버 라우트를 통해 프록시합니다. 예시:

| 라우트 | 설명 |
|--------|------|
| `/api/servers/*` | 서버 관리 (목록, 생성, 삭제, 시작/중지/재시작) |
| `/api/servers/:name/exec` | RCON 명령 실행 |
| `/api/servers/:name/logs` | 서버 로그 조회 |
| `/api/worlds/*` | 월드 관리 (목록, 생성, 업로드, 삭제, 할당/해제, 지도, 통계) |
| `/api/players/*` | 화이트리스트, 운영자, 차단, 킥 |
| `/api/backup/*` | 월드 백업, 복원, 백업 스케줄 |
| `/api/router/*` | mc-router 상태와 재시작 |
| `/api/sse/*` | 실시간 스트림 (서버 상태, 로그, 라우터 로그). 로그인한 세션이 필요합니다 |

이 아키텍처는 API 키가 브라우저에 도달하지 않도록 보장합니다. 이 라우트 뒤의 mcctl-api 엔드포인트는 [API 레퍼런스](../api/endpoints.md)를 참고하세요.

## 인증 모드

Management Console는 다양한 인증 모드를 지원합니다:

| 모드 | 설명 | 사용 사례 |
|------|------|----------|
| `internal` | 내부 접근만 허용, 외부 노출 없음 (가장 안전) | 기본 프로덕션 |
| `api-key` | X-API-Key 헤더로 외부 접근 | 자동화/스크립트 |
| `ip-whitelist` | IP 기반 접근 제어 | 알려진 클라이언트 IP |
| `api-key-ip` | API 키와 IP 모두 필요 | 고보안 환경 |
| `open` | 인증 없음 | 개발 환경 전용 |

!!! note
    `mcctl console init`은 접근 모드를 mcctl-api가 인식하는 값으로 변환해 `AUTH_MODE`에 기록합니다: `internal` → 루프백(127.0.0.1, ::1)만 허용하는 `ip-whitelist`, `api-key-ip` → `combined`, `open` → `disabled`. `api-key`와 `ip-whitelist`는 그대로 기록됩니다.

!!! warning "보안 경고"
    프로덕션 환경에서는 절대 `open` 모드를 사용하지 마세요. 모든 인증이 비활성화되어 서버가 무단 접근에 노출됩니다.

## 기능

### 서버 관리

- 모든 Minecraft 서버 상태 조회
- 서버 시작, 중지, 재시작
- 실시간 서버 로그 확인
- 플레이어 수와 서버 상태 모니터링

### 콘솔 통합

- 웹 인터페이스를 통한 RCON 명령 실행
- 서버 로그를 실시간으로 확인 (명령에 대한 RCON 응답은 표시되지 않음)
- 모든 표준 Minecraft 명령 지원

### 사용자 관리

- 역할 기반 접근 제어로 다중 사용자 계정 지원
- Admin 역할: 모든 기능에 대한 전체 접근 권한
- User 역할: 계정에 부여된 서버로 접근이 제한됨 (서버별 Viewer, Operator, Owner 권한)

## 빠른 시작

> **참고**: `mcctl admin` 명령어는 지원 중단(deprecated)되었습니다. 대신 `mcctl console`을 사용하세요. `admin` 명령어 별칭은 하위 호환성을 위해 계속 작동하지만 향후 버전에서 제거될 예정입니다.

### 1. Management Console 초기화

```bash
mcctl console init
```

대화형 프롬프트에 따라 다음을 설정합니다:

1. 설치할 서비스 선택 (mcctl-api, mcctl-console)
2. 관리자 이메일과 이름 (콘솔을 선택한 경우 필수)
3. 관리자 비밀번호 (최소 8자, 대문자, 소문자, 숫자 필수)
4. API 접근 모드 (internal, api-key, ip-whitelist, api-key-ip, open)
5. IP 화이트리스트 (해당하는 경우. mcctl-console도 설치한다면 `127.0.0.1`을 포함하세요)

### 2. Management Console 시작

```bash
mcctl console service start --console
```

`--console`은 mcctl-api와 mcctl-console을 시작합니다. 플래그 없이 실행하면 두 서비스가 모두 설치된 경우 어느 서비스를 시작할지 묻습니다.

### 3. 웹 콘솔 접속

브라우저를 열고 다음 주소로 이동합니다:

```
http://localhost:5000
```

초기화 시 생성한 관리자 자격 증명으로 로그인합니다.

## 요구 사항

- mcctl 플랫폼 초기화 완료 (`mcctl init`)
- Docker 실행 중 (Docker Engine 24 이상, Docker Compose 2.20 이상)
- Node.js 18 이상과 전역 설치된 PM2 6 이상 (`npm install -g pm2`). `mcctl console init`이 둘 다 확인합니다
- 포트 5000과 5001 사용 가능 (또는 `mcctl console init --api-port` / `--console-port`로 지정한 포트)

## 설정 파일

초기화 후 다음 파일들이 생성됩니다:

| 파일 | 설명 |
|------|------|
| `~/minecraft-servers/.mcctl-admin.yml` | Management Console 설정 |
| `~/minecraft-servers/data/mcctl.db` | 콘솔 사용자 데이터베이스 (SQLite, Better Auth, `mcctl-console`을 선택한 경우 생성) |
| `~/minecraft-servers/ecosystem.config.cjs` | PM2 에코시스템 설정 |
| `~/minecraft-servers/.env` | `mcctl-console`을 선택하면 `mcctl console init`이 콘솔 세션 시크릿 `BETTER_AUTH_SECRET`을 추가합니다 (기존 시크릿은 유지) |

## 다음 단계

- **[설치 가이드](setup-guide.ko.md)** - 상세한 설치 방법
- **[CLI 명령어](cli-commands.ko.md)** - 전체 CLI 레퍼런스
- **[API 레퍼런스](../api/endpoints.md)** - REST API 문서
- **[웹 콘솔 가이드](web-console.ko.md)** - 웹 인터페이스 사용법
