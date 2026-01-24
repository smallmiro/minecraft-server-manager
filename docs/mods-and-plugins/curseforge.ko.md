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

## mcctl 빠른 시작

### 1단계: API 키 발급

1. [CurseForge API 콘솔](https://console.curseforge.com/)로 이동
2. 로그인하고 API 키 생성
3. 플랫폼 `.env` 파일에 키 추가:

```bash
# 전역 환경 파일 편집
nano ~/minecraft-servers/.env

# 다음 라인 추가
CF_API_KEY=your_api_key_here
```

### 2단계: 서버 생성 및 모드 추가

```bash
# Forge 서버 생성
mcctl create modded --type FORGE --version 1.20.4

# CurseForge 모드 추가
mcctl config modded CURSEFORGE_FILES "jei,journeymap,jade"

# 재시작하여 변경사항 적용
mcctl stop modded && mcctl start modded
```

!!! warning "API 키 필수"
    CurseForge는 모든 다운로드에 API 키가 필요합니다. 키는 `.env` 파일에 설정해야 합니다.

## API 키 발급

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
    - `.env`를 `.gitignore` 파일에 추가하세요

### 4단계: API 키 설정

플랫폼의 `.env` 파일에 API 키를 추가합니다:

```bash
# .env 파일 편집
nano ~/minecraft-servers/.env

# API 키 추가
CF_API_KEY=your_api_key_here
```

!!! tip "API 키의 $ 이스케이프"
    API 키에 `$`가 포함된 경우 `.env` 파일에서 `$$`로 이스케이프합니다.

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

!!! tip "프로젝트 ID 찾기"
    1. CurseForge의 모드 페이지로 이동
    2. "About Project" 섹션까지 스크롤
    3. "Project ID" 찾기 (예: JEI의 경우 238222)

## mcctl로 설정하기

### 기본 설정

```bash
# 모드 추가 (쉼표 구분)
mcctl config myserver CURSEFORGE_FILES "jei,journeymap,jade"

# 재시작하여 적용
mcctl stop myserver && mcctl start myserver
```

### 특정 버전

```bash
# 특정 파일 ID로 고정
mcctl config myserver CURSEFORGE_FILES "jei:4593548,journeymap:4596105"

# 버전 문자열로 고정
mcctl config myserver CURSEFORGE_FILES "jei@10.2.1.1005"
```

### 혼합 참조

```bash
# 다양한 참조 형식을 함께 사용
mcctl config myserver CURSEFORGE_FILES "jei,journeymap:4596105,238222"
```

## 설정 레퍼런스

| 설정 키 | 설명 |
|--------|------|
| `CURSEFORGE_FILES` | 쉼표/공백/줄바꿈으로 구분된 모드 참조 목록 |

!!! note "API 키 위치"
    `CF_API_KEY`는 개별 서버 `config.env` 파일이 아닌 플랫폼 `.env` 파일에 설정합니다.

## 전체 예제

### Forge 모드 서버

```bash
# 서버 생성
mcctl create modded --type FORGE --version 1.20.4

# 모드 설정
mcctl config modded CURSEFORGE_FILES "jei,journeymap,jade,mouse-tweaks,appleskin"
mcctl config modded MEMORY "6G"

# 서버 시작
mcctl start modded
```

### 혼합 소스 (CurseForge + Modrinth)

```bash
# Fabric 서버 생성
mcctl create mixed --type FABRIC --version 1.21.1

# CurseForge 모드 (API 키 필요)
mcctl config mixed CURSEFORGE_FILES "jei,journeymap"

# Modrinth 모드 (API 키 불필요)
mcctl config mixed MODRINTH_PROJECTS "fabric-api,sodium,lithium"

# 재시작하여 적용
mcctl stop mixed && mcctl start mixed
```

### 재현성을 위한 고정 버전

```bash
# 일관된 빌드를 위해 특정 파일 버전 고정
mcctl config myserver CURSEFORGE_FILES "jei:4593548,journeymap:4596105,jade:4587399"
```

## 자동 제거 및 업그레이드

- 새 버전이 있으면 파일이 자동으로 **업그레이드**됨
- **제거된** 참조는 자동으로 정리됨
- 모든 CurseForge 모드를 제거하려면:

```bash
# 모든 CurseForge 모드 제거
mcctl config myserver CURSEFORGE_FILES ""
mcctl stop myserver && mcctl start myserver
```

## 의존성

!!! warning "수동 의존성 관리"
    CurseForge는 누락된 의존성을 감지할 수 있지만 자동으로 해결할 수 없습니다.

    필수 의존성을 `CURSEFORGE_FILES`에 수동으로 추가해야 합니다.

예: JEI가 Forge API를 필요로 하면 둘 다 추가해야 합니다:

```bash
mcctl config myserver CURSEFORGE_FILES "jei,forge-api"
```

## 고급 설정 (수동)

복잡한 설정의 경우 `config.env`를 직접 편집합니다:

```bash
nano ~/minecraft-servers/servers/myserver/config.env
```

`config.env` 예시:

```bash
# CurseForge 모드 (여러 줄 형식)
CURSEFORGE_FILES=jei
journeymap
jade
mouse-tweaks
appleskin
storage-drawers
```

### 목록 파일 사용

매우 큰 모드 목록의 경우:

```bash
# 모드 목록 파일 생성
nano ~/minecraft-servers/servers/myserver/data/cf-mods.txt
```

`cf-mods.txt` 내용:

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

그런 다음 `config.env`에서 참조합니다:

```bash
CURSEFORGE_FILES=@/data/cf-mods.txt
```

## 문제 해결

### 일반적인 문제

| 문제 | 원인 | 해결방법 |
|------|------|----------|
| 401 Unauthorized | 유효하지 않거나 누락된 API 키 | `.env`의 `CF_API_KEY` 확인 |
| 403 Forbidden | API 키에 권한 없음 | 콘솔에서 API 키 재생성 |
| 모드를 찾을 수 없음 | 잘못된 slug 또는 ID | CurseForge URL에서 확인 |
| 버전 불일치 | 모드가 서버 버전을 지원하지 않음 | 호환되는 버전의 특정 파일 ID 사용 |
| 의존성 누락 | 의존성이 해결되지 않음 | 필수 모드를 수동으로 추가 |

### API 키 설정 확인

```bash
# .env 파일 확인 (출력 내용을 공유하지 마세요!)
cat ~/minecraft-servers/.env | grep CF_API_KEY
```

### 현재 설정 확인

```bash
# 모든 설정 보기
mcctl config myserver

# 특정 설정 보기
mcctl config myserver CURSEFORGE_FILES
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
- [CLI 명령어 레퍼런스](../cli/commands.ko.md)
- [공식 itzg 문서](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/curseforge-files/)
