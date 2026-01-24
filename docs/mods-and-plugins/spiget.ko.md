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
    환경 변수는 "SPIGOT"이 아닌 **SPIGET** (E 포함)을 사용합니다. Spiget은 SpigotMC 리소스에 프로그래밍 방식으로 접근할 수 있게 해주는 서드파티 API입니다.

## 기본 사용법

### SPIGET_RESOURCES

숫자형 리소스 ID를 사용하여 플러그인 다운로드:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"
      SPIGET_RESOURCES: "28140,34315"
    volumes:
      - ./data:/data
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
| WorldGuard | `https://www.spigotmc.org/resources/worldguard.13932/` | `13932` |

### 리소스 ID 찾는 방법

1. [SpigotMC 리소스](https://www.spigotmc.org/resources/)로 이동
2. 원하는 플러그인 검색
3. 플러그인을 클릭하여 페이지 열기
4. URL 확인: `https://www.spigotmc.org/resources/plugin-name.XXXXX/`
5. 끝에 있는 숫자 (XXXXX)가 리소스 ID

## 환경 변수

| 변수 | 설명 |
|------|------|
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

    이러한 플러그인의 경우 수동으로 파일을 다운로드하고 볼륨 마운트를 사용하세요.

### 수동 다운로드 대안

제한된 플러그인의 경우:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
    volumes:
      - ./data:/data
      - ./plugins:/plugins:ro  # 수동으로 다운로드한 플러그인 마운트
```

그런 다음 수동으로 다운로드한 JAR 파일을 `./plugins` 디렉토리에 배치합니다.

## 전체 예시

### 여러 플러그인이 있는 Paper 서버

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"
      MEMORY: "4G"
      SPIGET_RESOURCES: "28140,34315,6245"  # LuckPerms, Vault, PlaceholderAPI
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```

### Modrinth 플러그인과 결합

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"

      # Spiget 플러그인
      SPIGET_RESOURCES: "28140,34315"  # LuckPerms, Vault

      # Modrinth 플러그인
      MODRINTH_PROJECTS: |
        chunky
        spark
    volumes:
      - ./data:/data
```

### 수동 플러그인과 결합

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"

      # Spiget 플러그인 (자동 다운로드 허용)
      SPIGET_RESOURCES: "28140,34315"
    volumes:
      - ./data:/data
      - ./plugins:/plugins:ro  # EssentialsX 및 기타 제한된 플러그인
```

## 인기 SpigotMC 플러그인

| 플러그인 | 리소스 ID | 설명 |
|----------|-----------|------|
| LuckPerms | 28140 | 권한 관리 |
| Vault | 34315 | 경제/권한 API |
| PlaceholderAPI | 6245 | 플레이스홀더 확장 |
| WorldEdit | 13932 | 월드 편집 도구 |
| WorldGuard | 13932 | 지역 보호 |
| CoreProtect | 8631 | 블록 로깅 |
| Multiverse-Core | 390 | 다중 월드 |
| SkinsRestorer | 2124 | 스킨 관리 |

!!! info "플러그인 호환성"
    서버에 추가하기 전에 항상 SpigotMC 페이지에서 마인크래프트 버전과의 플러그인 호환성을 확인하세요.

## 문제 해결

### 일반적인 문제

| 문제 | 원인 | 해결책 |
|------|------|--------|
| 플러그인이 다운로드되지 않음 | 다운로드 제한됨 | 볼륨 마운트로 수동 다운로드 사용 |
| 잘못된 플러그인 버전 | Spiget이 최신 선택 | 최신이 MC 버전을 지원하는지 확인 |
| 플러그인이 로드되지 않음 | 의존성 누락 | 플러그인 요구사항 확인 후 추가 |
| 리소스를 찾을 수 없음 | 유효하지 않은 리소스 ID | SpigotMC URL에서 ID 확인 |

### 디버그 로깅

문제 해결을 위한 디버그 출력 활성화:

```yaml
environment:
  DEBUG: "true"
```

### Spiget API 확인

리소스가 존재하고 사용 가능한지 확인:

```bash
curl "https://api.spiget.org/v2/resources/28140"
```

## 참고

- [SpigotMC 리소스](https://www.spigotmc.org/resources/)
- [Spiget API 문서](https://spiget.org/)
- [모드 및 플러그인 개요](index.ko.md)
- [Modrinth 가이드](modrinth.ko.md)
- [직접 다운로드 가이드](direct-download.ko.md)
- [공식 itzg 문서](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/spiget/)
