# 설정 개요

이 섹션에서는 Docker Minecraft Server 플랫폼의 모든 설정 옵션을 다룹니다.

## mcctl로 빠른 설정

**mcctl**은 서버를 설정하는 가장 쉬운 방법을 제공합니다:

```bash
# 모든 설정 보기
mcctl config myserver

# 특정 설정 보기
mcctl config myserver MOTD

# 설정 변경
mcctl config myserver MOTD "내 서버에 오신 것을 환영합니다!"
mcctl config myserver MAX_PLAYERS 50
mcctl config myserver MEMORY 8G

# 단축 옵션 사용
mcctl config myserver --cheats        # 치트 활성화
mcctl config myserver --no-pvp        # PvP 비활성화
mcctl config myserver --command-block # 커맨드 블록 활성화
```

!!! tip "권장 접근 방식"
    대부분의 설정 변경에는 `mcctl config`를 사용하세요. 유효성 검사를 처리하고 변경 사항을 올바르게 적용합니다.

## 설정 파일

참고로 플랫폼은 다음 설정 파일들을 사용합니다(`~/minecraft-servers/` 아래):

| 파일 | 용도 | 관리 주체 |
|------|------|-----------|
| `.env` | 플랫폼 설정. `servers/global.env`에 이름이 있는 키만 서버에 전달됩니다 | `mcctl init` |
| `servers/global.env` | 모든 서버에 전달할 `.env` 키의 이름 | `mcctl init`, `mcctl upgrade` |
| `servers/<name>/server.yaml` | 서버 정의 | `mcctl create`, `mcctl config` 및 그 밖의 모든 mcctl 변경 |
| `servers/<name>/config.env` | 서버 환경 변수, `server.yaml`에서 생성 | mcctl |
| `docker-compose.yml` | 메인 오케스트레이션: mc-router와 그 설정 | `mcctl init` |
| `servers/<name>/docker-compose.yml` | 서버 컨테이너, `server.yaml`에서 생성 | mcctl |
| `servers/compose.yml` | 서버 compose 파일 목록 | mcctl |

mcctl이 생성 파일을 어떻게 맞춰 두는지는 [서버 정의 (server.yaml)](server-yaml.ko.md)를 참고하세요.

## 설정 카테고리

<div class="grid cards" markdown>

-   :material-cog:{ .lg .middle } **환경 변수**

    ---

    모든 환경 변수에 대한 완전한 레퍼런스

    [:octicons-arrow-right-24: 환경 변수](environment.ko.md)

-   :material-server:{ .lg .middle } **서버 타입**

    ---

    Paper, Forge, Fabric 및 기타 서버 플랫폼

    [:octicons-arrow-right-24: 서버 타입](server-types.ko.md)

-   :material-file-document:{ .lg .middle } **서버 정의**

    ---

    mcctl이 각 서버의 파일을 만들어 쓰는 원본 파일 `server.yaml`

    [:octicons-arrow-right-24: 서버 정의](server-yaml.ko.md)

</div>

## 일반적인 설정 작업

### 서버 메모리 변경

```bash
mcctl config myserver MEMORY 8G
mcctl stop myserver && mcctl start myserver
```

### Minecraft 버전 변경

```bash
mcctl config myserver VERSION 1.21.1
mcctl stop myserver && mcctl start myserver
```

`VERSION`을 바꿔도 서버의 Java 이미지는 바뀌지 않습니다. 새 서버는 `VERSION`에 필요한 태그를 받습니다. `VERSION`을 바꾼 뒤에는 `mcctl update`를 실행하거나 [Java 버전과 이미지 태그](server-types.ko.md#java-버전과-이미지-태그)를 참고하세요.

### 모드/플러그인 활성화

모드 서버(Forge/Fabric)의 경우:

```bash
# Modrinth 모드
mcctl config myserver MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# CurseForge 모드 (Java 17+ 이미지에서는 CF_API_KEY 선택 사항)
mcctl config myserver CURSEFORGE_FILES "jei,journeymap"
```

플러그인 서버(Paper/Spigot)의 경우 플러그인을 `shared/plugins/` 디렉토리에 넣습니다.

### 자동 스케일링 설정

mc-router는 자동 스케일링 설정을 `.env`가 아니라 `~/minecraft-servers/docker-compose.yml`의 `router` 서비스에서 읽습니다:

```yaml
services:
  router:
    environment:
      AUTO_SCALE_UP: "true"         # 플레이어 접속 시 서버 자동 시작
      AUTO_SCALE_DOWN: "true"       # 유휴 서버 자동 중지
      AUTO_SCALE_DOWN_AFTER: "10m"  # 유휴 타임아웃
      DOCKER_TIMEOUT: "120s"        # 서버 시작 타임아웃 (Go time.Duration: 120s, 2m)
```

```bash
# mc-router 상태와 라우트 보기
mcctl status router

# docker-compose.yml 편집 후 mc-router 재생성
mcctl router start
```

`mcctl router restart`는 이전 설정을 그대로 사용합니다. `mcctl router start`는 편집한 파일로 컨테이너를 다시 만듭니다. `mcctl upgrade`는 이 파일에서 router의 `image`와 `group_add`만 바꾸므로 편집한 내용은 유지됩니다. 한 서버만 자동 스케일링을 끄려면 그 서버의 [server.yaml](server-yaml.ko.md)에서 `routing.autoScale`을 설정합니다.

### 서버 속성 변경

```bash
# 게임 설정
mcctl config myserver DIFFICULTY hard
mcctl config myserver MODE survival
mcctl config myserver MAX_PLAYERS 30

# 월드 설정
mcctl config myserver SPAWN_PROTECTION 0
mcctl config myserver VIEW_DISTANCE 12

# 화이트리스트 활성화
mcctl whitelist myserver on
mcctl whitelist myserver add Steve
```

## 설정 우선순위

설정은 다음 순서로 적용됩니다 (나중 것이 이전 것을 덮어씀):

1. **기본값** - itzg/minecraft-server 이미지에 내장
2. **`servers/global.env`** - 이 파일에 이름이 있는 플랫폼 키(`TZ`, `EXTRA_ARGS`, `RCON_PASSWORD`, `RCON_PORT`), 값은 `.env`에서 가져옴
3. **서버 `config.env`** - 서버별 값, `server.yaml`에서 생성 (`mcctl config`로 관리)
4. **서버 `docker-compose.yml`의 `environment`** - `EULA=TRUE`만 있음

그 밖의 `.env` 키는 서버에 전달되지 않습니다. 모든 서버에 전달하려면 `servers/global.env`에 이름을 추가하세요([설정 분류](environment.ko.md#설정-분류) 참고).

## 유효성 검사

설정 변경 후 서버 상태를 확인합니다:

```bash
# 서버 설정 확인
mcctl config myserver

# 서버 상태 확인
mcctl status myserver

# 오류 확인을 위해 로그 보기
mcctl logs myserver -n 50
```

## 고급 설정

`mcctl config`에서 지원하지 않는 설정은 파일을 직접 편집합니다:

```bash
# 전역 설정 편집
nano ~/minecraft-servers/.env

# 서버별 설정 편집
nano ~/minecraft-servers/servers/myserver/config.env

# 변경 사항 적용을 위해 재시작
mcctl stop myserver && mcctl start myserver
```

mcctl은 `config.env`와 서버의 `docker-compose.yml`을 `servers/<name>/server.yaml`에서 만들어 씁니다. `config.env`를 손으로 고치면 다음에 mcctl이 그 서버를 바꿀 때 `server.yaml`로 가져옵니다. `docker-compose.yml`에서 `image`와 `mc-router.*` 라벨 외의 부분(예: 리소스 제한)을 고친 내용은 유지되지만, 나중에 이 파일을 다시 써야 하는 변경은 `compose_edited`로 멈춥니다. [손으로 고친 경우](server-yaml.ko.md#손으로-고친-경우)와 `config.env`의 [값 규칙](environment.ko.md#값-규칙)을 참고하세요.

!!! note "직접 파일 편집이 필요한 경우"
    직접 파일 편집은 다음 경우에만 필요합니다:

    - 고급 JVM 옵션 (`JVM_OPTS`, `JVM_DD_OPTS`)
    - 사용자 지정 환경 변수
    - Docker 리소스 제한

    표준 설정은 `mcctl config`를 사용하세요.

## 다음 단계

- **[환경 변수](environment.ko.md)** - 사용 가능한 모든 설정 옵션
- **[서버 정의 (server.yaml)](server-yaml.ko.md)** - 각 서버 설정의 원본 파일
- **[서버 타입](server-types.ko.md)** - 각 서버 플랫폼에 대한 상세 가이드
- **[고급 네트워킹](../advanced/networking.ko.md)** - 네트워크 설정
