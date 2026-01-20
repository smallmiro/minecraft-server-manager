# 명령어 레퍼런스

mcctl 전체 명령어 레퍼런스입니다.

## 플랫폼 명령어

### mcctl init

플랫폼 디렉토리 구조를 초기화합니다.

```bash
mcctl init [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--root <path>` | 사용자 지정 데이터 디렉토리 |
| `--skip-validation` | Docker 검증 건너뛰기 |
| `--skip-docker` | Docker 확인 건너뛰기 |

**예제:**

```bash
# 기본 위치에 초기화 (~/minecraft-servers)
mcctl init

# 사용자 지정 위치에 초기화
mcctl --root /opt/minecraft init
```

**생성되는 구조:**

```text
~/minecraft-servers/
├── docker-compose.yml
├── .env
├── servers/
│   ├── compose.yml
│   └── _template/
├── worlds/
├── shared/
│   ├── plugins/
│   └── mods/
├── scripts/
└── backups/
```

---

### mcctl up

모든 인프라(mc-router 및 모든 마인크래프트 서버)를 시작합니다.

```bash
mcctl up
```

**예제:**

```bash
mcctl up
```

`docker compose up -d`와 동일합니다.

---

### mcctl down

모든 인프라를 중지하고 네트워크를 제거합니다.

```bash
mcctl down
```

**예제:**

```bash
mcctl down
```

모든 mc-* 컨테이너를 중지하고 `docker compose down`을 실행합니다.

---

### mcctl status

다양한 표시 옵션으로 모든 서버의 상태를 표시합니다.

```bash
mcctl status [options]
mcctl status <server>
mcctl status router
```

**옵션:**

| 옵션 | 단축 | 설명 |
|--------|-------|-------------|
| `--detail` | `-d` | 상세 정보 표시 (메모리, CPU, 플레이어, 업타임) |
| `--watch` | `-W` | 실시간 모니터링 모드 |
| `--interval <sec>` | | 새로고침 간격 (기본값: 5) |
| `--json` | | JSON 형식으로 출력 |

**예제:**

=== "기본 상태"
    ```bash
    mcctl status
    ```

=== "상세 상태"
    ```bash
    mcctl status --detail
    ```

=== "실시간 모니터링"
    ```bash
    # 기본 5초 새로고침
    mcctl status --watch

    # 사용자 지정 2초 새로고침
    mcctl status --watch --interval 2
    ```

=== "단일 서버"
    ```bash
    mcctl status myserver
    ```

=== "라우터 상태"
    ```bash
    mcctl status router
    ```

**상세 출력 예시:**

```
=== Detailed Server Status ===

INFRASTRUCTURE

  mc-router
    Status:    running (healthy)
    Port:      25565
    Mode:      --in-docker (auto-discovery)
    Uptime:    3d 14h 22m
    Routes:    2 configured
      - myserver.local → mc-myserver:25565
      - creative.local → mc-creative:25565

MINECRAFT SERVERS

  myserver
    Container: mc-myserver
    Status:    running (healthy)
    Hostname:  myserver.192.168.1.100.nip.io
    Type:      PAPER
    Version:   1.21.1
    Memory:    4G
    Uptime:    2d 8h 15m
    Resources: 2.1 GB / 4.0 GB (52.5%) | CPU: 15.2%
    Players:   3/20 - Steve, Alex, Notch
```

---

## 서버 명령어

### mcctl create

새 마인크래프트 서버를 생성합니다.

```bash
mcctl create [name] [options]
```

**인자:**

| 인자 | 설명 |
|----------|-------------|
| `name` | 서버 이름 (선택사항, 제공하지 않으면 프롬프트 표시) |

**옵션:**

| 옵션 | 단축 | 설명 |
|--------|-------|-------------|
| `--type` | `-t` | 서버 타입: PAPER, VANILLA, FORGE, FABRIC, SPIGOT, BUKKIT, PURPUR, QUILT |
| `--version` | `-v` | 마인크래프트 버전 (예: 1.21.1) |
| `--seed` | `-s` | 월드 생성 시드 |
| `--world-url` | `-u` | ZIP URL에서 월드 다운로드 |
| `--world` | `-w` | worlds/ 디렉토리의 기존 월드 사용 |
| `--no-start` | | 생성만 하고 시작하지 않음 |

**예제:**

=== "대화형 모드"
    ```bash
    mcctl create
    # 모든 옵션에 대해 프롬프트 표시
    ```

=== "CLI 모드"
    ```bash
    # 기본 Paper 서버
    mcctl create myserver

    # 특정 버전의 Forge 서버
    mcctl create modded -t FORGE -v 1.20.4

    # 월드 시드가 있는 서버
    mcctl create survival -t PAPER -v 1.21.1 -s 12345

    # 기존 월드 사용
    mcctl create legacy -w old-world -v 1.20.4

    # 시작하지 않고 생성만
    mcctl create myserver --no-start
    ```

**서버 타입:**

| 타입 | 설명 | 플러그인 | 모드 |
|------|-------------|---------|------|
| `PAPER` | 고성능 (권장) | Yes | No |
| `VANILLA` | 공식 마인크래프트 서버 | No | No |
| `FORGE` | Forge 모드용 서버 | No | Yes |
| `FABRIC` | 경량 모드 서버 | No | Yes |
| `SPIGOT` | 수정된 Bukkit 서버 | Yes | No |
| `BUKKIT` | 클래식 플러그인 서버 | Yes | No |
| `PURPUR` | 더 많은 기능이 있는 Paper 포크 | Yes | No |
| `QUILT` | 현대적인 모딩 툴체인 | No | Yes |

---

### mcctl delete

서버를 삭제합니다.

```bash
mcctl delete [name] [options]
```

**인자:**

| 인자 | 설명 |
|----------|-------------|
| `name` | 서버 이름 (선택사항, 제공하지 않으면 목록 표시) |

**옵션:**

| 옵션 | 단축 | 설명 |
|--------|-------|-------------|
| `--force` | `-y` | 확인 건너뛰기 |

!!! warning "월드 데이터 보존"
    `mcctl delete`는 서버 설정만 제거하고 월드 데이터는 `worlds/` 디렉토리에 보존됩니다.

**예제:**

```bash
# 대화형 - 서버 목록 표시
mcctl delete

# 확인과 함께 특정 서버 삭제
mcctl delete myserver

# 확인 없이 강제 삭제
mcctl delete myserver --force
```

---

### mcctl start

중지된 서버 또는 모든 서버를 시작합니다.

```bash
mcctl start <name>
mcctl start --all
```

**옵션:**

| 옵션 | 단축 | 설명 |
|--------|-------|-------------|
| `--all` | `-a` | 모든 마인크래프트 서버 시작 (라우터 제외) |

**예제:**

```bash
# 단일 서버 시작
mcctl start myserver

# 모든 서버 시작
mcctl start --all
```

!!! tip "자동 시작"
    mc-router를 사용하면 플레이어가 접속할 때 서버가 자동으로 시작됩니다.

---

### mcctl stop

실행 중인 서버 또는 모든 서버를 중지합니다.

```bash
mcctl stop <name>
mcctl stop --all
```

**옵션:**

| 옵션 | 단축 | 설명 |
|--------|-------|-------------|
| `--all` | `-a` | 모든 마인크래프트 서버 중지 (라우터 제외) |

**예제:**

```bash
# 단일 서버 중지
mcctl stop myserver

# 모든 서버 중지
mcctl stop --all
```

---

### mcctl logs

서버 로그를 조회합니다.

```bash
mcctl logs <name> [options]
```

**옵션:**

| 옵션 | 단축 | 설명 |
|--------|-------|-------------|
| `--follow` | `-f` | 로그 출력 추적 |
| `--lines` | `-n` | 표시할 줄 수 |

**예제:**

```bash
# 마지막 50줄 표시
mcctl logs myserver

# 실시간으로 로그 추적
mcctl logs myserver -f

# 마지막 100줄 표시
mcctl logs myserver -n 100
```

---

### mcctl console

서버 RCON 콘솔에 연결합니다.

```bash
mcctl console <name>
```

**예제:**

```bash
mcctl console myserver
```

```
> list
There are 2 of a max of 20 players online: Steve, Alex
> say Hello everyone!
> tp Steve Alex
```

종료하려면 `Ctrl+C`를 누르세요.

---

### mcctl exec

서버에서 단일 RCON 명령을 실행합니다.

```bash
mcctl exec <server> <command...>
```

**예제:**

```bash
# 모든 플레이어에게 메시지 전송
mcctl exec myserver say "Hello everyone!"

# 플레이어에게 아이템 지급
mcctl exec myserver give Steve diamond 64

# 온라인 플레이어 목록
mcctl exec myserver list

# 날씨 변경
mcctl exec myserver weather clear

# 시간 설정
mcctl exec myserver time set day
```

---

### mcctl config

서버 설정을 조회하거나 수정합니다.

```bash
mcctl config <server> [key] [value] [options]
```

**인자:**

| 인자 | 설명 |
|----------|-------------|
| `server` | 서버 이름 |
| `key` | 설정 키 (선택사항) |
| `value` | 새 값 (선택사항) |

**단축 옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--cheats` | 치트 활성화 (ALLOW_CHEATS=true) |
| `--no-cheats` | 치트 비활성화 |
| `--pvp` | PvP 활성화 |
| `--no-pvp` | PvP 비활성화 |
| `--command-block` | 커맨드 블록 활성화 |
| `--no-command-block` | 커맨드 블록 비활성화 |

**예제:**

=== "전체 설정 보기"
    ```bash
    mcctl config myserver
    ```

=== "단일 키 보기"
    ```bash
    mcctl config myserver MOTD
    ```

=== "값 설정"
    ```bash
    mcctl config myserver MOTD "Welcome to my server!"
    mcctl config myserver MAX_PLAYERS 50
    ```

=== "단축키 사용"
    ```bash
    mcctl config myserver --cheats
    mcctl config myserver --no-pvp
    mcctl config myserver --command-block
    ```

!!! note "재시작 필요"
    일부 설정 변경은 적용을 위해 서버 재시작이 필요합니다.

---

## 서버 백업 및 복원

### mcctl server-backup

서버 설정(config.env, docker-compose.yml)을 백업합니다.

```bash
mcctl server-backup <server> [options]
```

**옵션:**

| 옵션 | 단축 | 설명 |
|--------|-------|-------------|
| `--message` | `-m` | 백업 설명 |
| `--list` | | 서버의 모든 백업 목록 |
| `--json` | | JSON 형식으로 출력 |

**예제:**

```bash
# 메시지와 함께 백업
mcctl server-backup myserver -m "Before upgrade"

# 모든 백업 목록
mcctl server-backup myserver --list
```

---

### mcctl server-restore

백업에서 서버 설정을 복원합니다.

```bash
mcctl server-restore <server> [backup-id] [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--force` | 확인 건너뛰기 |
| `--dry-run` | 복원될 내용 미리보기 |
| `--json` | JSON 형식으로 출력 |

**예제:**

```bash
# 대화형 - 백업 목록 표시
mcctl server-restore myserver

# 특정 백업 복원
mcctl server-restore myserver abc123

# 복원 미리보기
mcctl server-restore myserver abc123 --dry-run
```

---

## 플레이어 관리

### mcctl op

서버 관리자(OP)를 관리합니다.

```bash
mcctl op <server> <action> [player]
```

**액션:**

| 액션 | 설명 |
|--------|-------------|
| `list` | 현재 관리자 목록 |
| `add <player>` | 관리자 추가 (RCON + config.env 업데이트) |
| `remove <player>` | 관리자 제거 |

**예제:**

```bash
# 관리자 목록
mcctl op myserver list

# 관리자 추가
mcctl op myserver add Steve

# 관리자 제거
mcctl op myserver remove Steve
```

---

### mcctl whitelist

서버 화이트리스트를 관리합니다.

```bash
mcctl whitelist <server> <action> [player]
```

**액션:**

| 액션 | 설명 |
|--------|-------------|
| `list` | 화이트리스트된 플레이어 목록 |
| `add <player>` | 화이트리스트에 추가 |
| `remove <player>` | 화이트리스트에서 제거 |
| `on` | 화이트리스트 활성화 |
| `off` | 화이트리스트 비활성화 |
| `status` | 화이트리스트 상태 표시 |

**예제:**

```bash
# 화이트리스트된 플레이어 목록
mcctl whitelist myserver list

# 플레이어 추가
mcctl whitelist myserver add Steve

# 화이트리스트 활성화
mcctl whitelist myserver on

# 상태 확인
mcctl whitelist myserver status
```

---

### mcctl ban

플레이어 및 IP 밴을 관리합니다.

```bash
mcctl ban <server> <action> [target] [reason]
mcctl ban <server> ip <action> [ip] [reason]
```

**플레이어 밴 액션:**

| 액션 | 설명 |
|--------|-------------|
| `list` | 밴된 플레이어 목록 |
| `add <player> [reason]` | 플레이어 밴 |
| `remove <player>` | 플레이어 밴 해제 |

**IP 밴 액션:**

| 액션 | 설명 |
|--------|-------------|
| `ip list` | 밴된 IP 목록 |
| `ip add <ip> [reason]` | IP 주소 밴 |
| `ip remove <ip>` | IP 주소 밴 해제 |

**예제:**

```bash
# 밴된 플레이어 목록
mcctl ban myserver list

# 사유와 함께 플레이어 밴
mcctl ban myserver add Griefer "건물 파괴"

# 플레이어 밴 해제
mcctl ban myserver remove Griefer

# 밴된 IP 목록
mcctl ban myserver ip list

# IP 밴
mcctl ban myserver ip add 192.168.1.100 "스팸"
```

---

### mcctl kick

서버에서 플레이어를 강퇴합니다.

```bash
mcctl kick <server> <player> [reason]
```

**예제:**

```bash
# 플레이어 강퇴
mcctl kick myserver Steve

# 사유와 함께 강퇴
mcctl kick myserver Steve "AFK 너무 오래됨"
```

---

### mcctl player online

서버의 온라인 플레이어를 표시합니다.

```bash
mcctl player online <server>
mcctl player online --all
```

**옵션:**

| 옵션 | 단축 | 설명 |
|--------|-------|-------------|
| `--all` | `-a` | 모든 서버의 플레이어 표시 |
| `--json` | | JSON 형식으로 출력 |

**예제:**

```bash
# 단일 서버
mcctl player online myserver

# 모든 서버
mcctl player online --all
```

**출력:**

```
Online Players for myserver:

  Status: Running (3/20)

  Steve
  Alex
  Notch
```

---

## 월드 관리

### mcctl world list

모든 월드와 잠금 상태를 나열합니다.

```bash
mcctl world list [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--json` | JSON 형식으로 출력 |

**예제:**

```bash
mcctl world list
```

**출력:**

```
Worlds:

  survival
    Status: locked: mc-myserver
    Size: 256 MB
    Path: /home/user/minecraft-servers/worlds/survival

  creative
    Status: unlocked
    Size: 128 MB
    Path: /home/user/minecraft-servers/worlds/creative
```

---

### mcctl world assign

월드를 서버에 잠급니다.

```bash
mcctl world assign [world] [server]
```

**인자:**

| 인자 | 설명 |
|----------|-------------|
| `world` | 월드 이름 (선택사항, 제공하지 않으면 프롬프트 표시) |
| `server` | 서버 이름 (선택사항, 제공하지 않으면 프롬프트 표시) |

**예제:**

=== "대화형 모드"
    ```bash
    mcctl world assign
    # 월드 목록, 그 다음 서버 목록 표시
    ```

=== "CLI 모드"
    ```bash
    mcctl world assign survival mc-myserver
    ```

!!! info "월드 잠금"
    잠긴 월드는 할당된 서버만 사용할 수 있습니다. 이는 동시 접근으로 인한 데이터 손상을 방지합니다.

---

### mcctl world release

월드 잠금을 해제합니다.

```bash
mcctl world release [world] [options]
```

**인자:**

| 인자 | 설명 |
|----------|-------------|
| `world` | 월드 이름 (선택사항, 제공하지 않으면 프롬프트 표시) |

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--force` | 서버가 실행 중이어도 강제 해제 |

**예제:**

```bash
# 대화형 - 잠긴 월드 목록 표시
mcctl world release

# 특정 월드 해제
mcctl world release survival
```

---

## 백업 관리

### mcctl backup status

백업 설정 상태를 표시합니다.

```bash
mcctl backup status [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--json` | JSON 형식으로 출력 |

**예제:**

```bash
mcctl backup status
```

**출력 (설정됨):**

```
Backup Configuration:

  Status: Configured
  Repository: user/minecraft-worlds-backup
  Branch: main
  Last backup: 2024-01-15 14:30:00
  Auto backup: enabled
```

**출력 (설정되지 않음):**

```
Backup Configuration:

  Status: Not configured

  To enable backups, set in .env:
    BACKUP_GITHUB_TOKEN=your-token
    BACKUP_GITHUB_REPO=username/repo
```

---

### mcctl backup push

월드 데이터를 GitHub 저장소에 푸시합니다.

```bash
mcctl backup push [options]
```

**옵션:**

| 옵션 | 단축 | 설명 |
|--------|-------|-------------|
| `--message` | `-m` | 커밋 메시지 |

**예제:**

=== "대화형 모드"
    ```bash
    mcctl backup push
    # 커밋 메시지 프롬프트 표시
    ```

=== "CLI 모드"
    ```bash
    mcctl backup push -m "서버 업그레이드 전"
    ```

---

### mcctl backup history

백업 기록을 표시합니다.

```bash
mcctl backup history [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--json` | JSON 형식으로 출력 |

**예제:**

```bash
mcctl backup history
```

**출력:**

```
Backup History:

  abc1234  서버 업그레이드 전     2024-01-15
  def5678  주간 백업              2024-01-08
  ghi9012  초기 백업              2024-01-01
```

---

### mcctl backup restore

백업에서 월드 데이터를 복원합니다.

```bash
mcctl backup restore [commit]
```

**인자:**

| 인자 | 설명 |
|----------|-------------|
| `commit` | 커밋 해시 (선택사항, 제공하지 않으면 목록 표시) |

**예제:**

=== "대화형 모드"
    ```bash
    mcctl backup restore
    # 백업 기록에서 선택
    ```

=== "CLI 모드"
    ```bash
    mcctl backup restore abc1234
    ```

!!! danger "데이터 덮어쓰기"
    복원은 현재 월드 데이터를 덮어씁니다. 복원 전에 반드시 백업하세요.

---

## 플레이어 유틸리티

### mcctl player lookup

Mojang API에서 플레이어 정보를 조회합니다.

```bash
mcctl player lookup <name> [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--json` | JSON 형식으로 출력 |

**예제:**

```bash
mcctl player lookup Notch
```

---

### mcctl player uuid

플레이어 UUID를 가져옵니다.

```bash
mcctl player uuid <name> [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--offline` | 오프라인 UUID 생성 |
| `--json` | JSON 형식으로 출력 |

**예제:**

```bash
# 온라인 UUID (Mojang에서)
mcctl player uuid Notch

# 오프라인 UUID (오프라인 모드 서버용)
mcctl player uuid Steve --offline
```

---

## 전역 옵션 레퍼런스

이 옵션들은 모든 명령어에서 사용할 수 있습니다:

| 옵션 | 설명 | 예제 |
|--------|-------------|---------|
| `--root <path>` | 사용자 지정 데이터 디렉토리 | `mcctl --root /opt/mc status` |
| `--json` | JSON 출력 형식 | `mcctl status --json` |
| `-h, --help` | 도움말 표시 | `mcctl --help` |
| `--version` | 버전 표시 | `mcctl --version` |
