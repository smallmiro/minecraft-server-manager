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

### mcctl router

mc-router를 마인크래프트 서버와 독립적으로 관리합니다.

```bash
mcctl router <action>
```

**액션:**

| 액션 | 설명 |
|--------|-------------|
| `start` | mc-router만 시작 |
| `stop` | mc-router만 중지 |
| `restart` | mc-router 재시작 |

**예제:**

```bash
# mc-router 시작
mcctl router start

# mc-router 중지
mcctl router stop

# mc-router 재시작 (설정 변경 후 유용)
mcctl router restart
```

mc-router는 모든 마인크래프트 서버에 대한 호스트명 기반 라우팅을 처리합니다. 클라이언트가 어떤 서버에든 연결하려면 mc-router가 실행 중이어야 합니다.

**설정:**

mc-router 설정은 `.env` 파일의 환경 변수로 구성합니다:

```bash
# 오토스케일링 설정
AUTO_SCALE_UP=true              # 플레이어 접속 시 서버 자동 시작
AUTO_SCALE_DOWN=true            # 유휴 서버 자동 중지
AUTO_SCALE_DOWN_AFTER=10m       # 유휴 타임아웃 (1m, 5m, 10m, 30m, 1h)
DOCKER_TIMEOUT=120              # 컨테이너 시작 타임아웃 (초)

# 슬립 상태 서버의 커스텀 MOTD
AUTO_SCALE_ASLEEP_MOTD=§e§l서버가 슬립 중§r\n§7접속하면 깨어납니다!
```

`.env` 변경 후 `mcctl router restart`로 mc-router를 재시작하세요.

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

    **출력:**
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
    survival             running      healthy    survival.local,survival.192.168.1.100.nip.io
    ```

=== "상세 상태"
    ```bash
    mcctl status --detail
    ```

    **출력:**
    ```
    === Detailed Server Status ===

    INFRASTRUCTURE

      mc-router
        Status:    running (healthy)
        Port:      25565
        Mode:      --in-docker (auto-discovery)
        Uptime:    1d 1h 27m
        Routes:    2 configured
          - survival.local → mc-survival:25565
          - survival.192.168.1.100.nip.io → mc-survival:25565

      avahi-daemon
        Status:    running
        Type:      system

    MINECRAFT SERVERS

      survival
        Container: mc-survival
        Status:    running (healthy)
        Hostname:  survival.local,survival.192.168.1.100.nip.io
        Type:      PAPER
        Version:   1.21.1
        Memory:    4G
        Uptime:    1d 1h 16m
        Resources: 3.1 GB / 8.0 GB (38.8%) | CPU: 15.2%
        Players:   2/20 - Steve, Alex
    ```

=== "JSON 출력"
    ```bash
    mcctl status --json
    ```

    **출력:**
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
          "name": "survival",
          "container": "mc-survival",
          "status": "running",
          "health": "healthy",
          "hostname": "survival.local,survival.192.168.1.100.nip.io"
        }
      ]
    }
    ```

=== "단일 서버"
    ```bash
    mcctl status survival
    ```

    **출력:**
    ```
    === Server: survival ===

      survival
        Container: mc-survival
        Status:    running (healthy)
        Hostname:  survival.local,survival.192.168.1.100.nip.io
        Type:      PAPER
        Version:   1.21.1
        Memory:    4G
        Uptime:    1d 1h 16m
        Resources: 3.1 GB / 8.0 GB (38.8%) | CPU: 18.2%
        Players:   2/20 - Steve, Alex
    ```

=== "라우터 상태"
    ```bash
    mcctl status router
    ```

    **출력:**
    ```
    === mc-router Status ===

      Status:    running (healthy)
      Port:      25565
      Mode:      --in-docker (auto-discovery)
      Uptime:    1d 1h 27m

    ROUTING TABLE

      HOSTNAME                                 TARGET                    STATUS
      --------                                 ------                    ------
      survival.local                           mc-survival:25565         running
      survival.192.168.1.100.nip.io            mc-survival:25565         running
    ```

=== "실시간 모니터링"
    ```bash
    # 기본 5초 새로고침
    mcctl status --watch

    # 사용자 지정 2초 새로고침
    mcctl status --watch --interval 2
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
| `--sudo-password` | | mDNS 등록용 sudo 비밀번호 (자동화용) |

!!! tip "Sudo 비밀번호를 사용한 자동화"
    CI/CD 파이프라인에서 서버 생성을 자동화할 때 mDNS 등록을 위한 sudo 비밀번호를 제공할 수 있습니다:

    - 환경 변수: `MCCTL_SUDO_PASSWORD`
    - CLI 옵션: `--sudo-password`

    avahi-daemon이 설치되어 있고 비밀번호가 제공되지 않으면 대화형으로 입력을 요청합니다.

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

=== "자동화 (CI/CD)"
    ```bash
    # 환경 변수로 sudo 비밀번호 전달
    export MCCTL_SUDO_PASSWORD="your-password"
    mcctl create myserver -t PAPER -v 1.21.1

    # --sudo-password 옵션 사용
    mcctl create myserver --sudo-password "your-password"
    ```

**서버 타입:**

| 타입 | 설명 | 플러그인 | 모드 |
|------|-------------|---------|------|
| `PAPER` | 고성능 (권장) | Yes | No |
| `VANILLA` | 공식 마인크래프트 서버 | No | No |
| `FORGE` | Forge 모드용 서버 | No | Yes |
| `NEOFORGE` | 현대적인 Forge 포크 (1.20.1+) | No | Yes |
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
| `--sudo-password` | | mDNS 해제용 sudo 비밀번호 (자동화용) |

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

# 자동화 시 sudo 비밀번호 사용
MCCTL_SUDO_PASSWORD="your-password" mcctl delete myserver --force
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
mcctl logs survival

# 실시간으로 로그 추적
mcctl logs survival -f

# 마지막 10줄 표시
mcctl logs survival -n 10
```

**출력 예시:**
```
[22:09:48] [Server thread/INFO]: Steve joined the game
[22:10:15] [Server thread/INFO]: Alex joined the game
[22:15:30] [Server thread/INFO]: <Steve> Hello everyone!
[22:15:45] [Server thread/INFO]: <Alex> Hi Steve!
[22:20:00] [Server thread/INFO]: Steve has made the advancement [Getting Wood]
[22:25:12] [Server thread/INFO]: Saving the game (this may take a moment!)
[22:25:12] [Server thread/INFO]: Saved the game
[22:30:00] [Server thread/INFO]: Alex left the game
[22:35:15] [RCON Listener #1/INFO]: Thread RCON Client started
[22:35:15] [RCON Client #1/INFO]: Thread RCON Client shutting down
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

### mcctl rcon

마인크래프트 서버의 대화형 RCON 콘솔에 연결합니다. 여러 명령을 연속으로 실행할 수 있는 세션을 엽니다.

```bash
mcctl rcon <server>
```

**예제:**

```bash
$ mcctl rcon survival
Connecting to RCON console for 'survival'...
Type "help" for commands, Ctrl+C or "exit" to quit

> list
There are 2 of 20 players online: Steve, Alex
> say 서버 점검 10분 전입니다!
[Server: 서버 점검 10분 전입니다!]
> tp Steve 0 100 0
Teleported Steve to 0.0, 100.0, 0.0
> exit
```

**`rcon` vs `exec` 사용 시점:**

| 명령어 | 모드 | 용도 |
|--------|------|------|
| `mcctl rcon <server>` | 대화형 | 수동 관리, 디버깅, 다중 명령 |
| `mcctl exec <server> <cmd>` | 비대화형 | 스크립트, 자동화, CI/CD, 단일 명령 |

사용 가능한 RCON 명령어 전체 목록은 [RCON 명령어 레퍼런스](rcon-commands.ko.md)를 참조하세요.

---

### mcctl exec

서버에서 단일 RCON 명령을 실행합니다. `mcctl rcon`의 비대화형 대안으로, 스크립트 및 자동화에 유용합니다.

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

# 스크립트에서 사용
PLAYERS=$(mcctl exec myserver list)
if echo "$PLAYERS" | grep -q "0 of"; then
  mcctl stop myserver
fi
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
    mcctl config survival
    ```

    **출력:**
    ```
    Configuration for survival:

      TYPE=PAPER
      VERSION=1.21.1
      MEMORY=4G
      GAMEMODE=survival
      DIFFICULTY=normal
      MAX_PLAYERS=20
      VIEW_DISTANCE=10
      PVP=true
      SPAWN_PROTECTION=0
      LEVEL=survival-world
      ENABLE_RCON=true
      MOTD=Welcome to survival! Your adventure begins here.
      ALLOW_CHEATS=false
      ENABLE_COMMAND_BLOCK=true
      OPS=Steve
    ```

=== "단일 키 보기"
    ```bash
    mcctl config survival MOTD
    ```

=== "값 설정"
    ```bash
    mcctl config survival MOTD "Welcome to my server!"
    mcctl config survival MAX_PLAYERS 50
    ```

=== "단축키 사용"
    ```bash
    mcctl config survival --cheats
    mcctl config survival --no-pvp
    mcctl config survival --command-block
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
mcctl server-backup survival -m "업그레이드 전"

# 모든 백업 목록
mcctl server-backup survival --list
```

**출력 예시 (--list):**
```
Backups for survival:

  20260120-203357
    Created: 1/20/2026, 8:33:57 PM
    Size: 3 KB, Files: 7
    Description: Before upgrade

  20260118-150000
    Created: 1/18/2026, 3:00:00 PM
    Size: 3 KB, Files: 7
    Description: Initial setup
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
mcctl op survival list

# 관리자 추가
mcctl op survival add Steve

# 관리자 제거
mcctl op survival remove Steve
```

**출력 예시 (list):**
```
Operators for survival:

  Steve
  Alex
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
mcctl whitelist survival list

# 플레이어 추가
mcctl whitelist survival add Steve

# 화이트리스트 활성화
mcctl whitelist survival on

# 상태 확인
mcctl whitelist survival status
```

**출력 예시 (list):**
```
Whitelist for survival:

  Steve
  Alex
  Notch
```

**출력 예시 (status):**
```
Whitelist Status for survival:

  Enabled: Yes
  Players: 3
  Running: Yes
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
mcctl ban survival list

# 사유와 함께 플레이어 밴
mcctl ban survival add Griefer "스폰 지역 그리핑"

# 플레이어 밴 해제
mcctl ban survival remove Griefer

# 밴된 IP 목록
mcctl ban survival ip list

# IP 밴
mcctl ban survival ip add 192.168.1.100 "스팸"
```

**출력 예시 (list):**
```
Banned Players for survival:

  Griefer (Reason: Griefing spawn area)
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

=== "단일 서버"
    ```bash
    mcctl player online survival
    ```

    **출력:**
    ```
    Online Players for survival:

      Status: Running (2/20)

      Players:
        - Steve
        - Alex
    ```

=== "모든 서버"
    ```bash
    mcctl player online --all
    ```

    **출력:**
    ```
    Online Players (All Servers):

      survival: 2 players
        - Steve
        - Alex

      creative: 0 players

      Total: 2 players online
    ```

---

## 월드 관리

### mcctl world new

선택적 시드 설정으로 새 월드 디렉토리를 생성합니다.

```bash
mcctl world new [name] [options]
```

**인자:**

| 인자 | 설명 |
|----------|-------------|
| `name` | 월드 이름 (선택사항, 제공하지 않으면 프롬프트 표시) |

**옵션:**

| 옵션 | 단축 | 설명 |
|--------|-------|-------------|
| `--seed` | `-s` | 월드 생성 시드 |
| `--server` | | 월드를 할당할 서버 (config에 SEED도 설정) |
| `--no-start` | | 할당 후 서버 자동 시작 안 함 |

**예제:**

=== "대화형 모드"
    ```bash
    mcctl world new
    # 다음을 프롬프트로 물어봅니다:
    # 1. 월드 이름
    # 2. 선택적 시드
    # 3. 선택적 서버 할당
    # 4. 자동 시작 여부 (서버 할당 시)
    ```

=== "CLI 모드"
    ```bash
    # 빈 월드 디렉토리 생성
    mcctl world new myworld

    # 특정 시드로 월드 생성
    mcctl world new myworld --seed 12345

    # 생성 후 서버에 할당
    mcctl world new myworld --server myserver

    # 시드와 함께 생성하고 서버에 할당
    mcctl world new myworld --seed 12345 --server myserver

    # 자동 시작 없이 생성 후 할당
    mcctl world new myworld --server myserver --no-start
    ```

**수행 내용:**

1. `worlds/<name>/` 디렉토리에 월드 디렉토리 생성
2. 시드가 제공되면 `.seed` 파일 생성 (참조용)
3. 서버가 할당되면:
   - 서버의 `config.env`에 `LEVEL=<world-name>` 업데이트
   - 시드가 있으면 `SEED=<seed>` 설정
   - 선택적으로 서버 시작

!!! tip "시드 동작"
    시드는 서버의 `SEED` 환경 변수를 통해 적용됩니다.
    서버가 처음 시작될 때 이 시드로 월드가 생성됩니다.

---

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

=== "기본 출력"
    ```bash
    mcctl world list
    ```

    **출력:**
    ```
    Worlds:

      survival-world
        Status: locked (mc-survival)
        Size: 514.0MB
        Path: /home/myuser/minecraft-servers/worlds/survival-world

      creative-world
        Status: unlocked
        Size: 128.5MB
        Path: /home/myuser/minecraft-servers/worlds/creative-world
    ```

=== "JSON 출력"
    ```bash
    mcctl world list --json
    ```

    **출력:**
    ```json
    [
      {
        "name": "survival-world",
        "path": "/home/myuser/minecraft-servers/worlds/survival-world",
        "isLocked": true,
        "lockedBy": "mc-survival",
        "size": "514.0MB",
        "lastModified": "2026-01-21T13:19:48.853Z"
      },
      {
        "name": "creative-world",
        "path": "/home/myuser/minecraft-servers/worlds/creative-world",
        "isLocked": false,
        "size": "128.5MB",
        "lastModified": "2026-01-20T10:30:00.000Z"
      }
    ]
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

### mcctl world delete

월드와 모든 데이터를 영구적으로 삭제합니다.

```bash
mcctl world delete [world] [options]
```

**인자:**

| 인자 | 설명 |
|----------|-------------|
| `world` | 월드 이름 (선택사항, 제공하지 않으면 프롬프트 표시) |

**옵션:**

| 옵션 | 단축 | 설명 |
|--------|-------|-------------|
| `--force` | `-f` | 확인 프롬프트 건너뛰기 |
| `--json` | | JSON 형식으로 출력 |

!!! danger "영구 삭제"
    이 명령어는 다음을 포함한 모든 월드 데이터를 영구적으로 삭제합니다:

    - 월드 파일 (level.dat, 리전 데이터 등)
    - 네더와 엔드 차원
    - 해당 월드의 플레이어 데이터

    **이 작업은 되돌릴 수 없습니다.** 삭제 전에 중요한 월드는 반드시 백업하세요.

**예제:**

=== "대화형 모드"
    ```bash
    mcctl world delete
    # 선택할 월드 목록 표시
    # 삭제 전 확인 요청
    ```

=== "CLI 모드"
    ```bash
    # 확인 프롬프트와 함께 삭제
    mcctl world delete old-world

    # 확인 없이 강제 삭제
    mcctl world delete old-world --force
    ```

**안전 기능:**

- **잠금 확인**: 잠긴 월드(실행 중인 서버에 할당된)는 삭제할 수 없음
- **확인 프롬프트**: "DELETE" 입력 필요 (`--force` 미사용 시)
- **크기 표시**: 삭제 전 월드 크기 표시

**출력 예시:**

```
World 'old-world' (512.5 MB) will be permanently deleted.

Type DELETE to confirm: DELETE

✓ World 'old-world' deleted
  Freed: 512.5 MB
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
=== Backup Status ===

Configuration: Configured
Repository:    myuser/minecraft-backup-repo
Branch:        main
Auto on stop:  true

Cache:         Exists
Last commit:   fd8633b
Last date:     2026-01-20 21:06:35 +0900

Worlds dir:    /home/myuser/minecraft-servers/worlds
Cache dir:     /home/myuser/.minecraft-backup

Backup Configuration:

  Status: Configured
  Repository: myuser/minecraft-backup-repo
  Branch: main
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

=== "기본 출력"
    ```bash
    mcctl backup history
    ```

    **출력:**
    ```
    Backup History:

      fd8633b  Backup: 2026-01-20 21:06:30       2026-01-20
      19a7a4d  Backup: 2026-01-20 20:21:06       2026-01-20
      7c2ad14  Manual backup                     2026-01-19
      ddeda27  Initial backup                    2026-01-17
    ```

=== "JSON 출력"
    ```bash
    mcctl backup history --json
    ```

    **출력:**
    ```json
    {
      "history": [
        {"commit": "fd8633b", "date": "2026-01-20 21:06:35 +0900", "message": "Backup: 2026-01-20 21:06:30"},
        {"commit": "19a7a4d", "date": "2026-01-20 20:21:08 +0900", "message": "Backup: 2026-01-20 20:21:06"},
        {"commit": "7c2ad14", "date": "2026-01-19 22:50:42 +0900", "message": "Manual backup"},
        {"commit": "ddeda27", "date": "2026-01-17 23:43:24 +0900", "message": "Initial backup"}
      ]
    }
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

### mcctl player (대화형 모드)

통합 플레이어 관리 대화형 워크플로우입니다.

```bash
mcctl player
mcctl player <server>
```

**예제:**

=== "전체 대화형"
    ```bash
    mcctl player
    # 1. 목록에서 서버 선택
    # 2. 온라인 플레이어 선택 또는 이름 입력
    # 3. 액션 선택 (op/deop, 화이트리스트, 밴, 강퇴, 정보)
    ```

=== "서버 지정"
    ```bash
    mcctl player myserver
    # 1. 온라인 플레이어 선택 또는 이름 입력
    # 2. 액션 선택
    ```

대화형 모드 제공 기능:

- 상태 표시가 있는 서버 선택
- 온라인 플레이어 목록 및 쉬운 선택
- 액션 메뉴 (op/deop, 화이트리스트 추가/제거, 밴/밴 해제, 강퇴, 정보 보기)
- 필요시 자동 서버 재시작 프롬프트

---

### mcctl player info

Mojang API에서 플레이어 정보를 조회하고 암호화된 로컬 캐시를 사용합니다.

```bash
mcctl player info <name> [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--offline` | Mojang 조회 대신 오프라인 모드 UUID 계산 |
| `--json` | JSON 형식으로 출력 |

**예제:**

```bash
# 플레이어 정보 조회 (UUID, 스킨 URL)
mcctl player info Notch

# 오프라인 UUID 계산
mcctl player info Steve --offline

# 스크립팅용 JSON 출력
mcctl player info Notch --json
```

**출력:**

```
Player: Notch
  UUID: 069a79f4-44e9-4726-a5be-fca90e38aaf5
  Skin: http://textures.minecraft.net/texture/292009a4925b58f02c77dadc3ecef07ea4c7472f64e0fdc32ce5522489362680
  Source: mojang
```

**JSON 출력:**

```json
{
  "username": "Notch",
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "skinUrl": "https://textures.minecraft.net/texture/...",
  "source": "mojang",
  "cached": true
}
```

!!! info "플레이어 캐시"
    플레이어 데이터는 AES-256-GCM 암호화로 로컬에 캐시됩니다:

    - **UUID**: 영구 캐시 (절대 변경되지 않음)
    - **사용자명**: 30일간 캐시 (변경 가능)
    - **스킨 URL**: 1일간 캐시 (자주 변경됨)

    캐시 위치: `~/.minecraft-docker/.player-cache`

---

### mcctl player cache

암호화된 플레이어 데이터 캐시를 관리합니다.

```bash
mcctl player cache <action>
```

**액션:**

| 액션 | 설명 |
|--------|-------------|
| `stats` | 캐시 통계 표시 |
| `clear` | 모든 캐시된 플레이어 데이터 삭제 |

**예제:**

```bash
# 캐시 통계 보기
mcctl player cache stats

# 모든 캐시된 데이터 삭제
mcctl player cache clear
```

**통계 출력:**

```
Player Cache Statistics
  Players cached: 5
  Cache size: 2.1 KB
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

### mcctl player lookup (레거시)

!!! note "지원 중단 예정"
    `mcctl player info`를 대신 사용하세요. 이 명령어는 하위 호환성을 위해 유지됩니다.

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

### mcctl player uuid (레거시)

!!! note "지원 중단 예정"
    `mcctl player info` 또는 `mcctl player info --offline`을 대신 사용하세요.

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

## 마이그레이션 명령어

### mcctl migrate status

모든 서버의 마이그레이션 상태를 확인합니다.

```bash
mcctl migrate status [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--json` | JSON 형식으로 출력 |

**예제:**

```bash
mcctl migrate status
```

**출력:**

```
Migration Status:

  survival: needs migration
    Missing EXTRA_ARGS=--universe /worlds/
  creative: up to date

1 server(s) need migration.
Run: mcctl migrate worlds to migrate.
```

---

### mcctl migrate worlds

월드를 공유 `/worlds/` 디렉토리 구조로 마이그레이션합니다.

```bash
mcctl migrate worlds [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--all` | 선택 없이 모든 서버 마이그레이션 |
| `--dry-run` | 변경 사항을 적용하지 않고 미리보기 |
| `--backup` | 마이그레이션 전 백업 생성 |
| `--force` | 확인 프롬프트 건너뛰기 |

**예제:**

=== "대화형 모드"
    ```bash
    mcctl migrate worlds
    # 마이그레이션이 필요한 서버 표시, 하나 또는 전체 선택
    ```

=== "전체 마이그레이션"
    ```bash
    mcctl migrate worlds --all
    ```

=== "드라이 런"
    ```bash
    mcctl migrate worlds --dry-run
    ```

    **출력:**
    ```
    DRY RUN - No changes will be made

    Would migrate: survival
      1. Stop server if running
      2. Move world: servers/survival/data/world → worlds/survival
      3. Update config.env:
         - Add: EXTRA_ARGS=--universe /worlds/
         - Set: LEVEL=survival
    ```

=== "백업과 함께"
    ```bash
    mcctl migrate worlds --all --backup
    ```

**마이그레이션 수행 내용:**

1. 서버가 실행 중이면 **서버 중지**
2. `servers/<name>/data/world`에서 `worlds/<server-name>/`으로 **월드 데이터 이동**
3. **config.env 업데이트**:
   - `EXTRA_ARGS=--universe /worlds/` 추가
   - `LEVEL=<server-name>` 설정
4. 대소문자 무시로 **기존 월드 탐지**

!!! info "월드 저장 경로 변경"
    `mcctl create`로 생성된 새 서버는 이미 `/worlds/` 디렉토리 구조를 사용합니다.
    이 마이그레이션 명령어는 이 변경 이전에 생성된 기존 서버를 위한 것입니다.

---

## 모드 관리

마인크래프트 서버의 모드와 플러그인을 관리합니다. mcctl은 Modrinth, CurseForge, Spiget (SpigotMC), 직접 URL 다운로드 등 다양한 모드 소스와 통합됩니다.

### mcctl mod search

Modrinth에서 모드를 검색합니다.

```bash
mcctl mod search <query> [options]
```

**인자:**

| 인자 | 설명 |
|----------|-------------|
| `query` | 검색어 (모드 이름, 설명 키워드) |

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--json` | JSON 형식으로 출력 |

**예제:**

```bash
# 최적화 모드 검색
mcctl mod search sodium

# 월드 생성 모드 검색
mcctl mod search "world generation"

# 스크립팅용 JSON 출력
mcctl mod search lithium --json
```

**출력 예시:**

```
Search results for "sodium" (25 total):

  sodium (12.5M downloads)
    Sodium server client
    A modern rendering engine for Minecraft

  sodium-extra (2.1M downloads)
    Sodium Extra server? client
    Extra options for Sodium

Use: mcctl mod add <server> <mod-slug> to install
```

출력 내용:

- **모드 슬러그** (설치에 사용)
- **다운로드 수** (인기도 지표)
- **사이드 요구사항** (서버/클라이언트/둘 다)
- **설명** (잘린 버전)

---

### mcctl mod add

서버 설정에 모드를 추가합니다.

```bash
mcctl mod add <server> <mod...> [options]
```

**인자:**

| 인자 | 설명 |
|----------|-------------|
| `server` | 서버 이름 |
| `mod...` | 하나 이상의 모드 슬러그/ID |

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--modrinth` | Modrinth 사용 (기본값) |
| `--curseforge` | CurseForge 사용 (CF_API_KEY 필요) |
| `--spiget` | Spiget 사용 (SpigotMC 플러그인) |
| `--url` | 직접 JAR URL 다운로드 |
| `--force` | 모드를 찾을 수 없거나 서버 타입 불일치해도 추가 |
| `--json` | JSON 형식으로 출력 |

**예제:**

=== "Modrinth (기본값)"
    ```bash
    # 단일 모드 추가
    mcctl mod add myserver sodium

    # 여러 모드 한 번에 추가
    mcctl mod add myserver sodium lithium phosphor

    # Fabric 서버에 추가
    mcctl mod add fabric-server fabric-api sodium lithium
    ```

=== "CurseForge"
    ```bash
    # .env 파일에 CF_API_KEY 필요
    mcctl mod add myserver --curseforge jei journeymap

    # 인기 모드팩 모드 추가
    mcctl mod add myserver --curseforge create applied-energistics-2
    ```

=== "Spiget (SpigotMC)"
    ```bash
    # SpigotMC의 리소스 ID 사용
    mcctl mod add myserver --spiget 9089 1649

    # EssentialsX 예제 (리소스 ID: 9089)
    mcctl mod add paper-server --spiget 9089
    ```

=== "직접 URL"
    ```bash
    # URL에서 JAR 직접 다운로드
    mcctl mod add myserver --url https://example.com/mod.jar

    # 여러 URL
    mcctl mod add myserver --url https://example.com/mod1.jar https://example.com/mod2.jar
    ```

**작동 방식:**

1. **검증**: Modrinth에서 모드 존재 여부 확인 (Modrinth 소스 사용 시)
2. **서버 타입 확인**: 서버 타입이 모드를 지원하지 않을 수 있으면 경고
3. **설정 업데이트**: `config.env`의 적절한 환경 변수에 모드 추가
4. **재시작 필요**: 변경 사항 적용을 위해 서버 재시작 필요

**사용되는 환경 변수:**

| 소스 | 환경 변수 | 서버 타입 |
|--------|---------------------|--------------|
| Modrinth | `MODRINTH_PROJECTS` | 전체 |
| CurseForge | `CURSEFORGE_FILES` | 전체 (CF_API_KEY 필요) |
| Spiget | `SPIGET_RESOURCES` | Paper, Spigot, Bukkit |
| URL | `MODS` | Forge, NeoForge, Fabric, Quilt |
| URL | `PLUGINS` | Paper, Spigot, Bukkit |

!!! warning "⚠️ 의존성 자동 다운로드"
    모드는 종종 다른 모드를 의존성으로 필요로 합니다 (예: Iris는 Sodium 필요).

    **기본적으로 의존성이 자동 다운로드됩니다** (`config.env`의 `MODRINTH_DOWNLOAD_DEPENDENCIES=required` 설정).

    | 설정값 | 동작 |
    |---------|----------|
    | `required` | 필수 의존성 자동 다운로드 **(기본값, 권장)** |
    | `optional` | 필수 + 선택적 의존성 다운로드 |
    | `none` | 의존성 다운로드 안 함 (수동 관리) |

    **예시**: `iris`를 추가하면 서버 시작 시 `sodium`(필수 의존성)이 자동으로 다운로드됩니다.

    ```bash
    mcctl mod add myserver iris
    # ✓ iris 추가됨
    # ✓ sodium 서버 시작 시 자동 다운로드 (필수 의존성)
    ```

**출력 예시:**

```
Validating mods on Modrinth...
  ✓ Sodium (sodium)
  ✓ Lithium (lithium)

✓ Added 2 mod(s) to myserver

  sodium
  lithium

Config: MODRINTH_PROJECTS=sodium,lithium

Restart the server to apply changes:
  mcctl stop myserver && mcctl start myserver
```

---

### mcctl mod list

서버에 설정된 모드 목록을 표시합니다.

```bash
mcctl mod list <server> [options]
```

**인자:**

| 인자 | 설명 |
|----------|-------------|
| `server` | 서버 이름 |

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--json` | JSON 형식으로 출력 |

**예제:**

```bash
# 서버의 모드 목록
mcctl mod list myserver

# JSON 출력
mcctl mod list myserver --json
```

**출력 예시:**

```
Mods for myserver (FABRIC):

  Modrinth:
    - sodium
    - lithium
    - phosphor

  CurseForge:
    - jei
    - journeymap

Total: 5 mod(s)
```

**JSON 출력:**

```json
{
  "serverType": "FABRIC",
  "sources": [
    {"key": "MODRINTH_PROJECTS", "name": "Modrinth", "mods": ["sodium", "lithium"]},
    {"key": "CURSEFORGE_FILES", "name": "CurseForge", "mods": ["jei"]}
  ],
  "total": 3
}
```

---

### mcctl mod remove

서버 설정에서 모드를 제거합니다.

```bash
mcctl mod remove <server> <mod...> [options]
```

**인자:**

| 인자 | 설명 |
|----------|-------------|
| `server` | 서버 이름 |
| `mod...` | 제거할 하나 이상의 모드 슬러그/ID |

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--json` | JSON 형식으로 출력 |

**예제:**

```bash
# 단일 모드 제거
mcctl mod remove myserver sodium

# 여러 모드 제거
mcctl mod remove myserver sodium lithium phosphor
```

**출력 예시:**

```
  ✓ Removed sodium from MODRINTH_PROJECTS
  ✓ Removed lithium from MODRINTH_PROJECTS

✓ Removed 2 mod(s) from myserver

Restart the server to apply changes:
  mcctl stop myserver && mcctl start myserver
```

!!! note "재시작 필요"
    제거된 모드는 서버가 재시작될 때까지 서버의 mods 폴더에 남아있습니다. 재시작 시 itzg/minecraft-server 이미지가 mods 폴더를 설정과 동기화합니다.

---

### mcctl mod sources

사용 가능한 모드 소스와 설정을 표시합니다.

```bash
mcctl mod sources [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--json` | JSON 형식으로 출력 |

**예제:**

```bash
mcctl mod sources
```

**출력:**

```
Available Mod Sources:

  Modrinth --modrinth (default)
    Free, open-source mod platform. No API key required.
    Config: MODRINTH_PROJECTS
    mcctl mod add myserver sodium lithium

  CurseForge --curseforge
    Popular mod platform. Requires CF_API_KEY in .env
    Config: CURSEFORGE_FILES
    mcctl mod add myserver --curseforge jei journeymap

  Spiget (SpigotMC) --spiget
    SpigotMC plugin repository. Use resource IDs.
    Config: SPIGET_RESOURCES
    mcctl mod add myserver --spiget 9089

  URL --url
    Direct JAR file download URLs.
    Config: MODS / PLUGINS
    mcctl mod add myserver --url https://example.com/mod.jar
```

---

### 모드 관리 워크플로우

#### 모드 서버 설정하기

Fabric 모드 서버를 생성하고 설정하는 전체 워크플로우:

```bash
# 1. Fabric 서버 생성
mcctl create modded-server -t FABRIC -v 1.20.4

# 2. 모드 검색
mcctl mod search "optimization"

# 3. 필수 모드 추가
mcctl mod add modded-server fabric-api sodium lithium phosphor

# 4. 설정된 모드 목록 확인
mcctl mod list modded-server

# 5. 재시작하여 적용
mcctl stop modded-server && mcctl start modded-server
```

#### 플러그인 서버 설정하기

플러그인이 있는 Paper 서버 전체 워크플로우:

```bash
# 1. Paper 서버 생성
mcctl create plugin-server -t PAPER -v 1.21.1

# 2. Modrinth에서 플러그인 추가
mcctl mod add plugin-server luckperms

# 3. Spiget (SpigotMC)에서 플러그인 추가
mcctl mod add plugin-server --spiget 9089  # EssentialsX

# 4. 재시작하여 적용
mcctl stop plugin-server && mcctl start plugin-server
```

#### CurseForge 설정

CurseForge 모드를 사용하려면 API 키가 필요합니다:

1. [CurseForge for Studios](https://console.curseforge.com/)에서 API 키 발급
2. `.env` 파일에 추가:

```bash
CF_API_KEY=your-api-key-here
```

3. 이제 CurseForge 모드를 추가할 수 있습니다:

```bash
mcctl mod add myserver --curseforge jei journeymap
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

---

## 환경 변수

자동화 및 CI/CD 파이프라인을 위한 환경 변수입니다.

### MCCTL_SUDO_PASSWORD

root 권한이 필요한 작업(mDNS 등록/해제)에 sudo 비밀번호를 제공합니다.

```bash
export MCCTL_SUDO_PASSWORD="your-password"
```

**사용하는 명령어:**

- `mcctl create` - avahi-daemon에 mDNS 호스트명 등록
- `mcctl delete` - mDNS 호스트명 해제

**예제 (CI/CD):**

```bash
# GitHub Actions 예제
- name: Create Minecraft Server
  env:
    MCCTL_SUDO_PASSWORD: ${{ secrets.SUDO_PASSWORD }}
  run: |
    mcctl create myserver -t PAPER -v 1.21.1
```

!!! warning "보안"
    sudo 비밀번호는 CI/CD secrets를 사용하여 안전하게 저장하세요. 비밀번호를 버전 관리에 커밋하지 마세요.

**대안:** `--sudo-password` 옵션 직접 사용:

```bash
mcctl create myserver --sudo-password "your-password"
```
