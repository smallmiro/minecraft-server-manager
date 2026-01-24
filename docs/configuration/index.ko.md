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

참고로 플랫폼은 다음 설정 파일들을 사용합니다:

| 파일 | 용도 | 관리 주체 |
|------|------|-----------|
| `.env` | 전역 환경 변수 | `mcctl init` |
| `servers/<name>/config.env` | 서버별 설정 | `mcctl config` |
| `docker-compose.yml` | 메인 오케스트레이션 | `mcctl init` (자동 생성) |
| `servers/<name>/docker-compose.yml` | 서버별 compose | `mcctl create` (자동 생성) |

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

### 모드/플러그인 활성화

모드 서버(Forge/Fabric)의 경우:

```bash
# Modrinth 모드
mcctl config myserver MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# CurseForge 모드 (.env에 API 키 필요)
mcctl config myserver CURSEFORGE_FILES "jei,journeymap"
```

플러그인 서버(Paper/Spigot)의 경우 플러그인을 `shared/plugins/` 디렉토리에 넣습니다.

### 자동 스케일링 설정

```bash
# 현재 mc-router 설정 보기
mcctl status router

# .env 편집 후 mc-router 재시작
mcctl router restart
```

`~/minecraft-servers/.env`의 자동 스케일링 설정:

```bash
AUTO_SCALE_UP=true              # 플레이어 접속 시 서버 자동 시작
AUTO_SCALE_DOWN=true            # 유휴 서버 자동 중지
AUTO_SCALE_DOWN_AFTER=10m       # 유휴 타임아웃
DOCKER_TIMEOUT=120              # 서버 시작 타임아웃 (초)
```

### 서버 속성 변경

```bash
# 게임 설정
mcctl config myserver DIFFICULTY hard
mcctl config myserver GAMEMODE survival
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
2. **전역 `.env`** - 플랫폼 전체 기본값
3. **서버 `config.env`** - 서버별 오버라이드 (`mcctl config`로 관리)

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

!!! note "직접 파일 편집이 필요한 경우"
    직접 파일 편집은 다음 경우에만 필요합니다:

    - 고급 JVM 옵션 (`JVM_OPTS`, `JVM_DD_OPTS`)
    - 사용자 지정 환경 변수
    - Docker 리소스 제한

    표준 설정은 `mcctl config`를 사용하세요.

## 다음 단계

- **[환경 변수](environment.ko.md)** - 사용 가능한 모든 설정 옵션
- **[서버 타입](server-types.ko.md)** - 각 서버 플랫폼에 대한 상세 가이드
- **[고급 네트워킹](../advanced/networking.ko.md)** - 네트워크 설정
