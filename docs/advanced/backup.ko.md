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
- 호스트에 git 2.31 이상(`git --version`). 이보다 낮으면 백업이 명확한 오류로 거부됩니다

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
mcctl backup restore abc1234          # 확인을 묻습니다
mcctl backup restore abc1234 --force  # 묻지 않습니다(스크립트용)
```

복원 규칙:

- **먼저 모든 서버를 중지하세요.** 실행 중인 서버가 하나라도 있거나 Docker 상태를 조회할 수 없으면 복원을 거부합니다.
- 결과는 백업 커밋과 정확히 같습니다. 그 커밋 이후에 생긴 파일은 섞이지 않고 제거됩니다.
- `worlds/.locks`는 건드리지 않습니다.
- 서버 내부 월드(`servers/<이름>/data/<LEVEL>`)는 커밋에 있는 서버만 복원합니다. 서버의 현재 `LEVEL`이 커밋의 월드와 다르면 거부합니다(`restore_conflict`).
- 교체된 데이터는 `~/minecraft-servers/backups/restore-previous/<시각>/`에 남습니다. 최근 3개만 두고, 복원이 성공하면 더 오래된 것은 지웁니다.

!!! warning "복원 중 자동 기동"
    mc-router는 플레이어가 접속하면 서버를 띄울 수 있습니다. 복원은 실행 중인 서버를 두 번 확인하지만, 마지막 확인 뒤 복원이 끝나기 전에 서버가 뜨는 것까지는 막지 못합니다. 복원하기 전에 `mc-router`를 멈추거나 아무도 접속하지 않게 하세요.

!!! danger "데이터 덮어쓰기 경고"
    복원은 현재 월드 데이터를 교체합니다. 먼저 백업하는 것을 고려하세요:
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

정지 경로는 `mcctl backup push --auto`를 실행합니다. `--auto`는 입력을 묻지 않고, 다른 백업이 실행 중이면 최대 10분 기다립니다.

### 예약 백업

보존 정책이 있는 예약 백업은 `mcctl backup schedule add`(또는 웹 콘솔)를 쓰세요. 일반 cron 작업도 됩니다:

```cron
# 매일 오전 4시 백업(--auto: 묻지 않고, 실행 중인 백업을 기다림)
0 4 * * * /usr/local/bin/mcctl backup push --auto
```

---

## 백업되는 내용

- `worlds/` 디렉터리 전체(`worlds/.locks` 제외)
- 서버 내부 월드: 월드가 `worlds/`에 없는 서버의 `servers/<이름>/data/<LEVEL>`(있으면 `<LEVEL>_nether`, `<LEVEL>_the_end` 포함)

실행 중인 서버는 복사 전에 디스크에 기록합니다. 순서는 `save-off` → `save-all flush` → 복사 → `save-on`이고, 백업이 실패해도 `save-on`은 보냅니다. 실행 중인 서버가 RCON에 응답하지 않으면, 쓰는 중인 월드를 복사하지 않고 백업을 실패로 끝냅니다.

마지막 백업 이후 바뀐 것이 없으면 "No changes to backup"으로 성공합니다.

### 백업에서 제외

- 서버 설정 파일(`servers/*/config.env`, compose 파일)
- 플러그인/모드(shared/*)
- 컨테이너 데이터(로그, 임시 파일)

!!! tip "서버 설정은 별도로 백업"
    mcctl로 서버 설정을 백업하세요:
    ```bash
    mcctl server-backup myserver
    mcctl server-backup myserver --list
    mcctl server-restore myserver
    ```

### 삭제한 월드

마지막 백업에 있던 월드가 없으면, 삭제를 기록하지 않고 백업을 멈춥니다. 마운트가 빠졌을 때 백업에서 모든 월드가 지워지는 것을 막기 위해서입니다. 일부러 지운 월드라면 한 번 동의하세요:

```bash
mcctl backup push --allow-missing
```

웹 콘솔에서는 백업 대화상자에서 **Remove worlds I deleted on purpose**를 체크합니다. 예약 백업은 이 옵션을 쓰지 않고, 실패 메시지에 이 명령을 남깁니다. `servers/<이름>/` 디렉터리 전체를 지운 경우는 의도한 삭제로 봅니다.

---

## 저장소 구조

```text
minecraft-worlds-backup/
├── README.md                 # 자동 생성
├── worlds/
│   ├── survival/
│   └── creative/
└── servers/
    └── myserver/
        ├── world/            # 서버 내부 월드
        └── world_nether/
```

로컬 작업 사본은 `~/minecraft-servers/backups/worlds`입니다. 직접 고치지 마세요.

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

### 다른 백업이 실행 중

```
Error: Another backup operation is running (push, pid 1234 on host, since ...)
```

push, 복원, 보존 정책 정리는 잠금 하나(`~/minecraft-servers/backups/.backup.lock`)를 함께 씁니다. 실행 중인 백업이 없는데 이 오류가 나면(예: 다른 호스트에서 비정상 종료), 표시된 프로세스가 없는지 확인한 뒤 파일을 지우세요.

### 원본에서 월드가 없어짐

[삭제한 월드](#삭제한-월드)를 보세요. `mcctl backup push --allow-missing`은 의도한 삭제일 때만 쓰세요.

### 실행 중인 서버를 중지하세요

서버가 실행 중이면 복원을 거부합니다. `mcctl stop <서버>`로 중지한 뒤 다시 시도하세요.

### 복원이 끝나지 않음

```
Error: A restore did not finish; recover manually from .../backups/restore-previous/<시각>
```

복원이 실패했고 되돌리기도 끝까지 하지 못한 상태입니다. 복구하기 전까지 이후의 push와 복원은 모두 막힙니다:

1. `backups/restore-previous/<시각>/INCOMPLETE`를 엽니다. 대상마다 실제 경로(`live`)와 이전 데이터를 둔 곳(`previous`)이 적혀 있습니다.
2. 대상마다 `live`가 없거나 잘못되었으면 `previous`를 `live`로 되돌립니다. 복원이 이미 옮겨 넣은 데이터는 `.new/` 아래에 있습니다.
3. `INCOMPLETE` 파일을 지웁니다.

### 지원하지 않는 배치

`unsupported_layout`은 다음 중 하나입니다:

- 월드 안에 심볼릭 링크가 있습니다(심볼릭 링크는 백업·복원하지 않습니다).
- `worlds/`, `servers/<이름>/`, `backups/`가 서로 다른 파일시스템에 있습니다(복원은 디렉터리를 옮기므로 같은 파일시스템이어야 합니다).

### 예전 `worlds.bak.<시각>` 디렉터리

이전 버전은 복원할 때마다 `worlds/` 옆에 `worlds.bak.<시각>` 사본을 남겼습니다. 이제는 만들지 않습니다. 필요 없으면 직접 지우세요:

```bash
ls -d ~/minecraft-servers/worlds.bak.*
rm -rf ~/minecraft-servers/worlds.bak.<시각>
```

### 대용량 파일 오류

```
Error: File exceeds 100MB limit
```

대용량 파일에 Git LFS를 사용합니다:

```bash
cd ~/minecraft-servers/backups/worlds
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
