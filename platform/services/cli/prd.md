# PRD: mcctl - CLI Tool

## 상위 문서
- [전체 프로젝트 PRD](../../../prd.md) - Section 9

## 1. 개요

### 1.1 목적
마인크래프트 서버 관리를 위한 CLI(Command Line Interface) 도구입니다. 대화형 프롬프트와 명령어 인자를 모두 지원합니다.

### 1.2 범위
- 서버 생성/삭제/시작/중지
- 월드 관리 (생성, 할당, 해제)
- 플레이어 관리 (화이트리스트, 밴, OP, 킥)
- 백업/복원
- 플랫폼 초기화

### 1.3 비목표
- 웹 UI 제공 (mcctl-console 담당)
- REST API 제공 (mcctl-api 담당)

## 2. 기술 스택

| 구성요소 | 기술 | 버전 |
|---------|------|------|
| Runtime | Node.js | 18+ |
| Language | TypeScript | 5.x |
| Prompts | @clack/prompts | 0.7.x |
| Colors | picocolors | 1.x |
| Shared | @minecraft-docker/shared | workspace |

## 3. 아키텍처

### 3.1 Hexagonal Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│                  CLI Commands (index.ts)                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   APPLICATION LAYER                          │
│         Use Cases (from @minecraft-docker/shared)            │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    DOMAIN LAYER                              │
│    Entities, Value Objects (from @minecraft-docker/shared)   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                         │
│   ClackPromptAdapter (CLI 전용) + Shared Adapters            │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 디렉토리 구조

```
platform/services/cli/
├── prd.md                      # 이 문서
├── plan.md                     # 구현 계획
├── README.md                   # npm 패키지 설명
├── package.json                # @minecraft-docker/mcctl
├── tsconfig.json
├── src/
│   ├── index.ts                # CLI 진입점
│   ├── commands/               # 명령어 구현
│   │   ├── create.ts
│   │   ├── delete.ts
│   │   ├── status.ts
│   │   ├── world.ts
│   │   ├── player.ts
│   │   ├── whitelist.ts
│   │   ├── ban.ts
│   │   ├── op.ts
│   │   ├── kick.ts
│   │   ├── backup.ts
│   │   └── ...
│   ├── adapters/
│   │   └── ClackPromptAdapter.ts  # CLI 전용 어댑터
│   ├── di/
│   │   └── container.ts        # DI 컨테이너
│   └── lib/
│       ├── prompts/            # 재사용 프롬프트 컴포넌트
│       ├── mojang-api.ts       # Mojang API 클라이언트
│       └── player-cache.ts     # 플레이어 캐시
└── tests/
```

## 4. 명령어 구조

### 4.1 서버 관리

| 명령어 | 설명 |
|--------|------|
| `mcctl init` | 플랫폼 초기화 |
| `mcctl create [name]` | 서버 생성 |
| `mcctl delete [name]` | 서버 삭제 |
| `mcctl status` | 서버 상태 조회 |
| `mcctl start <name>` | 서버 시작 |
| `mcctl stop <name>` | 서버 중지 |
| `mcctl logs <name>` | 서버 로그 |
| `mcctl console <name>` | RCON 콘솔 |

### 4.2 월드 관리

| 명령어 | 설명 |
|--------|------|
| `mcctl world list` | 월드 목록 |
| `mcctl world new [name]` | 월드 생성 |
| `mcctl world assign` | 월드 할당 |
| `mcctl world release` | 월드 해제 |

### 4.3 플레이어 관리

| 명령어 | 설명 |
|--------|------|
| `mcctl player` | 통합 플레이어 관리 (대화형) |
| `mcctl player info <name>` | 플레이어 정보 |
| `mcctl whitelist <server> <action>` | 화이트리스트 |
| `mcctl ban <server> <action>` | 밴/언밴 |
| `mcctl op <server> <action>` | OP 관리 |
| `mcctl kick <server> <player>` | 킥 |

### 4.4 백업

| 명령어 | 설명 |
|--------|------|
| `mcctl backup status` | 백업 상태 |
| `mcctl backup push` | 백업 푸시 |
| `mcctl backup history` | 백업 이력 |
| `mcctl backup restore` | 백업 복원 |

## 5. 대화형 모드

### 5.1 서버 생성 플로우

```
$ mcctl create

┌  Create Minecraft Server
│
◆  Server name?
│  myserver
│
◆  Server type?
│  ● Paper (Recommended)
│  ○ Vanilla
│  ○ Forge
│  ○ Fabric
│
◆  Minecraft version?
│  1.21.1
│
◇  Creating server...
│
└  ✓ Server 'myserver' created!
   Connect via: myserver.local:25565
```

## 6. 의존성

### 6.1 내부 의존성

```json
{
  "dependencies": {
    "@minecraft-docker/shared": "workspace:*"
  }
}
```

### 6.2 외부 의존성

```json
{
  "dependencies": {
    "@clack/prompts": "^0.7.x",
    "picocolors": "^1.x"
  }
}
```

## 7. 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `MCCTL_ROOT` | 데이터 디렉토리 | `~/minecraft-servers` |
| `MCCTL_SUDO_PASSWORD` | sudo 비밀번호 (자동화용) | - |

## 8. Revision History

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0.0 | 2025-01-25 | - | 초기 PRD 작성 |
