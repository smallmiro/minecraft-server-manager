# Modrinth

[Modrinth](https://modrinth.com/)에서 모드와 플러그인을 다운로드합니다 - 오픈소스 모드 호스팅 플랫폼입니다.

## 개요

| 기능 | 값 |
|------|-----|
| 공식 웹사이트 | [https://modrinth.com/](https://modrinth.com/) |
| API 키 필요 | 아니오 |
| 의존성 해결 | 자동 (선택사항) |
| 버전 자동 감지 | 예 |
| 지원 유형 | 모드, 플러그인, 데이터팩 |

## mcctl 빠른 시작

### 서버 생성 및 모드 추가

```bash
# Fabric 서버 생성
mcctl create modded --type FABRIC --version 1.21.1

# Modrinth 모드 추가
mcctl config modded MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# 자동 의존성 다운로드 활성화
mcctl config modded MODRINTH_DOWNLOAD_DEPENDENCIES "required"

# 재시작하여 변경사항 적용
mcctl stop modded && mcctl start modded
```

### Paper 서버에 플러그인 추가

```bash
# Paper 서버 생성
mcctl create survival --type PAPER --version 1.21.1

# Modrinth 플러그인 추가
mcctl config survival MODRINTH_PROJECTS "luckperms,chunky,spark"

# 재시작하여 변경사항 적용
mcctl stop survival && mcctl start survival
```

## 프로젝트 Slug 찾기

Slug는 `/mod/` 또는 `/plugin/` 뒤의 URL 부분입니다.

예: `https://modrinth.com/mod/fabric-api` -> slug는 `fabric-api`

!!! tip "프로젝트 Slug"
    Modrinth의 프로젝트 slug 또는 프로젝트 ID를 사용할 수 있습니다.

## 프로젝트 입력 형식

`MODRINTH_PROJECTS` 값에서 다양한 형식을 사용할 수 있습니다:

| 형식 | 설명 | 예시 |
|------|------|------|
| `project` | 최신 릴리스 | `fabric-api` |
| `project:version` | 특정 버전 ID 또는 번호 | `fabric-api:0.92.0` |
| `project:release` | 최신 릴리스 타입 | `fabric-api:release` |
| `project:beta` | 최신 베타 | `lithium:beta` |
| `project:alpha` | 최신 알파 | `sodium:alpha` |
| `prefix:project` | 로더 오버라이드 | `fabric:sodium` |

### 버전 지정자

```bash
# 최신 릴리스
mcctl config myserver MODRINTH_PROJECTS "fabric-api"

# 특정 버전
mcctl config myserver MODRINTH_PROJECTS "fabric-api:0.92.0"

# 베타 버전
mcctl config myserver MODRINTH_PROJECTS "lithium:beta"

# 혼합 버전의 여러 모드
mcctl config myserver MODRINTH_PROJECTS "fabric-api,sodium:release,iris:beta"
```

### 로더 접두사

특정 프로젝트에 대해 자동 감지된 로더를 오버라이드합니다:

```bash
# Fabric 로더 강제
mcctl config myserver MODRINTH_PROJECTS "fabric:fabric-api"

# 플러그인용 Paper 로더 강제
mcctl config myserver MODRINTH_PROJECTS "paper:luckperms"

# 데이터팩
mcctl config myserver MODRINTH_PROJECTS "datapack:better-villages"
```

## 설정 옵션

### 기본 설정

```bash
# 모드 추가 (쉼표 구분)
mcctl config myserver MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# 자동 의존성 다운로드
mcctl config myserver MODRINTH_DOWNLOAD_DEPENDENCIES "required"

# 모든 모드의 기본 버전 타입
mcctl config myserver MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE "release"
```

### 의존성 옵션

| 값 | 설명 |
|----|------|
| `none` | 의존성 없음 (기본값) |
| `required` | 필수 의존성만 다운로드 |
| `optional` | 필수 및 선택적 의존성 다운로드 |

### 버전 제어

```bash
# 모드에서 마인크래프트 버전 자동 감지
mcctl config myserver VERSION_FROM_MODRINTH_PROJECTS "true"

# 로더 타입 오버라이드
mcctl config myserver MODRINTH_LOADER "fabric"
```

## 설정 레퍼런스

| 설정 키 | 기본값 | 설명 |
|--------|--------|------|
| `MODRINTH_PROJECTS` | - | 쉼표 또는 줄바꿈으로 구분된 프로젝트 목록 |
| `MODRINTH_DOWNLOAD_DEPENDENCIES` | `none` | `none`, `required`, 또는 `optional` |
| `MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE` | `release` | 기본값: `release`, `beta`, `alpha` |
| `VERSION_FROM_MODRINTH_PROJECTS` | `false` | 마인크래프트 버전 자동 설정 |
| `MODRINTH_LOADER` | auto | 로더 타입 오버라이드 |

## 전체 예제

### Fabric 성능 서버

```bash
# 서버 생성
mcctl create performance --type FABRIC --version 1.21.1

# 모드 설정
mcctl config performance MODRINTH_PROJECTS "fabric-api,lithium,phosphor,ferritecore,krypton,c2me-fabric"
mcctl config performance MODRINTH_DOWNLOAD_DEPENDENCIES "required"
mcctl config performance MEMORY "4G"

# 서버 시작
mcctl start performance
```

### Paper 플러그인 서버

```bash
# 서버 생성
mcctl create survival --type PAPER --version 1.21.1

# 플러그인 설정
mcctl config survival MODRINTH_PROJECTS "luckperms,vault,chunky,spark"
mcctl config survival MEMORY "4G"

# 서버 시작
mcctl start survival
```

### 혼합 버전 타입

```bash
# 기본값을 베타로 설정
mcctl config myserver MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE "beta"

# 개별 모드 오버라이드
mcctl config myserver MODRINTH_PROJECTS "fabric-api,sodium:release,iris:alpha"
```

## 고급 설정 (수동)

고급 멀티라인 설정은 `config.env`를 직접 편집합니다:

```bash
nano ~/minecraft-servers/servers/myserver/config.env
```

`config.env` 예시:

```bash
# Modrinth 모드 (여러 줄 형식)
MODRINTH_PROJECTS=fabric-api
lithium
phosphor
ferritecore
krypton
c2me-fabric

# 의존성 설정
MODRINTH_DOWNLOAD_DEPENDENCIES=required

# 커스텀 로더 (커스텀 서버 타입용)
MODRINTH_LOADER=fabric
```

### 목록 파일 사용

매우 큰 모드 목록의 경우 목록 파일을 사용합니다:

```bash
# 모드 목록 파일 생성
nano ~/minecraft-servers/servers/myserver/data/mods.txt
```

`mods.txt` 내용:

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

그런 다음 `config.env`에서 참조합니다:

```bash
MODRINTH_PROJECTS=@/data/mods.txt
```

## 자동 제거

`MODRINTH_PROJECTS`에서 프로젝트를 제거하면 해당 파일이 서버에서 자동으로 제거됩니다.

```bash
# 목록에서 sodium 제거
mcctl config myserver MODRINTH_PROJECTS "fabric-api,lithium"

# 재시작하여 적용 (sodium이 제거됨)
mcctl stop myserver && mcctl start myserver
```

## 문제 해결

### 일반적인 문제

| 문제 | 원인 | 해결방법 |
|------|------|----------|
| 모드를 찾을 수 없음 | 잘못된 slug 또는 ID | Modrinth URL에서 slug 확인 |
| 버전 불일치 | 모드가 서버 버전을 지원하지 않음 | `VERSION_FROM_MODRINTH_PROJECTS` 사용 또는 호환성 확인 |
| 의존성 누락 | 의존성이 다운로드되지 않음 | `MODRINTH_DOWNLOAD_DEPENDENCIES: "required"` 설정 |
| 잘못된 로더 | 자동 감지 실패 | 로더 접두사 또는 `MODRINTH_LOADER` 사용 |

### 현재 설정 확인

```bash
# 모든 설정 보기
mcctl config myserver

# 특정 설정 보기
mcctl config myserver MODRINTH_PROJECTS
```

### 서버 로그 보기

```bash
# 모드 로딩 오류 확인
mcctl logs myserver

# 실시간 로그 추적
mcctl logs myserver -f
```

### 디버그 모드

문제 해결을 위해 디버그 출력을 활성화합니다:

```bash
mcctl config myserver DEBUG "true"
mcctl stop myserver && mcctl start myserver
mcctl logs myserver
```

## 참고

- [Modrinth 공식 웹사이트](https://modrinth.com/)
- [Modrinth API 문서](https://docs.modrinth.com/)
- [모드 및 플러그인 개요](index.ko.md)
- [CurseForge 가이드](curseforge.ko.md)
- [CLI 명령어 레퍼런스](../cli/commands.ko.md)
- [공식 itzg 문서](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/modrinth/)
