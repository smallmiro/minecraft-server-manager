# 설정 개요

이 섹션에서는 Docker Minecraft Server 플랫폼의 모든 설정 옵션을 다룹니다.

## 설정 파일

플랫폼은 여러 설정 파일을 사용합니다:

| 파일 | 용도 | 위치 |
|------|------|------|
| `.env` | 전역 환경 변수 | `~/minecraft-servers/.env` |
| `docker-compose.yml` | 메인 오케스트레이션 | `~/minecraft-servers/docker-compose.yml` |
| `servers/<name>/config.env` | 서버별 설정 | `~/minecraft-servers/servers/<name>/config.env` |
| `servers/<name>/docker-compose.yml` | 서버별 compose | `~/minecraft-servers/servers/<name>/docker-compose.yml` |

## 빠른 설정

### 필수 설정

`~/minecraft-servers/.env`를 편집합니다:

```bash
# 서버의 IP 주소 (nip.io에 필요)
HOST_IP=192.168.1.100

# 기본 메모리 할당
DEFAULT_MEMORY=4G

# 기본 Minecraft 버전
DEFAULT_VERSION=1.20.4

# 타임존
TZ=Asia/Seoul

# RCON 비밀번호 (이것을 변경하세요!)
RCON_PASSWORD=your-secure-password
```

### 서버별 설정

`~/minecraft-servers/servers/<name>/config.env`를 편집합니다:

```bash
# 서버 타입
TYPE=PAPER

# Minecraft 버전
VERSION=1.21.1

# 메모리 할당
MEMORY=4G

# 서버 속성
MAX_PLAYERS=20
MOTD=내 서버에 오신 것을 환영합니다!
DIFFICULTY=normal
GAMEMODE=survival
```

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

## 설정 우선순위

설정은 다음 순서로 적용됩니다 (나중 것이 이전 것을 덮어씀):

1. **기본값** - itzg/minecraft-server 이미지에 내장
2. **전역 `.env`** - 플랫폼 전체 기본값
3. **서버 `config.env`** - 서버별 오버라이드
4. **Docker Compose** - 컨테이너별 설정

## 일반적인 설정 작업

### 서버 메모리 변경

`servers/<name>/config.env`를 편집합니다:

```bash
MEMORY=8G
```

그런 다음 재시작합니다:

```bash
docker compose restart mc-<name>
```

### Minecraft 버전 변경

`servers/<name>/config.env`를 편집합니다:

```bash
VERSION=1.21.1
```

그런 다음 컨테이너를 재생성합니다:

```bash
docker compose up -d mc-<name>
```

### 모드/플러그인 활성화

모드 서버(Forge/Fabric)의 경우 `config.env`에 추가합니다:

```bash
# Modrinth에서 다운로드
MODRINTH_PROJECTS=fabric-api,lithium,sodium

# 또는 CurseForge에서
CF_API_KEY=${CF_API_KEY}
CURSEFORGE_FILES=jei,journeymap
```

플러그인 서버(Paper/Spigot)의 경우 `shared/plugins/` 디렉토리를 사용합니다.

### 자동 스케일링 설정

mc-router가 자동 스케일링을 처리합니다. `docker-compose.yml`을 편집합니다:

```yaml
services:
  router:
    environment:
      AUTO_SCALE_UP: "true"
      AUTO_SCALE_DOWN: "true"  # 유휴 서버 중지
      DOCKER_TIMEOUT: "120"    # 서버 시작 대기 시간
```

## 유효성 검사

설정 변경 후 검증합니다:

```bash
# compose 구문 확인
docker compose config --quiet

# 서버 시작 테스트
docker compose up -d mc-<name>
docker logs -f mc-<name>
```

## 다음 단계

- **[환경 변수](environment.ko.md)** - 사용 가능한 모든 설정 옵션
- **[서버 타입](server-types.ko.md)** - 각 서버 플랫폼에 대한 상세 가이드
- **[고급 네트워킹](../advanced/networking.ko.md)** - 네트워크 설정
