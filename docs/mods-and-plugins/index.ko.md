# 모드 및 플러그인

다양한 소스에서 마인크래프트 서버용 모드와 플러그인을 설치하는 가이드입니다.

## 개요

| 유형 | 설명 | 서버 타입 |
|------|------|----------|
| **모드(Mods)** | 게임 메커니즘 수정, 클라이언트 설치 필요 | Forge, Fabric, Quilt |
| **플러그인(Plugins)** | 서버 측만 적용, 클라이언트 변경 불필요 | Paper, Spigot, Bukkit |

## 설치 소스

| 소스 | 적합한 용도 | API 키 필요 |
|------|------------|------------|
| [Modrinth](modrinth.ko.md) | 최신 모드/플러그인, 개방형 플랫폼 | 아니오 |
| [CurseForge](curseforge.ko.md) | 대규모 모드 라이브러리, 모드팩 | 예 |
| [Spiget](spiget.ko.md) | SpigotMC 플러그인 | 아니오 |
| [직접 다운로드](direct-download.ko.md) | 커스텀/비공개 파일 | 아니오 |
| [모드팩](modpacks.ko.md) | 사전 구성된 모드 컬렉션 | 다양함 |

## 빠른 비교

### Modrinth vs CurseForge

| 기능 | Modrinth | CurseForge |
|------|----------|------------|
| API 키 | 불필요 | 필수 |
| 의존성 해결 | 자동 | 수동 |
| 버전 자동 감지 | 예 (`VERSION_FROM_MODRINTH_PROJECTS`) | 아니오 |
| 모드 라이브러리 규모 | 성장 중 | 최대 |
| 플러그인 지원 | 예 | 제한적 |

### 플러그인용 Spiget vs Modrinth

| 기능 | Spiget | Modrinth |
|------|--------|----------|
| 플랫폼 | SpigotMC 리소스 | Modrinth 프로젝트 |
| ID 형식 | 숫자형 리소스 ID | Slug 또는 프로젝트 ID |
| 의존성 지원 | 아니오 | 예 (`MODRINTH_DOWNLOAD_DEPENDENCIES`) |
| 다운로드 제한 | 일부 플러그인 제한됨 | 없음 |

## 기본 설치 방법

### 볼륨 마운트

모드 및 플러그인용 로컬 디렉토리 마운트:

```yaml
services:
  mc:
    image: itzg/minecraft-server
    volumes:
      - ./data:/data
      - ./mods:/mods:ro      # 읽기 전용 모드
      - ./plugins:/plugins:ro # 읽기 전용 플러그인
      - ./config:/config      # 설정 파일
```

!!! info "마운트 포인트"
    - `/mods`는 `/data/mods`로 동기화됨 (Forge, Fabric)
    - `/plugins`는 `/data/plugins`로 동기화됨 (Paper, Spigot)
    - `/config`는 `/data/config`로 동기화됨

### 환경 변수

| 변수 | 설명 |
|------|------|
| `MODS` | 쉼표/공백/줄바꿈으로 구분된 모드 URL |
| `PLUGINS` | 쉼표/공백/줄바꿈으로 구분된 플러그인 URL |
| `MODS_FILE` | 모드 URL 목록이 있는 파일 경로 또는 URL |
| `PLUGINS_FILE` | 플러그인 URL 목록이 있는 파일 경로 또는 URL |

### 동기화 경로 커스터마이징

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `COPY_MODS_SRC` | `/mods` | 모드 소스 디렉토리 |
| `COPY_MODS_DEST` | `/data/mods` | 모드 대상 디렉토리 |
| `COPY_PLUGINS_SRC` | `/plugins` | 플러그인 소스 디렉토리 |
| `COPY_PLUGINS_DEST` | `/data/plugins` | 플러그인 대상 디렉토리 |
| `COPY_CONFIG_DEST` | `/data/config` | 설정 대상 디렉토리 |

## 자동 정리

### 이전 모드 제거

새 콘텐츠 적용 전 이전 모드/플러그인 자동 제거:

```yaml
environment:
  REMOVE_OLD_MODS: "TRUE"
```

### 특정 파일 제외

```yaml
environment:
  REMOVE_OLD_MODS: "TRUE"
  REMOVE_OLD_MODS_INCLUDE: "*.jar"
  REMOVE_OLD_MODS_EXCLUDE: "keep-this-mod.jar"
```

## 하이브리드 서버

Cardboard (Fabric + Bukkit 플러그인) 같은 하이브리드 서버의 경우:

```yaml
environment:
  TYPE: FABRIC
  USES_PLUGINS: "true"  # Fabric에서 플러그인 지원 활성화
```

## 환경 변수 처리

기본적으로 동기화된 설정 파일의 환경 변수가 처리됩니다. 비활성화하려면:

```yaml
environment:
  REPLACE_ENV_DURING_SYNC: "false"
```

## 다음 단계

- [Modrinth 가이드](modrinth.ko.md) - Modrinth에서 다운로드
- [CurseForge 가이드](curseforge.ko.md) - CurseForge에서 다운로드
- [Spiget 가이드](spiget.ko.md) - SpigotMC 플러그인 다운로드
- [직접 다운로드 가이드](direct-download.ko.md) - URL에서 다운로드
- [모드팩 가이드](modpacks.ko.md) - 모드팩 설치

## 참고

- [서버 타입](../configuration/server-types.ko.md)
- [환경 변수](../configuration/environment.ko.md)
- [공식 itzg 문서](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/)
