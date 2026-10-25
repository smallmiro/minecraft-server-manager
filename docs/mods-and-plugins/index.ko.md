# 모드 및 플러그인

mcctl CLI를 사용하여 마인크래프트 서버에 모드와 플러그인을 설치하는 가이드입니다.

## 개요

| 유형 | 설명 | 서버 타입 |
|------|------|----------|
| **모드(Mods)** | 게임 메커니즘 수정, 클라이언트 설치 필요 | Forge, NeoForge, Fabric, Quilt |
| **플러그인(Plugins)** | 서버 측만 적용, 클라이언트 변경 불필요 | Paper, Purpur, Spigot, Bukkit, Leaf, Folia, Pufferfish |

## mcctl 빠른 시작

### 모드 지원 서버 생성

먼저 모드 또는 플러그인에 적합한 타입으로 서버를 생성합니다:

```bash
# 모드용 (Forge/Fabric)
mcctl create modded -t FABRIC -v 1.21.1

# 플러그인용 (Paper)
mcctl create survival -t PAPER -v 1.21.1
```

### 모드/플러그인 설정

`mcctl config`를 사용하여 모드 및 플러그인 소스를 설정합니다:

```bash
# Modrinth 모드 (Fabric 예시)
mcctl config modded MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# CurseForge 모드 (Java 17+ 이미지에서는 CF_API_KEY 선택 사항)
mcctl config modded CURSEFORGE_FILES "jei,journeymap"

# SpigotMC 플러그인
mcctl config survival SPIGET_RESOURCES "28140,34315"

# 변경사항 적용
mcctl stop modded && mcctl start modded
```

!!! tip "재시작 필요"
    모드/플러그인 설정 변경 후 서버를 재시작해야 변경사항이 적용됩니다.

### mcctl mod 사용

`mcctl mod`가 같은 키를 대신 씁니다:

```bash
# Modrinth 검색
mcctl mod search sodium

# Modrinth 프로젝트 추가 (mcctl이 Modrinth에서 slug를 확인)
mcctl mod add modded fabric-api lithium

# 다른 소스
mcctl mod add modded --curseforge jei journeymap
mcctl mod add survival --spiget 28140
mcctl mod add modded --url https://example.com/custom-mod.jar

# 목록 확인과 제거
mcctl mod list modded
mcctl mod remove modded lithium
```

`--curseforge`는 `CURSEFORGE_FILES`, `--spiget`은 `SPIGET_RESOURCES`에 쓰고, `--url`은 플러그인 서버에서는 `PLUGINS`, 나머지에서는 `MODS`에 씁니다. 모드팩 타입을 포함해 [개요](#개요) 표에 없는 서버 타입에는 `mcctl mod add`가 `--force`를 요구합니다. 추가한 뒤 서버를 재시작하세요.

## 설치 소스

| 소스 | 적합한 용도 | API 키 필요 | mcctl 설정 키 |
|------|------------|------------|---------------|
| [Modrinth](modrinth.ko.md) | 최신 모드/플러그인 | 아니오 | `MODRINTH_PROJECTS` |
| [CurseForge](curseforge.ko.md) | 대규모 모드 라이브러리 | 아니오 (Java 17+ 이미지는 내장) | `CURSEFORGE_FILES` |
| [Spiget](spiget.ko.md) | SpigotMC 플러그인 | 아니오 | `SPIGET_RESOURCES` |
| [직접 다운로드](direct-download.ko.md) | 커스텀/비공개 파일 | 아니오 | `MODS` / `PLUGINS` |
| [모드팩](modpacks.ko.md) | 사전 구성된 컬렉션 | 다양함 | 서버 TYPE |

## 빠른 비교

### Modrinth vs CurseForge

| 기능 | Modrinth | CurseForge |
|------|----------|------------|
| API 키 | 불필요 | 선택 사항 (Java 17+ 이미지는 내장) |
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

`mcctl init`은 `shared/plugins/`를 만들며, 모든 서버가 이를 `/plugins`에 읽기 전용으로 마운트합니다. 이미지는 서버가 시작할 때 이 jar들을 서버의 `plugins/` 폴더로 복사합니다.

```
~/minecraft-servers/
  shared/
    plugins/                 # 모든 서버용 플러그인 JAR (읽기 전용 마운트)
  servers/<name>/data/
    mods/                    # 서버 하나용 모드 JAR
```

수동으로 내려받은 플러그인은 `shared/plugins/`에 넣으세요. 모드 JAR는 해당 서버의 `servers/<name>/data/mods/`에 넣거나, 다운로드 URL을 `MODS`에 나열합니다([직접 다운로드](direct-download.ko.md) 참고).

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

기본적으로 동기화로 복사되는 파일의 환경 변수는 처리되지 않습니다. 활성화하려면:

```bash
mcctl config myserver REPLACE_ENV_DURING_SYNC "true"
```

## 고급 설정 (수동)

mcctl config에서 지원하지 않는 복잡한 설정은 `config.env`를 직접 편집합니다:

```bash
# 서버 설정 파일 편집
nano ~/minecraft-servers/servers/myserver/config.env
```

`config.env` 예시:

```bash
# Modrinth 모드 (한 줄, 쉼표 구분)
MODRINTH_PROJECTS=fabric-api,lithium,sodium,iris

# 의존성 설정
MODRINTH_DOWNLOAD_DEPENDENCIES=required
```

값은 한 줄에 써야 합니다. 목록이 길면 목록 파일을 사용하세요([목록 파일 사용](modrinth.ko.md#목록-파일-사용) 참고). 손으로 고친 내용은 다음에 mcctl이 그 서버를 바꿀 때 `server.yaml`로 가져옵니다.

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
