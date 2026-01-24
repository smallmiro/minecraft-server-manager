# 모드팩

다양한 소스에서 사전 구성된 모드팩 컬렉션을 설치합니다.

## 개요

| 플랫폼 | 설정 키 | API 키 필요 | 적합한 용도 |
|--------|--------|------------|------------|
| [Packwiz](#packwiz) | `PACKWIZ_URL` | 아니오 | 커스텀/자체 호스팅 모드팩 |
| [CurseForge](#curseforge-모드팩) | `CF_PAGE_URL`, `CF_SLUG` | 예 | 인기 모드팩 |
| [Modrinth](#modrinth-모드팩) | `MODRINTH_MODPACK` | 아니오 | 오픈소스 모드팩 |
| [FTB](#ftb-모드팩) | `FTB_MODPACK_ID` | 아니오 | Feed the Beast 모드팩 |
| [ZIP 아카이브](#zip-모드팩) | `MODPACK`, `GENERIC_PACKS` | 아니오 | 수동/커스텀 아카이브 |

!!! note "모드팩과 서버 타입"
    모드팩을 설치할 때 서버 TYPE은 모드팩 플랫폼에 따라 자동으로 설정되는 경우가 많습니다. 예를 들어 CurseForge 모드팩은 `TYPE=AUTO_CURSEFORGE`를 사용하고 Modrinth 모드팩은 `TYPE=MODRINTH`를 사용합니다.

---

## Packwiz

[Packwiz](https://packwiz.infra.link/)는 CurseForge와 Modrinth 소스를 모두 지원하는 모드팩 생성 및 관리용 명령줄 도구입니다.

### mcctl 빠른 시작

```bash
# Packwiz 모드팩으로 Fabric 서버 생성
mcctl create modded --type FABRIC --version 1.21.1

# Packwiz 모드팩 URL 설정
mcctl config modded PACKWIZ_URL "https://example.com/modpack/pack.toml"

# 재시작하여 적용
mcctl stop modded && mcctl start modded
```

### 설정 레퍼런스

| 설정 키 | 설명 |
|--------|------|
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

### mcctl 빠른 시작

```bash
# 서버 생성 (CurseForge 모드팩의 경우 TYPE이 자동 설정됨)
mcctl create modded

# CurseForge 모드팩용 서버 타입 설정
mcctl config modded TYPE "AUTO_CURSEFORGE"

# 페이지 URL로 모드팩 설정
mcctl config modded CF_PAGE_URL "https://www.curseforge.com/minecraft/modpacks/all-the-mods-8"

# 또는 슬러그로 (더 짧음)
mcctl config modded CF_SLUG "all-the-mods-8"

# 메모리 설정 (모드팩은 일반적으로 더 많이 필요)
mcctl config modded MEMORY "8G"

# 재시작하여 적용
mcctl stop modded && mcctl start modded
```

### 모드팩 지정 방법

| 방법 | 설명 | 예시 |
|------|------|------|
| `CF_PAGE_URL` | 전체 모드팩 페이지 URL | `https://www.curseforge.com/minecraft/modpacks/all-the-mods-8` |
| `CF_SLUG` | URL의 짧은 식별자 | `all-the-mods-8` |
| `CF_FILE_ID` | 버전 고정을 위한 특정 파일 ID | `4567890` |
| `CF_FILENAME_MATCHER` | 파일명 매칭을 위한 부분 문자열 | `server` |

### 설정 레퍼런스

| 설정 키 | 설명 |
|--------|------|
| `CF_API_KEY` | CurseForge API 키 (필수, `.env`에 설정) |
| `CF_PAGE_URL` | 모드팩 또는 특정 파일의 전체 URL |
| `CF_SLUG` | URL 경로의 짧은 식별자 |
| `CF_FILE_ID` | 버전 고정을 위한 특정 파일 ID |
| `CF_FILENAME_MATCHER` | 원하는 파일명 매칭을 위한 부분 문자열 |

### 모드 필터링

```bash
# 특정 모드 제외
mcctl config modded CF_EXCLUDE_MODS "optifine,journeymap"

# 클라이언트 전용으로 잘못 태그된 모드 강제 포함
mcctl config modded CF_FORCE_INCLUDE_MODS "some-mod"

# 병렬 다운로드 수
mcctl config modded CF_PARALLEL_DOWNLOADS "6"
```

| 설정 키 | 설명 |
|--------|------|
| `CF_EXCLUDE_MODS` | 제외할 쉼표/공백으로 구분된 프로젝트 슬러그 또는 ID |
| `CF_FORCE_INCLUDE_MODS` | 클라이언트 전용으로 잘못 태그된 모드 강제 포함 |
| `CF_EXCLUDE_ALL_MODS` | 모든 모드 제외 (서버 전용 설정) |
| `CF_PARALLEL_DOWNLOADS` | 동시 모드 다운로드 수 (기본값: 4) |

### 전체 예제

```bash
# CurseForge 모드팩 서버 생성 및 설정
mcctl create atm8

# 모드팩 설정
mcctl config atm8 TYPE "AUTO_CURSEFORGE"
mcctl config atm8 CF_PAGE_URL "https://www.curseforge.com/minecraft/modpacks/all-the-mods-8"
mcctl config atm8 MEMORY "8G"
mcctl config atm8 CF_EXCLUDE_MODS "optifine,journeymap"
mcctl config atm8 CF_PARALLEL_DOWNLOADS "6"

# 서버 시작
mcctl start atm8
```

---

## Modrinth 모드팩

[Modrinth](https://modrinth.com/modpacks)에서 모드팩을 설치합니다.

### mcctl 빠른 시작

```bash
# 서버 생성
mcctl create modded

# Modrinth 모드팩용 서버 타입 설정
mcctl config modded TYPE "MODRINTH"

# 슬러그로 모드팩 설정
mcctl config modded MODRINTH_MODPACK "cobblemon-modpack"

# 메모리 설정
mcctl config modded MEMORY "6G"

# 재시작하여 적용
mcctl stop modded && mcctl start modded
```

### 모드팩 지정 방법

| 방법 | 설명 | 예시 |
|------|------|------|
| 프로젝트 슬러그 | URL 식별자 | `cobblemon-modpack` |
| 프로젝트 ID | 숫자형 ID | `1234567` |
| 페이지 URL | 전체 모드팩 URL | `https://modrinth.com/modpack/cobblemon-modpack` |
| mrpack URL | 직접 mrpack 파일 URL | `https://example.com/pack.mrpack` |
| 로컬 경로 | 컨테이너 경로 | `/packs/custom.mrpack` |

### 설정 레퍼런스

| 설정 키 | 기본값 | 설명 |
|--------|--------|------|
| `MODRINTH_MODPACK` | - | 프로젝트 슬러그, ID, URL 또는 경로 |
| `VERSION` | - | 자동 선택을 위해 `LATEST` 또는 `SNAPSHOT` 설정 |
| `MODRINTH_MODPACK_VERSION_TYPE` | - | `release`, `beta` 또는 `alpha`로 제한 |
| `MODRINTH_VERSION` | - | 정확한 모드팩 버전 ID |
| `MODRINTH_LOADER` | auto | 특정 로더: `forge`, `fabric`, `quilt` |

### 파일 관리

```bash
# 특정 파일 제외
mcctl config modded MODRINTH_EXCLUDE_FILES "optifine,shaders"

# 특정 모드 강제 포함
mcctl config modded MODRINTH_FORCE_INCLUDE_FILES "some-server-mod"

# 강제 동기화 (모드 호환성 반복 시)
mcctl config modded MODRINTH_FORCE_SYNCHRONIZE "true"
```

### 전체 예제

```bash
# Modrinth 모드팩 서버 생성 및 설정
mcctl create cobblemon

# 모드팩 설정
mcctl config cobblemon TYPE "MODRINTH"
mcctl config cobblemon MODRINTH_MODPACK "cobblemon-modpack"
mcctl config cobblemon MODRINTH_MODPACK_VERSION_TYPE "release"
mcctl config cobblemon MEMORY "6G"
mcctl config cobblemon MODRINTH_EXCLUDE_FILES "optifine,shaders"

# 서버 시작
mcctl start cobblemon
```

---

## FTB 모드팩

[Feed the Beast](https://www.feed-the-beast.com/modpacks)에서 모드팩을 설치합니다.

### mcctl 빠른 시작

```bash
# 서버 생성
mcctl create ftb

# 서버 타입 설정 (FTB가 아닌 FTBA 사용)
mcctl config ftb TYPE "FTBA"

# 모드팩 ID 설정 (URL에서 확인)
mcctl config ftb FTB_MODPACK_ID "23"

# 메모리 설정 (FTB 팩은 대용량)
mcctl config ftb MEMORY "8G"

# 재시작하여 적용
mcctl stop ftb && mcctl start ftb
```

!!! info "FTBA vs FTB"
    `TYPE: "FTBA"` (A 접미사 포함)를 사용하세요. "FTB" 별칭은 더 이상 사용되지 않으며 CurseForge를 참조합니다.

### 모드팩 ID 찾기

모드팩 ID는 URL에 있습니다:

`https://www.feed-the-beast.com/modpacks/23-ftb-infinity-evolved-17` -> ID는 `23`

### 설정 레퍼런스

| 설정 키 | 설명 |
|--------|------|
| `FTB_MODPACK_ID` | 숫자형 모드팩 ID (필수) |
| `FTB_MODPACK_VERSION_ID` | 특정 버전 ID (선택) |
| `FTB_FORCE_REINSTALL` | 강제 재설치를 위해 `true`로 설정 |

### 업그레이드

- **자동 업그레이드**: 버전 고정 없이 컨테이너 재시작으로 최신 버전 가져옴
- **수동 업그레이드**: `FTB_MODPACK_VERSION_ID` 업데이트 후 컨테이너 재생성

### 전체 예제

```bash
# FTB 모드팩 서버 생성 및 설정
mcctl create infinity

# 모드팩 설정
mcctl config infinity TYPE "FTBA"
mcctl config infinity FTB_MODPACK_ID "23"
mcctl config infinity MEMORY "8G"

# 서버 시작
mcctl start infinity
```

---

## ZIP 모드팩

ZIP 아카이브에서 모드팩을 설치합니다.

### mcctl 빠른 시작

```bash
# 적절한 타입으로 서버 생성
mcctl create modded --type FORGE

# 모드팩 URL 설정
mcctl config modded MODPACK "https://example.com/modpack.zip"

# 재시작하여 적용
mcctl stop modded && mcctl start modded
```

### 여러 팩

여러 팩 또는 추가 콘텐츠용:

```bash
# 여러 팩 설정 (쉼표로 구분)
mcctl config modded GENERIC_PACKS "https://example.com/base-pack.zip,https://example.com/addon-pack.zip"
```

### 설정 레퍼런스

| 설정 키 | 설명 |
|--------|------|
| `MODPACK` | 모드팩 ZIP의 URL 또는 컨테이너 경로 |
| `GENERIC_PACKS` | 여러 팩 URL/경로 (쉼표/줄바꿈으로 구분) |

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

### 현재 설정 확인

```bash
# 모든 설정 보기
mcctl config myserver

# 특정 설정 보기
mcctl config myserver TYPE
mcctl config myserver CF_PAGE_URL
mcctl config myserver MODRINTH_MODPACK
```

### 서버 로그 보기

```bash
# 모드팩 로딩 오류 확인
mcctl logs myserver

# 실시간 로그 추적
mcctl logs myserver -f
```

### 디버그 모드

문제 해결을 위해 디버그 출력 활성화:

```bash
mcctl config myserver DEBUG "true"
mcctl stop myserver && mcctl start myserver
mcctl logs myserver
```

## 고급 설정 (수동)

복잡한 설정의 경우 `config.env`를 직접 편집:

```bash
nano ~/minecraft-servers/servers/myserver/config.env
```

CurseForge 모드팩용 `config.env` 예시:

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/all-the-mods-8
MEMORY=8G
CF_EXCLUDE_MODS=optifine,journeymap
CF_PARALLEL_DOWNLOADS=6
```

Modrinth 모드팩용 `config.env` 예시:

```bash
TYPE=MODRINTH
MODRINTH_MODPACK=cobblemon-modpack
MODRINTH_MODPACK_VERSION_TYPE=release
MEMORY=6G
```

## 참고

- [CurseForge 모드 가이드](curseforge.ko.md)
- [Modrinth 모드 가이드](modrinth.ko.md)
- [모드 및 플러그인 개요](index.ko.md)
- [CLI 명령어 레퍼런스](../cli/commands.ko.md)
- [공식 itzg 문서 - Auto CurseForge](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/auto-curseforge/)
- [공식 itzg 문서 - Modrinth 모드팩](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/modrinth-modpacks/)
- [공식 itzg 문서 - FTB](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/ftb/)
- [공식 itzg 문서 - Packwiz](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/packwiz/)
