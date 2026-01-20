# 빠른 시작

5분 만에 첫 번째 Minecraft 서버를 생성합니다.

## 사전 요구사항

[설치](installation.ko.md) 단계를 완료했는지 확인합니다:

- [x] Docker 설치 및 실행 중
- [x] Node.js 18+ 설치됨
- [x] mcctl 설치됨 (`npm install -g @minecraft-docker/mcctl`)
- [x] 플랫폼 초기화됨 (`mcctl init`)

## 1단계: 첫 번째 서버 생성

### 대화형 모드 (초보자 권장)

인수 없이 create 명령을 실행하면 가이드 설정이 진행됩니다:

```bash
mcctl create
```

다음 항목을 입력하라는 메시지가 표시됩니다:

1. **서버 이름** - 고유한 이름 (예: `survival`, `creative`)
2. **서버 타입** - Paper, Vanilla, Forge, Fabric 등
3. **Minecraft 버전** - 예: 1.21.1, 1.20.4
4. **메모리 할당** - 기본값은 4GB

### CLI 모드 (자동화용)

단일 명령으로 서버를 생성합니다:

```bash
mcctl create myserver -t PAPER -v 1.21.1
```

옵션:

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-t, --type` | 서버 타입 (PAPER, VANILLA, FORGE, FABRIC) | PAPER |
| `-v, --version` | Minecraft 버전 | 최신 버전 |
| `-s, --seed` | 월드 시드 | 랜덤 |
| `--no-start` | 시작하지 않고 생성만 | 자동 시작 |

## 2단계: 서버 시작 대기

서버가 자동으로 다운로드되고 시작됩니다. 로그를 확인합니다:

```bash
docker logs -f mc-myserver
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

create 명령의 출력을 확인하거나 다음을 실행합니다:

```bash
mcctl status
```

접속 정보가 표시됩니다:

```
Servers:
  mc-myserver (running)
    Connect: myserver.192.168.1.100.nip.io:25565
```

### Minecraft에서 접속

1. Minecraft Java Edition을 실행합니다
2. **멀티플레이어** > **서버 추가**를 클릭합니다
3. 서버 주소를 입력합니다: `myserver.192.168.1.100.nip.io:25565`
4. **완료**를 클릭하고 접속합니다!

!!! success "접속 방법"
    === "nip.io (권장)"
        인터넷에 연결된 모든 네트워크에서 작동합니다:
        ```
        myserver.192.168.1.100.nip.io:25565
        ```

    === "mDNS"
        로컬 네트워크에서 작동합니다 (avahi/Bonjour 필요):
        ```
        myserver.local:25565
        ```

    === "직접 IP"
        DNS가 작동하지 않는 경우:
        ```
        192.168.1.100:25565
        ```

## 4단계: 서버 관리

### 서버 상태 확인

```bash
mcctl status
```

출력:

```
Platform Status
===============

Router: mc-router (running)

Servers:
  mc-myserver
    Status: running
    Type: PAPER 1.21.1
    Memory: 4G
    Players: 0/20
    Connect: myserver.192.168.1.100.nip.io:25565
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
    mc-router를 사용하면 중지된 서버도 플레이어가 접속을 시도할 때 자동으로 시작됩니다.

### 서버 콘솔 접속 (RCON)

```bash
mcctl console myserver
```

대화형 RCON 세션이 열립니다:

```
> list
There are 0 of a max of 20 players online:
> help
```

종료하려면 `Ctrl+C`를 누릅니다.

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

## 다음 단계

<div class="grid cards" markdown>

-   :material-cog:{ .lg .middle } **서버 커스터마이즈**

    ---

    server.properties, 플러그인, 모드 설정

    [:octicons-arrow-right-24: 서버 설정](../configuration/environment.ko.md)

-   :material-earth:{ .lg .middle } **월드 관리**

    ---

    서버 간 월드 공유 및 잠금

    [:octicons-arrow-right-24: 월드 관리](../cli/commands.ko.md#월드-관리)

-   :material-backup-restore:{ .lg .middle } **백업 설정**

    ---

    월드 데이터 자동 GitHub 백업

    [:octicons-arrow-right-24: 백업 설정](../advanced/backup.ko.md)

-   :material-network:{ .lg .middle } **고급 네트워킹**

    ---

    nip.io, mDNS, 커스텀 도메인 설정

    [:octicons-arrow-right-24: 네트워킹 가이드](../advanced/networking.ko.md)

</div>

## 빠른 참조

### 서버 관리

| 작업 | 명령어 |
|------|--------|
| 서버 생성 | `mcctl create <name> [-t TYPE] [-v VERSION]` |
| 서버 목록 | `mcctl status` |
| 상세 상태 | `mcctl status --detail` |
| 실시간 모니터링 | `mcctl status --watch` |
| 서버 시작 | `mcctl start <name>` |
| 서버 중지 | `mcctl stop <name>` |
| 로그 확인 | `mcctl logs <name> [-f]` |
| RCON 콘솔 | `mcctl console <name>` |
| RCON 명령 실행 | `mcctl exec <name> <command>` |
| 서버 삭제 | `mcctl delete <name>` |

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

---

## 문제 해결

### 서버가 시작되지 않음

1. **로그에서 오류 확인:**
   ```bash
   mcctl logs <server> -n 100
   ```

2. **EULA 동의 확인:**
   ```bash
   mcctl config <server> EULA
   # EULA=TRUE 여야 함
   ```

3. **Java 버전 호환성 확인:**
   - Minecraft 1.21+ → Java 21 필요
   - Minecraft 1.18-1.20.4 → Java 17+ 필요
   - Forge 1.16.5 이하 → Java 8 필요

### 서버에 접속할 수 없음

1. **mc-router 실행 확인:**
   ```bash
   mcctl status
   # mc-router가 "running"과 "healthy" 상태여야 함
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
