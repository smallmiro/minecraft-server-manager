# CLI 개요

mcctl은 Docker Minecraft 서버를 관리하기 위한 커맨드라인 인터페이스입니다. 모든 작업에 대해 대화형 모드와 명령줄 모드를 모두 제공합니다.

## 설치

```bash
npm install -g @minecraft-docker/mcctl
```

## 기본 사용법

```bash
mcctl <command> [options]
```

### 도움말 보기

```bash
# 모든 명령어 표시
mcctl --help

# 특정 명령어 도움말 표시
mcctl create --help
```

## 명령어 카테고리

### 인프라 명령어

| 명령어 | 설명 |
|--------|------|
| `mcctl init` | 플랫폼 디렉토리 구조 초기화 |
| `mcctl up` | 모든 인프라 시작 (라우터 + 서버) |
| `mcctl down` | 모든 인프라 중지 |
| `mcctl router <action>` | mc-router 관리 (start/stop/restart) |

### 서버 관리

| 명령어 | 설명 |
|--------|------|
| `mcctl create` | 새 서버 생성 (대화형 또는 CLI) |
| `mcctl delete` | 서버 삭제 (월드 데이터 보존) |
| `mcctl status` | 모든 서버 상태 표시 |
| `mcctl start` | 중지된 서버 시작 |
| `mcctl stop` | 실행 중인 서버 중지 |
| `mcctl logs` | 서버 로그 확인 |
| `mcctl console` | RCON 콘솔 접속 |
| `mcctl exec` | 단일 RCON 명령 실행 |
| `mcctl config` | 서버 설정 조회/수정 |

### 플레이어 관리

| 명령어 | 설명 |
|--------|------|
| `mcctl op` | 서버 관리자(OP) 관리 (add/remove/list) |
| `mcctl whitelist` | 화이트리스트 관리 (add/remove/on/off/status) |
| `mcctl ban` | 플레이어 및 IP 밴 관리 |
| `mcctl kick` | 서버에서 플레이어 강퇴 |
| `mcctl player online` | 온라인 플레이어 표시 |
| `mcctl player lookup` | 플레이어 정보 조회 |
| `mcctl player uuid` | 플레이어 UUID 조회 |

### 월드 관리

| 명령어 | 설명 |
|--------|------|
| `mcctl world list` | 잠금 상태와 함께 모든 월드 목록 표시 |
| `mcctl world assign` | 월드를 서버에 잠금 |
| `mcctl world release` | 월드 잠금 해제 |

### 서버 백업/복원

| 명령어 | 설명 |
|--------|------|
| `mcctl server-backup` | 서버 설정 백업 |
| `mcctl server-restore` | 백업에서 서버 복원 |

### 월드 백업 (GitHub)

| 명령어 | 설명 |
|--------|------|
| `mcctl backup status` | 백업 설정 표시 |
| `mcctl backup push` | GitHub에 백업 푸시 |
| `mcctl backup history` | 백업 히스토리 표시 |
| `mcctl backup restore` | 백업에서 복원 |

## 대화형 모드 vs CLI 모드

대부분의 명령어는 두 모드를 모두 지원합니다:

### 대화형 모드

인수 없이 명령어를 실행하면 가이드 모드로 진입합니다:

```bash
mcctl create
# 프롬프트: 서버 이름, 타입, 버전, 메모리

mcctl world assign
# 프롬프트: 월드 선택, 서버 선택

mcctl backup push
# 프롬프트: 백업 메시지
```

### CLI 모드

스크립팅 및 자동화를 위해 인수를 직접 제공합니다:

```bash
mcctl create myserver -t PAPER -v 1.21.1
mcctl world assign survival mc-myserver
mcctl backup push -m "업그레이드 전"
```

## 전역 옵션

다음 옵션은 모든 명령어에서 사용할 수 있습니다:

| 옵션 | 설명 |
|------|------|
| `--root <path>` | 사용자 지정 데이터 디렉토리 (기본값: `~/minecraft-servers`) |
| `--json` | JSON 형식으로 출력 |
| `-h, --help` | 도움말 표시 |
| `--version` | 버전 표시 |

## 출력 형식

### 사람이 읽기 쉬운 형식 (기본값)

```bash
mcctl status
```

```
Platform Status
===============

Router: mc-router (running)

Servers:
  mc-myserver (running)
    Type: PAPER 1.21.1
    Memory: 4G
    Connect: myserver.192.168.1.100.nip.io:25565
```

### JSON 형식

```bash
mcctl status --json
```

```json
{
  "router": {
    "name": "mc-router",
    "status": "running"
  },
  "servers": [
    {
      "name": "mc-myserver",
      "status": "running",
      "type": "PAPER",
      "version": "1.21.1"
    }
  ]
}
```

## 종료 코드

| 코드 | 의미 |
|------|------|
| 0 | 성공 |
| 1 | 일반 오류 |

## 환경 변수

mcctl은 다음 환경 변수를 인식합니다:

| 변수 | 설명 |
|------|------|
| `MCCTL_ROOT` | 기본 데이터 디렉토리 |
| `NO_COLOR` | 컬러 출력 비활성화 |

## 다음 단계

- **[명령어 레퍼런스](commands.ko.md)** - 모든 명령어에 대한 상세 문서
- **[설정](../configuration/index.ko.md)** - 환경 변수 및 설정
- **[빠른 시작](../getting-started/quickstart.ko.md)** - 첫 번째 서버 시작하기
