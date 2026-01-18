# 명령어 레퍼런스

모든 mcctl 명령어에 대한 완전한 레퍼런스입니다.

## 플랫폼 명령어

### mcctl init

플랫폼 디렉토리 구조를 초기화합니다.

```bash
mcctl init [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--root <path>` | 사용자 지정 데이터 디렉토리 |
| `--skip-validation` | Docker 유효성 검사 건너뛰기 |
| `--skip-docker` | Docker 확인 건너뛰기 |

**예제:**

```bash
# 기본 위치에 초기화 (~/minecraft-servers)
mcctl init

# 사용자 지정 위치에 초기화
mcctl --root /opt/minecraft init
```

**생성되는 구조:**

```
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

### mcctl status

모든 서버의 상태를 표시합니다.

```bash
mcctl status [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--json` | JSON 형식으로 출력 |

**예제:**

```bash
mcctl status
```

**출력:**

```
Platform Status
===============

Router: mc-router (running)

Servers:
  mc-myserver
    Status: running
    Type: PAPER 1.21.1
    Memory: 4G
    Players: 2/20
    Connect: myserver.192.168.1.100.nip.io:25565

  mc-creative
    Status: stopped
    Type: VANILLA 1.20.4
    Memory: 2G
```

---

## 서버 명령어

### mcctl create

새 Minecraft 서버를 생성합니다.

```bash
mcctl create [name] [options]
```

**인수:**

| 인수 | 설명 |
|------|------|
| `name` | 서버 이름 (선택사항, 제공되지 않으면 프롬프트) |

**옵션:**

| 옵션 | 단축 | 설명 |
|------|------|------|
| `--type` | `-t` | 서버 타입: PAPER, VANILLA, FORGE, FABRIC, SPIGOT, BUKKIT, PURPUR, QUILT |
| `--version` | `-v` | Minecraft 버전 (예: 1.21.1) |
| `--seed` | `-s` | 월드 생성용 시드 |
| `--world-url` | `-u` | ZIP URL에서 월드 다운로드 |
| `--world` | `-w` | worlds/ 디렉토리의 기존 월드 사용 |
| `--no-start` | | 시작하지 않고 생성만 |

**예제:**

=== "대화형 모드"
    ```bash
    mcctl create
    # 모든 옵션에 대해 프롬프트
    ```

=== "CLI 모드"
    ```bash
    # 기본 Paper 서버
    mcctl create myserver

    # 특정 버전의 Forge 서버
    mcctl create modded -t FORGE -v 1.20.4

    # 월드 시드를 지정한 서버
    mcctl create survival -t PAPER -v 1.21.1 -s 12345

    # 기존 월드 사용
    mcctl create legacy -w old-world -v 1.20.4

    # 시작하지 않고 생성
    mcctl create myserver --no-start
    ```

**서버 타입:**

| 타입 | 설명 | 플러그인 | 모드 |
|------|------|----------|------|
| `PAPER` | 고성능 서버 (권장) | 예 | 아니오 |
| `VANILLA` | 공식 Minecraft 서버 | 아니오 | 아니오 |
| `FORGE` | Forge 모드용 서버 | 아니오 | 예 |
| `FABRIC` | 경량 모드 서버 | 아니오 | 예 |
| `SPIGOT` | 수정된 Bukkit 서버 | 예 | 아니오 |
| `BUKKIT` | 클래식 플러그인 서버 | 예 | 아니오 |
| `PURPUR` | 더 많은 기능을 가진 Paper 포크 | 예 | 아니오 |
| `QUILT` | 현대적인 모딩 툴체인 | 아니오 | 예 |

---

### mcctl delete

서버를 삭제합니다.

```bash
mcctl delete [name] [options]
```

**인수:**

| 인수 | 설명 |
|------|------|
| `name` | 서버 이름 (선택사항, 제공되지 않으면 목록 표시) |

**옵션:**

| 옵션 | 단축 | 설명 |
|------|------|------|
| `--force` | `-y` | 확인 건너뛰기 |

!!! warning "월드 데이터 보존"
    `mcctl delete`는 서버 설정을 제거하지만 `worlds/` 디렉토리의 월드 데이터는 보존합니다.

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

중지된 서버를 시작합니다.

```bash
mcctl start <name>
```

**예제:**

```bash
mcctl start myserver
```

!!! tip "자동 시작"
    mc-router를 사용하면 플레이어가 접속할 때 서버가 자동으로 시작됩니다.

---

### mcctl stop

실행 중인 서버를 중지합니다.

```bash
mcctl stop <name>
```

**예제:**

```bash
mcctl stop myserver
```

---

### mcctl logs

서버 로그를 확인합니다.

```bash
mcctl logs <name> [options]
```

**옵션:**

| 옵션 | 단축 | 설명 |
|------|------|------|
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

서버 RCON 콘솔에 접속합니다.

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
> say 모두 안녕하세요!
> tp Steve Alex
```

종료하려면 `Ctrl+C`를 누릅니다.

---

## 월드 관리

### mcctl world list

잠금 상태와 함께 모든 월드를 목록으로 표시합니다.

```bash
mcctl world list [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
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

월드를 서버에 잠금합니다.

```bash
mcctl world assign [world] [server]
```

**인수:**

| 인수 | 설명 |
|------|------|
| `world` | 월드 이름 (선택사항, 제공되지 않으면 프롬프트) |
| `server` | 서버 이름 (선택사항, 제공되지 않으면 프롬프트) |

**예제:**

=== "대화형 모드"
    ```bash
    mcctl world assign
    # 월드 목록 표시 후 서버 목록 표시
    ```

=== "CLI 모드"
    ```bash
    mcctl world assign survival mc-myserver
    ```

!!! info "월드 잠금"
    잠긴 월드는 할당된 서버에서만 사용할 수 있습니다. 이는 동시 접근으로 인한 데이터 손상을 방지합니다.

---

### mcctl world release

월드 잠금을 해제합니다.

```bash
mcctl world release [world] [options]
```

**인수:**

| 인수 | 설명 |
|------|------|
| `world` | 월드 이름 (선택사항, 제공되지 않으면 프롬프트) |

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--force` | 서버가 실행 중이어도 강제 해제 |

**예제:**

```bash
# 대화형 - 잠긴 월드 표시
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
|------|------|
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

**출력 (설정 안 됨):**

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
|------|------|------|
| `--message` | `-m` | 커밋 메시지 |

**예제:**

=== "대화형 모드"
    ```bash
    mcctl backup push
    # 커밋 메시지 프롬프트
    ```

=== "CLI 모드"
    ```bash
    mcctl backup push -m "서버 업그레이드 전"
    ```

---

### mcctl backup history

백업 히스토리를 표시합니다.

```bash
mcctl backup history [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
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

**인수:**

| 인수 | 설명 |
|------|------|
| `commit` | 커밋 해시 (선택사항, 제공되지 않으면 목록 표시) |

**예제:**

=== "대화형 모드"
    ```bash
    mcctl backup restore
    # 선택을 위한 백업 히스토리 표시
    ```

=== "CLI 모드"
    ```bash
    mcctl backup restore abc1234
    ```

!!! danger "데이터 덮어쓰기"
    복원은 현재 월드 데이터를 덮어씁니다. 복원 전에 백업했는지 확인하세요.

---

## 플레이어 유틸리티

### mcctl player lookup

Mojang API에서 플레이어 정보를 조회합니다.

```bash
mcctl player lookup <name> [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--json` | JSON 형식으로 출력 |

**예제:**

```bash
mcctl player lookup Notch
```

---

### mcctl player uuid

플레이어 UUID를 조회합니다.

```bash
mcctl player uuid <name> [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
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

다음 옵션은 모든 명령어에서 사용할 수 있습니다:

| 옵션 | 설명 | 예제 |
|------|------|------|
| `--root <path>` | 사용자 지정 데이터 디렉토리 | `mcctl --root /opt/mc status` |
| `--json` | JSON 출력 형식 | `mcctl status --json` |
| `-h, --help` | 도움말 표시 | `mcctl --help` |
| `--version` | 버전 표시 | `mcctl --version` |
