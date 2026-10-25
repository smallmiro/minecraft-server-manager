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
# 모든 명령어와 옵션 표시
mcctl --help
```

`mcctl <command> --help`도 같은 페이지를 출력합니다. 각 명령은 [명령어 레퍼런스](commands.ko.md)에 설명되어 있습니다.

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
| `mcctl rcon` | RCON 콘솔 접속 (`mcctl console`과 같은 세션) |
| `mcctl exec` | 단일 RCON 명령 실행 |
| `mcctl config` | 서버 설정 조회/수정 |

### 플레이어 관리

| 명령어 | 설명 |
|--------|------|
| `mcctl op` | 서버 관리자(OP) 관리 (add/remove/list) |
| `mcctl whitelist` | 화이트리스트 관리 (add/remove/on/off/status) |
| `mcctl ban` | 플레이어 및 IP 밴 관리 |
| `mcctl kick` | 서버에서 플레이어 강퇴 |
| `mcctl player` | 대화형 플레이어 관리 (서버, 플레이어, 액션 선택) |
| `mcctl player online` | 온라인 플레이어 표시 |
| `mcctl player info` | 플레이어 UUID와 스킨 조회 |
| `mcctl player cache` | 플레이어 조회 캐시 확인 또는 삭제 |

### 월드 관리

| 명령어 | 설명 |
|--------|------|
| `mcctl world list` | 모든 월드를 할당된 서버와 함께 나열 |
| `mcctl world new` | 월드 생성 (선택적으로 서버에 할당) |
| `mcctl world assign` | 월드를 중지된 서버에 할당 (월드 하나는 서버 하나) |
| `mcctl world release` | 월드를 쓰던 서버를 자신의 기본 월드로 되돌림 |
| `mcctl world delete` | 어떤 서버도 쓰지 않는 월드 삭제 |

### 서버 백업/복원

| 명령어 | 설명 |
|--------|------|
| `mcctl server-backup` | 서버 설정 백업 |
| `mcctl server-restore` | 백업에서 서버 복원 |
| `mcctl config-snapshot` | 서버 설정 파일 스냅샷 (일정 실행 포함) |

### 월드 백업 (GitHub)

| 명령어 | 설명 |
|--------|------|
| `mcctl backup init` | GitHub 백업 설정 |
| `mcctl backup status` | 백업 설정 표시 |
| `mcctl backup push` | GitHub에 백업 푸시 |
| `mcctl backup history` | 백업 히스토리 표시 |
| `mcctl backup restore` | 백업에서 복원 |
| `mcctl backup schedule` | 일정에 따라 백업 |

### 모드와 플러그인

| 명령어 | 설명 |
|--------|------|
| `mcctl mod` | 모드와 플러그인 검색, 추가, 목록, 제거 (`search`, `add`, `list`, `remove`, `sources`) |

### 플랫폼 유지보수

| 명령어 | 설명 |
|--------|------|
| `mcctl update` | CLI, 설치된 서비스, 서버 이미지 업데이트 |
| `mcctl upgrade` | 플랫폼 설정 파일을 설치된 버전에 맞게 마이그레이션 |
| `mcctl migrate` | 월드를 공유 `worlds/` 디렉토리로 옮기거나 서버를 `server.yaml`로 가져오기 |

### 외부 접속, 콘솔, 감사

| 명령어 | 설명 |
|--------|------|
| `mcctl playit` | playit.gg 에이전트와 서버의 외부 도메인 관리 |
| `mcctl console` 하위 명령 (`init`, `service`, `user`, `api`, `remove`) | 웹 콘솔 관리 ([콘솔 CLI 명령어](../console/cli-commands.ko.md)) |
| `mcctl audit` | 감사 로그 조회 및 정리 ([감사 로그](audit-log.ko.md)) |

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
mcctl world assign survival myserver
mcctl backup push -m "업그레이드 전"
```

## 전역 옵션

| 옵션 | 설명 |
|------|------|
| `--root <path>` | 데이터 디렉토리 (기본값: `MCCTL_ROOT` 또는 `~/minecraft-servers`) |
| `--json` | JSON 출력. 지원하는 명령에서만 동작 |
| `--sudo-password <pwd>` | `create`, `delete`의 mDNS 항목 처리용 sudo 비밀번호 |
| `-h, --help` | 도움말 표시 |
| `--version` | 버전 표시 |

옵션 값과 `--` 처리 방식은 [전역 옵션 레퍼런스](commands.ko.md#전역-옵션-레퍼런스)에 있습니다.

## 출력 형식

### 사람이 읽기 쉬운 형식 (기본값)

```bash
mcctl status
```

```
=== Server Status (mc-router Managed) ===

INFRASTRUCTURE
SERVICE              STATUS       HEALTH     PORT/INFO
-------              ------       ------     ---------
mc-router            running      healthy    :25565 (hostname routing)
avahi-daemon         running      (system)   mDNS broadcast

MINECRAFT SERVERS
SERVER               STATUS       HEALTH     HOSTNAME
------               ------       ------     --------
myserver             running      healthy    myserver.local,myserver.192.168.1.100.nip.io
```

### JSON 형식

```bash
mcctl status --json
```

```json
{
  "router": {
    "name": "mc-router",
    "status": "running",
    "health": "healthy",
    "port": 25565
  },
  "avahi_daemon": {
    "name": "avahi-daemon",
    "status": "running",
    "type": "system"
  },
  "servers": [
    {
      "name": "myserver",
      "container": "mc-myserver",
      "status": "running",
      "health": "healthy",
      "hostname": "myserver.local,myserver.192.168.1.100.nip.io"
    }
  ]
}
```

## 종료 코드

| 코드 | 의미 |
|------|------|
| 0 | 성공 |
| 1 | 일반 오류 |
| 2 | `mcctl start` / `mcctl stop`: 서버가 이미 실행 중 / 실행 중이 아님 |

`mcctl update --check`는 새 CLI 버전이 있으면 1로 끝나고, `mcctl exec`는 RCON 명령의 종료 코드로 끝납니다.

## 환경 변수

mcctl은 다음 환경 변수를 인식합니다:

| 변수 | 설명 |
|------|------|
| `MCCTL_ROOT` | 기본 데이터 디렉토리 |
| `MCCTL_SUDO_PASSWORD` | `create`, `delete`의 mDNS 항목 처리용 sudo 비밀번호 |

## 다음 단계

- **[명령어 레퍼런스](commands.ko.md)** - 모든 명령어에 대한 상세 문서
- **[설정](../configuration/index.ko.md)** - 환경 변수 및 설정
- **[빠른 시작](../getting-started/quickstart.ko.md)** - 첫 번째 서버 시작하기
