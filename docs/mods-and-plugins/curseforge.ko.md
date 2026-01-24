# CurseForge

[CurseForge](https://www.curseforge.com/minecraft)에서 모드와 플러그인을 다운로드합니다 - 가장 큰 모드 호스팅 플랫폼입니다.

## 개요

| 기능 | 값 |
|------|-----|
| 공식 웹사이트 | [https://www.curseforge.com/minecraft](https://www.curseforge.com/minecraft) |
| API 키 필요 | **예** |
| API 콘솔 | [https://console.curseforge.com/](https://console.curseforge.com/) |
| 의존성 해결 | 수동 (메타데이터만 제공) |
| 모드 라이브러리 규모 | 최대 |

## API 키 발급

!!! warning "API 키 필수"
    CurseForge는 모든 다운로드에 API 키가 필요합니다. CurseForge 기능을 사용하기 전에 반드시 발급받아야 합니다.

### 1단계: CurseForge 계정 생성

1. [CurseForge](https://www.curseforge.com/)로 이동
2. "Sign In" 또는 "Register" 클릭
3. 가입 절차 완료

### 2단계: API 콘솔 접속

1. [https://console.curseforge.com/](https://console.curseforge.com/)로 이동
2. CurseForge 계정으로 로그인
3. API 이용약관 동의

### 3단계: API 키 생성

1. "Create API Key" 클릭 또는 API Keys 섹션으로 이동
2. 키에 설명적인 이름 부여 (예: "Minecraft Docker Server")
3. 생성된 API 키를 즉시 복사

!!! danger "보안"
    - API 키를 안전하게 저장하세요
    - API 키를 버전 관리에 커밋하지 마세요
    - 환경 변수 또는 Docker secrets 사용

### 4단계: API 키 설정

=== "환경 변수"

    ```yaml
    environment:
      CF_API_KEY: "${CF_API_KEY}"
    ```

    쉘 또는 `.env` 파일에서 설정:
    ```bash
    export CF_API_KEY=your_api_key_here
    ```

=== "Docker Secrets"

    ```yaml
    services:
      mc:
        secrets:
          - cf_api_key
        environment:
          CF_API_KEY_FILE: /run/secrets/cf_api_key

    secrets:
      cf_api_key:
        file: ./cf_api_key.txt
    ```

=== ".env 파일"

    ```bash
    # .env
    CF_API_KEY=your_api_key_here
    ```

    ```yaml
    # docker-compose.yml
    environment:
      CF_API_KEY: "${CF_API_KEY}"
    ```

!!! tip "Docker Compose에서 $ 이스케이프"
    API 키에 `$`가 포함된 경우 `$$`로 이스케이프:
    ```yaml
    CF_API_KEY: "abc$$def$$ghi"
    ```

## 기본 사용법

### CURSEFORGE_FILES

다양한 참조 형식을 사용하여 모드/플러그인 다운로드:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      VERSION: "1.20.1"
      CF_API_KEY: "${CF_API_KEY}"
      CURSEFORGE_FILES: |
        jei
        journeymap
        jade
    volumes:
      - ./data:/data
```

## 지원되는 참조 형식

| 형식 | 설명 | 예시 |
|------|------|------|
| 프로젝트 URL | 모드 페이지 전체 URL | `https://www.curseforge.com/minecraft/mc-mods/jei` |
| 파일 URL | 특정 파일이 포함된 URL | `https://www.curseforge.com/minecraft/mc-mods/jei/files/4593548` |
| Slug | URL의 짧은 식별자 | `jei` |
| 프로젝트 ID | 숫자형 프로젝트 식별자 | `238222` |
| Slug:FileID | 특정 파일이 포함된 슬러그 | `jei:4593548` |
| ID:FileID | 파일 ID가 포함된 프로젝트 ID | `238222:4593548` |
| Slug@Version | 버전 문자열이 포함된 슬러그 | `jei@10.2.1.1005` |
| @ListingFile | 목록 파일 경로 | `@/extras/cf-mods.txt` |

!!! tip "프로젝트 ID 찾기"
    1. CurseForge의 모드 페이지로 이동
    2. "About Project" 섹션까지 스크롤
    3. "Project ID" 찾기 (예: JEI의 경우 238222)

### 참조 형식 예시

```yaml
environment:
  CF_API_KEY: "${CF_API_KEY}"
  CURSEFORGE_FILES: |
    # URL 형식
    https://www.curseforge.com/minecraft/mc-mods/jei
    https://www.curseforge.com/minecraft/mc-mods/jei/files/4593548

    # Slug (호환되는 최신 버전 자동 선택)
    journeymap

    # 프로젝트 ID
    238222

    # 특정 파일 ID
    jei:4593548
    238222:4593548

    # 특정 버전 문자열
    jei@10.2.1.1005
```

## 목록 파일 사용

### 파일 형식

`/extras/cf-mods.txt`에 목록 파일 생성:

```text
# 핵심 모드
jei
journeymap

# 유틸리티 모드
jade
mouse-tweaks

# 특정 버전
create:5678901
```

### 목록 파일 참조

```yaml
environment:
  CF_API_KEY: "${CF_API_KEY}"
  CURSEFORGE_FILES: "@/extras/cf-mods.txt"
volumes:
  - ./extras:/extras:ro
```

!!! note "목록 파일 요구사항"
    - 마운트된 디렉토리에 있어야 함
    - 주석은 `#`으로 시작
    - 빈 줄은 무시됨

## 자동 제거 및 업그레이드

- 새 버전이 있으면 파일이 자동으로 **업그레이드**됨
- **제거된** 참조는 자동으로 정리됨
- `CURSEFORGE_FILES`를 빈 문자열로 설정하면 모든 관리 파일 제거

## 의존성

!!! warning "수동 의존성 관리"
    CurseForge는 누락된 의존성을 감지할 수 있지만 자동으로 해결할 수 없습니다. 메타데이터는 모드 ID만 제공하고 필요한 특정 파일 버전은 제공하지 않습니다.

    필수 의존성을 `CURSEFORGE_FILES`에 수동으로 추가해야 합니다.

## 전체 예시

### Forge 모드 서버

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      VERSION: "1.20.1"
      MEMORY: "6G"
      CF_API_KEY: "${CF_API_KEY}"
      CURSEFORGE_FILES: |
        jei
        journeymap
        jade
        mouse-tweaks
        appleskin
        storage-drawers
        refined-storage
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```

### 혼합 소스 (CurseForge + Modrinth)

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"

      # CurseForge 모드
      CF_API_KEY: "${CF_API_KEY}"
      CURSEFORGE_FILES: |
        jei
        journeymap

      # Modrinth 모드
      MODRINTH_PROJECTS: |
        fabric-api
        sodium
        lithium
    volumes:
      - ./data:/data
```

### 고정 버전

재현 가능한 빌드를 위해 특정 파일 버전 고정:

```yaml
environment:
  CF_API_KEY: "${CF_API_KEY}"
  CURSEFORGE_FILES: |
    jei:4593548
    journeymap:4596105
    jade:4587399
```

## 환경 변수 참조

| 변수 | 설명 |
|------|------|
| `CF_API_KEY` | CurseForge API 키 (필수) |
| `CF_API_KEY_FILE` | API 키가 포함된 파일 경로 |
| `CURSEFORGE_FILES` | 쉼표/공백/줄바꿈으로 구분된 모드 참조 목록 |

## 문제 해결

### 일반적인 문제

| 문제 | 원인 | 해결책 |
|------|------|--------|
| 401 Unauthorized | 유효하지 않거나 누락된 API 키 | `CF_API_KEY`가 올바르게 설정되었는지 확인 |
| 403 Forbidden | API 키에 권한 없음 | 콘솔에서 API 키 재생성 |
| 모드를 찾을 수 없음 | 잘못된 슬러그 또는 ID | CurseForge URL에서 확인 |
| 버전 불일치 | 모드가 서버 버전을 지원하지 않음 | 호환되는 버전의 특정 파일 ID 사용 |
| 의존성 누락 | 의존성이 해결되지 않음 | 필수 모드를 수동으로 추가 |

### 디버그 로깅

문제 해결을 위한 디버그 출력 활성화:

```yaml
environment:
  DEBUG: "true"
```

### API 키 확인

curl로 API 키 테스트:

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://api.curseforge.com/v1/mods/238222"
```

## 참고

- [CurseForge 공식 웹사이트](https://www.curseforge.com/minecraft)
- [CurseForge API 콘솔](https://console.curseforge.com/)
- [모드 및 플러그인 개요](index.ko.md)
- [Modrinth 가이드](modrinth.ko.md)
- [모드팩 가이드](modpacks.ko.md)
- [공식 itzg 문서](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/curseforge-files/)
