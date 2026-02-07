# Management Console 개요

Management Console는 Docker Minecraft 서버를 위한 웹 기반 관리 인터페이스와 REST API를 제공합니다. 현대적인 웹 콘솔을 통해 원격 서버 관리, 모니터링, 운영이 가능합니다.

!!! warning "개발 상태"
    **mcctl-console (웹 UI)은 현재 활발히 개발 중입니다.** 일부 기능이 불완전하거나 변경될 수 있습니다. REST API (mcctl-api)는 안정적이며 프로덕션 환경에서 사용 가능합니다.

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
            Docker Socket      |  (Fastify REST)   |
            (read-only)        |                   |
                               +-------------------+
```

## 구성 요소

### mcctl-api (REST API 서버)

Fastify 기반의 REST API 서버로 다음 기능을 제공합니다:

- **서버 관리**: Minecraft 서버 목록 조회, 시작, 중지, 재시작
- **서버 정보**: 상태, 플레이어, 리소스 사용량 확인
- **RCON 통합**: 원격으로 콘솔 명령 실행
- **Swagger 문서**: `/docs`에서 자동 생성된 API 문서 확인
- **상태 확인**: `/health`에서 내장 헬스 체크

기본 포트: `5001`

### mcctl-console (웹 관리 UI)

Next.js 웹 애플리케이션으로 다음 기능을 제공합니다:

- **대시보드**: 모든 서버의 실시간 상태 개요
- **서버 상세**: 상세한 서버 정보와 제어 기능
- **사용자 인증**: Better Auth를 통한 보안 로그인
- **BFF 프록시**: 안전한 API 접근을 위한 Backend-for-Frontend 패턴
- **React Query 훅**: 자동 캐싱을 갖춘 타입 안전 데이터 페칭
- **월드 관리**: 월드 목록, 생성, 할당, 해제 기능

기본 포트: `5000`

#### BFF 프록시 라우트 (v1.7.8+)

콘솔은 모든 API 요청을 Next.js 서버 라우트를 통해 프록시합니다:

| 라우트 | 설명 |
|--------|------|
| `/api/servers/*` | 서버 관리 (목록, 생성, 삭제, 시작/중지/재시작) |
| `/api/servers/:name/exec` | RCON 명령 실행 |
| `/api/servers/:name/logs` | 서버 로그 조회 |
| `/api/worlds/*` | 월드 관리 (목록, 생성, 삭제, 할당/해제) |

이 아키텍처는 API 키가 브라우저에 도달하지 않도록 보장합니다.

## 인증 모드

Management Console는 다양한 인증 모드를 지원합니다:

| 모드 | 설명 | 사용 사례 |
|------|------|----------|
| `internal` | Docker 네트워크 내부만 허용 (가장 안전) | 기본 프로덕션 |
| `api-key` | X-API-Key 헤더로 외부 접근 | 자동화/스크립트 |
| `ip-whitelist` | IP 기반 접근 제어 | 알려진 클라이언트 IP |
| `api-key-ip` | API 키와 IP 모두 필요 | 고보안 환경 |
| `open` | 인증 없음 | 개발 환경 전용 |

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
- 명령 출력 실시간 확인
- 모든 표준 Minecraft 명령 지원

### 사용자 관리

- 역할 기반 접근 제어로 다중 사용자 계정 지원
- Admin 역할: 모든 기능에 대한 전체 접근 권한
- Viewer 역할: 상태와 로그에 대한 읽기 전용 접근

## 빠른 시작

> **참고**: `mcctl admin` 명령어는 지원 중단(deprecated)되었습니다. 대신 `mcctl console`을 사용하세요. `admin` 명령어 별칭은 하위 호환성을 위해 계속 작동하지만 향후 버전에서 제거될 예정입니다.

### 1. Management Console 초기화

```bash
mcctl console init
```

대화형 프롬프트에 따라 다음을 설정합니다:

1. 관리자 사용자명
2. 관리자 비밀번호 (최소 8자, 대문자, 소문자, 숫자 필수)
3. API 접근 모드
4. IP 화이트리스트 (해당하는 경우)

### 2. Management Console 시작

```bash
mcctl console service start
```

### 3. 웹 콘솔 접속

브라우저를 열고 다음 주소로 이동합니다:

```
http://localhost:5000
```

초기화 시 생성한 관리자 자격 증명으로 로그인합니다.

## 요구 사항

- mcctl 플랫폼 초기화 완료 (`mcctl init`)
- Docker 실행 중
- 포트 5000과 5001 사용 가능 (또는 `.env`에서 사용자 정의 포트)

## 설정 파일

초기화 후 다음 파일들이 생성됩니다:

| 파일 | 설명 |
|------|------|
| `~/minecraft-servers/admin.yaml` | Management Console 설정 |
| `~/minecraft-servers/users.yaml` | 사용자 자격 증명 (해시된 비밀번호) |
| `~/minecraft-servers/api-config.json` | API 접근 설정 |

## 다음 단계

- **[설치 가이드](installation.ko.md)** - 상세한 설치 방법
- **[CLI 명령어](cli-commands.ko.md)** - 전체 CLI 레퍼런스
- **[API 레퍼런스](api-reference.ko.md)** - REST API 문서
- **[웹 콘솔 가이드](web-console.ko.md)** - 웹 인터페이스 사용법
