# Spiget (SpigotMC)

[Spiget API](https://spiget.org/)를 사용하여 [SpigotMC](https://www.spigotmc.org/)에서 플러그인을 다운로드합니다.

## 개요

| 기능 | 값 |
|------|-----|
| 공식 웹사이트 | [https://www.spigotmc.org/](https://www.spigotmc.org/) |
| Spiget API | [https://spiget.org/](https://spiget.org/) |
| API 키 필요 | 아니오 |
| 지원 타입 | 플러그인만 |
| 서버 타입 | Paper, Spigot, Bukkit |

!!! note "Spiget vs Spigot"
    설정 키는 "SPIGOT"이 아닌 **SPIGET** (E 포함)을 사용합니다. Spiget은 SpigotMC 리소스에 프로그래밍 방식으로 접근할 수 있게 해주는 서드파티 API입니다.

## mcctl 빠른 시작

### 서버 생성 및 플러그인 추가

```bash
# Paper 서버 생성
mcctl create survival --type PAPER --version 1.21.1

# SpigotMC 플러그인 추가 (숫자 리소스 ID 사용)
mcctl config survival SPIGET_RESOURCES "28140,34315,6245"

# 재시작하여 변경사항 적용
mcctl stop survival && mcctl start survival
```

## 리소스 ID 찾기

리소스 ID는 SpigotMC 리소스 URL 끝에 있는 숫자 부분입니다.

### 예시

| 플러그인 | URL | 리소스 ID |
|----------|-----|-----------|
| LuckPerms | `https://www.spigotmc.org/resources/luckperms.28140/` | `28140` |
| Vault | `https://www.spigotmc.org/resources/vault.34315/` | `34315` |
| PlaceholderAPI | `https://www.spigotmc.org/resources/placeholderapi.6245/` | `6245` |
| WorldEdit | `https://www.spigotmc.org/resources/worldedit.13932/` | `13932` |
| CoreProtect | `https://www.spigotmc.org/resources/coreprotect.8631/` | `8631` |

### 리소스 ID 찾는 방법

1. [SpigotMC 리소스](https://www.spigotmc.org/resources/)로 이동
2. 원하는 플러그인 검색
3. 플러그인을 클릭하여 페이지 열기
4. URL 확인: `https://www.spigotmc.org/resources/plugin-name.XXXXX/`
5. 끝에 있는 숫자 (XXXXX)가 리소스 ID

## mcctl로 설정하기

### 기본 설정

```bash
# 플러그인 추가 (쉼표로 구분된 숫자 ID)
mcctl config myserver SPIGET_RESOURCES "28140,34315,6245"

# 재시작하여 적용
mcctl stop myserver && mcctl start myserver
```

### 현재 설정 확인

```bash
# 모든 설정 보기
mcctl config myserver

# Spiget 리소스 보기
mcctl config myserver SPIGET_RESOURCES
```

## 설정 레퍼런스

| 설정 키 | 설명 |
|--------|------|
| `SPIGET_RESOURCES` | 쉼표로 구분된 SpigotMC 리소스 ID 목록 |

## 파일 처리

Spiget API는 다양한 파일 타입을 자동으로 처리합니다:

| 파일 타입 | 동작 |
|-----------|------|
| `.jar` 파일 | plugins 디렉토리로 직접 이동 |
| `.zip` 파일 | plugins 디렉토리에 압축 해제 |

## 제한 사항

!!! warning "다운로드 제한"
    SpigotMC의 일부 플러그인은 Spiget을 통한 자동 다운로드를 제한합니다. 이러한 플러그인은 Spiget이 제공할 수 없는 외부 다운로드 인증이 필요합니다.

    **제한된 플러그인 예시:**

    - EssentialsX (ID: 9089)
    - 일부 프리미엄 플러그인

    이러한 플러그인의 경우 수동으로 다운로드하고 공유 플러그인 디렉토리를 사용하세요.

### 수동 다운로드 대안

제한된 플러그인의 경우 공유 플러그인 디렉토리를 사용합니다:

```bash
# 플러그인을 수동으로 다운로드하고 공유 디렉토리에 배치
# 위치: ~/minecraft-servers/shared/plugins/

# 파일이 모든 서버에 자동으로 사용 가능
```

## 전체 예제

### 여러 플러그인이 있는 Paper 서버

```bash
# 서버 생성
mcctl create survival --type PAPER --version 1.21.1

# 플러그인 설정
mcctl config survival SPIGET_RESOURCES "28140,34315,6245"
mcctl config survival MEMORY "4G"

# 서버 시작
mcctl start survival
```

### Modrinth 플러그인과 결합

```bash
# 서버 생성
mcctl create survival --type PAPER --version 1.21.1

# Spiget 플러그인 (SpigotMC)
mcctl config survival SPIGET_RESOURCES "28140,34315"

# Modrinth 플러그인 (추가)
mcctl config survival MODRINTH_PROJECTS "chunky,spark"

# 재시작하여 적용
mcctl stop survival && mcctl start survival
```

### 수동 플러그인과 결합

Spiget 다운로드가 제한된 플러그인의 경우:

1. SpigotMC에서 플러그인을 수동으로 다운로드
2. JAR 파일을 `~/minecraft-servers/shared/plugins/`에 배치
3. 플러그인이 모든 서버에서 사용 가능

```bash
# 서버 생성 (수동 플러그인이 자동으로 마운트됨)
mcctl create survival --type PAPER --version 1.21.1

# 작동하는 것들은 Spiget 플러그인으로 추가
mcctl config survival SPIGET_RESOURCES "28140,34315"

# shared/plugins/의 수동 플러그인은 자동으로 사용 가능
mcctl start survival
```

## 인기 SpigotMC 플러그인

| 플러그인 | 리소스 ID | 설명 |
|----------|-----------|------|
| LuckPerms | 28140 | 권한 관리 |
| Vault | 34315 | 경제/권한 API |
| PlaceholderAPI | 6245 | 플레이스홀더 확장 |
| WorldEdit | 13932 | 월드 편집 도구 |
| CoreProtect | 8631 | 블록 로깅 |
| Multiverse-Core | 390 | 다중 월드 |
| SkinsRestorer | 2124 | 스킨 관리 |
| DiscordSRV | 18494 | Discord 연동 |

!!! info "플러그인 호환성"
    서버에 추가하기 전에 항상 SpigotMC 페이지에서 마인크래프트 버전과의 플러그인 호환성을 확인하세요.

## 문제 해결

### 일반적인 문제

| 문제 | 원인 | 해결방법 |
|------|------|----------|
| 플러그인이 다운로드되지 않음 | 다운로드 제한됨 | 공유 디렉토리로 수동 다운로드 사용 |
| 잘못된 플러그인 버전 | Spiget이 최신 선택 | 최신이 MC 버전을 지원하는지 확인 |
| 플러그인이 로드되지 않음 | 의존성 누락 | 플러그인 요구사항 확인 후 추가 |
| 리소스를 찾을 수 없음 | 유효하지 않은 리소스 ID | SpigotMC URL에서 ID 확인 |

### 현재 설정 확인

```bash
# 모든 설정 보기
mcctl config myserver

# Spiget 리소스 보기
mcctl config myserver SPIGET_RESOURCES
```

### 서버 로그 보기

```bash
# 플러그인 로딩 오류 확인
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

### Spiget API 확인

리소스가 존재하고 사용 가능한지 확인:

```bash
curl "https://api.spiget.org/v2/resources/28140"
```

## 플러그인용 Modrinth vs Spiget

플러그인이 Modrinth와 SpigotMC 모두에서 사용 가능한 경우:

| 기능 | Modrinth | Spiget (SpigotMC) |
|------|----------|-------------------|
| ID 형식 | Slug (기억하기 쉬움) | 숫자 (기억하기 어려움) |
| 의존성 지원 | 예 | 아니오 |
| 다운로드 제한 | 없음 | 일부 플러그인 제한됨 |
| 권장 | **우선 사용** | Modrinth에 없을 때 사용 |

```bash
# 권장: 가능하면 Modrinth 사용
mcctl config myserver MODRINTH_PROJECTS "luckperms,chunky,spark"

# 대안: SpigotMC 전용 플러그인에 Spiget 사용
mcctl config myserver SPIGET_RESOURCES "390,2124"
```

## 참고

- [SpigotMC 리소스](https://www.spigotmc.org/resources/)
- [Spiget API 문서](https://spiget.org/)
- [모드 및 플러그인 개요](index.ko.md)
- [Modrinth 가이드](modrinth.ko.md)
- [직접 다운로드 가이드](direct-download.ko.md)
- [CLI 명령어 레퍼런스](../cli/commands.ko.md)
- [공식 itzg 문서](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/spiget/)
