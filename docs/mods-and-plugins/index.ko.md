# 모드 및 플러그인

mcctl CLI를 사용하여 마인크래프트 서버에 모드와 플러그인을 설치하는 가이드입니다.

## 개요

| 유형 | 설명 | 서버 타입 |
|------|------|----------|
| **모드(Mods)** | 게임 메커니즘 수정, 클라이언트 설치 필요 | Forge, Fabric, Quilt |
| **플러그인(Plugins)** | 서버 측만 적용, 클라이언트 변경 불필요 | Paper, Spigot, Bukkit |

## mcctl 빠른 시작

### 모드 지원 서버 생성

먼저 모드 또는 플러그인에 적합한 타입으로 서버를 생성합니다:

```bash
# 모드용 (Forge/Fabric)
mcctl create modded --type FABRIC --version 1.21.1

# 플러그인용 (Paper)
mcctl create survival --type PAPER --version 1.21.1
```

### 모드/플러그인 설정

`mcctl config`를 사용하여 모드 및 플러그인 소스를 설정합니다:

```bash
# Modrinth 모드 (Fabric 예시)
mcctl config modded MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# CurseForge 모드 (.env에 API 키 필요)
mcctl config modded CURSEFORGE_FILES "jei,journeymap"

# SpigotMC 플러그인
mcctl config survival SPIGET_RESOURCES "28140,34315"

# 변경사항 적용
mcctl stop modded && mcctl start modded
```

!!! tip "재시작 필요"
    모드/플러그인 설정 변경 후 서버를 재시작해야 변경사항이 적용됩니다.

## 설치 소스

| 소스 | 적합한 용도 | API 키 필요 | mcctl 설정 키 |
|------|------------|------------|---------------|
| [Modrinth](modrinth.ko.md) | 최신 모드/플러그인 | 아니오 | `MODRINTH_PROJECTS` |
| [CurseForge](curseforge.ko.md) | 대규모 모드 라이브러리 | 예 | `CURSEFORGE_FILES` |
| [Spiget](spiget.ko.md) | SpigotMC 플러그인 | 아니오 | `SPIGET_RESOURCES` |
| [직접 다운로드](direct-download.ko.md) | 커스텀/비공개 파일 | 아니오 | `MODS` / `PLUGINS` |
| [모드팩](modpacks.ko.md) | 사전 구성된 컬렉션 | 다양함 | 서버 TYPE |

## 빠른 비교

### Modrinth vs CurseForge

| 기능 | Modrinth | CurseForge |
|------|----------|------------|
| API 키 | 불필요 | 필수 |
| 의존성 해결 | 자동 | 수동 |
| 버전 자동 감지 | 예 | 아니오 |
| 모드 라이브러리 규모 | 성장 중 | 최대 |
| 플러그인 지원 | 예 | 제한적 |

### 플러그인용 Spiget vs Modrinth

| 기능 | Spiget | Modrinth |
|------|--------|----------|
| 플랫폼 | SpigotMC 리소스 | Modrinth 프로젝트 |
| ID 형식 | 숫자형 리소스 ID | Slug 또는 프로젝트 ID |
| 의존성 지원 | 아니오 | 예 |
| 다운로드 제한 | 일부 플러그인 제한됨 | 없음 |

## mcctl로 설정하기

### 모드 소스 설정

```bash
# 현재 설정 보기
mcctl config myserver

# Modrinth 모드 추가
mcctl config myserver MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# 의존성 다운로드 활성화
mcctl config myserver MODRINTH_DOWNLOAD_DEPENDENCIES "required"

# 재시작하여 적용
mcctl stop myserver && mcctl start myserver
```

### 플러그인 소스 설정

```bash
# Modrinth 플러그인 (Paper 서버)
mcctl config survival MODRINTH_PROJECTS "luckperms,chunky,spark"

# SpigotMC 플러그인 (숫자 ID)
mcctl config survival SPIGET_RESOURCES "28140,34315,6245"

# 재시작하여 적용
mcctl stop survival && mcctl start survival
```

### 공유 디렉토리 사용

mcctl init은 모드와 플러그인을 위한 공유 디렉토리를 생성합니다:

```
~/minecraft-servers/
  shared/
    mods/       # 모드 JAR 파일 배치 (읽기 전용 마운트)
    plugins/    # 플러그인 JAR 파일 배치 (읽기 전용 마운트)
```

수동으로 다운로드한 파일을 이 디렉토리에 배치하세요. 모든 서버에 자동으로 마운트됩니다.

## 자동 정리

### 이전 모드 제거

새 콘텐츠 적용 전 이전 모드 자동 정리 설정:

```bash
mcctl config myserver REMOVE_OLD_MODS "TRUE"
```

### 특정 파일 제외

```bash
mcctl config myserver REMOVE_OLD_MODS_INCLUDE "*.jar"
mcctl config myserver REMOVE_OLD_MODS_EXCLUDE "keep-this-mod.jar"
```

## 하이브리드 서버

Cardboard (Fabric + Bukkit 플러그인) 같은 하이브리드 서버의 경우:

```bash
mcctl config myserver TYPE "FABRIC"
mcctl config myserver USES_PLUGINS "true"
```

## 환경 변수 처리

기본적으로 동기화된 설정 파일의 환경 변수가 처리됩니다. 비활성화하려면:

```bash
mcctl config myserver REPLACE_ENV_DURING_SYNC "false"
```

## 고급 설정 (수동)

mcctl config에서 지원하지 않는 복잡한 설정은 `config.env`를 직접 편집합니다:

```bash
# 서버 설정 파일 편집
nano ~/minecraft-servers/servers/myserver/config.env
```

`config.env` 예시:

```bash
# Modrinth 모드 (여러 줄 형식)
MODRINTH_PROJECTS=fabric-api
lithium
sodium
iris

# 의존성 설정
MODRINTH_DOWNLOAD_DEPENDENCIES=required
```

## 다음 단계

- [Modrinth 가이드](modrinth.ko.md) - Modrinth에서 다운로드
- [CurseForge 가이드](curseforge.ko.md) - CurseForge에서 다운로드
- [Spiget 가이드](spiget.ko.md) - SpigotMC 플러그인 다운로드
- [직접 다운로드 가이드](direct-download.ko.md) - URL에서 다운로드
- [모드팩 가이드](modpacks.ko.md) - 모드팩 설치

## 참고

- [서버 타입](../configuration/server-types.ko.md)
- [CLI 명령어 레퍼런스](../cli/commands.ko.md)
- [공식 itzg 문서](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/)
