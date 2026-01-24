# 모드팩

다양한 소스에서 사전 구성된 모드팩 컬렉션을 설치합니다.

## 개요

| 플랫폼 | 환경 변수 | API 키 필요 | 적합한 용도 |
|--------|----------|------------|------------|
| [Packwiz](#packwiz) | `PACKWIZ_URL` | 아니오 | 커스텀/자체 호스팅 모드팩 |
| [CurseForge](#curseforge-모드팩) | `CF_PAGE_URL`, `CF_SLUG` | 예 | 인기 모드팩 |
| [Modrinth](#modrinth-모드팩) | `MODRINTH_MODPACK` | 아니오 | 오픈소스 모드팩 |
| [FTB](#ftb-모드팩) | `FTB_MODPACK_ID` | 아니오 | Feed the Beast 모드팩 |
| [ZIP 아카이브](#zip-모드팩) | `MODPACK`, `GENERIC_PACKS` | 아니오 | 수동/커스텀 아카이브 |

---

## Packwiz

[Packwiz](https://packwiz.infra.link/)는 CurseForge와 Modrinth 소스를 모두 지원하는 모드팩 생성 및 관리용 명령줄 도구입니다.

### 기본 사용법

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      PACKWIZ_URL: "https://example.com/modpack/pack.toml"
    volumes:
      - ./data:/data
```

### 환경 변수

| 변수 | 설명 |
|------|------|
| `PACKWIZ_URL` | `pack.toml` 모드팩 정의 파일 URL |

### 주요 기능

- **처리 순서**: Packwiz 정의가 다른 모드 정의(`MODPACK`, `MODS` 등)보다 먼저 처리되어 추가 커스터마이징 가능
- **서버 측 전용**: 서버 호환 모드만 다운로드하도록 사전 구성
- **다중 소스**: CurseForge와 Modrinth 모드 소스 모두 지원

### 클라이언트 측 모드

클라이언트 측 모드가 문제를 일으키면 `pack.toml`의 side 설정에서 `"both"` 대신 `"client"`로 표시되어 있는지 확인하세요.

### 더 알아보기

- [Packwiz 공식 문서](https://packwiz.infra.link/tutorials/getting-started/)

---

## CurseForge 모드팩

자동 업그레이드 지원과 함께 [CurseForge](https://www.curseforge.com/minecraft/modpacks)에서 모드팩을 설치합니다.

### 사전 요구사항

!!! warning "API 키 필수"
    CurseForge는 API 키가 필요합니다. 설정 지침은 [CurseForge 가이드](curseforge.ko.md#api-키-발급)를 참조하세요.

### 기본 사용법

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "AUTO_CURSEFORGE"
      CF_API_KEY: "${CF_API_KEY}"
      CF_PAGE_URL: "https://www.curseforge.com/minecraft/modpacks/all-the-mods-8"
    volumes:
      - ./data:/data
```

### 모드팩 지정 방법

| 방법 | 설명 | 예시 |
|------|------|------|
| `CF_PAGE_URL` | 전체 모드팩 페이지 URL | `https://www.curseforge.com/minecraft/modpacks/all-the-mods-8` |
| `CF_SLUG` | URL의 짧은 식별자 | `all-the-mods-8` |
| `CF_FILE_ID` | 버전 고정을 위한 특정 파일 ID | `4567890` |
| `CF_FILENAME_MATCHER` | 파일명 매칭을 위한 부분 문자열 | `server` |

### 환경 변수

| 변수 | 설명 |
|------|------|
| `CF_API_KEY` | CurseForge API 키 (필수) |
| `CF_API_KEY_FILE` | API 키가 포함된 파일 경로 |
| `CF_PAGE_URL` | 모드팩 또는 특정 파일의 전체 URL |
| `CF_SLUG` | URL 경로의 짧은 식별자 |
| `CF_FILE_ID` | 버전 고정을 위한 특정 파일 ID |
| `CF_FILENAME_MATCHER` | 원하는 파일명 매칭을 위한 부분 문자열 |

### 모드 필터링

| 변수 | 설명 |
|------|------|
| `CF_EXCLUDE_MODS` | 제외할 쉼표/공백으로 구분된 프로젝트 슬러그 또는 ID |
| `CF_FORCE_INCLUDE_MODS` | 클라이언트 전용으로 잘못 태그된 모드 강제 포함 |
| `CF_EXCLUDE_ALL_MODS` | 모든 모드 제외 (서버 전용 설정) |
| `CF_EXCLUDE_INCLUDE_FILE` | 복잡한 제외를 위한 JSON 설정 파일 경로 |

### 고급 옵션

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `CF_MOD_LOADER_VERSION` | auto | 모드 로더 버전 오버라이드 |
| `CF_OVERRIDES_EXCLUSIONS` | - | override 파일 제외를 위한 Ant 스타일 경로 패턴 |
| `CF_PARALLEL_DOWNLOADS` | 4 | 동시 모드 다운로드 수 |
| `CF_FORCE_REINSTALL_MODLOADER` | false | 모드 로더 강제 재설치 |
| `CF_FORCE_SYNCHRONIZE` | false | 제외/포함 재평가 |
| `CF_SET_LEVEL_FROM` | - | `WORLD_FILE` 또는 `OVERRIDES`에서 월드 데이터 설정 |

### 수동 다운로드

자동 다운로드를 제한하는 모드의 경우:

```yaml
environment:
  CF_DOWNLOADS_REPO: "/downloads"  # 기본 경로
volumes:
  - ./manual-downloads:/downloads:ro
```

수동으로 다운로드한 파일을 `./manual-downloads/`에 배치합니다.

### 비공개 모드팩

비공개 또는 로컬 모드팩의 경우:

```yaml
environment:
  TYPE: "AUTO_CURSEFORGE"
  CF_API_KEY: "${CF_API_KEY}"
  CF_MODPACK_ZIP: "/modpacks/my-modpack.zip"
volumes:
  - ./modpacks:/modpacks:ro
```

또는 매니페스트만 사용:

```yaml
environment:
  CF_MODPACK_MANIFEST: "/modpacks/manifest.json"
```

### 전체 예시

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "AUTO_CURSEFORGE"
      CF_API_KEY: "${CF_API_KEY}"
      CF_PAGE_URL: "https://www.curseforge.com/minecraft/modpacks/all-the-mods-8"
      MEMORY: "8G"
      CF_EXCLUDE_MODS: "optifine,journeymap"  # 클라이언트 전용 모드 제외
      CF_PARALLEL_DOWNLOADS: "6"
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```

---

## Modrinth 모드팩

[Modrinth](https://modrinth.com/modpacks)에서 모드팩을 설치합니다.

### 기본 사용법

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "MODRINTH"
      MODRINTH_MODPACK: "cobblemon-modpack"
    volumes:
      - ./data:/data
```

### 모드팩 지정 방법

| 방법 | 설명 | 예시 |
|------|------|------|
| 프로젝트 슬러그 | URL 식별자 | `cobblemon-modpack` |
| 프로젝트 ID | 숫자형 ID | `1234567` |
| 페이지 URL | 전체 모드팩 URL | `https://modrinth.com/modpack/cobblemon-modpack` |
| mrpack URL | 직접 mrpack 파일 URL | `https://example.com/pack.mrpack` |
| 로컬 경로 | 컨테이너 경로 | `/packs/custom.mrpack` |

### 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `MODRINTH_MODPACK` | - | 프로젝트 슬러그, ID, URL 또는 경로 |
| `VERSION` | - | 자동 선택을 위해 `LATEST` 또는 `SNAPSHOT` 설정 |
| `MODRINTH_MODPACK_VERSION_TYPE` | - | `release`, `beta` 또는 `alpha`로 제한 |
| `MODRINTH_VERSION` | - | 정확한 모드팩 버전 ID |
| `MODRINTH_LOADER` | auto | 특정 로더: `forge`, `fabric`, `quilt` |

### 파일 관리

| 변수 | 설명 |
|------|------|
| `MODRINTH_EXCLUDE_FILES` | 제외할 부분 파일명의 쉼표/줄바꿈 목록 |
| `MODRINTH_FORCE_INCLUDE_FILES` | 특정 모드 강제 포함 |
| `MODRINTH_IGNORE_MISSING_FILES` | 무시할 파일의 glob 패턴 |
| `MODRINTH_OVERRIDES_EXCLUSIONS` | override 제외를 위한 Ant 스타일 경로 |
| `MODRINTH_FORCE_SYNCHRONIZE` | 모드 호환성 반복 시 `true`로 설정 |

### 전체 예시

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "MODRINTH"
      MODRINTH_MODPACK: "cobblemon-modpack"
      MODRINTH_MODPACK_VERSION_TYPE: "release"
      MEMORY: "6G"
      MODRINTH_EXCLUDE_FILES: "optifine,shaders"
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```

---

## FTB 모드팩

[Feed the Beast](https://www.feed-the-beast.com/modpacks)에서 모드팩을 설치합니다.

### 기본 사용법

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17-graalvm
    environment:
      EULA: "TRUE"
      TYPE: "FTBA"
      FTB_MODPACK_ID: "23"
    volumes:
      - ./data:/data
```

!!! info "FTBA vs FTB"
    `TYPE: "FTBA"` (A 접미사 포함)를 사용하세요. "FTB" 별칭은 더 이상 사용되지 않으며 CurseForge를 참조합니다.

### 모드팩 ID 찾기

모드팩 ID는 URL에 있습니다:

`https://www.feed-the-beast.com/modpacks/23-ftb-infinity-evolved-17` -> ID는 `23`

### 환경 변수

| 변수 | 설명 |
|------|------|
| `FTB_MODPACK_ID` | 숫자형 모드팩 ID (필수) |
| `FTB_MODPACK_VERSION_ID` | 특정 버전 ID (선택) |
| `FTB_FORCE_REINSTALL` | 강제 재설치를 위해 `true`로 설정 |

### 업그레이드

- **자동 업그레이드**: 버전 고정 없이 컨테이너 재시작으로 최신 버전 가져옴
- **수동 업그레이드**: `FTB_MODPACK_VERSION_ID` 업데이트 후 컨테이너 재생성

### 전체 예시

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17-graalvm
    environment:
      EULA: "TRUE"
      TYPE: "FTBA"
      FTB_MODPACK_ID: "23"
      MEMORY: "8G"
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```

---

## ZIP 모드팩

ZIP 아카이브에서 모드팩을 설치합니다.

### MODPACK 변수

단일 모드팩 설치용:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      MODPACK: "https://example.com/modpack.zip"
    volumes:
      - ./data:/data
```

### GENERIC_PACKS 변수

여러 팩 또는 추가 콘텐츠용:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      GENERIC_PACKS: |
        https://example.com/base-pack.zip
        https://example.com/addon-pack.zip
    volumes:
      - ./data:/data
```

### 로컬 ZIP 파일

```yaml
environment:
  MODPACK: "/packs/custom-modpack.zip"
volumes:
  - ./packs:/packs:ro
```

### 환경 변수

| 변수 | 설명 |
|------|------|
| `MODPACK` | 모드팩 ZIP의 URL 또는 컨테이너 경로 |
| `GENERIC_PACKS` | 여러 팩 URL/경로 (줄바꿈으로 구분) |

---

## 비교표

| 기능 | Packwiz | CurseForge | Modrinth | FTB | ZIP |
|------|---------|------------|----------|-----|-----|
| API 키 | 아니오 | 예 | 아니오 | 아니오 | 아니오 |
| 자동 업그레이드 | 예 | 예 | 예 | 예 | 아니오 |
| 버전 제어 | pack.toml | CF_FILE_ID | MODRINTH_VERSION | FTB_MODPACK_VERSION_ID | 수동 |
| 커스텀 모드 | 예 | 제한적 | 제한적 | 아니오 | 예 |
| 의존성 해결 | 예 | 부분적 | 예 | 예 | 아니오 |
| 다중 소스 지원 | 예 | 아니오 | 아니오 | 아니오 | N/A |

## 문제 해결

### 일반적인 문제

| 문제 | 원인 | 해결책 |
|------|------|--------|
| 모드팩이 로드되지 않음 | 잘못된 TYPE | 적절한 TYPE 설정 (AUTO_CURSEFORGE, MODRINTH, FTBA) |
| 모드 누락 | 클라이언트 전용 제외 | CF_FORCE_INCLUDE_MODS 또는 MODRINTH_FORCE_INCLUDE_FILES 사용 |
| 메모리 부족 | 할당 부족 | MEMORY 값 증가 (대규모 팩은 8G+ 권장) |
| 버전 불일치 | 호환되지 않는 버전 | 버전 ID 변수로 특정 버전 고정 |

### 디버그 로깅

```yaml
environment:
  DEBUG: "true"
```

## 참고

- [CurseForge 모드 가이드](curseforge.ko.md)
- [Modrinth 모드 가이드](modrinth.ko.md)
- [모드 및 플러그인 개요](index.ko.md)
- [공식 itzg 문서 - Auto CurseForge](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/auto-curseforge/)
- [공식 itzg 문서 - Modrinth 모드팩](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/modrinth-modpacks/)
- [공식 itzg 문서 - FTB](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/ftb/)
- [공식 itzg 문서 - Packwiz](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/packwiz/)
