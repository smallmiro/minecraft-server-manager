# Modrinth

[Modrinth](https://modrinth.com/)에서 모드와 플러그인을 다운로드합니다 - 오픈소스 모드 호스팅 플랫폼입니다.

## 개요

| 기능 | 값 |
|------|-----|
| 공식 웹사이트 | [https://modrinth.com/](https://modrinth.com/) |
| API 키 필요 | 아니오 |
| 의존성 해결 | 자동 (선택적) |
| 버전 자동 감지 | 예 |
| 지원 타입 | 모드, 플러그인, 데이터팩 |

## 기본 사용법

### MODRINTH_PROJECTS

프로젝트 슬러그 또는 ID를 사용하여 모드/플러그인 다운로드:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"
      MODRINTH_PROJECTS: |
        fabric-api
        lithium
        sodium
        iris
    volumes:
      - ./data:/data
```

!!! tip "프로젝트 슬러그 찾기"
    슬러그는 `/mod/` 또는 `/plugin/` 뒤의 URL 부분입니다.

    예: `https://modrinth.com/mod/fabric-api` -> 슬러그는 `fabric-api`

## 프로젝트 항목 형식

| 형식 | 설명 | 예시 |
|------|------|------|
| `project` | 최신 릴리스 | `fabric-api` |
| `project:version` | 특정 버전 ID 또는 번호 | `fabric-api:0.92.0` |
| `project:release` | 최신 릴리스 타입 | `fabric-api:release` |
| `project:beta` | 최신 베타 | `lithium:beta` |
| `project:alpha` | 최신 알파 | `sodium:alpha` |
| `prefix:project` | 로더 오버라이드 | `fabric:sodium` |
| `@file` | 목록 파일 경로 | `@/data/mods.txt` |

### 버전 지정자

```yaml
environment:
  MODRINTH_PROJECTS: |
    fabric-api                    # 최신 릴리스
    fabric-api:release            # 명시적 최신 릴리스
    fabric-api:beta               # 최신 베타
    fabric-api:alpha              # 최신 알파
    fabric-api:0.92.0             # 특정 버전 번호
    fabric-api:ABC123xyz          # 특정 버전 ID
```

### 로더 접두사

특정 프로젝트에 대해 자동 감지된 로더를 오버라이드:

```yaml
environment:
  MODRINTH_PROJECTS: |
    fabric:fabric-api             # Fabric 로더 강제
    forge:jei                     # Forge 로더 강제
    paper:luckperms               # Paper 로더 강제
    datapack:better-villages      # 데이터팩
```

## 환경 변수

### 핵심 설정

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `MODRINTH_PROJECTS` | - | 쉼표 또는 줄바꿈으로 구분된 프로젝트 목록 |
| `MODRINTH_DOWNLOAD_DEPENDENCIES` | `none` | `none`, `required`, 또는 `optional` |
| `MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE` | `release` | 기본 버전 타입: `release`, `beta`, `alpha` |

### 버전 제어

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `VERSION_FROM_MODRINTH_PROJECTS` | `false` | 모드 호환성 기반 마인크래프트 버전 자동 설정 |
| `MODRINTH_LOADER` | auto | 조회용 로더 타입 오버라이드 |

## 의존성 관리

### 자동 의존성

필수 의존성 자동 다운로드:

```yaml
environment:
  TYPE: FABRIC
  MODRINTH_DOWNLOAD_DEPENDENCIES: "required"
  MODRINTH_PROJECTS: |
    sodium
    lithium
```

### 의존성 옵션

| 값 | 설명 |
|----|------|
| `none` | 의존성 없음 (기본값) |
| `required` | 필수 의존성만 다운로드 |
| `optional` | 필수 및 선택적 의존성 다운로드 |

## 자동 버전 감지

Modrinth가 모드 호환성에 따라 마인크래프트 버전을 결정하도록 함:

```yaml
environment:
  TYPE: FABRIC
  VERSION_FROM_MODRINTH_PROJECTS: "true"
  MODRINTH_PROJECTS: |
    fabric-api
    sodium
```

!!! warning "버전 호환성"
    `VERSION_FROM_MODRINTH_PROJECTS` 사용 시, 나열된 모든 모드가 동일한 마인크래프트 버전을 지원하는지 확인하세요.

## 목록 파일 사용

### 파일 형식

`/data/mods.txt`에 목록 파일 생성:

```text
# 성능 모드
fabric-api
lithium
sodium

# 유틸리티 모드
iris:beta
modmenu

# 특정 버전
fabric-api:0.92.0
```

### 목록 파일 참조

```yaml
environment:
  MODRINTH_PROJECTS: "@/data/mods.txt"
```

!!! note "목록 파일 요구사항"
    - 마운트된 디렉토리에 있어야 함
    - 주석은 `#`으로 시작
    - 빈 줄은 무시됨

## 자동 제거

`MODRINTH_PROJECTS`에서 프로젝트를 제거하면 해당 파일이 서버에서 자동으로 제거됩니다.

## 전체 예시

### Fabric 성능 서버

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"
      MEMORY: "4G"
      MODRINTH_DOWNLOAD_DEPENDENCIES: "required"
      MODRINTH_PROJECTS: |
        fabric-api
        lithium
        phosphor
        ferritecore
        krypton
        c2me-fabric
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```

### Paper 플러그인 서버

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"
      MEMORY: "4G"
      MODRINTH_PROJECTS: |
        luckperms
        vault
        chunky
        spark
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```

### 혼합 버전 타입

```yaml
environment:
  MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE: "beta"
  MODRINTH_PROJECTS: |
    fabric-api                # beta 사용 (기본값)
    sodium:release            # release로 오버라이드
    iris:alpha                # alpha로 오버라이드
```

### 커스텀 로더 오버라이드

커스텀 로더를 가진 서버의 경우:

```yaml
environment:
  TYPE: "CUSTOM"
  MODRINTH_LOADER: "fabric"
  MODRINTH_PROJECTS: |
    fabric-api
    lithium
```

## 문제 해결

### 일반적인 문제

| 문제 | 원인 | 해결책 |
|------|------|--------|
| 모드를 찾을 수 없음 | 잘못된 슬러그 또는 ID | Modrinth URL에서 슬러그 확인 |
| 버전 불일치 | 모드가 서버 버전을 지원하지 않음 | 모드 호환성 확인 또는 `VERSION_FROM_MODRINTH_PROJECTS` 사용 |
| 의존성 누락 | 의존성이 다운로드되지 않음 | `MODRINTH_DOWNLOAD_DEPENDENCIES: "required"` 설정 |
| 잘못된 로더 | 자동 감지 실패 | 로더 접두사 또는 `MODRINTH_LOADER` 사용 |

### 디버그 로깅

문제 해결을 위한 디버그 출력 활성화:

```yaml
environment:
  DEBUG: "true"
```

## 참고

- [Modrinth 공식 웹사이트](https://modrinth.com/)
- [Modrinth API 문서](https://docs.modrinth.com/)
- [모드 및 플러그인 개요](index.ko.md)
- [CurseForge 가이드](curseforge.ko.md)
- [공식 itzg 문서](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/modrinth/)
