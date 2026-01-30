# 직접 다운로드

URL에서 직접 모드와 플러그인을 다운로드하거나 로컬 파일을 사용합니다.

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
| 공유 디렉토리 | 로컬 디렉토리 | 로컬 또는 수동 다운로드 파일 |

## mcctl 빠른 시작

### 직접 URL 사용

```bash
# Fabric 서버 생성
mcctl create modded --type FABRIC --version 1.21.1

# 직접 URL로 모드 추가
mcctl config modded MODS "https://example.com/custom-mod.jar,https://github.com/user/repo/releases/download/v1.0/mod.jar"

# 재시작하여 적용
mcctl stop modded && mcctl start modded
```

### 공유 디렉토리 사용

mcctl은 모드와 플러그인을 위한 공유 디렉토리를 생성합니다:

```
~/minecraft-servers/
  shared/
    mods/       # 모드 JAR 파일 배치
    plugins/    # 플러그인 JAR 파일 배치
```

파일을 해당 디렉토리에 배치하면 모든 서버에서 자동으로 사용할 수 있습니다.

## mcctl로 설정하기

### MODS 변수

Forge/Fabric 서버의 경우 URL에서 모드 다운로드:

```bash
# 단일 모드
mcctl config myserver MODS "https://example.com/custom-mod.jar"

# 여러 모드 (쉼표로 구분)
mcctl config myserver MODS "https://example.com/mod1.jar,https://example.com/mod2.jar"

# 재시작하여 적용
mcctl stop myserver && mcctl start myserver
```

### PLUGINS 변수

Paper/Spigot 서버의 경우 URL에서 플러그인 다운로드:

```bash
# 단일 플러그인
mcctl config myserver PLUGINS "https://example.com/custom-plugin.jar"

# 여러 플러그인
mcctl config myserver PLUGINS "https://example.com/plugin1.jar,https://example.com/plugin2.jar"

# 재시작하여 적용
mcctl stop myserver && mcctl start myserver
```

### 지원되는 구분자

URL은 다음으로 구분할 수 있습니다:

- 쉼표: `url1,url2,url3`
- 공백: `url1 url2 url3`
- 줄바꿈 (config.env 다중 행 형식)

## 설정 레퍼런스

| 설정 키 | 설명 |
|--------|------|
| `MODS` | 쉼표/공백/줄바꿈으로 구분된 모드 URL 또는 컨테이너 경로 |
| `PLUGINS` | 쉼표/공백/줄바꿈으로 구분된 플러그인 URL 또는 컨테이너 경로 |

## 공유 디렉토리

### 디렉토리 구조

mcctl init은 다음과 같은 공유 디렉토리를 생성합니다:

```
~/minecraft-servers/
  shared/
    mods/       # 공유 모드 파일 (Forge, Fabric)
    plugins/    # 공유 플러그인 파일 (Paper, Spigot)
```

### 공유 디렉토리 사용

1. 적절한 디렉토리에 JAR 파일 배치
2. 파일이 모든 서버에 자동으로 마운트됨 (읽기 전용)
3. 설정 불필요

```bash
# 예시: 커스텀 모드 추가
cp ~/downloads/custom-mod.jar ~/minecraft-servers/shared/mods/

# 모든 Forge/Fabric 서버에서 자동으로 사용 가능
```

### 장점

- **서버 간 공유**: 하나의 파일로 모든 서버에서 사용
- **설정 불필요**: 파일만 디렉토리에 배치
- **읽기 전용 마운트**: 서버가 소스 파일을 수정할 수 없음
- **쉬운 업데이트**: 파일 교체 후 서버 재시작

## 전체 예제

### GitHub 릴리스 다운로드

```bash
# 서버 생성
mcctl create modded --type FABRIC --version 1.21.1

# GitHub 릴리스에서 모드 추가
mcctl config modded MODS "https://github.com/CaffeineMC/sodium-fabric/releases/download/mc1.21-0.6.0/sodium-fabric-0.6.0+mc1.21.jar"

# 재시작하여 적용
mcctl stop modded && mcctl start modded
```

### 혼합 소스

```bash
# 서버 생성
mcctl create modded --type FABRIC --version 1.21.1

# 커스텀 모드는 직접 URL
mcctl config modded MODS "https://example.com/custom-mod.jar"

# 인기 모드는 Modrinth
mcctl config modded MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# 재시작하여 적용
mcctl stop modded && mcctl start modded
```

### 로컬 개발 설정

로컬 빌드를 사용한 모드 개발용:

1. 모드 빌드
2. 공유 디렉토리에 복사
3. 서버 재시작

```bash
# 빌드된 모드를 공유 디렉토리에 복사
cp ~/my-mod/build/libs/my-mod-1.0.jar ~/minecraft-servers/shared/mods/

# 모드를 로드하기 위해 서버 재시작
mcctl stop modded && mcctl start modded
```

### 공유 플러그인이 있는 서버 네트워크

모든 서버가 `shared/plugins/`의 동일한 플러그인을 공유:

```bash
# 여러 서버 생성
mcctl create lobby --type PAPER --version 1.21.1
mcctl create survival --type PAPER --version 1.21.1
mcctl create creative --type PAPER --version 1.21.1

# 공유 플러그인 배치
cp luckperms.jar ~/minecraft-servers/shared/plugins/
cp vault.jar ~/minecraft-servers/shared/plugins/

# 이제 모든 서버에서 이 플러그인을 사용 가능
mcctl start --all
```

## 고급 설정 (수동)

복잡한 설정의 경우 `config.env`를 직접 편집:

```bash
nano ~/minecraft-servers/servers/myserver/config.env
```

`config.env` 예시:

```bash
# 직접 모드 URL (다중 행 형식)
MODS=https://example.com/mod1.jar
https://example.com/mod2.jar
https://github.com/user/repo/releases/download/v1.0/mod3.jar

# 자동 정리 설정
REMOVE_OLD_MODS=TRUE
```

### 파일 목록 사용

매우 큰 모드 목록의 경우:

```bash
# 모드 목록 파일 생성
nano ~/minecraft-servers/servers/myserver/data/mods.txt
```

`mods.txt` 내용:

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

그런 다음 `config.env`에서 MODS_FILE 설정:

```bash
MODS_FILE=/data/mods.txt
```

### 동기화 경로 커스터마이징

모드/플러그인 동기화 경로 변경:

```bash
# config.env 내
COPY_MODS_SRC=/custom-mods
COPY_MODS_DEST=/data/mods
COPY_PLUGINS_SRC=/custom-plugins
COPY_PLUGINS_DEST=/data/plugins
```

## 자동 정리

### 이전 모드 제거

새 콘텐츠 적용 전 자동 정리 설정:

```bash
mcctl config myserver REMOVE_OLD_MODS "TRUE"
```

### 특정 파일 제외

```bash
mcctl config myserver REMOVE_OLD_MODS_INCLUDE "*.jar"
mcctl config myserver REMOVE_OLD_MODS_EXCLUDE "keep-this-mod.jar"
```

## 문제 해결

### 일반적인 문제

| 문제 | 원인 | 해결책 |
|------|------|--------|
| 다운로드 실패 | 유효하지 않은 URL 또는 네트워크 문제 | URL 접근성 확인 |
| 파일을 찾을 수 없음 | 잘못된 경로 | 공유 디렉토리 위치 확인 |
| 권한 거부 | 파일 권한 | 파일이 읽기 가능한지 확인 |
| 모드가 로드되지 않음 | 잘못된 서버 타입 | TYPE이 모드 로더와 일치하는지 확인 |

### 현재 설정 확인

```bash
# 모든 설정 보기
mcctl config myserver

# MODS 설정 보기
mcctl config myserver MODS
```

### 서버 로그 보기

```bash
# 모드/플러그인 로딩 오류 확인
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

### URL 접근성 확인

URL 접근성 테스트:

```bash
curl -I "https://example.com/mod.jar"
```

### 공유 디렉토리 확인

```bash
# 공유 모드 목록
ls -la ~/minecraft-servers/shared/mods/

# 공유 플러그인 목록
ls -la ~/minecraft-servers/shared/plugins/
```

## 참고

- [모드 및 플러그인 개요](index.ko.md)
- [Modrinth 가이드](modrinth.ko.md)
- [CurseForge 가이드](curseforge.ko.md)
- [Spiget 가이드](spiget.ko.md)
- [CLI 명령어 레퍼런스](../cli/commands.ko.md)
- [공식 itzg 문서](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/)
