# 백업 가이드

월드 데이터를 비공개 GitHub 저장소에 자동 백업하도록 설정합니다.

## 개요

백업 시스템은 다음을 제공합니다:

- **Git 기반 백업** - 월드 데이터의 전체 버전 히스토리
- **GitHub 통합** - 비공개 저장소에 안전하게 저장
- **대화형 및 CLI 모드** - 유연한 백업 관리
- **복원 기능** - 이전 백업으로 롤백

## 사전 요구사항

- GitHub 계정
- 백업용 비공개 저장소
- `repo` 범위가 있는 Personal Access Token

## 설정

### 1단계: 비공개 저장소 생성

1. [github.com/new](https://github.com/new)로 이동
2. 저장소 이름 입력 (예: `minecraft-worlds-backup`)
3. **Private** 선택
4. **Create repository** 클릭

### 2단계: Personal Access Token 생성

1. [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)로 이동
2. **Generate new token (classic)** 클릭
3. 설명적인 이름 입력 (예: "Minecraft Backup")
4. 범위 선택: **repo** (비공개 저장소 전체 제어)
5. **Generate token** 클릭
6. **토큰을 즉시 복사하세요** - 다시 표시되지 않습니다!

!!! warning "토큰 보안"
    - 토큰을 버전 관리에 절대 커밋하지 마세요
    - `.env` 파일에만 저장하세요
    - 유출되면 재생성하세요

### 3단계: 백업 설정

`~/minecraft-servers/.env`를 편집합니다:

```bash
# GitHub 백업 설정
BACKUP_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BACKUP_GITHUB_REPO=yourusername/minecraft-worlds-backup
BACKUP_GITHUB_BRANCH=main
BACKUP_AUTO_ON_STOP=true
```

| 변수 | 설명 | 필수 |
|------|------|------|
| `BACKUP_GITHUB_TOKEN` | Personal Access Token | 예 |
| `BACKUP_GITHUB_REPO` | `username/repo` 형식의 저장소 | 예 |
| `BACKUP_GITHUB_BRANCH` | 대상 브랜치 | 아니오 (기본값: main) |
| `BACKUP_AUTO_ON_STOP` | 서버 중지 시 자동 백업 | 아니오 (기본값: false) |

### 4단계: 설정 확인

```bash
mcctl backup status
```

예상 출력:

```
Backup Configuration:

  Status: Configured
  Repository: yourusername/minecraft-worlds-backup
  Branch: main
  Auto backup: enabled
```

---

## 백업 사용

### 수동 백업

#### 대화형 모드

```bash
mcctl backup push
```

커밋 메시지를 입력하라는 프롬프트가 표시됩니다.

#### CLI 모드

```bash
mcctl backup push -m "서버 업그레이드 전"
mcctl backup push -m "주간 백업"
```

### 백업 히스토리 보기

```bash
mcctl backup history
```

출력:

```
Backup History:

  abc1234  서버 업그레이드 전     2024-01-15
  def5678  주간 백업              2024-01-08
  ghi9012  초기 백업              2024-01-01
```

스크립팅을 위한 JSON 출력:

```bash
mcctl backup history --json
```

### 백업에서 복원

#### 대화형 모드

```bash
mcctl backup restore
```

선택할 백업 목록이 표시됩니다.

#### CLI 모드

```bash
mcctl backup restore abc1234
```

!!! danger "데이터 덮어쓰기 경고"
    복원은 모든 현재 월드 데이터를 덮어씁니다. 먼저 백업하는 것을 고려하세요:
    ```bash
    mcctl backup push -m "복원 전 백업"
    mcctl backup restore abc1234
    ```

---

## 자동 백업

### 서버 중지 시

서버가 중지될 때 자동 백업을 활성화합니다:

```bash
# .env
BACKUP_AUTO_ON_STOP=true
```

### 예약 백업 (cron)

예약 백업을 위한 cron 작업을 생성합니다:

```bash
# crontab 편집
crontab -e
```

추가:

```cron
# 매일 오전 4시 백업
0 4 * * * /usr/local/bin/mcctl backup push -m "예약된 일일 백업"

# 매주 일요일 오전 3시 백업
0 3 * * 0 /usr/local/bin/mcctl backup push -m "예약된 주간 백업"
```

---

## 백업되는 내용

백업에는 전체 `worlds/` 디렉토리가 포함됩니다:

```text
worlds/
├── survival/
│   ├── level.dat
│   ├── region/
│   ├── DIM-1/       # 네더
│   ├── DIM1/        # 엔드
│   └── ...
├── creative/
│   └── ...
└── modded/
    └── ...
```

### 백업에서 제외

- 서버 설정 파일 (servers/*)
- Docker compose 파일
- 플러그인/모드 (shared/*)
- 컨테이너 데이터 (로그, 임시 파일)

!!! tip "서버 설정은 별도로 백업"
    설정 파일은 별도로 백업하는 것을 고려하세요:
    ```bash
    # 설정 백업
    cp -r ~/minecraft-servers/servers ./servers-backup
    cp ~/minecraft-servers/.env ./env-backup
    ```

---

## 저장소 구조

첫 번째 백업 후 저장소에는 다음이 포함됩니다:

```text
minecraft-worlds-backup/
├── README.md           # 자동 생성
├── survival/
│   ├── level.dat
│   ├── region/
│   └── ...
├── creative/
│   └── ...
└── .backup-metadata    # 백업 메타데이터
```

---

## 스토리지 고려사항

### 저장소 크기

GitHub는 저장소에 대해 다음 제한이 있습니다:

| 제한 | 값 |
|------|-----|
| 권장 최대 크기 | 1 GB |
| 하드 제한 | 5 GB |
| 개별 파일 제한 | 100 MB |

더 큰 월드의 경우 고려하세요:

- 대용량 파일에 Git LFS 사용
- 백업 압축
- 대체 스토리지 사용 (S3, Backblaze)

### 백업 크기 줄이기

```bash
# 월드 크기 확인
du -sh ~/minecraft-servers/worlds/*

# 출력:
# 256M  ~/minecraft-servers/worlds/survival
# 128M  ~/minecraft-servers/worlds/creative
```

---

## 문제 해결

### 인증 실패

```
Error: Authentication failed
```

1. 토큰에 `repo` 범위가 있는지 확인
2. 토큰이 만료되지 않았는지 확인
3. 필요한 경우 토큰 재생성

### 저장소를 찾을 수 없음

```
Error: Repository not found
```

1. 저장소 이름 철자 확인
2. 저장소가 비공개인지 확인 (공개가 아님)
3. 토큰이 저장소에 접근할 수 있는지 확인

### 푸시 거부됨

```
Error: Push rejected (non-fast-forward)
```

원격에 로컬에 없는 변경사항이 있습니다. 옵션:

```bash
# 옵션 1: 강제 푸시 (원격을 덮어씀)
git -C ~/minecraft-servers/worlds push --force origin main

# 옵션 2: 먼저 풀하고 머지
git -C ~/minecraft-servers/worlds pull origin main
mcctl backup push -m "병합된 백업"
```

### 대용량 파일 오류

```
Error: File exceeds 100MB limit
```

대용량 파일에 Git LFS를 사용합니다:

```bash
cd ~/minecraft-servers/worlds
git lfs install
git lfs track "*.dat"
git lfs track "*.mca"
git add .gitattributes
git commit -m "Git LFS 활성화"
```

---

## 대안적 백업 전략

### 로컬 백업

```bash
# 간단한 tar 백업
tar -czvf backup-$(date +%Y%m%d).tar.gz ~/minecraft-servers/worlds/

# rsync 사용
rsync -av ~/minecraft-servers/worlds/ /backup/minecraft/worlds/
```

### 클라우드 스토리지

```bash
# AWS S3
aws s3 sync ~/minecraft-servers/worlds/ s3://my-bucket/minecraft/

# Backblaze B2
b2 sync ~/minecraft-servers/worlds/ b2://my-bucket/minecraft/
```

### Docker 볼륨 백업

```bash
# Docker 볼륨 백업
docker run --rm \
  -v minecraft-worlds:/data \
  -v $(pwd):/backup \
  alpine tar -czvf /backup/worlds.tar.gz /data
```

---

## 모범 사례

1. **정기적인 백업** - 일일 자동 + 변경 전 수동
2. **복원 테스트** - 주기적으로 백업이 작동하는지 확인
3. **다중 대상** - GitHub + 로컬/클라우드 백업
4. **변경사항 문서화** - 의미 있는 커밋 메시지 사용
5. **크기 모니터링** - 저장소 증가 추적

## 참고

- **[CLI 명령어](../cli/commands.ko.md)** - 모든 백업 명령어
- **[빠른 시작](../getting-started/quickstart.ko.md)** - 기본 설정
- **[GitHub 문서: Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)**
