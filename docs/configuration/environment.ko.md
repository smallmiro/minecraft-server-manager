# 환경 변수

플랫폼에서 사용되는 모든 환경 변수에 대한 완전한 레퍼런스입니다.

## 전역 변수 (.env)

이 변수들은 `~/minecraft-servers/.env`에 설정되며 모든 서버에 적용됩니다.

### 네트워크 설정

| 변수 | 설명 | 기본값 | 예제 |
|------|------|--------|------|
| `HOST_IP` | 호스트 머신 IP 주소 | 자동 감지 | `192.168.1.100` |
| `MINECRAFT_NETWORK` | Docker 네트워크 이름 | `minecraft-net` | `minecraft-net` |
| `MINECRAFT_SUBNET` | 네트워크 서브넷 | `172.28.0.0/16` | `172.28.0.0/16` |

### 기본 서버 설정

| 변수 | 설명 | 기본값 | 예제 |
|------|------|--------|------|
| `DEFAULT_MEMORY` | 기본 메모리 할당 | `4G` | `4G`, `8G` |
| `DEFAULT_VERSION` | 기본 Minecraft 버전 | `LATEST` | `1.21.1`, `1.20.4` |
| `TZ` | 타임존 | `UTC` | `Asia/Seoul`, `America/New_York` |
| `RCON_PASSWORD` | RCON 콘솔 비밀번호 | `changeme` | `your-secure-password` |
| `RCON_PORT` | RCON 포트 | `25575` | `25575` |

### 백업 설정

| 변수 | 설명 | 기본값 | 예제 |
|------|------|--------|------|
| `BACKUP_GITHUB_TOKEN` | GitHub Personal Access Token | - | `ghp_xxxx...` |
| `BACKUP_GITHUB_REPO` | 대상 저장소 | - | `user/minecraft-backup` |
| `BACKUP_GITHUB_BRANCH` | 대상 브랜치 | `main` | `main`, `backups` |
| `BACKUP_AUTO_ON_STOP` | 서버 중지 시 자동 백업 | `false` | `true`, `false` |

---

## 서버 변수 (config.env)

이 변수들은 `servers/<name>/config.env`에 서버별로 설정됩니다.

### 필수 설정

| 변수 | 설명 | 기본값 | 예제 |
|------|------|--------|------|
| `EULA` | Minecraft EULA 동의 | `TRUE` | `TRUE` (필수) |
| `TYPE` | 서버 타입 | `PAPER` | `PAPER`, `FORGE`, `FABRIC` |
| `VERSION` | Minecraft 버전 | `LATEST` | `1.21.1` |

### 메모리 설정

| 변수 | 설명 | 기본값 | 예제 |
|------|------|--------|------|
| `MEMORY` | JVM 힙 메모리 | `4G` | `2G`, `4G`, `8G` |
| `INIT_MEMORY` | 초기 힙 크기 | `MEMORY`와 동일 | `2G` |
| `MAX_MEMORY` | 최대 힙 크기 | `MEMORY`와 동일 | `8G` |
| `JVM_OPTS` | 추가 JVM 옵션 | - | `-XX:+UseG1GC` |
| `JVM_DD_OPTS` | JVM -D 옵션 | - | `key=value,key2=value2` |

### 서버 속성

Minecraft의 `server.properties`에 직접 매핑됩니다:

| 변수 | 설명 | 기본값 | 예제 |
|------|------|--------|------|
| `MOTD` | 서버 메시지 | `A Minecraft Server` | `환영합니다!` |
| `MAX_PLAYERS` | 최대 플레이어 수 | `20` | `50`, `100` |
| `DIFFICULTY` | 게임 난이도 | `easy` | `peaceful`, `easy`, `normal`, `hard` |
| `GAMEMODE` | 기본 게임 모드 | `survival` | `survival`, `creative`, `adventure`, `spectator` |
| `LEVEL` | 월드/레벨 이름 | `world` | `survival`, `creative` |
| `SEED` | 월드 생성 시드 | 랜덤 | `12345`, `minecraft` |
| `PVP` | PvP 활성화 | `true` | `true`, `false` |
| `HARDCORE` | 하드코어 모드 | `false` | `true`, `false` |
| `ALLOW_FLIGHT` | 비행 허용 | `false` | `true`, `false` |
| `SPAWN_PROTECTION` | 스폰 보호 반경 | `16` | `0`, `16`, `32` |
| `VIEW_DISTANCE` | 시야 거리 (청크) | `10` | `8`, `12`, `16` |
| `SIMULATION_DISTANCE` | 시뮬레이션 거리 | `10` | `8`, `12` |
| `ONLINE_MODE` | Mojang 인증 | `true` | `true`, `false` |
| `ENABLE_COMMAND_BLOCK` | 커맨드 블록 활성화 | `false` | `true`, `false` |
| `FORCE_GAMEMODE` | 기본 게임모드 강제 | `false` | `true`, `false` |
| `ENABLE_WHITELIST` | 화이트리스트 활성화 | `false` | `true`, `false` |

### 월드 설정

| 변수 | 설명 | 기본값 | 예제 |
|------|------|--------|------|
| `LEVEL_TYPE` | 월드 타입 | `DEFAULT` | `DEFAULT`, `FLAT`, `LARGEBIOMES`, `AMPLIFIED` |
| `GENERATOR_SETTINGS` | 플랫 월드 프리셋 | - | JSON 문자열 |
| `WORLD` | URL에서 월드 다운로드 | - | `https://example.com/world.zip` |
| `WORLD_INDEX` | 월드 ZIP 내 경로 | `/` | `/world` |

### 모드/플러그인 설정

| 변수 | 설명 | 기본값 | 예제 |
|------|------|--------|------|
| `MODRINTH_PROJECTS` | Modrinth 모드 슬러그 | - | `fabric-api,lithium` |
| `MODRINTH_DOWNLOAD_DEPENDENCIES` | 의존성 다운로드 | `optional` | `required`, `optional`, `none` |
| `CF_API_KEY` | CurseForge API 키 | - | `$2a$10$...` |
| `CURSEFORGE_FILES` | CurseForge 프로젝트 슬러그 | - | `jei,journeymap` |
| `SPIGET_RESOURCES` | Spigot 리소스 ID | - | `1234,5678` |
| `MODS` | 모드 다운로드 URL | - | `https://example.com/mod.jar` |
| `PLUGINS_SYNC_UPDATE` | 플러그인 자동 업데이트 | `false` | `true` |

### 서버 운영자

| 변수 | 설명 | 기본값 | 예제 |
|------|------|--------|------|
| `OPS` | 운영자 사용자명 | - | `Steve,Alex` |
| `OPS_FILE` | ops 파일 경로 | - | `/config/ops.json` |
| `WHITELIST` | 화이트리스트 플레이어 | - | `Steve,Alex` |
| `WHITELIST_FILE` | 화이트리스트 파일 경로 | - | `/config/whitelist.json` |

### 성능 튜닝

| 변수 | 설명 | 기본값 | 예제 |
|------|------|--------|------|
| `USE_AIKAR_FLAGS` | Aikar의 JVM 플래그 사용 | `false` | `true` |
| `MAX_TICK_TIME` | 틱당 최대 ms | `60000` | `-1` (워치독 비활성화) |
| `NETWORK_COMPRESSION_THRESHOLD` | 압축 임계값 | `256` | `256`, `512` |
| `ENTITY_BROADCAST_RANGE_PERCENTAGE` | 엔티티 렌더 거리 % | `100` | `50`, `75`, `100` |

### 컨테이너 설정

| 변수 | 설명 | 기본값 | 예제 |
|------|------|--------|------|
| `UID` | 파일 권한용 사용자 ID | `1000` | `1000` |
| `GID` | 파일 권한용 그룹 ID | `1000` | `1000` |
| `SKIP_CHOWN_DATA` | 소유권 변경 건너뛰기 | `false` | `true` |
| `TZ` | 컨테이너 타임존 | `UTC` | `Asia/Seoul` |
| `ENABLE_RCON` | RCON 활성화 | `true` | `true`, `false` |
| `RCON_PASSWORD` | RCON 비밀번호 | 전역 .env에서 | `your-password` |

### 디버깅

| 변수 | 설명 | 기본값 | 예제 |
|------|------|--------|------|
| `DEBUG` | 디버그 출력 활성화 | `false` | `true` |
| `DEBUG_EXEC` | exec 명령어 디버그 | `false` | `true` |
| `DEBUG_MEMORY` | 메모리 사용량 디버그 | `false` | `true` |

---

## mc-router 변수

`~/minecraft-servers/.env`에 설정하고 mc-router에 전달됩니다:

| 변수 | 설명 | 기본값 | 예제 |
|------|------|--------|------|
| `IN_DOCKER` | Docker 모드 활성화 | `true` | `true` |
| `AUTO_SCALE_UP` | 접속 시 서버 자동 시작 | `true` | `true`, `false` |
| `AUTO_SCALE_DOWN` | 유휴 서버 자동 중지 | `true` | `true`, `false` |
| `AUTO_SCALE_DOWN_AFTER` | 중지 전 유휴 타임아웃 | `10m` | `1m`, `5m`, `10m`, `30m`, `1h` |
| `DOCKER_TIMEOUT` | 서버 시작 타임아웃 (초) | `120` | `120`, `300` |
| `AUTO_SCALE_ASLEEP_MOTD` | 슬리핑 서버 MOTD | - | `§e§l서버 슬립 중§r` |
| `API_BINDING` | 관리 API 바인딩 | `:8080` | `:8080` |

!!! tip "mc-router 관리"
    mc-router 변수 변경 후 재시작하세요:
    ```bash
    mcctl router restart
    ```

---

## 예제 설정

### 서바이벌 서버

```bash
# servers/survival/config.env
TYPE=PAPER
VERSION=1.21.1
MEMORY=4G

MOTD=서바이벌 서버 - 행운을 빕니다!
DIFFICULTY=hard
GAMEMODE=survival
MAX_PLAYERS=30
PVP=true

USE_AIKAR_FLAGS=true
VIEW_DISTANCE=12
```

### 크리에이티브 서버

```bash
# servers/creative/config.env
TYPE=VANILLA
VERSION=1.21.1
MEMORY=2G

MOTD=크리에이티브 모드 - 자유롭게 건축하세요!
DIFFICULTY=peaceful
GAMEMODE=creative
MAX_PLAYERS=20

SPAWN_PROTECTION=0
ENABLE_COMMAND_BLOCK=true
```

### 모드 서버 (Forge)

```bash
# servers/modded/config.env
TYPE=FORGE
VERSION=1.20.4
MEMORY=8G

MOTD=모드 서버 - 향상된 경험
DIFFICULTY=normal
GAMEMODE=survival

CF_API_KEY=${CF_API_KEY}
CURSEFORGE_FILES=jei,journeymap,create

USE_AIKAR_FLAGS=true
```

### 모드 서버 (Fabric)

```bash
# servers/fabric/config.env
TYPE=FABRIC
VERSION=1.21.1
MEMORY=6G

MOTD=Fabric 서버 - 성능 모드
DIFFICULTY=normal
GAMEMODE=survival

MODRINTH_PROJECTS=fabric-api,lithium,sodium,starlight
MODRINTH_DOWNLOAD_DEPENDENCIES=required
```

---

## 변수 보간

다른 변수를 참조할 수 있습니다:

```bash
# .env
HOST_IP=192.168.1.100

# config.env
MOTD=${HOST_IP}를 통해 접속하세요
```

## 참고

- **[서버 타입](server-types.ko.md)** - 타입별 설정
- **[itzg/minecraft-server 문서](https://docker-minecraft-server.readthedocs.io/)** - 전체 변수 레퍼런스
