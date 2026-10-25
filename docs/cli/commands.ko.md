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
| `--skip-validation` | 사전 요구사항 확인(Node.js, Docker, Docker Compose, avahi) 건너뛰기 |
| `--skip-docker` | `minecraft-net` Docker 네트워크를 만들지 않음 |
| `--reconfigure` | 이미 초기화된 플랫폼의 설정 변경 (호스트 IP 주소, 타임존, RCON 비밀번호 등) |
| `--playit-key <key>` | 이 `PLAYIT_SECRET_KEY`로 playit.gg 활성화 (묻지 않음) |
| `--no-playit` | playit.gg를 켜지 않음 (묻지 않음) |
| `--upgrade` | 대신 [`mcctl upgrade`](#mcctl-upgrade) 실행 |

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
├── .gitignore
├── .mcctl.json
├── servers/
│   ├── compose.yml
│   ├── global.env
│   └── _template/
├── worlds/
├── shared/
│   ├── plugins/
│   └── mods/
└── backups/
```

`mcctl init`은 사용할 호스트 IP 주소(`.env`의 `HOST_IP`, `HOST_IPS`)와 playit.gg 사용 여부를 묻습니다. `.env`에는 무작위 24자 `RCON_PASSWORD`를 기록합니다. 이미 초기화된 플랫폼에서는 아무것도 바꾸지 않고 `mcctl init --reconfigure`를 안내합니다.

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

모든 인프라(mc-router 및 모든 마인크래프트 서버)를 중지합니다.

```bash
mcctl down
```

**예제:**

```bash
mcctl down
```

모든 mc-* 컨테이너를 중지하고 `docker compose down`을 실행하며, 이때 컨테이너가 제거됩니다. `minecraft-net` 네트워크는 `external`로 선언되어 있어 남습니다.

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

# mc-router 재시작 (컨테이너의 현재 설정은 그대로 유지)
mcctl router restart
```

mc-router는 모든 마인크래프트 서버에 대한 호스트명 기반 라우팅을 처리합니다. 클라이언트가 어떤 서버에든 연결하려면 mc-router가 실행 중이어야 합니다.

**설정:**

오토스케일 설정은 `<root>/docker-compose.yml`에 있는 `router` 서비스의 `environment:`에 있습니다:

```yaml
  router:
    environment:
      AUTO_SCALE_UP: "true"            # 플레이어가 접속하면 중지된 서버 시작
      AUTO_SCALE_DOWN: "true"          # 유휴 서버 중지
      AUTO_SCALE_DOWN_AFTER: "10m"     # 유휴 타임아웃 (1m, 5m, 10m, 30m, 1h)
      DOCKER_TIMEOUT: "120s"           # 컨테이너 시작 타임아웃 (Go time.Duration: 120s, 2m)
      AUTO_SCALE_ASLEEP_MOTD: "§e§lServer is sleeping§r\n§7Connect to wake up!"   # 중지된 서버의 MOTD
```

변경 사항은 `mcctl router start`로 적용합니다(`docker compose up -d router`가 컨테이너를 다시 만듭니다). `mcctl router restart`는 이전 값을 그대로 유지합니다. `mcctl upgrade`는 router의 `image`와 `group_add`만 수정하므로 이 편집 내용은 업그레이드 후에도 남습니다.

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

### mcctl update

> 릴리즈 전체 업그레이드 절차와 업그레이드 후 검증: [업그레이드 런북](../advanced/upgrade-runbook.ko.md)

mcctl CLI 및 서비스의 업데이트를 확인하고 최신 버전으로 업데이트합니다.

```bash
mcctl update [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--cli-only` | mcctl CLI 바이너리만 업데이트 (전체 업데이트 opt-out) |
| `--check` | CLI와 설치된 서비스의 업데이트를 보여 주기만 하고 아무것도 설치하지 않음 |
| `--yes` | 업데이트 전에 묻지 않고, 중지된 서버도 다시 만들지 않음 (아래 **중지된 서버** 참조) |
| `--force` | 호환용으로 받음. `mcctl update`는 항상 캐시 없이 npm을 확인 |
| `--all` | Deprecated 별칭 — 기본 동작과 동일 (하위 호환용) |

기본적으로 `mcctl update`는 CLI, 설치된 서비스(mcctl-api, mcctl-console, `shared`), 서버 이미지를 업데이트합니다. `--cli-only`는 CLI 바이너리만 업데이트합니다.

서버 이미지 태그는 `VERSION`을 따릅니다(예: 1.21.1이면 `java21`). `server.yaml`의 `itzg/minecraft-server:2026.10.0-java21` 같은 릴리스 태그나 digest(`java21@sha256:…`)는 고정으로 보고 그대로 둡니다. 업스트림 회귀가 해결되지 않은 동안 검증된 이미지에 서버를 묶어 둘 수 있습니다. 고정한 Java가 `VERSION`에 필요한 버전보다 낮으면 `mcctl update`가 경고하지만 태그는 그대로 둡니다. 수정이 릴리스되면 `VERSION`에 맞는 태그로 되돌리세요.

**예제:**

=== "업데이트 확인"
    ```bash
    mcctl update --check
    ```

    **출력 (업데이트 가능):**
    ```
    mcctl Version Info

      Installed: 3.0.1
      Latest:    3.0.2

      Update available: 3.0.1 → 3.0.2
    ```

    **출력 (최신 버전):**
    ```
    mcctl Version Info

      Installed: 3.0.2
      Latest:    3.0.2

      You are using the latest version.
    ```

    `--cli-only`가 없으면 그 뒤에 서비스 목록이 표시됩니다(예: `Update available`, `Up to date`).

=== "CLI만 업데이트"
    ```bash
    mcctl update --cli-only
    ```

    버전 정보 다음에 `Update mcctl to 3.0.2?`를 묻고(`--yes`가 없을 때), 이어서 다음을 출력합니다:

    ```
    ✓ mcctl updated successfully!
    ```

=== "전체 업데이트 (기본)"
    ```bash
    mcctl update
    ```

    **출력 (CLI 업데이트 이후):**
    ```
    Updating services...

      mcctl-api        3.0.1 → 3.0.2  ✓ Updated & restarted
      mcctl-console    3.0.1 → 3.0.2  ✓ Updated & restarted

    Checking server image compatibility...
      ✓ survival: java21 (VERSION=1.21.1 - compatible)

    Updating Docker images...

      ✓ itzg/minecraft-server:java21

    Applying new images to stopped servers...
      ✓ survival: up to date

      Completed in 41.8s
    ```

=== "자동 확인 (CI/CD)"
    ```bash
    mcctl update --yes
    ```

**동작 상세:**

- **명령 실행 전 업데이트 확인**: `--help`와 `--version`을 제외한 모든 명령은 실행 전에 npm에서 새 CLI 버전을 확인하고, 새 버전이 있으면 알림을 출력합니다. 결과는 `~/.mcctl-update-check.json`에 24시간 동안 캐시되며, 유효한 캐시가 없으면 명령이 npm 응답을 최대 2초 기다립니다.
- **`--check` 종료 코드**: 새 CLI 버전이 있거나 npm에 연결할 수 없으면 종료 코드 `1`, CLI가 최신이면 `0`을 반환합니다. 서비스 업데이트 여부는 종료 코드에 영향을 주지 않습니다. 스크립팅에 유용합니다.
- **기본 동작 (전체 업데이트)**: CLI 업데이트 후(CLI가 이미 최신이어도) 다음을 수행합니다:
    - `mcctl-api` 및 `mcctl-console`: 최신 버전 설치 후 PM2 서비스 재시작
    - `shared` 라이브러리: 최신 버전 설치 (재시작 불필요)
    - 각 서버의 이미지 태그를 `server.yaml`을 통해 `VERSION`에 맞는 권장 태그로 바꾸고(고정 태그는 유지, 위 참조) 서버의 Docker 이미지를 pull
- **중지된 서버**: mc-router 오토스케일은 기존 컨테이너를 시작하므로, 중지된 서버는 컨테이너를 다시 만들 때까지 이전 이미지를 계속 씁니다. pull이 끝나면 `mcctl update`는 컨테이너가 pull한 이미지를 쓰지 않는 중지된(`exited` 또는 `created`) 서버를 보여 주고, 이미 그 이미지를 쓰는 서버는 `up to date`로 표시합니다. 터미널에서는 `Recreate the stopped servers now so they use the new image?`를 묻습니다(기본값 No). Yes를 고르면 서버마다 `docker compose up --no-start --no-deps mc-<server>`를 실행하고 되돌리는 명령(`docker tag <old image ID> <image> && docker compose up --no-start --no-deps mc-<server>`)을 출력합니다. `--yes`를 주거나 터미널이 없으면 아무것도 다시 만들지 않고 서버마다 `docker compose up --no-start --no-deps` 명령만 출력합니다. 실행 중인 서버는 `mcctl stop <server> && mcctl start <server>`를 실행할 때까지 기존 이미지를 유지합니다.
- **`--cli-only` 플래그**: mcctl CLI 바이너리만 업데이트하고 서비스/이미지는 건너뜁니다.

!!! tip "스크립트에서 --check 활용"
    `--check`를 스크립트에서 사용하여 조건부 업데이트를 실행할 수 있습니다:

    ```bash
    if ! mcctl update --check > /dev/null 2>&1; then
      mcctl update --yes
    fi
    ```

!!! note "update vs upgrade"
    `mcctl update`는 npm에서 CLI 및 서비스 **패키지**를 업데이트합니다.
    `mcctl upgrade`는 플랫폼 **설정 파일** 및 템플릿을 새 버전으로 마이그레이션합니다.

### mcctl upgrade

> 릴리즈 전체 업그레이드 절차와 업그레이드 후 검증: [업그레이드 런북](../advanced/upgrade-runbook.ko.md)

플랫폼 설정 파일을 설치된 mcctl 버전에 맞게 마이그레이션합니다.

```bash
mcctl upgrade [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--dry-run` | 파일을 수정하지 않고 변경 사항만 미리 보기 |
| `--non-interactive` | 확인 없이 적용 |
| `--root <path>` | 사용자 지정 데이터 디렉터리 |

**동작:**

1. 번들된 `.env.example`의 새 변수를 `.env`에 추가합니다 (기존 값은 변경하지 않음). 터미널에서는 새 변수마다 값을 묻고(Enter는 기본값 유지), `--non-interactive`이면 기본값을 기록합니다
2. Docker 소켓의 그룹 ID를 감지해 `.env`에 `DOCKER_GID`로 기록합니다 (non-root mc-router 1.46+에 필요)
3. 루트 `docker-compose.yml`의 `router` 서비스를 패치합니다 (아래 참조)
4. `servers/_template/` 파일을 갱신하고 `.mcctl.json`에 `templateVersion`을 기록합니다
5. `servers/global.env`가 없으면 만들고, 각 서버의 `docker-compose.yml`이 플랫폼 `.env` 대신 이 파일을 읽도록 바꿔 플랫폼 비밀 값이 서버에 전달되지 않게 합니다. 기존 컨테이너는 다시 만들 때까지 이전 환경을 유지하므로, 표시된 서버마다 `mcctl stop <server> && mcctl start <server>`를 실행합니다
6. `ecosystem.config.cjs`의 `BETTER_AUTH_SECRET`, `BETTER_AUTH_BASE_URL`을 `.env`로 옮깁니다(백업: `ecosystem.config.cjs.bak-<timestamp>`). `mcctl console service restart --console`로 적용합니다
7. 아직 `server.yaml`이 없는 서버를 알려 주기만 하고 아무것도 쓰지 않습니다. 이 서버들은 다음 변경 때, 또는 [`mcctl migrate spec`](#mcctl-migrate-spec)으로 가져옵니다
8. `.mcctl.json`에 `installId`가 없으면 추가합니다 (기존 값은 유지)
9. (v3.0.0 이상) `<root>/scripts`가 있으면 경로, v3.0.0부터 쓰지 않으며 직접 고친 파일이 있을 수 있다는 경고, [스크립트 → mcctl 대응표](../advanced/upgrade-runbook.ko.md#v300-scripts) 링크를 출력합니다. 터미널에서는 `Remove <path>?`(기본값 `N`)를 묻고 `y`일 때만 삭제합니다. `--non-interactive`이거나 터미널이 없으면 힌트(`rm -r <path>`)만 출력하고 아무것도 지우지 않습니다. `--dry-run`이면 `Would ask before removing <path>.`만 출력합니다. 심볼릭 링크는 링크만 지우고 따라가지 않습니다. 확인을 건너뛰는 옵션은 없습니다.

**docker-compose.yml router 패치:** `router` 서비스의 `image` 태그와 `group_add` 항목만 번들 템플릿에 맞춥니다. 다른 서비스, 포트, 주석, 줄바꿈 형식은 그대로 유지됩니다.

- 줄 단위 diff를 보여 준 뒤 적용 여부를 확인합니다 (`--non-interactive`는 확인 없이 적용, `--dry-run`은 diff만 표시)
- 원본은 `docker-compose.yml.bak-<timestamp>`로 백업되며, 쓰기에 실패하면 복원됩니다
- 패치가 적용되면 `docker compose up -d router`로 mc-router를 재생성합니다 (실행 중인 서버는 영향을 받지 않음)
- 자동 패치가 불가능하면 직접 추가할 줄을 안내하는 경고를 표시합니다
- compose 갱신에 실패해도 나머지 단계는 계속 진행하며, 명령은 종료 코드 `1`로 끝납니다

```bash
mcctl upgrade --dry-run
mcctl upgrade
mcctl upgrade --non-interactive
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
| `--type` | `-t` | 서버 타입 (기본값 `PAPER`): PAPER, VANILLA, FORGE, NEOFORGE, FABRIC, SPIGOT, BUKKIT, PURPUR, QUILT, LEAF, FOLIA, PUFFERFISH, MODRINTH, AUTO_CURSEFORGE |
| `--version` | `-v` | 마인크래프트 버전: `-v 1.21.1` 또는 `=`를 쓴 긴 형식 `--version=1.21.1` (기본값 `LATEST`, 모드팩 타입은 모드팩의 버전 사용) |
| `--seed` | `-s` | 월드 생성 시드. 음수 시드도 됩니다(`-s -123`). `--seed=<값>`은 어떤 값이든 받습니다 |
| `--world-url` | `-u` | ZIP URL에서 월드 다운로드 |
| `--world` | `-w` | worlds/ 디렉토리의 기존 월드 사용 |
| `--modpack <slug>` | | 모드팩 slug. `-t MODRINTH` 또는 `-t AUTO_CURSEFORGE`에서 필수 |
| `--modpack-version <version>` | | 모드팩 버전 (기본값: 최신) |
| `--mod-loader <loader>` | | 모드팩의 모드 로더. 예: `fabric`, `forge`, `neoforge`, `quilt` (생략하면 모드팩에서 감지) |
| `--exclude-files <list>` | | 모드팩에서 뺄 파일 목록(쉼표 구분). 예: 클라이언트 전용 모드 |
| `--no-start` | | 생성만 하고 시작하지 않음 |
| `--whitelist` | | 화이트리스트 활성화 + 초기 플레이어 등록 (쉼표 구분, 예: `Steve,Alex`) |
| `--enable-whitelist` | | 초기 플레이어 없이 화이트리스트 활성화 |
| `--no-whitelist` | | 화이트리스트 비활성화 (기본값, 위 두 옵션보다 우선) |
| `--playit-domain <domain>` | | 서버의 playit.gg 외부 도메인 (예: `aa.example.com`) |
| `--no-playit-domain` | | playit.gg 도메인을 설정하지 않음 (`--playit-domain`이 없을 때의 기본 동작과 같음) |
| `--sudo-password` | | mDNS 등록용 sudo 비밀번호 (자동화용) |

새 서버는 메모리 4G(모드팩 타입은 6G)와 이미지 `itzg/minecraft-server:java25`로 만들어집니다. 대화형 `mcctl create`는 메모리를 묻고, 생성 후에는 `mcctl config <name> MEMORY <size>`로 바꿉니다. 모드팩에 대한 자세한 내용은 [모드팩](../mods-and-plugins/modpacks.ko.md)에 있습니다.

!!! info "create가 쓰는 파일"
    `mcctl create`는 `servers/<이름>/server.yaml`을 쓰고, 그 파일에서 `config.env`, `docker-compose.yml`, `servers/compose.yml` 항목을 만듭니다([서버 정의](../configuration/server-yaml.md)). 서버가 만들어지기 전에 실패하면 아무것도 남기지 않으므로 같은 명령을 다시 실행하면 됩니다. 서버는 만들어졌지만 시작하지 못하면 서버는 그대로 두고 원인과 함께 종료 코드 1로 끝납니다. `mcctl start <이름>`으로 시작하세요.

!!! info "월드 하나는 서버 하나"
    다른 서버가 이미 사용 중인 월드는 `--world`(그리고 새 서버의 기본 월드 `<name>`)로 지정할 수 없습니다. [월드 할당 규칙](#world-assignment-rules)을 참고하세요.

!!! note "화이트리스트는 기본 비활성입니다"
    화이트리스트 옵션 없이 만든 서버는 화이트리스트가 **꺼진 상태**라서 정품(online-mode) 계정이면 누구나 접속할 수 있습니다. 접속을 제한하려면 `--whitelist` 또는 `--enable-whitelist`를 사용하거나, 나중에 `mcctl whitelist <server> on`으로 켜세요. 대화형 모드에서는 "Enable whitelist?"(기본 No)를 묻고, Yes를 선택한 경우에만 플레이어를 입력받습니다. 웹 콘솔에서 만든 서버도 화이트리스트가 꺼진 상태로 생성됩니다.

    정품 인증(`ONLINE_MODE=TRUE`)은 바뀌지 않고 계속 켜져 있습니다. 이 변경 이전에 만든 서버는 기존 화이트리스트 설정을 그대로 유지합니다.

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

    # 화이트리스트 활성화 + 초기 플레이어 등록
    mcctl create private --whitelist Steve,Alex

    # 화이트리스트만 켜고 플레이어는 나중에 추가
    mcctl create private --enable-whitelist
    ```

=== "모드팩"
    ```bash
    # slug로 Modrinth 모드팩 서버 생성
    mcctl create cobblemon -t MODRINTH --modpack cobblemon

    # 모드팩 버전과 로더를 고정하고 클라이언트 전용 모드는 제외
    mcctl create mypack -t MODRINTH --modpack <slug> --modpack-version <version> --mod-loader fabric --exclude-files <file1>,<file2>

    # slug로 CurseForge 모드팩 서버 생성
    mcctl create mypack -t AUTO_CURSEFORGE --modpack <slug>
    ```

    안내에 따라 만들려면 이름 없이 `mcctl create`를 실행하고 "Modpack Platforms"에서 **Modrinth Modpack** 또는 **CurseForge Modpack**을 고릅니다. 그러면 모드팩 slug, 모드 로더, 모드팩 버전, 제외할 파일을 차례로 묻습니다.

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
| `LEAF` | 경량 Paper 포크 | Yes | No |
| `FOLIA` | 큰 월드용 멀티스레드 Paper 서버 | Yes | No |
| `PUFFERFISH` | 대형 서버용 Paper 포크 | Yes | No |
| `MODRINTH` | Modrinth 모드팩 서버 | No | Yes |
| `AUTO_CURSEFORGE` | CurseForge 모드팩 서버 | No | Yes |

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
| `--yes` | `-y` | 확인 건너뛰기 |
| `--force` | | 접속 중인 플레이어가 있어도 삭제 (`--yes` 포함) |
| `--delete-world` | | 서버 안의 월드를 `worlds/`로 옮기지 않고 삭제 |
| `--sudo-password` | | mDNS 해제용 sudo 비밀번호 (자동화용) |

`mcctl delete`는 삭제 전에 확인을 묻습니다. 터미널이 없는 환경(스크립트, CI)에서는 `--yes`나 `--force`를 주지 않으면 삭제하지 않습니다.

!!! info "월드는 서버를 삭제해도 남습니다"
    - `worlds/`에 있는 월드는 그대로 둡니다. 삭제한 서버에 배정된 상태만 풀립니다.
    - 서버 안의 월드(`servers/<name>/data/<LEVEL>`와 `<LEVEL>_nether`, `<LEVEL>_the_end`)는 서버 디렉터리를 지우기 전에 `worlds/<LEVEL>`로 옮깁니다. 옮긴 월드는 다른 서버에 배정할 수 있습니다.
    - `worlds/`에 같은 이름의 폴더가 이미 있으면 삭제를 중단하고 아무것도 지우지 않습니다. `worlds/`의 폴더 이름을 바꾸거나 `--delete-world`를 지정하세요.
    - `--delete-world`는 서버 안의 월드를 삭제합니다. `worlds/`의 월드는 지우지 않으므로 [`mcctl world delete`](#mcctl-world-delete)로 지우세요.

`--delete-world`가 없으면 월드를 확실히 보존할 수 없는 다음 경우에도 아무것도 지우지 않고 중단합니다.

- `config.env`로 서버의 월드를 정할 수 없는 경우. `LEVEL`은 Docker Compose가 파일을 읽는 방식으로 읽습니다(따옴표, 줄 끝 주석, `=` 앞뒤 공백은 괜찮고, `LEVEL` 줄이 여럿이면 마지막 줄을 씁니다). 값이 월드 이름(영문자, 숫자, `-`, `_`)이 아니거나, `$` 보간을 쓰거나, `EXTRA_ARGS`의 `--universe`가 mcctl이 지원하지 않는 위치를 가리키면 중단합니다. [월드 할당 규칙](#world-assignment-rules)과 같은 규칙입니다. `LEVEL` 줄이 아예 없으면 월드는 `world`로 봅니다.
- `servers/<name>/`나 그 안의 `data/`가 심볼릭 링크이거나, `data/<LEVEL>` 없이 `<LEVEL>_nether`·`<LEVEL>_the_end`만 있는 경우.
- 다른 월드 폴더(`level.dat`, `level.dat_old`, `region/`, `*.mca` 중 하나가 있는 폴더. 예: 이전 `LEVEL`의 옛 월드)가 함께 지워지게 되거나, 서버 안의 심볼릭 링크가 서버 안을 가리키는 경우. 메시지에 그 경로를 보여 줍니다.

`worlds/`의 실제 경로가 서버 안(예: `servers/<name>/`을 가리키는 심볼릭 링크)이면 `--delete-world`를 줘도 중단합니다. 서버 컨테이너를 정지하지 못하거나 Docker를 조회하지 못하면 삭제를 중단하고 아무것도 지우지 않습니다. 실행 중인 서버의 접속자 수를 RCON으로 읽지 못하면 `mcctl delete <name>`은 `--force` 없이는 삭제를 거부합니다.

삭제 전에 백업은 하지 않습니다. 월드는 `worlds/`에 남습니다(`--delete-world`가 아니면). 한 서버의 삭제는 한 번에 하나만 실행됩니다. 삭제가 도는 동안 같은 서버에 대한 두 번째 `mcctl delete`(또는 API 삭제)는 실패합니다. 삭제는 mcctl이 쓰는 `servers/compose.yml` 항목(`<name>/docker-compose.yml`)만 다룹니다. 그 서버에 대한 include 항목을 손으로 따로 썼다면(객체형, 추가 compose 파일) 아무것도 바꾸지 않고 멈추며, 그 항목을 먼저 지우라고 안내합니다. mDNS 호스트명 `<name>.local`은 서버 파일을 지운 뒤 README의 sudoers `NOPASSWD` 줄이 허용하는 명령인 `sudo sed -i … /etc/avahi/hosts`로 `/etc/avahi/hosts`에서 지웁니다. sudo 비밀번호는 `--sudo-password`, [`MCCTL_SUDO_PASSWORD`](#mcctl_sudo_password), 프롬프트 중 하나로 받습니다. 지우지 못해도(예: 비밀번호도 `NOPASSWD` 규칙도 없음) 서버는 삭제되고 `mcctl delete`가 경고를 출력합니다. 이때는 `<name>.local` 줄을 직접 지우세요. `servers/compose.yml`에서 빠진 뒤 `servers/<name>/`에서 지우지 못한 파일(예: 컨테이너가 root로 만든 파일)도 경고로 출력합니다. 출력된 `sudo rm -rf` 명령으로 지우세요.

**예제:**

```bash
# 대화형 - 서버 목록 표시
mcctl delete

# 확인과 함께 특정 서버 삭제
mcctl delete myserver

# 확인 없이 삭제
mcctl delete myserver --yes

# 서버와 서버 안의 월드를 함께 삭제
mcctl delete myserver --yes --delete-world

# 자동화 시 sudo 비밀번호 사용
MCCTL_SUDO_PASSWORD="your-password" mcctl delete myserver --yes
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

`mcctl start <name>`은 필요하면 컨테이너를 만든 뒤 시작합니다(`docker compose up -d mc-<name>`). 서버가 이미 실행 중이면 경고와 함께 종료 코드 2로, `servers/<name>/docker-compose.yml`이 없으면 종료 코드 1로 끝납니다.

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

`mcctl stop <name>`은 서버가 실행 중이 아니면 경고와 함께 종료 코드 2로 끝납니다. Docker를 조회할 수 없으면 `start`와 `stop`은 종료 코드 1로 끝납니다.

`BACKUP_AUTO_ON_STOP=true`이고 백업이 설정되어 있으면 `mcctl stop <name>`은 서버가 멈춘 뒤 월드를 백업합니다. 방식은 [`mcctl backup push --auto`](#mcctl-backup-push)와 같습니다. 입력을 묻지 않고, 다른 백업이 실행 중이면 최대 10분 기다립니다. 백업이 실패하면 경고만 출력하고 정지는 성공합니다(종료 코드 0). 웹 콘솔이나 API(`POST /api/servers/<name>/stop`)로 정지해도 같은 백업을 백그라운드에서 실행합니다. `mcctl stop --all`은 백업하지 않습니다.

---

### mcctl logs

서버 로그를 조회합니다.

```bash
mcctl logs <name|router> [options]
```

**옵션:**

| 옵션 | 단축 | 설명 |
|--------|-------|-------------|
| `--follow` | `-f` | 로그 출력 추적 |
| `--lines` | `-n` | 표시할 줄 수(기본 50). `-f`와 함께 쓰면 마지막 N줄 다음 이어서 추적 |
| `--json` | | 줄 배열을 JSON으로 출력(`-f`와 함께 사용 불가) |

**예제:**

```bash
# 마지막 50줄 표시
mcctl logs survival

# 실시간으로 로그 추적
mcctl logs survival -f

# 마지막 10줄 표시
mcctl logs survival -n 10

# mc-router 로그
mcctl logs router
```

> 추적(`-f`)은 Ctrl+C로 끝내며 종료 코드는 0이다. avahi-daemon 로그는 `mcctl logs`가 다루지 않는다. 필요하면 `journalctl -u avahi-daemon`을 직접 실행한다.

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

서버 RCON 콘솔에 연결합니다. [`mcctl rcon`](#mcctl-rcon)과 같은 대화형 세션입니다.

```bash
mcctl console <name>
```

하위 명령 `mcctl console init`, `service`, `user`, `api`, `remove`는 관리 콘솔을 관리합니다. 자세한 내용은 [콘솔 CLI 명령어](../console/cli-commands.ko.md)에 있습니다. `mcctl admin <subcommand>`는 이 명령들의 deprecated 별칭입니다. 이름이 이 하위 명령과 같은 서버에는 `mcctl rcon <name>`으로 접속합니다.

!!! note "v3.0.0부터: `docker exec` 대신 TCP RCON"
    `mcctl console`은 `mcctl rcon`처럼 서버의 RCON 포트에 TCP로 연결합니다(컨테이너 주소, `RCON_PORT`, `RCON_PASSWORD`). 예전에는 `docker exec -i mc-<name> rcon-cli`를 실행했습니다. 서버가 실행 중이어야 하고, `mcctl`을 실행하는 호스트에서 RCON 포트에 닿아야 합니다. `exit`나 `quit`을 입력하거나 `Ctrl+C`/`Ctrl+D`를 누르면 끝납니다. 파이프 입력은 한 줄씩 실행합니다(`printf 'list\n' | mcctl console myserver`). 서버가 연결을 끊으면(예: `stop` 뒤) 세션이 끝나고, 연결 오류는 종료 코드 1로 끝납니다.

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
[INFO] Connecting to RCON console for 'survival'...
[INFO] Connected! Type "help" for commands, "exit" or Ctrl+C to quit.

> list
There are 2 of a max of 20 players online: Steve, Alex
> say Server maintenance in 10 minutes!
[Server: Server maintenance in 10 minutes!]
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

음수는 그대로 전달됩니다(`mcctl exec myserver tp Steve -1 64 -5`). 그 밖에 `-`로 시작하는 인자가 든 명령은 `--` 뒤에 적으세요: `mcctl exec myserver -- say -h`.

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
if echo "$PLAYERS" | grep -q "There are 0 of"; then
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

`--json`을 주면 설정 값, 또는 변경 내용(`server`, `key`, `oldValue`, `newValue`)을 JSON으로 출력합니다.

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

!!! warning "`LEVEL` 변경"
    `LEVEL`은 서버가 사용하는 월드입니다([월드 할당 규칙](#world-assignment-rules) 참고). 서버가 실행 중이거나 다른 서버가 `<world>`를 사용 중이면 `mcctl config <server> LEVEL <world>`는 거부됩니다. 새 `EXTRA_ARGS` 값이 월드 위치를 `worlds/`와 `servers/<server>/data` 사이에서 바꾸는 경우(`--universe`)에도 같습니다.

---

## 서버 백업 및 복원

### mcctl server-backup

서버 설정 파일을 `backups/servers/<server>/<id>.tar.gz`로 백업합니다: `config.env`, `docker-compose.yml`, 그리고 있으면 `server.yaml`, `data/ops.json`, `data/whitelist.json`, `data/banned-players.json`, `data/banned-ips.json`, `data/server.properties`. ID는 생성 시각(`20260120-203357`)입니다.

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
mcctl server-restore myserver 20260120-203357

# 복원 미리보기
mcctl server-restore myserver 20260120-203357 --dry-run
```

`--force`나 `--json`이 없으면 복원 전에 확인을 묻습니다. 현재 파일은 먼저 `backups/servers/<server>/.pre-restore/`에 복사됩니다. 복원한 파일을 적용하려면 서버를 재시작합니다.

---

## 설정 스냅샷

### mcctl config-snapshot

서버 설정 파일의 사본을 저장하고 복원합니다. 스냅샷에는 `servers/<server>/` 바로 아래(`data/` 제외)의 파일이 들어갑니다: `server.yaml`, `config.env`, `docker-compose.yml`, 그리고 1MB 이하의 다른 `.yml`, `.yaml`, `.json`, `.properties` 파일. 스냅샷은 `backups/meta/config-snapshots.db`와 `backups/meta/config-snapshot-storage/`에 저장됩니다.

```bash
mcctl config-snapshot <list|create|show|diff|restore|delete> [args] [options]
```

| 명령 | 설명 |
|------|------|
| `list [server]` | 스냅샷 목록, 최신순 (`--limit <n>`, 기본값 20; `--json`) |
| `create <server>` | 스냅샷 생성 (`--description "..."`; `--json`) |
| `show <id>` | 스냅샷 상세 (`--files`로 파일 목록 표시; `--json`) |
| `diff <id1> <id2>` | 두 스냅샷 사이의 변경 내용 (`--files-only`; `--json`) |
| `restore <id>` | 스냅샷의 파일을 `servers/<server>/`에 다시 씀. `--force`가 없으면 먼저 확인 |
| `delete <id>` | 스냅샷 삭제. `--force`가 없으면 먼저 확인 |

`list`는 ID의 앞 8자만 보여 줍니다. 나머지 명령에는 전체 ID가 필요하며, 전체 ID는 `create`와 `list --json`이 출력합니다. 서버의 월드를 바꾸는 복원은 [월드 할당 규칙](#world-assignment-rules)을 따릅니다. 복원한 파일을 적용하려면 서버를 재시작합니다.

**예제:**

```bash
mcctl config-snapshot create survival --description "Before mod update"
mcctl config-snapshot list survival
mcctl config-snapshot diff <id1> <id2> --files-only
mcctl config-snapshot restore <id>
```

### mcctl config-snapshot schedule

일정에 따라 스냅샷을 만듭니다. 일정은 mcctl-api가 실행하며, mcctl-api는 시작할 때 일정을 읽습니다. 여기서 일정을 추가, 삭제, 활성화, 비활성화한 뒤에는 `mcctl console service restart --api`로 mcctl-api를 재시작합니다.

| 명령 | 설명 |
|------|------|
| `schedule list` | 일정 목록 (`--server <name>`; `--json`) |
| `schedule add` | 일정 추가: `--server <name>`, `--cron "<expression>"`, `--name "<name>"`는 필수. `--retention <n>`은 이 일정의 최신 스냅샷 n개를 남김(기본값 10); `--json` |
| `schedule remove <id>` | 일정 삭제. `--force`가 없으면 먼저 확인 |
| `schedule enable <id>` | 일정 활성화 |
| `schedule disable <id>` | 일정 비활성화 |

```bash
mcctl config-snapshot schedule add --server survival --cron "0 3 * * *" --name "Daily"
```

---

## 플레이어 관리

### mcctl op

서버 관리자(OP)를 관리합니다.

```bash
mcctl op <server> <action> [player] [level]
```

**액션:**

| 액션 | 설명 |
|--------|-------------|
| `list` | 관리자와 레벨, 역할 표시 (`data/ops.json`에서 읽음) |
| `add <player> [level]` | 관리자 추가: `config.env`의 `OPS`에 추가하고, 서버가 실행 중이면 RCON으로도 적용합니다(이때 레벨을 `data/ops.json`에 기록). 레벨을 주지 않으면 터미널에서 묻고, `--json`이면 4를 씁니다 |
| `remove <player>` | 관리자 제거 |
| `set-level <player> <level>` | `data/ops.json`에서 관리자의 레벨 변경. 서버가 실행 중이어야 하며, 적용하려면 재시작합니다 |

레벨: `1` Moderator, `2` Gamemaster, `3` Admin, `4` Owner. `--json`을 주면 결과를 JSON으로 출력합니다.

**예제:**

```bash
# 관리자 목록
mcctl op survival list

# 관리자 추가 (레벨을 물음)
mcctl op survival add Steve

# 레벨 2로 관리자 추가
mcctl op survival add Alex 2

# 레벨 변경
mcctl op survival set-level Alex 3

# 관리자 제거
mcctl op survival remove Steve
```

**출력 예시 (list):**
```
Operators for survival:

  Player       Level             Role
  ------------------------------------------------------------
  Steve                4   Owner
  Alex                 2   Gamemaster
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

`--json`을 주면 결과를 JSON으로 출력합니다.

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

`--json`을 주면 결과를 JSON으로 출력합니다.

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

  Griefer - Griefing spawn area
```

---

### mcctl kick

서버에서 플레이어를 강퇴합니다.

```bash
mcctl kick <server> <player> [reason]
```

서버가 실행 중이어야 합니다. `--json`을 주면 결과를 JSON으로 출력합니다.

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

      Steve
      Alex
    ```

=== "모든 서버"
    ```bash
    mcctl player online --all
    ```

    **출력:**
    ```
    Online Players (All Servers):

      Total: 2 players

      survival (2/20):
        Steve
        Alex
    ```

    접속한 플레이어가 없는 실행 중 서버는 표시하지 않습니다.

---

## 월드 관리

### 월드 할당 규칙 { #world-assignment-rules }

월드는 `servers/<name>/config.env`의 `LEVEL`로 서버에 할당됩니다. `LEVEL`이 없으면 레거시 `WORLD_NAME`을 읽고, 둘 다 없으면 서버는 itzg 기본값인 `world`를 사용합니다.

- **잠금 파일 없음.** `worlds/.locks`는 더 이상 읽거나 쓰거나 만들지 않습니다(`mcctl init`도 만들지 않습니다). 기존 `worlds/.locks` 디렉토리는 무해하며 `rm -rf worlds/.locks`로 지워도 안전합니다. `lock.sh`와 `mcctl.sh` 스크립트는 제거되었습니다(#670, #734).
- **월드 하나는 서버 하나.** 월드와 그 `<world>_nether` / `<world>_the_end` 폴더는 하나의 월드로 취급합니다. 다른 서버가 사용 중인 월드는 할당할 수 없습니다. `mcctl world assign`, `mcctl create --world`, 새 서버의 기본 월드 `<name>`, `mcctl config <server> LEVEL <world>`가 거부됩니다. 서버를 삭제하면 그 월드는 다시 쓸 수 있습니다.
- **중지된 서버만.** 서버 컨테이너가 running, paused, restarting, created 상태이면 `world assign`, `world release`, `world new --server`, `config LEVEL`은 거부됩니다. 서버를 자동으로 중지하지 않습니다(`world new --server`는 예전에 서버 중지를 시도했지만, 이제는 거부합니다).
- **안전 우선(fail-closed).** 어떤 서버의 `config.env`를 읽을 수 없거나 `LEVEL`을 안전하게 해석할 수 없으면, 문제를 고칠 때까지 모든 할당 변경과 월드 삭제·초기화가 거부됩니다. 안전하지 않은 값은 경로 구분자, `.` 또는 `..`, 따옴표, 제어 문자, 작은따옴표 밖의 `${VAR}` 같은 Compose 보간, 지원하지 않는 `--universe` 위치입니다. `My World` 같은 레거시 이름은 기존 값으로는 계속 허용되며, 새 이름은 영문자, 숫자, `-`, `_`만 쓸 수 있습니다.
- **이전 설치.** 중복 할당은 고치지 않고 알려 줍니다. [`mcctl world list`](#mcctl-world-list)를 참고하세요.

---

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
| `--seed` | `-s` | 월드 생성 시드. 음수 시드도 됩니다(`-s -123`). `--seed=<값>`은 어떤 값이든 받습니다 |
| `--server` | | 월드를 할당할 서버 (`LEVEL`을 설정하고, 시드가 있으면 `SEED`도 설정). 서버가 중지되어 있어야 함 |
| `--no-start` | | 대화형 모드: 서버 시작 여부를 묻지 않고, 시작하지도 않음 |
| `--json` | | 결과를 JSON으로 출력 |

**예제:**

=== "대화형 모드"
    ```bash
    mcctl world new
    # 다음을 프롬프트로 물어봅니다:
    # 1. 월드 이름
    # 2. 선택적 시드
    # 3. 월드를 할당할 서버 (중지되어 있어야 함)
    # 4. 서버 시작 여부
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
    ```

    월드 이름을 주면 서버는 시작하지 않습니다. `mcctl start <server>`로 시작합니다.

**수행 내용:**

1. `worlds/<name>/` 디렉토리에 월드 디렉토리와 `.meta` 파일(이름, 시드, 생성 시각) 생성
2. 서버가 할당되면:
   - 서버가 실행 중이거나 다른 서버가 그 월드를 사용 중이면 거부 (서버를 대신 중지하지 않음)
   - 서버의 `config.env`에 `LEVEL=<world-name>` 업데이트
   - 시드가 있으면 `SEED=<seed>` 설정
   - 대화형 모드에서 시작하겠다고 답하면 서버 시작

`mcctl world new`에는 서버가 하나 이상 있어야 합니다. 서버가 없으면 `No servers available. Create a server first.`로 멈춥니다.

!!! tip "시드 동작"
    시드는 서버의 `SEED` 환경 변수를 통해 적용됩니다.
    서버가 처음 시작될 때 이 시드로 월드가 생성됩니다.

---

### mcctl world list

모든 월드와 할당된 서버를 나열합니다.

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
        Status: assigned: survival
        Size: 514.0MB
        Path: /home/myuser/minecraft-servers/worlds/survival-world

      creative-world
        Status: unassigned
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
        "lockedBy": "survival",
        "size": "514.0MB",
        "lastModified": "2026-01-21T13:19:48.853Z",
        "servers": ["survival"],
        "dimensions": { "nether": true, "end": true }
      },
      {
        "name": "creative-world",
        "path": "/home/myuser/minecraft-servers/worlds/creative-world",
        "isLocked": false,
        "size": "128.5MB",
        "lastModified": "2026-01-20T10:30:00.000Z",
        "servers": [],
        "dimensions": { "nether": false, "end": false }
      }
    ]
    ```

!!! info "중복 할당"
    이전 설치에서 두 서버가 같은 월드를 쓰고 있으면 `mcctl world list`가 `assigned: a, b`로 표시하고, 중복마다(그리고 `config.env`를 읽을 수 없는 서버마다) 경고를 출력합니다. 자동으로 고치지 않으므로, 한 서버만 남기고 나머지 서버에는 다른 월드를 할당하세요. JSON 출력의 `isLocked`와 `lockedBy`는 "할당됨"의 별칭으로 남아 있습니다.

---

### mcctl world assign

월드를 서버에 할당합니다(서버의 `LEVEL`을 설정).

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
    mcctl world assign survival myserver
    ```

!!! info "월드 하나는 서버 하나"
    다른 서버가 사용 중인 월드는 할당할 수 없고, 대상 서버는 중지되어 있어야 합니다. 이는 동시 접근으로 인한 데이터 손상을 방지합니다. 월드를 `servers/<name>/data` 안에 두는 서버에도 할당할 수 없으므로 먼저 `mcctl migrate worlds`를 실행하세요. [월드 할당 규칙](#world-assignment-rules)을 참고하세요.

---

### mcctl world release

월드를 사용하던 서버를 서버 자신의 기본 월드 `<server>`로 되돌립니다.

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
| `--force` | 받아들이지만 무시됨 (실행 중인 서버는 해제하지 않음) |

**예제:**

```bash
# 대화형 - 할당된 월드 목록 표시
mcctl world release

# 특정 월드 해제
mcctl world release survival
```

월드를 사용하던 서버는 `LEVEL=<server>`가 됩니다. 비어 있는 `worlds/<server>`가 이미 있으면 그것을 사용하고, 없으면 다음 시작 때 새로 만듭니다. 월드 자체는 `worlds/`에 그대로 남습니다.

서버가 실행 중이거나, 서버가 이미 자신의 기본 월드를 쓰고 있거나, 월드가 둘 이상의 서버에 할당되어 있거나, 서버가 월드를 `servers/<name>/data` 안에 두고 있거나, 월드를 쓰는 서버가 없으면 해제는 거부됩니다.

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
| `--force` | | 확인 건너뛰기 (서버가 사용 중인 월드는 삭제하지 않음) |
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

- **할당 확인**: 서버가 사용 중인 월드는 실행 여부와 관계없이 삭제할 수 없으며 `--force`로도 우회할 수 없음. 먼저 서버에 다른 월드를 할당하세요. 월드를 `servers/<name>/data` 안에 두는 서버(`EXTRA_ARGS=--universe /worlds/` 없음)는 `worlds/<world>` 삭제를 막지 않음
- **안전 우선(fail-closed)**: 어떤 서버의 `config.env`를 읽거나 해석할 수 없으면 거부됨([월드 할당 규칙](#world-assignment-rules) 참고)
- **확인 프롬프트**: `--force`가 없으면 삭제 전에 확인(yes/no)을 묻습니다
- **크기**: 대화형 모드는 확인 전에 월드 크기를 보여 주고, 삭제 후에는 확보된 크기를 출력합니다

---

## 백업 관리

### mcctl backup init

GitHub 월드 백업을 대화형으로 설정합니다.

```bash
mcctl backup init [--force]
```

GitHub 개인 액세스 토큰, 저장소(`username/repo`), 브랜치, 서버 중지 시 백업 여부를 묻습니다. 저장소 접근을 확인한 뒤 `.env`에 `BACKUP_GITHUB_TOKEN`, `BACKUP_GITHUB_REPO`, `BACKUP_GITHUB_BRANCH`, `BACKUP_AUTO_ON_STOP`을 기록합니다. 백업이 이미 설정되어 있으면 덮어쓸지 묻고, `--force`는 이 질문을 건너뜁니다. 저장소와 토큰을 만드는 방법은 [백업 가이드](../advanced/backup.ko.md)에 있습니다.

---

### mcctl backup status

백업 설정 상태를 표시합니다. 하위 명령 없이 `mcctl backup`을 실행해도 같습니다.

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
  Repository: myuser/minecraft-backup-repo
  Branch: main
  Last backup: 1/20/2026, 9:06:35 PM
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

[`mcctl backup init`](#mcctl-backup-init)이 이 설정을 대신 기록합니다.

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
| `--auto` | | 묻지 않고 시각 메시지로 백업합니다. 다른 백업이 실행 중이면 최대 10분 기다립니다(정지 시 자동 백업과 같은 규칙) |
| `--allow-missing` | | 일부러 지운 월드를 백업에서도 지웁니다([백업 가이드](../advanced/backup.md#삭제한-월드) 참조) |

실행 중인 서버는 복사 전에 디스크에 기록합니다(`save-off`, `save-all flush`, `save-on`). 변경이 없으면 성공입니다.

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
    [
      {
        "commitHash": "fd8633b2c1e4a7d9b0f3e6a5c8d1b4e7f0a3c6d9",
        "message": "Backup: 2026-01-20 21:06:30",
        "date": "2026-01-20T12:06:35.000Z",
        "author": "Minecraft Backup"
      }
    ]
    ```

---

### mcctl backup restore

백업에서 월드 데이터를 복원합니다.

```bash
mcctl backup restore [commit] [--force]
```

**인자:**

| 인자 | 설명 |
|----------|-------------|
| `commit` | 커밋 해시 (선택사항, 제공하지 않으면 목록 표시) |
| `--force` | 확인을 묻지 않습니다 |

모든 서버가 중지되어 있어야 합니다. 결과는 그 커밋과 정확히 같고, `worlds/.locks`는 남으며, 교체된 데이터는 `backups/restore-previous/<시각>/`에 남습니다. [백업 가이드](../advanced/backup.md#백업에서-복원)를 참조하세요.

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

### mcctl backup schedule

일정에 따라 월드를 백업합니다. 일정은 mcctl-api가 실행하며, mcctl-api는 시작할 때 일정을 읽습니다. 여기서 일정을 추가, 삭제, 활성화, 비활성화한 뒤에는 `mcctl console service restart --api`로 mcctl-api를 재시작합니다.

| 명령 | 설명 |
|------|------|
| `backup schedule list` | 일정 목록 (`--json`) |
| `backup schedule add` | 일정 추가: `--cron <expression or preset>` (필수, 프리셋 `hourly`, `daily`, `every-6h`, `every-12h`, `weekly`), `--name <name>` (기본값 `Backup Schedule`), `--max-count <n>`, `--max-age-days <n>`, `--json` |
| `backup schedule remove <id>` | 일정 삭제 |
| `backup schedule enable <id>` | 일정 활성화 |
| `backup schedule disable <id>` | 일정 비활성화 |

예약 백업이 끝날 때마다 최신 `--max-count`개를 넘는 백업과 `--max-age-days`일보다 오래된 백업이 저장소 기록에서 지워집니다(가장 최근 백업은 항상 남습니다). [예약 백업](../advanced/backup.ko.md#예약-백업)을 참고하십시오.

```bash
mcctl backup schedule add --cron daily --name "Daily Backup" --max-count 30
```

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

- 서버 선택 (실행 중인 서버만, 액션은 RCON으로 실행)
- 온라인 플레이어 목록 및 쉬운 선택
- 액션 메뉴 (op/deop, 화이트리스트 추가/제거, 밴/밴 해제, 강퇴, 정보 보기)

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
  "name": "Notch",
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "uuidNoDashes": "069a79f444e94726a5befca90e38aaf5",
  "skinUrl": "https://textures.minecraft.net/texture/...",
  "source": "mojang"
}
```

!!! info "플레이어 캐시"
    플레이어 데이터는 AES-256-GCM 암호화로 로컬에 캐시됩니다:

    - **UUID**: 영구 캐시 (절대 변경되지 않음)
    - **사용자명**: 30일간 캐시 (변경 가능)
    - **스킨 URL**: 1일간 캐시 (자주 변경됨)

    캐시 위치: `~/.mcctl/.player-cache`

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

`mcctl player online`은 [플레이어 관리](#mcctl-player-online)에 설명되어 있습니다.

---

!!! note "제거됨"
    `mcctl player lookup`과 `mcctl player uuid`는 제거되었습니다. `mcctl player info <name>`을 사용하세요(오프라인 UUID는 `--offline`).
    기존 `player.sh`는 variant 비트 버그 때문에 일부 이름(예: Steve, Alex)의 오프라인 UUID를 잘못 계산했습니다. `mcctl player info --offline`은 Minecraft와 같은 값을 출력합니다.

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
| `--server <name>` | 이 서버만 마이그레이션 |
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

결과 `LEVEL`을 다른 서버가 사용 중이거나 서버의 할당을 확인할 수 없으면, 데이터를 옮기기 전에 해당 서버의 마이그레이션을 거부합니다([월드 할당 규칙](#world-assignment-rules) 참고).

!!! info "월드 저장 경로 변경"
    `mcctl create`로 생성된 새 서버는 이미 `/worlds/` 디렉토리 구조를 사용합니다.
    이 마이그레이션 명령어는 이 변경 이전에 생성된 기존 서버를 위한 것입니다.

---

### mcctl migrate spec

서버를 정의 파일 `servers/<이름>/server.yaml`로 가져오고, 그 파일에서 만드는 파일(`config.env`, `docker-compose.yml`, `servers/compose.yml` 항목)을 씁니다. [서버 정의](../configuration/server-yaml.md)를 참고하세요.

```bash
mcctl migrate spec <서버> [옵션]
mcctl migrate spec --all [옵션]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--all` | 모든 서버 |
| `--dry-run` | 가져올 내용만 보고하고 쓰지 않음 |
| `--force` | 생성 파일의 손수정을 무시하고 `server.yaml`에서 다시 만듦(`.bak` 사본을 남김) |
| `--json` | 서버별 보고서를 JSON으로 출력 |

다시 실행해도 안전합니다. 동기화된 서버는 `synced`로 보고하고 아무것도 다시 쓰지 않습니다. 월드나 이미지를 정할 수 없는 서버(예: `config.env`의 `${...}` 값)는 `refused`이고 종료 코드는 1입니다. `world.level`을 바꾸면 [월드 할당 규칙](#world-assignment-rules)으로 검사하며 서버가 정지돼 있어야 합니다.

꼭 실행할 필요는 없습니다. `server.yaml`이 없는 서버는 mcctl이 처음 바꿀 때 가져오고, `mcctl upgrade`가 아직 가져오지 않은 서버를 알려 줍니다.

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
Search results for "sodium" on Modrinth (25 total):

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
| `--curseforge` | CurseForge 사용 (CF_API_KEY는 Java 17+에서 선택 사항) |
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
    # Java 17+ 이미지에서는 .env의 CF_API_KEY가 선택 사항
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
2. **서버 타입 확인**: 모드나 플러그인을 지원하지 않는 서버 타입(예: VANILLA)은 `--force`가 없으면 거부
3. **설정 업데이트**: `config.env`의 적절한 환경 변수에 모드 추가
4. **재시작 필요**: 변경 사항 적용을 위해 서버 재시작 필요

**사용되는 환경 변수:**

| 소스 | 환경 변수 | 서버 타입 |
|--------|---------------------|--------------|
| Modrinth | `MODRINTH_PROJECTS` | 전체 |
| CurseForge | `CURSEFORGE_FILES` | 전체 (CF_API_KEY는 Java 17+에서 선택 사항) |
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
    Popular mod platform. Java 17+ images include a built-in CF_API_KEY; set it in .env only for java8 or pre-17 tags or your own key
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

Java 17+ 이미지는 키가 내장되어 있으며, java8/17 미만 태그 또는 자체 키를 사용할 때만 CF_API_KEY를 설정합니다. 자체 키를 설정하려면:

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

## 외부 접속 (playit.gg)

### mcctl playit

playit.gg 에이전트와 서버의 외부 도메인을 관리합니다. playit.gg 설정 방법은 [playit.gg 외부 접속](../advanced/external-access.ko.md)에 있습니다.

```bash
mcctl playit <start|stop|status|setup|domain> [args]
```

| 명령 | 설명 |
|------|------|
| `start` | `playit-agent` 컨테이너 시작 (`PLAYIT_SECRET_KEY`와 playit.gg 활성화 필요) |
| `stop` | 에이전트 중지 |
| `status` | 에이전트 상태, `PLAYIT_SECRET_KEY` 설정 여부, playit.gg 도메인이 있는 서버 표시 (`--json`) |
| `setup` | `PLAYIT_SECRET_KEY`를 묻고 `.env`에 저장한 뒤 playit.gg를 켜고, 없으면 `docker-compose.yml`에 `playit` 서비스 추가 |
| `domain <server> <domain>` | 서버의 playit.gg 도메인(`PLAYIT_DOMAIN`) 설정 |
| `domain <server> --remove` | 서버의 playit.gg 도메인 제거 |

인자 없이 `mcctl playit domain`을 실행하면 서버와 도메인을 묻습니다. 도메인 변경은 `mcctl stop <server> && mcctl start <server>` 후에 적용되며, 컨테이너 재시작으로는 적용되지 않습니다.

---

## 감사 로그

### mcctl audit

CLI, API, 웹 콘솔에서 수행한 작업의 감사 로그를 조회하고 정리합니다. 자세한 내용, 액션 이름, 설정은 [감사 로그](audit-log.ko.md)에 있습니다.

```bash
mcctl audit <list|stats|purge> [options]
```

| 명령 | 설명 |
|------|------|
| `list` | 항목을 최신순으로 표시: `--limit <n>`(기본값 50), `--action`, `--actor`, `--target`, `--status <status>`(`success` 또는 `failure`), `--from <date>`, `--to <date>` |
| `stats` | 상태, 액션, 액터별 항목 수 |
| `purge` | `--days <n>`(기본값 90)일보다 오래되었거나 `--before <date>` 이전인 항목 삭제. `--force`가 없으면 먼저 확인하고, `--dry-run`은 개수만 셈 |

---

## 전역 옵션 레퍼런스

| 옵션 | 설명 | 예제 |
|--------|-------------|---------|
| `--root <path>` | 데이터 디렉토리 (기본값: `MCCTL_ROOT` 또는 `~/minecraft-servers`) | `mcctl --root /opt/mc status` |
| `--json` | JSON 출력. 지원하는 명령에서만 동작 (각 명령에 표시) | `mcctl status --json` |
| `--sudo-password <pwd>` | `create`, `delete`의 mDNS 항목 처리용 sudo 비밀번호 (또는 [`MCCTL_SUDO_PASSWORD`](#mcctl_sudo_password)) | `mcctl delete myserver --yes --sudo-password "..."` |
| `-h, --help` | 도움말 표시 (모든 명령에서 같은 페이지) | `mcctl --help` |
| `--version` | 버전 표시 | `mcctl --version` |

값이 필요한 옵션은 다음 단어(`--seed 123`)나 `=` 뒤(`--seed=123`)에서 값을 읽습니다. `--force`, `--json`, `--yes` 같은 스위치는 `=true`나 `=false`도 받습니다. `--` 뒤의 모든 인자는 그대로 전달됩니다(`mcctl exec myserver -- say -h`).

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

### MCCTL_ROOT

`--root`를 주지 않았을 때 쓰는 데이터 디렉토리입니다(기본값: `~/minecraft-servers`).

```bash
export MCCTL_ROOT=/opt/minecraft
```
