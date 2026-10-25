# 환경 변수

플랫폼에서 사용되는 모든 환경 변수에 대한 완전한 레퍼런스입니다.

## mcctl로 빠른 설정

대부분의 설정은 `mcctl config`를 사용하여 구성할 수 있습니다:

```bash
# 현재 설정 보기
mcctl config myserver

# 설정 변경
mcctl config myserver MEMORY 8G
mcctl config myserver MOTD "환영합니다!"
mcctl config myserver MAX_PLAYERS 50

# 일반적인 설정을 위한 단축 옵션
mcctl config myserver --cheats        # 치트 활성화
mcctl config myserver --no-pvp        # PvP 비활성화
mcctl config myserver --command-block # 커맨드 블록 활성화
```

!!! tip "권장 접근 방식"
    표준 설정에는 `mcctl config`를 사용하세요. CLI에서 지원하지 않는 고급 옵션에 대해서만 설정 파일을 직접 편집합니다.

## 웹 콘솔에서 설정

관리자는 웹 콘솔의 **Settings** → **Platform Settings**에서 플랫폼 `.env`를 편집할 수 있습니다. 키는 카드별로 묶여 있고, 시크릿은 쓰기 전용이며, 저장은 `.env`만 기록합니다. 저장 후 대화상자가 재시작할 대상을 안내합니다. 서버별 값은 각 서버의 **Options** 탭에 그대로 있습니다. [플랫폼 설정](../console/web-console.md#플랫폼-설정-관리자)을 참고하세요.

![Platform Settings](../images/platform-settings.png)

---

## 전역 변수 (.env)

이 변수들은 `~/minecraft-servers/.env`에 설정됩니다. 서버 컨테이너에는 `servers/global.env`에 이름이 있는 키만 전달됩니다. 각 키를 누가 읽는지는 [설정 분류](#설정-분류)를 참고하세요.

### 네트워크 설정

| 변수 | 설명 | 기본값 | mcctl |
|------|------|--------|-------|
| `HOST_IP` | 호스트 머신 IP 주소 | 자동 감지 | `mcctl init` |
| `HOST_IPS` | VPN mesh용 다중 IP (쉼표 구분) | - | 수동 |
| `DOCKER_GID` | non-root mc-router(1.46+)용 Docker 소켓 그룹 ID | `999` | `mcctl init` / `mcctl upgrade` |
| `MINECRAFT_NETWORK` | compose 파일이 연결하는 Docker 네트워크 이름. `mcctl init`이 `minecraft-net`을 만듭니다 | `minecraft-net` | 수동 |
| `MINECRAFT_SUBNET` | mcctl이 읽지 않습니다. `mcctl init`은 `minecraft-net`을 서브넷 `172.28.0.0/16`으로 만듭니다 | `172.28.0.0/16` | - |

!!! tip "다중 네트워크 접속 (Tailscale/ZeroTier)"
    LAN과 VPN에서 동시에 접속하려면 `HOST_IPS`를 사용하세요:
    ```bash
    # LAN IP + Tailscale IP
    HOST_IPS=192.168.1.100,100.64.0.5
    ```
    자세한 설정은 **[VPN Mesh 네트워크 가이드](../advanced/networking.ko.md#vpn-mesh-네트워크)**를 참조하세요.

### 기본 서버 설정

| 변수 | 설명 | 기본값 | mcctl |
|------|------|--------|-------|
| `TZ` | 서버 컨테이너의 타임존. `mcctl init`이 템플릿의 `TZ=Asia/Seoul`을 그대로 복사하므로 사용하는 IANA 타임존으로 바꾸세요 | `Asia/Seoul` | 수동 |
| `RCON_PASSWORD` | RCON 콘솔 비밀번호. `mcctl init`이 무작위로 생성하며, 변경 후에는 컨테이너를 재생성해야 합니다 (`mcctl down && mcctl up`) | 무작위 | `mcctl init` |
| `RCON_PORT` | RCON 포트 | `25575` | 자동 |
| `EXTRA_ARGS` | 아직 `server.yaml`이 없는 서버에 전달하는 추가 인자. `server.yaml`이 있는 서버는 `config.env`에 항상 자신의 `EXTRA_ARGS`(`world.storage`와 `env.EXTRA_ARGS`에서 생성)를 쓰므로 이 값이 전달되지 않습니다. 이 값을 상속하는 실행 중 서버의 월드 위치를 바꾸거나, 상속 서버를 다른 서버가 쓰는 월드에 놓게 되면 콘솔 저장이 거부됩니다(409, 해당 서버 목록 포함) | - | 수동 |

### 백업 설정

| 변수 | 설명 | 기본값 | mcctl |
|------|------|--------|-------|
| `BACKUP_GITHUB_TOKEN` | GitHub Personal Access Token | - | `mcctl backup init` |
| `BACKUP_GITHUB_REPO` | 대상 저장소 | - | `mcctl backup init` |
| `BACKUP_GITHUB_BRANCH` | 대상 브랜치 | `main` | `mcctl backup init` |
| `BACKUP_AUTO_ON_STOP` | 서버 중지 시 자동 백업 | `false` | `mcctl backup init` |

!!! info "백업 설정"
    백업 변수 설정 후 확인:
    ```bash
    mcctl backup status
    ```

### 외부 접속 및 콘솔

| 변수 | 설명 | 기본값 | mcctl |
|------|------|--------|-------|
| `PLAYIT_SECRET_KEY` | playit.gg 에이전트 시크릿 키 | - | `mcctl playit setup` |
| `LOG_LEVEL` | mcctl-api 로그 레벨 | `info` | 수동 |
| `BETTER_AUTH_SECRET` | 콘솔 로그인 세션 서명 키. 변경하면 모든 사용자가 로그아웃됩니다 | 무작위 | `mcctl console init` |
| `BETTER_AUTH_BASE_URL` | 인증 콜백에 쓰는 콘솔 공개 URL | `http://localhost:<console port>` | 수동 |

### mcctl-api 제한

mcctl-api는 시작할 때 `.env`에서 이 키들을 읽습니다. 변경은 `mcctl console service restart --api`로 적용합니다. 콘솔의 월드 업로드 라우트도 `.env`에서 `WORLD_UPLOAD_MAX_SIZE`를 읽으므로, 이 값을 바꾼 뒤에는 `mcctl console service restart --console`도 실행하세요. Platform Settings에는 **Unknown**으로 표시됩니다.

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `WORLD_UPLOAD_MAX_SIZE` | `POST /api/worlds/upload`가 받는 월드 ZIP의 최대 크기(바이트) | `1073741824` (1 GiB) |
| `WORLD_EXTRACT_MAX_SIZE` | 월드 ZIP을 풀 때 허용하는 압축 해제 후 전체 크기(바이트) | `5368709120` (5 GiB) |
| `WORLD_EXTRACT_MAX_ENTRIES` | 월드 ZIP에 허용하는 최대 항목 수 | `100000` |
| `STATS_ANALYZE_TIMEOUT_MS` | 광석·블록 통계 스캔의 제한 시간(밀리초) | `600000` (10분) |
| `SWAGGER_ENABLED` | `true`이면 `NODE_ENV=production`에서도 `/docs`에서 API 문서를 제공합니다(개발 모드에서는 항상 켜짐) | - |

### 설정 분류

`.env`의 모든 키는 템플릿 포함 여부가 아니라 실제로 해당 키를 읽는 코드에 따라 정확히 하나의 상태로 분류됩니다. 콘솔 **Settings** 페이지(관리자 전용)에도 동일한 분류가 표시됩니다. [플랫폼 설정](../console/web-console.md#플랫폼-설정-관리자)을 참고하세요.

!!! info "서버 컨테이너에 전달되는 `.env` 키"
    서버는 `env_file: [../global.env, config.env]`를 로드합니다. `servers/global.env`에는 키 **이름**만 있으며(`TZ`, `EXTRA_ARGS`, `RCON_PASSWORD`, `RCON_PORT`), Docker Compose가 값을 `.env`에서 채웁니다. `BACKUP_GITHUB_TOKEN`, `PLAYIT_SECRET_KEY` 같은 시크릿을 포함한 나머지 키는 컨테이너에 들어가지 않습니다. 다른 키를 모든 서버에 전달하려면 `servers/global.env`에 이름을 추가하세요. 서버의 `config.env`는 해당 서버에 한해 플랫폼 값을 덮어씁니다. `.env`의 모든 키는 여전히 시작 시 `mcctl-api` 환경에 로드됩니다.

!!! warning "이전 버전에서 업그레이드하는 경우"
    이 변경 전에 만든 서버는 `.env` 전체(`- ../../.env`)를 로드합니다. `mcctl upgrade`가 `servers/global.env`를 만들고 기존 서버가 이를 쓰도록 바꿉니다. 컨테이너는 다시 만들 때까지 이전 환경을 유지하므로, 이후 서버마다 `mcctl stop <name> && mcctl start <name>`을 실행하세요. 위 네 개 외에 `.env`로 전달되던 키에 의존했다면 `servers/global.env`에 이름을 추가해야 합니다.

| 상태 | 의미 | 콘솔에서 편집 |
|------|------|---------------|
| Editable | 지원되며 타입별 입력 제공 | 가능 |
| Read-only | 지원되지만 UI에서 변경하기 위험 | 불가 (CLI 전용) |
| Runtime-managed (PM2) | `ecosystem.config.cjs`가 주입 | 불가 (`mcctl console init`) |
| Legacy | 현재 어떤 코드도 읽지 않음 | 삭제만 가능 |
| Unknown | mcctl이 인식하지 못함 | Advanced 편집기 |

**편집 가능한 키**

| 키 | 사용처 | 적용 범위 |
|----|--------|-----------|
| `HOST_IP`, `HOST_IPS` | `mcctl create`, `mcctl init --reconfigure`, 이후 서버에 대한 모든 mcctl 변경 | `next-create`: 다음 `mcctl create`부터 사용. 기존 서버는 다음에 mcctl이 그 서버의 파일을 다시 쓸 때 새 주소를 nip.io 호스트명에 반영하며, `mcctl init --reconfigure`는 모든 서버를 다시 만듭니다. 적용하려면 서버를 stop 후 start |
| `DOCKER_GID` | compose `router.group_add` | `router`: `mcctl router start` (`mcctl router restart`로는 적용되지 않습니다) |
| `TZ`, `EXTRA_ARGS` | 모든 서버 컨테이너 (`servers/global.env`). `EXTRA_ARGS`는 `server.yaml`이 없는 서버에만 전달됨 | `servers`: 각 서버를 stop 후 start |
| `RCON_PASSWORD` (시크릿), `RCON_PORT` | 모든 서버 컨테이너 (`servers/global.env`), CLI `rcon` | `servers` |
| `BACKUP_GITHUB_TOKEN` (시크릿), `BACKUP_GITHUB_REPO`, `BACKUP_GITHUB_BRANCH` | CLI와 mcctl-api 백업 (`GitWorldBackupAdapter`가 작업마다 `.env`를 다시 읽음) | `none`: 다음 백업 작업 |
| `BACKUP_AUTO_ON_STOP` | `mcctl stop <server>`, API·콘솔 정지 | `none`: 다음 정지 |
| `PLAYIT_SECRET_KEY` (시크릿) | compose `playit` 서비스 (`SECRET_KEY`) | `playit`: playit를 stop 후 start |
| `LOG_LEVEL` | **mcctl-api 전용** (dotenv, cwd = MCCTL_ROOT) | `api` |
| `BETTER_AUTH_SECRET` (시크릿, 삭제 불가), `BETTER_AUTH_BASE_URL` | mcctl-console은 시작 시 `.env`에서 이 두 인증 키를 읽으며, 비어 있지 않은 값은 `ecosystem.config.cjs`에 해당 키가 더 이상 없을 때만 사용됩니다(ecosystem에 있는 동안은 ecosystem 값이 우선하고, `.env`와 다르면 경고를 로그에 남깁니다). `mcctl upgrade`가 이 키들을 `.env`로 옮깁니다. 시크릿을 바꾸면 모든 사용자가 로그아웃됩니다. base URL 미설정 시 `http://localhost:<console port>` | `console`: `mcctl console service restart --console` |

**읽기 전용 키:** `MINECRAFT_NETWORK` (mcctl은 `minecraft-net`만 만듭니다. 이름을 바꾸려면 `mcctl down`, `docker network create <name>`, `.env` 수정, `mcctl up` 순서로 진행), `MINECRAFT_SUBNET` (mcctl이 읽지 않으며, 네트워크는 만들 때의 서브넷을 유지), `COMPOSE_PROJECT_NAME` (변경하면 기존 컨테이너와 네트워크가 고아가 되므로 CLI 전용).

**Runtime-managed (PM2):** `AUTH_MODE`(api)는 `ecosystem.config.cjs`에서 옵니다. 변경하려면 `mcctl console init`을 다시 실행하세요. 이전 버전에서 생성된 ecosystem 파일은 `BETTER_AUTH_SECRET`, `BETTER_AUTH_BASE_URL`도 주입하지만 ecosystem에 정의돼 있는 동안은 ecosystem 값이 `.env`보다 우선하고 Platform Settings에는 읽기 전용으로 표시됩니다. `mcctl upgrade`를 실행하면 두 키가 `.env`로 옮겨지고(시크릿은 그대로라 세션 유지, 백업 `ecosystem.config.cjs.bak-<타임스탬프>` 생성), 이후 `mcctl console service restart --console`로 적용합니다.


**Legacy:** `API_ACCESS_MODE`, `BETTER_AUTH_TRUSTED_ORIGINS`, `BETTER_AUTH_URL`, `MCCTL_API_IMAGE`, `MCCTL_CONSOLE_IMAGE`, `MCCTL_CONSOLE_PORT`, `MCCTL_CORS_ORIGIN`, `MCCTL_JWT_EXPIRY`, `MCCTL_JWT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DEFAULT_MEMORY`, `DEFAULT_VERSION`. `DEFAULT_MEMORY`와 `DEFAULT_VERSION`은 어떤 생성 경로도 읽지 않습니다.

**Unknown:** mcctl이 인식하지 못하는 키입니다. 시작 시 mcctl-api에 로드되며, 이름이 `servers/global.env`에 있을 때만 Minecraft 서버에 전달됩니다.

이름이 `SECRET`, `TOKEN`, `PASSWORD`, `PASSWD`, `CREDENTIAL`, `PRIVATE`을 포함하거나 `_KEY`로 끝나는 Legacy/Unknown 키는 시크릿으로 처리되어 값이 표시되지 않습니다.

!!! note "Restart는 `.env`를 다시 읽지 않습니다"
    `docker compose restart`와 `mcctl router restart`는 `.env`를 다시 읽지 않습니다. 컨테이너가 재생성되도록 stop 후 start(또는 `mcctl router start`)를 사용하세요.

---

## 서버 변수 (config.env)

이 변수들은 서버별로 설정됩니다. `mcctl config`를 사용하여 관리합니다. mcctl은 서버의 [server.yaml](server-yaml.ko.md)에서 `config.env`를 만들어 쓰며, 손으로 고친 내용은 다음에 mcctl이 그 서버를 바꿀 때 `server.yaml`로 가져옵니다.

### 값 규칙

`config.env`는 Docker Compose가 env 파일을 읽는 방식으로 읽힙니다:

- 한 줄에 `KEY=value` 하나입니다. mcctl은 여러 줄에 걸친 값을 지원하지 않으며, `=`가 없는 다음 줄은 값에 포함되지 않습니다.
- 따옴표 없는 값에서는 공백 뒤의 `#`부터 주석입니다. `MOTD=Hi #1`은 `Hi`가 됩니다. 이런 값은 따옴표로 감싸거나(`MOTD='Hi #1'`) `mcctl config`로 설정하세요. `mcctl config`는 따옴표를 알아서 붙입니다.
- 같은 키가 두 번 있으면 마지막 줄이 적용됩니다.
- mcctl은 제어 문자가 들어 있거나 따옴표로 시작하는 값, 그리고 `$`, ` #`, 앞뒤 공백이 있으면서 `'`를 포함하거나 `\`로 끝나는 값을 거부합니다.

### 필수 설정

| 변수 | 설명 | 기본값 | mcctl 명령어 |
|------|------|--------|--------------|
| `EULA` | Minecraft EULA 동의 | `TRUE` | 자동 설정 |
| `TYPE` | 서버 타입 | `PAPER` (`mcctl create`, 웹 콘솔 폼은 `VANILLA`로 시작) | `mcctl create -t TYPE` |
| `VERSION` | Minecraft 버전 | `LATEST` | `mcctl config <server> VERSION` |

### 메모리 설정

| 변수 | 설명 | 기본값 | mcctl 명령어 |
|------|------|--------|--------------|
| `MEMORY` | JVM 힙 메모리 | `4G` (모드팩 타입은 `6G`) | `mcctl config <server> MEMORY` |
| `INIT_MEMORY` | 초기 힙 크기 | `MEMORY`와 동일 | 수동 |
| `MAX_MEMORY` | 최대 힙 크기 | `MEMORY`와 동일 | 수동 |
| `JVM_OPTS` | 추가 JVM 옵션 | - | 수동 |
| `JVM_DD_OPTS` | JVM -D 옵션 | - | 수동 |

**예제 - 메모리 설정:**

```bash
mcctl config myserver MEMORY 8G
mcctl stop myserver && mcctl start myserver
```

### 서버 속성

Minecraft의 `server.properties`에 직접 매핑됩니다. 기본값은 새 서버가 받는 값입니다. `mcctl create`가 템플릿에서 `config.env`에 쓰는 값이고, 쓰지 않는 키는 이미지 기본값입니다.

| 변수 | 설명 | 기본값 | mcctl 명령어 |
|------|------|--------|--------------|
| `MOTD` | 서버 메시지 | `Welcome to <name>! Your adventure begins here.` | `mcctl config <server> MOTD` |
| `MAX_PLAYERS` | 최대 플레이어 수 | `20` | `mcctl config <server> MAX_PLAYERS` |
| `DIFFICULTY` | 게임 난이도 | `normal` | `mcctl config <server> DIFFICULTY` |
| `MODE` | 기본 게임 모드 (`survival`, `creative`, `adventure`, `spectator`). 이미지는 `GAMEMODE`가 아니라 `MODE`를 읽습니다 | `survival` | `mcctl config <server> MODE` |
| `LEVEL` | 월드/레벨 이름 | 자동 설정 | `mcctl config <server> LEVEL` |
| `SEED` | 월드 생성 시드 | 랜덤 | `mcctl create -s SEED` |
| `PVP` | PvP 활성화 | `true` | `mcctl config <server> --pvp/--no-pvp` |
| `HARDCORE` | 하드코어 모드 | `false` | `mcctl config <server> HARDCORE` |
| `ALLOW_FLIGHT` | 비행 허용 | `false` | `mcctl config <server> ALLOW_FLIGHT` |
| `SPAWN_PROTECTION` | 스폰 보호 반경 | `0` | `mcctl config <server> SPAWN_PROTECTION` |
| `VIEW_DISTANCE` | 시야 거리 (청크) | `10` | `mcctl config <server> VIEW_DISTANCE` |
| `SIMULATION_DISTANCE` | 시뮬레이션 거리 | `10` | `mcctl config <server> SIMULATION_DISTANCE` |
| `ONLINE_MODE` | Mojang 인증 | `true` | `mcctl config <server> ONLINE_MODE` |
| `ENABLE_COMMAND_BLOCK` | 커맨드 블록 활성화 | `false` | `mcctl config <server> --command-block` |
| `FORCE_GAMEMODE` | 기본 게임모드 강제 | `false` | `mcctl config <server> FORCE_GAMEMODE` |
| `ENABLE_WHITELIST` | 화이트리스트 활성화 | `false` | `mcctl whitelist <server> on` |

**예제 - 게임 설정 구성:**

```bash
mcctl config myserver DIFFICULTY hard
mcctl config myserver MODE survival
mcctl config myserver MAX_PLAYERS 30
mcctl config myserver --no-pvp
```

### 월드 설정

| 변수 | 설명 | 기본값 | mcctl 명령어 |
|------|------|--------|--------------|
| `LEVEL_TYPE` | 월드 타입 | `DEFAULT` | `mcctl config <server> LEVEL_TYPE` |
| `GENERATOR_SETTINGS` | 플랫 월드 프리셋 | - | 수동 |
| `WORLD` | URL에서 월드 다운로드 | - | `mcctl create -u URL` |
| `WORLD_INDEX` | 월드 ZIP 내 경로 | `/` | 수동 |

### 모드/플러그인 설정

| 변수 | 설명 | 기본값 | mcctl 명령어 |
|------|------|--------|--------------|
| `MODRINTH_PROJECTS` | Modrinth 모드 슬러그 | - | `mcctl config <server> MODRINTH_PROJECTS` |
| `MODRINTH_DOWNLOAD_DEPENDENCIES` | 의존성 다운로드 (`none`, `required`, `optional`, 이미지 기본값은 `none`) | `required` | `mcctl config <server> MODRINTH_DOWNLOAD_DEPENDENCIES` |
| `CF_API_KEY` | CurseForge API 키. `java8` 등 Java 17 미만 이미지 태그나 자체 키를 쓸 때만 필요합니다. `.env`에만 있는 키는 서버에 전달되지 않습니다 | - | `mcctl config <server> CF_API_KEY` |
| `CURSEFORGE_FILES` | CurseForge 프로젝트 슬러그 | - | `mcctl config <server> CURSEFORGE_FILES` |
| `SPIGET_RESOURCES` | Spigot 리소스 ID | - | `mcctl config <server> SPIGET_RESOURCES` |
| `MODS` | 모드 다운로드 URL | - | 수동 |
| `PLUGINS_SYNC_UPDATE` | 플러그인 자동 업데이트 | `false` | 수동 |

**예제 - 모드 추가:**

```bash
# 성능 모드가 있는 Fabric 서버
mcctl config myserver MODRINTH_PROJECTS "fabric-api,lithium,sodium"
mcctl config myserver MODRINTH_DOWNLOAD_DEPENDENCIES required
mcctl stop myserver && mcctl start myserver
```

### 서버 운영자

| 변수 | 설명 | 기본값 | mcctl 명령어 |
|------|------|--------|--------------|
| `OPS` | 운영자 사용자명 | - | `mcctl op <server> add <player>` |
| `OPS_FILE` | ops 파일 경로 | - | 수동 |
| `WHITELIST` | 화이트리스트 플레이어 | - | `mcctl whitelist <server> add <player>` |
| `WHITELIST_FILE` | 화이트리스트 파일 경로 | - | 수동 |

**예제 - 운영자 관리:**

```bash
# 운영자 추가
mcctl op myserver add Steve

# 운영자 목록
mcctl op myserver list

# 운영자 제거
mcctl op myserver remove Steve
```

### 성능 튜닝

| 변수 | 설명 | 기본값 | mcctl 명령어 |
|------|------|--------|--------------|
| `USE_AIKAR_FLAGS` | Aikar의 JVM 플래그 사용 | `false` | `mcctl config <server> USE_AIKAR_FLAGS` |
| `MAX_TICK_TIME` | 틱당 최대 ms | `60000` | 수동 |
| `NETWORK_COMPRESSION_THRESHOLD` | 압축 임계값 | `256` | 수동 |
| `ENTITY_BROADCAST_RANGE_PERCENTAGE` | 엔티티 렌더 거리 % | `100` | 수동 |

**예제 - 성능 최적화 활성화:**

```bash
mcctl config myserver USE_AIKAR_FLAGS true
mcctl stop myserver && mcctl start myserver
```

### 컨테이너 설정

| 변수 | 설명 | 기본값 | mcctl 명령어 |
|------|------|--------|--------------|
| `UID` | 파일 권한용 사용자 ID | `1000` | 수동 |
| `GID` | 파일 권한용 그룹 ID | `1000` | 수동 |
| `SKIP_CHOWN_DATA` | 소유권 변경 건너뛰기 | `false` | 수동 |
| `TZ` | 컨테이너 타임존 | `.env`에서 (`servers/global.env`) | 수동 |
| `ENABLE_RCON` | RCON 활성화 | `true` | 자동 |
| `RCON_PASSWORD` | RCON 비밀번호 | 전역 .env에서 | 자동 |

### 디버깅

| 변수 | 설명 | 기본값 | mcctl 명령어 |
|------|------|--------|--------------|
| `DEBUG` | 디버그 출력 활성화 | `false` | 수동 |
| `DEBUG_EXEC` | exec 명령어 디버그 | `false` | 수동 |
| `DEBUG_MEMORY` | 메모리 사용량 디버그 | `false` | 수동 |

---

## 감사 로그 변수

감사 로그 동작을 위해 `~/minecraft-servers/.env`에 설정합니다. mcctl-api는 시작할 때 이 값을 읽고, CLI는 셸 환경에서만 읽습니다.

| 변수 | 설명 | 기본값 | 관리 |
|------|------|--------|------|
| `AUDIT_AUTO_CLEANUP` | 오래된 감사 로그 자동 삭제 | `false` (미설정) | 수동 |
| `AUDIT_RETENTION_DAYS` | 감사 로그 보관 일수 | `90` | 수동 |

**AUDIT_AUTO_CLEANUP:**
- `true`: 새 항목을 기록하는 동안 `AUDIT_RETENTION_DAYS`보다 오래된 로그를 삭제합니다(새 항목 100개마다, 또는 마지막 정리 후 24시간이 지나면)
- 미설정 또는 `false`: 자동 정리 비활성화 (`mcctl audit purge`를 통한 수동 삭제만 가능)

**AUDIT_RETENTION_DAYS:**
- 자동 정리 전에 감사 로그를 보관할 일수
- 권장값: 규정 준수 요구사항에 따라 30-180일
- 프로덕션 환경: 90일 이상

**데이터베이스 위치:**
```
~/minecraft-servers/data/audit.db
```

**예제:**
```bash
# 사용자 지정 보관 정책 설정
echo "AUDIT_RETENTION_DAYS=180" >> ~/minecraft-servers/.env
echo "AUDIT_AUTO_CLEANUP=true" >> ~/minecraft-servers/.env

# mcctl-api를 재시작하여 적용
mcctl console service restart --api
```

---

## mc-router 변수

`~/minecraft-servers/docker-compose.yml`의 `router` 서비스 `environment` 블록에 설정합니다. mc-router는 이 값을 `.env`에서 읽지 않습니다:

| 변수 | 설명 | 기본값 | 관리 |
|------|------|--------|------|
| `IN_DOCKER` | Docker 모드 활성화 | `true` | 자동 |
| `AUTO_SCALE_UP` | 접속 시 서버 자동 시작 | `true` | 수동 |
| `AUTO_SCALE_DOWN` | 유휴 서버 자동 중지 | `true` | 수동 |
| `AUTO_SCALE_DOWN_AFTER` | 유휴 타임아웃 | `10m` | 수동 |
| `DOCKER_TIMEOUT` | 서버 시작 타임아웃 (Go duration, 예: `120s`) | `120s` | 수동 |
| `AUTO_SCALE_ASLEEP_MOTD` | 슬리핑 서버 MOTD | `§e§lServer is sleeping§r\n§7Connect to wake up!` | 수동 |
| `API_BINDING` | 관리 API 바인딩 | `:8080` | 자동 |

서버의 [server.yaml](server-yaml.ko.md)에서 `routing.autoScale`은 그 서버에 한해 `AUTO_SCALE_UP`과 `AUTO_SCALE_DOWN`보다 우선하고, `routing.asleepMotd`는 `AUTO_SCALE_ASLEEP_MOTD`보다 우선합니다. 접속 시 서버를 깨우려면 여기서도 `AUTO_SCALE_UP`이 `true`여야 합니다.

**mc-router 설정 변경 후:**

```bash
mcctl router start
```

`mcctl router start`는 편집한 파일로 컨테이너를 다시 만듭니다. `mcctl router restart`는 이전 설정을 그대로 사용합니다. `mcctl upgrade`는 이 파일에서 router의 `image`와 `group_add`만 바꾸므로 편집한 내용은 유지됩니다.

---

## 셸 변수

`.env`가 아니라 mcctl을 실행하는 셸(또는 PM2)의 환경에서 읽습니다:

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `MCCTL_ROOT` | `mcctl`, mcctl-api, mcctl-console이 쓰는 플랫폼 디렉토리. `--root <path>`가 명령 하나에 한해 우선합니다 | `~/minecraft-servers` |
| `MCCTL_SUDO_PASSWORD` | CLI가 `/etc/avahi/hosts`에 `<server>.local`을 추가하거나 제거할 때 쓰는 sudo 비밀번호. `--sudo-password`가 우선합니다 | - |

`PLATFORM_PATH`는 더 이상 읽지 않습니다. `MCCTL_ROOT`를 사용하세요.

---

## 예제 설정

### 서바이벌 서버

```bash
# 서버 생성
mcctl create survival -t PAPER -v 1.21.1

# 설정
mcctl config survival MOTD "서바이벌 서버 - 행운을 빕니다!"
mcctl config survival DIFFICULTY hard
mcctl config survival MODE survival
mcctl config survival MAX_PLAYERS 30
mcctl config survival --pvp
mcctl config survival USE_AIKAR_FLAGS true
mcctl config survival VIEW_DISTANCE 12

# 적용을 위해 재시작
mcctl stop survival && mcctl start survival
```

### 크리에이티브 서버

```bash
# 서버 생성
mcctl create creative -t VANILLA -v 1.21.1

# 설정
mcctl config creative MOTD "크리에이티브 모드 - 자유롭게 건축하세요!"
mcctl config creative DIFFICULTY peaceful
mcctl config creative MODE creative
mcctl config creative MAX_PLAYERS 20
mcctl config creative SPAWN_PROTECTION 0
mcctl config creative --command-block

# 적용을 위해 재시작
mcctl stop creative && mcctl start creative
```

### 모드 서버 (Forge)

```bash
# 서버 생성
mcctl create modded -t FORGE -v 1.20.4

# 설정
mcctl config modded MOTD "모드 서버 - 향상된 경험"
mcctl config modded DIFFICULTY normal
mcctl config modded MODE survival
mcctl config modded MEMORY 8G
mcctl config modded USE_AIKAR_FLAGS true

# 모드 추가 (Java 17+ 이미지에서는 CF_API_KEY 선택 사항)
mcctl config modded CURSEFORGE_FILES "jei,journeymap,create"

# 적용을 위해 재시작
mcctl stop modded && mcctl start modded
```

### 모드 서버 (Fabric)

```bash
# 서버 생성
mcctl create fabric -t FABRIC -v 1.21.1

# 설정
mcctl config fabric MOTD "Fabric 서버 - 성능 모드"
mcctl config fabric DIFFICULTY normal
mcctl config fabric MODE survival
mcctl config fabric MEMORY 6G

# Modrinth에서 모드 추가
mcctl config fabric MODRINTH_PROJECTS "fabric-api,lithium,sodium,starlight"
mcctl config fabric MODRINTH_DOWNLOAD_DEPENDENCIES required

# 적용을 위해 재시작
mcctl stop fabric && mcctl start fabric
```

---

## 변수 보간

설정 파일을 직접 편집할 때 다른 변수를 참조할 수 있습니다:

```bash
# .env
HOST_IP=192.168.1.100

# config.env
MOTD=${HOST_IP}를 통해 접속하세요
```

이 방식은 손으로 쓴 줄에서만 동작합니다. `mcctl config`, 웹 콘솔, `server.yaml`로 설정한 값은 작은따옴표로 감싸 쓰므로 `${...}`가 그대로 남습니다. `TYPE`, `VERSION`, `MEMORY`, `LEVEL`, `PLAYIT_DOMAIN`, `EXTRA_ARGS`나 서버 이미지에는 `${...}`를 쓰지 마세요. mcctl이 그런 값을 `server.yaml`로 가져올 수 없습니다.

## 참고

- **[서버 타입](server-types.ko.md)** - 타입별 설정
- **[CLI 명령어](../cli/commands.ko.md)** - 전체 mcctl 레퍼런스
- **[itzg/minecraft-server 문서](https://docker-minecraft-server.readthedocs.io/)** - 전체 변수 레퍼런스
