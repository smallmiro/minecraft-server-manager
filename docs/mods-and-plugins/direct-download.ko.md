# 직접 다운로드

URL에서 직접 모드와 플러그인을 다운로드하거나 로컬 파일을 마운트합니다.

## 개요

| 기능 | 값 |
|------|-----|
| API 키 필요 | 아니오 |
| 지원 | 접근 가능한 모든 URL 또는 로컬 파일 |
| 사용 사례 | 커스텀 모드, 비공개 파일, 직접 URL |

## 방법

| 방법 | 설명 | 사용 사례 |
|------|------|----------|
| `MODS` / `PLUGINS` | 직접 URL 목록 | 간단한 URL 기반 다운로드 |
| `MODS_FILE` / `PLUGINS_FILE` | URL이 포함된 파일 | 정리된 URL 목록 |
| 볼륨 마운트 | 로컬 디렉토리 | 로컬 또는 수동 다운로드 파일 |

## URL 기반 다운로드

### MODS 및 PLUGINS 변수

URL에서 직접 모드 또는 플러그인 다운로드:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"
      MODS: |
        https://example.com/custom-mod.jar
        https://github.com/user/repo/releases/download/v1.0/mod.jar
    volumes:
      - ./data:/data
```

### 지원되는 구분자

URL은 다음으로 구분할 수 있습니다:

- 쉼표: `url1,url2,url3`
- 공백: `url1 url2 url3`
- 줄바꿈 (YAML 다중 행)

### 플러그인 예시

```yaml
environment:
  TYPE: "PAPER"
  PLUGINS: |
    https://example.com/plugin1.jar
    https://example.com/plugin2.jar
```

## 파일 기반 목록

### MODS_FILE 및 PLUGINS_FILE

URL이 포함된 파일 참조:

```yaml
environment:
  MODS_FILE: "/data/mods.txt"
  PLUGINS_FILE: "/data/plugins.txt"
```

### 파일 형식

`/data/mods.txt` 생성:

```text
# 성능 모드
https://example.com/lithium.jar
https://example.com/phosphor.jar

# 유틸리티 모드
https://example.com/mod-menu.jar

# #으로 시작하는 주석은 무시됨
# 빈 줄도 무시됨

# 특수 접두사도 사용 가능
modrinth:fabric-api
curseforge:jei
```

### 원격 파일 목록

원격 파일 목록도 참조할 수 있습니다:

```yaml
environment:
  MODS_FILE: "https://example.com/server-mods.txt"
  PLUGINS_FILE: "https://gist.githubusercontent.com/user/id/raw/plugins.txt"
```

### 특수 접두사

파일 목록은 다양한 소스에 대한 특수 접두사를 지원합니다:

| 접두사 | 설명 | 예시 |
|--------|------|------|
| `modrinth:` | Modrinth 프로젝트 | `modrinth:fabric-api` |
| `curseforge:` | CurseForge 프로젝트 | `curseforge:jei` |
| (없음) | 직접 URL | `https://example.com/mod.jar` |

## 볼륨 마운트

### 읽기 전용 마운트

모드 또는 플러그인이 포함된 로컬 디렉토리 마운트:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
    volumes:
      - ./data:/data
      - ./mods:/mods:ro      # 읽기 전용
      - ./plugins:/plugins:ro
```

!!! tip "읽기 전용 권장"
    서버가 소스 파일을 수정하지 못하도록 `:ro` (읽기 전용)를 사용하세요.

### 마운트 포인트

| 컨테이너 경로 | 동기화 대상 | 용도 |
|---------------|-------------|------|
| `/mods` | `/data/mods` | 모드 파일 (Forge, Fabric) |
| `/plugins` | `/data/plugins` | 플러그인 파일 (Paper, Spigot) |
| `/config` | `/data/config` | 설정 파일 |

### 동기화 경로 커스터마이징

소스 또는 대상 경로 변경:

```yaml
environment:
  COPY_MODS_SRC: "/custom-mods"
  COPY_MODS_DEST: "/data/mods"
  COPY_PLUGINS_SRC: "/custom-plugins"
  COPY_PLUGINS_DEST: "/data/plugins"
  COPY_CONFIG_DEST: "/data/config"
volumes:
  - ./my-mods:/custom-mods:ro
  - ./my-plugins:/custom-plugins:ro
```

## 컨테이너 경로 참조

컨테이너 내 파일 참조:

```yaml
environment:
  MODS: |
    /extras/custom-mod.jar
    https://example.com/other-mod.jar
volumes:
  - ./extras:/extras:ro
```

## 전체 예시

### GitHub 릴리스 다운로드

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"
      MODS: |
        https://github.com/CaffeineMC/sodium-fabric/releases/download/mc1.20.4-0.5.8/sodium-fabric-0.5.8+mc1.20.4.jar
        https://github.com/CaffeineMC/lithium-fabric/releases/download/mc1.20.4-0.12.1/lithium-fabric-mc1.20.4-0.12.1.jar
    volumes:
      - ./data:/data
```

### 혼합 소스

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"

      # 직접 URL
      MODS: |
        https://example.com/custom-mod.jar

      # 파일 기반 목록
      MODS_FILE: "/data/extra-mods.txt"

      # Modrinth 모드
      MODRINTH_PROJECTS: |
        fabric-api
        sodium
    volumes:
      - ./data:/data
```

### 로컬 개발 설정

로컬 빌드를 사용한 모드 개발용:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"
      REMOVE_OLD_MODS: "TRUE"  # 재시작 시 정리
    volumes:
      - ./data:/data
      - ../my-mod/build/libs:/mods:ro  # 빌드 출력 마운트
```

### 공유 플러그인이 있는 서버 네트워크

```yaml
services:
  lobby:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
    volumes:
      - ./lobby-data:/data
      - ./shared-plugins:/plugins:ro

  survival:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
    volumes:
      - ./survival-data:/data
      - ./shared-plugins:/plugins:ro
```

## 환경 변수 참조

| 변수 | 설명 |
|------|------|
| `MODS` | 쉼표/공백/줄바꿈으로 구분된 모드 URL 또는 컨테이너 경로 |
| `PLUGINS` | 쉼표/공백/줄바꿈으로 구분된 플러그인 URL 또는 컨테이너 경로 |
| `MODS_FILE` | 모드 URL이 포함된 파일 경로 또는 URL |
| `PLUGINS_FILE` | 플러그인 URL이 포함된 파일 경로 또는 URL |
| `COPY_MODS_SRC` | 모드 소스 디렉토리 (기본값: `/mods`) |
| `COPY_MODS_DEST` | 모드 대상 디렉토리 (기본값: `/data/mods`) |
| `COPY_PLUGINS_SRC` | 플러그인 소스 디렉토리 (기본값: `/plugins`) |
| `COPY_PLUGINS_DEST` | 플러그인 대상 디렉토리 (기본값: `/data/plugins`) |

## 문제 해결

### 일반적인 문제

| 문제 | 원인 | 해결책 |
|------|------|--------|
| 다운로드 실패 | 유효하지 않은 URL 또는 네트워크 문제 | URL 접근성 확인 |
| 파일을 찾을 수 없음 | 잘못된 컨테이너 경로 | 볼륨 마운트 설정 확인 |
| 권한 거부 | 파일 권한 | 파일이 읽기 가능한지 확인 |
| 모드가 로드되지 않음 | 잘못된 서버 타입 | TYPE이 모드 로더와 일치하는지 확인 |

### 디버그 로깅

문제 해결을 위한 디버그 출력 활성화:

```yaml
environment:
  DEBUG: "true"
```

### URL 접근성 확인

URL 접근성 테스트:

```bash
curl -I "https://example.com/mod.jar"
```

## 참고

- [모드 및 플러그인 개요](index.ko.md)
- [Modrinth 가이드](modrinth.ko.md)
- [CurseForge 가이드](curseforge.ko.md)
- [Spiget 가이드](spiget.ko.md)
- [공식 itzg 문서](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/)
