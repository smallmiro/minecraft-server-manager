# 빠른 시작

5분 만에 첫 번째 Minecraft 서버를 생성합니다.

## 사전 요구사항

[설치](installation.ko.md) 단계를 완료했는지 확인합니다:

- [x] Docker 설치 및 실행 중
- [x] Node.js 18+ 설치됨
- [x] mcctl 설치됨 (`npm install -g @minecraft-docker/mcctl`)
- [x] 플랫폼 초기화됨 (`mcctl init`)
- [x] mc-router 시작됨 (`mcctl router start`)

!!! note "mc-router는 한 번 시작합니다"
    `mcctl init`은 mc-router를 시작하지 않고, 서버를 생성하면 그 서버만 시작됩니다. `mcctl router start`를 한 번 실행하세요. 직접 중지하기 전까지 재부팅 후에도 Docker가 mc-router를 다시 시작합니다. `mcctl up`은 mc-router와 모든 서버를 시작합니다.

## 1단계: 첫 번째 서버 생성

### 대화형 모드 (초보자 권장)

인수 없이 create 명령을 실행하면 가이드 설정이 진행됩니다:

```bash
mcctl create
```

다음 항목을 입력하라는 메시지가 표시됩니다:

1. **서버 이름** - 고유한 이름 (예: `survival`, `creative`)
2. **서버 타입** - Paper, Vanilla, Forge, Fabric 등
3. **Minecraft 버전** - 예: 1.21.1, 1.20.4 (모드팩 타입은 대신 모드팩을 묻습니다)
4. **월드** - 새 월드, 시드를 지정한 새 월드, `worlds/`의 기존 월드, 월드 ZIP URL 중에서 선택
5. **메모리 할당** - 기본값은 4GB (모드팩은 6GB)
6. **화이트리스트** - 기본값은 꺼짐이며, 켜면 플레이어를 추가할 수 있습니다
7. **playit.gg 도메인** - playit.gg를 활성화한 경우에만

`/etc/avahi/hosts`가 있으면(avahi-daemon이 설치된 경우) `<name>.local` 등록을 위해 먼저 sudo 비밀번호를 묻습니다(Enter를 누르면 비밀번호 없이 sudo를 시도합니다).

### CLI 모드 (자동화용)

단일 명령으로 서버를 생성합니다:

```bash
mcctl create myserver -t PAPER -v 1.21.1
```

옵션:

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-t, --type` | 서버 타입 (PAPER, VANILLA, FORGE, NEOFORGE, FABRIC) | PAPER |
| `-v, --version` | Minecraft 버전 | 최신 버전 |
| `-s, --seed` | 월드 시드 | 랜덤 |
| `--no-start` | 시작하지 않고 생성만 | 자동 시작 |
| `--whitelist`, `--enable-whitelist` | 화이트리스트 켜기 (지정한 플레이어로, 또는 빈 목록으로) | 꺼짐 |

## 2단계: 서버 시작 대기

서버가 자동으로 다운로드되고 시작됩니다. 로그를 확인합니다:

```bash
mcctl logs myserver -f
```

다음 메시지가 나타날 때까지 기다립니다:

```
[Server thread/INFO]: Done (X.XXXs)! For help, type "help"
```

!!! tip "첫 시작은 더 오래 걸립니다"
    첫 시작 시 Minecraft 서버 파일을 다운로드하고 월드를 생성합니다.
    이후 시작은 훨씬 빠릅니다.

## 3단계: 서버 접속

### 서버 주소 확인

create 명령은 `Connect via: myserver.local:25565`만 출력합니다. 서버의 모든 주소는 `mcctl status`의 HOSTNAME 열에 표시됩니다:

```bash
mcctl status
```

```
MINECRAFT SERVERS
SERVER               STATUS       HEALTH     HOSTNAME
------               ------       ------     --------
myserver             running      healthy    myserver.local,myserver.192.168.1.100.nip.io
```

### Minecraft에서 접속

1. Minecraft Java Edition을 실행합니다
2. **멀티플레이어** > **서버 추가**를 클릭합니다
3. 서버 주소를 입력합니다: `myserver.192.168.1.100.nip.io:25565`
4. **완료**를 클릭하고 접속합니다!

!!! success "접속 방법"
    === "nip.io (권장)"
        `192.168.1.100`에 접근할 수 있는 네트워크(보통 같은 LAN)에서 작동합니다. `HOST_IPS`에 넣은 VPN 주소에는 별도의 호스트네임이 생깁니다:
        ```
        myserver.192.168.1.100.nip.io:25565
        ```

    === "mDNS"
        로컬 네트워크에서 작동합니다 (avahi/Bonjour 필요):
        ```
        myserver.local:25565
        ```

    IP만으로(`192.168.1.100:25565`) 접속하면 작동하지 않습니다. mc-router는 클라이언트가 보낸 호스트네임으로 서버를 고르기 때문입니다. 인터넷에서 접속하게 하려면 [외부 접속](../advanced/external-access.ko.md)을 참조하세요.

## 4단계: 서버 관리

### 서버 상태 확인

```bash
mcctl status
```

출력:

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

타입, 버전, 메모리, 플레이어는 `mcctl status myserver`(모든 서버는 `mcctl status --detail`)로 확인합니다:

```
=== Server: myserver ===

  myserver
    Container: mc-myserver
    Status:    running (healthy)
    Hostname:  myserver.local,myserver.192.168.1.100.nip.io
    Type:      PAPER
    Version:   1.21.1
    Memory:    4G
    Uptime:    5m
    Resources: 1.2 GB / 15.5 GB (7.7%) | CPU: 3.1%
    Players:   0/20 - none
```

### 서버 로그 확인

```bash
mcctl logs myserver

# 실시간으로 로그 추적
mcctl logs myserver -f
```

### 서버 중지

```bash
mcctl stop myserver
```

### 서버 시작

```bash
mcctl start myserver
```

!!! note "접속 시 자동 시작"
    mc-router를 사용하면 중지된 서버도 플레이어가 접속을 시도할 때 자동으로 시작됩니다. 이 기능에는 서버 컨테이너가 있어야 합니다. `--no-start`로 생성한 서버나 `mcctl down`(컨테이너를 삭제함) 후의 모든 서버는 `mcctl start <name>`(또는 `mcctl up`)을 한 번 실행해야 접속 시 시작됩니다.

### 서버 콘솔 접속 (RCON)

```bash
mcctl console myserver
```

대화형 RCON 세션이 열립니다(서버가 실행 중이어야 합니다):

```
> list
There are 0 of a max of 20 players online:
> help
```

종료하려면 `exit`나 `quit`를 입력하거나 `Ctrl+C` 또는 `Ctrl+D`를 누릅니다.

!!! note "Docker Desktop (macOS)"
    `mcctl console`은 Docker 네트워크에 있는 컨테이너 IP 주소로 TCP 접속하는데, Docker Desktop은 이 주소를 호스트에 노출하지 않을 수 있습니다. 이때는 `mcctl exec myserver <command>`를 사용하세요.

## 예제: 여러 서버 생성

다양한 게임 모드를 위한 추가 서버를 생성합니다:

```bash
# 특정 시드를 사용한 크리에이티브 서버
mcctl create creative -t VANILLA -v 1.21.1 -s 12345

# Forge를 사용한 모드 서버
mcctl create modded -t FORGE -v 1.20.4

# 모든 서버 확인
mcctl status
```

각 서버는 고유한 호스트네임을 갖습니다:

- `creative.192.168.1.100.nip.io:25565`
- `modded.192.168.1.100.nip.io:25565`

## mcctl 업데이트 유지

`mcctl update`는 npm에서 CLI와 설치된 서비스(mcctl-api, mcctl-console, shared 라이브러리)를 업데이트합니다.

### 업데이트 확인

```bash
mcctl update --check   # CLI 업데이트가 있으면 exit 1
```

### mcctl 업데이트

```bash
# 대화형 (확인 프롬프트 표시)
mcctl update

# 자동 확인 (CI/CD에 유용)
mcctl update --yes

# CLI만 업데이트
mcctl update --cli-only
```

`mcctl update`는 또한 각 서버의 이미지 태그를 `VERSION`과 비교하고, 서버 이미지를 받은 뒤, 터미널에서는 아직 옛 이미지를 쓰는 중지된 서버를 다시 만들지 묻습니다(기본값 No). `mcctl upgrade`는 실행하지 않으므로 이어서 `mcctl upgrade`를 실행해 `.env`, `servers/_template`, 라우터를 갱신하세요. 전체 절차는 [업그레이드 런북](../advanced/upgrade-runbook.ko.md)에 있습니다.

!!! tip "자동 업데이트 확인"
    mcctl은 각 명령을 실행하기 전에(`--help`, `--version` 제외) npm에서 새 버전을 확인합니다. 결과는 `~/.mcctl-update-check.json`에 24시간 동안 캐시되며, 캐시가 오래되면 명령이 확인을 기다립니다(최대 약 2초).
    새 버전이 있으면 알림을 출력합니다.

전체 update 명령어 레퍼런스는 [mcctl update](../cli/commands.ko.md#mcctl-update)를 참조하세요.

## 다음 단계

<div class="grid cards" markdown>

-   :material-cog:{ .lg .middle } **서버 커스터마이즈**

    ---

    server.properties, 플러그인, 모드 설정

    [:octicons-arrow-right-24: 서버 설정](../configuration/environment.ko.md)

-   :material-earth:{ .lg .middle } **월드 관리**

    ---

    서버에 월드 배정 (한 월드에 한 서버)

    [:octicons-arrow-right-24: 월드 관리](../cli/commands.ko.md#월드-관리)

-   :material-backup-restore:{ .lg .middle } **백업 설정**

    ---

    월드 데이터 자동 GitHub 백업

    [:octicons-arrow-right-24: 백업 설정](../advanced/backup.ko.md)

-   :material-network:{ .lg .middle } **고급 네트워킹**

    ---

    nip.io, mDNS, 커스텀 도메인 설정

    [:octicons-arrow-right-24: 네트워킹 가이드](../advanced/networking.ko.md)

-   :material-earth:{ .lg .middle } **외부 접속 (playit.gg)**

    ---

    포트 포워딩 없이 친구들이 인터넷에서 접속 가능

    [:octicons-arrow-right-24: 외부 접속 가이드](../advanced/external-access.ko.md)

</div>

## 빠른 참조

### 서버 관리

| 작업 | 명령어 |
|------|--------|
| mc-router 시작 | `mcctl router start` |
| mc-router와 모든 서버 시작 | `mcctl up` |
| 서버 생성 | `mcctl create <name> [-t TYPE] [-v VERSION]` |
| 서버 목록 | `mcctl status` |
| 상세 상태 | `mcctl status --detail` |
| 실시간 모니터링 | `mcctl status --watch` |
| 서버 시작 | `mcctl start <name>` |
| 서버 중지 | `mcctl stop <name>` |
| 로그 확인 | `mcctl logs <name> [-f]` |
| RCON 콘솔 | `mcctl console <name>` |
| RCON 명령 실행 | `mcctl exec <name> <command>` |
| 서버 삭제 (먼저 확인, 월드는 유지) | `mcctl delete <name> [--delete-world]` |

### 플레이어 관리

| 작업 | 명령어 |
|------|--------|
| 관리자 추가 | `mcctl op <server> add <player>` |
| 관리자 제거 | `mcctl op <server> remove <player>` |
| 관리자 목록 | `mcctl op <server> list` |
| 화이트리스트 추가 | `mcctl whitelist <server> add <player>` |
| 화이트리스트 활성화 | `mcctl whitelist <server> on` |
| 플레이어 밴 | `mcctl ban <server> add <player> [reason]` |
| 플레이어 강퇴 | `mcctl kick <server> <player> [reason]` |
| 온라인 플레이어 확인 | `mcctl player online <server>` |

### 설정

| 작업 | 명령어 |
|------|--------|
| 설정 보기 | `mcctl config <server>` |
| 설정 변경 | `mcctl config <server> KEY value` |
| 치트 활성화 | `mcctl config <server> --cheats` |
| PvP 비활성화 | `mcctl config <server> --no-pvp` |

### 백업

| 작업 | 명령어 |
|------|--------|
| 서버 설정 백업 | `mcctl server-backup <server>` |
| 서버 설정 복원 | `mcctl server-restore <server>` |
| 월드 GitHub 백업 | `mcctl backup push -m "message"` |
| GitHub에서 복원 | `mcctl backup restore <commit>` |

### 유지보수

| 작업 | 명령어 |
|------|--------|
| 업데이트 확인 | `mcctl update --check` |
| CLI와 서비스 업데이트 | `mcctl update` |
| CLI만 업데이트 | `mcctl update --cli-only` |
| 자동 확인 업데이트 | `mcctl update --yes` |
| 업데이트 후 플랫폼 파일 동기화 | `mcctl upgrade` |

---

## 문제 해결

### 서버가 시작되지 않음

1. **로그에서 오류 확인:**
   ```bash
   mcctl logs <server> -n 100
   ```

2. **Java 버전 호환성 확인:**
   - Minecraft 26.x와 `LATEST` → Java 25 필요
   - Minecraft 1.20.5–1.21.x → Java 21 필요
   - Minecraft 1.17–1.20.4 → Java 17 필요
   - Minecraft 1.16.5 이하 → Java 8 필요

### 서버에 접속할 수 없음

1. **mc-router 실행 확인:**
   ```bash
   mcctl status
   # mc-router가 "running"과 "healthy" 상태여야 함
   mcctl router start   # 실행 중이 아니면
   ```

2. **서버 호스트명 확인:**
   ```bash
   mcctl status <server>
   # 호스트명 확인 (예: myserver.192.168.1.100.nip.io)
   ```

3. **서버 실행 확인:**
   ```bash
   mcctl start <server>
   ```

### 서버 충돌

1. **메모리 할당 확인:**
   ```bash
   mcctl config <server> MEMORY
   # 필요시 증가: mcctl config <server> MEMORY 6G
   ```

2. **모드 충돌 확인:**
   ```bash
   mcctl logs <server> | grep -i "error\|exception"
   ```

### 권한 거부 오류

```bash
# 파일 소유권 수정 (필요시)
sudo chown -R $USER:$USER ~/minecraft-servers/
```

더 자세한 문제 해결은 [itzg/minecraft-server 문서](https://docker-minecraft-server.readthedocs.io/)를 참조하세요.
