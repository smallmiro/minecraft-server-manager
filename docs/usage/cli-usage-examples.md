# CLI 사용 예제 가이드

`mcctl` CLI 도구의 실제 사용 예제입니다. 모든 명령어는 Interactive Mode(대화형)와 CLI Mode(인자 전달) 두 가지 방식을 지원합니다.

## 목차

- [설치](#설치)
- [플랫폼 초기화](#플랫폼-초기화)
- [서버 생성](#서버-생성)
- [서버 삭제](#서버-삭제)
- [서버 상태 확인](#서버-상태-확인)
- [월드 관리](#월드-관리)
- [백업 관리](#백업-관리)

---

## 설치

### npm을 통한 글로벌 설치

```bash
# npm
npm install -g @minecraft-docker/mcctl

# pnpm
pnpm add -g @minecraft-docker/mcctl

# 설치 확인
mcctl --version
mcctl --help
```

### 개발 환경에서 실행

```bash
cd platform/services/cli

# 빌드
pnpm build

# 직접 실행
npx tsx src/index.ts --help

# 글로벌 링크
pnpm link --global
mcctl --help
```

---

## 플랫폼 초기화

`mcctl init` 명령어로 Minecraft 서버 플랫폼을 초기화합니다.

### 기본 초기화

```bash
mcctl init
```

**출력 예시:**
```
============================================================
  Minecraft Server Platform - Initialization
============================================================

  Data directory: ~/minecraft-servers

[1/5] Checking prerequisites...
  ✓ Docker is available
  ✓ Docker Compose is available
  ✓ avahi-daemon is available (mDNS support)

[2/5] Creating directory structure...
  Created: ~/.minecraft-servers/servers
  Created: ~/.minecraft-servers/worlds
  Created: ~/.minecraft-servers/shared/plugins
  Created: ~/.minecraft-servers/shared/mods
  Created: ~/.minecraft-servers/backups

[3/5] Copying template files...
  Copied: docker-compose.yml
  Copied: .env
  Copied: servers/compose.yml
  Copied: servers/_template/docker-compose.yml
  Copied: servers/_template/config.env

[4/5] Creating configuration...
  Created: .mcctl.json

[5/5] Setting up Docker network...
  ✓ Created network: minecraft-net

════════════════════════════════════════════════════════════
  ✓ Platform initialized successfully!
════════════════════════════════════════════════════════════

  Next steps:

  1. Edit configuration (optional):
     nano ~/minecraft-servers/.env

  2. Create your first server:
     mcctl create myserver

  3. Connect via Minecraft:
     myserver.local:25565
```

### 커스텀 경로에 초기화

```bash
mcctl --root /custom/path init
```

---

## 서버 생성

### Interactive Mode (대화형)

인자 없이 실행하면 대화형 모드로 진입합니다:

```bash
mcctl create
```

**대화형 프롬프트 예시:**
```
◆ Create Minecraft Server

◇ Enter server name:
│ myserver

◇ Select server type:
│ ● Paper (Recommended)
│ ○ Vanilla
│ ○ Forge
│ ○ Fabric

◇ Enter Minecraft version:
│ 1.21.1

◇ Enter memory allocation:
│ 4G

◇ World setup:
│ ● Create new world
│ ○ Create new world with seed
│ ○ Use existing world
│ ○ Download world from URL

◆ Creating server...
  ✓ Created server directory
  ✓ Generated configuration
  ✓ Updated compose.yml
  ✓ Registered mDNS hostname
  ✓ Started server container

◇ Server 'myserver' created successfully!

  Container: mc-myserver
  Type: Paper (Optimized fork with plugin support)
  Version: 1.21.1
  Memory: 4G

  Connect via: myserver.local:25565
```

### CLI Mode (인자 전달)

```bash
# 기본 생성 (PAPER 서버)
mcctl create myserver

# 서버 타입 지정
mcctl create myserver -t PAPER
mcctl create myserver -t VANILLA
mcctl create myserver -t FORGE
mcctl create myserver -t FABRIC

# 버전 지정
mcctl create myserver -t PAPER -v 1.21.1
mcctl create myserver -t FORGE -v 1.20.4

# 월드 시드 지정
mcctl create myserver -t PAPER -v 1.21.1 -s 12345678

# 월드 다운로드 URL
mcctl create myserver -t PAPER --world-url https://example.com/world.zip

# 기존 월드 사용 (worlds/ 디렉토리에 있는 월드)
mcctl create myserver -t PAPER -w survival

# 생성만 하고 시작하지 않음
mcctl create myserver -t PAPER --no-start

# 모든 옵션 조합
mcctl create myserver -t FORGE -v 1.20.4 -s 12345 --no-start
```

**출력 예시:**
```
✓ Server 'myserver' created successfully!
  Container: mc-myserver
  Type: Paper (Optimized fork with plugin support)
  Version: 1.21.1
  Memory: 4G

  Connect via: myserver.local:25565
```

---

## 서버 삭제

### Interactive Mode

```bash
mcctl delete
```

**대화형 프롬프트 예시:**
```
◆ Delete Minecraft Server

◇ Select server to delete:
│ ● mc-myserver (running)
│ ○ mc-creative (stopped)
│ ○ mc-modded (running)

◇ Are you sure you want to delete 'mc-myserver'?
│ ● Yes
│ ○ No

◆ Deleting server...
  ⚠ Warning: 2 players are currently connected
  ✓ Stopped container
  ✓ Removed from compose.yml
  ✓ Unregistered mDNS hostname
  ✓ Deleted server directory

◇ Server 'myserver' deleted successfully!
  World data has been preserved in worlds/ directory.
```

### CLI Mode

```bash
# 서버명 지정
mcctl delete myserver

# 플레이어가 접속 중이어도 강제 삭제
mcctl delete myserver --force
```

**출력 예시:**
```
✓ Server 'myserver' deleted successfully!
  World data has been preserved in worlds/ directory.
```

---

## 서버 상태 확인

```bash
# 기본 상태 확인
mcctl status

# JSON 출력
mcctl status --json
```

**출력 예시:**
```
Servers:

  mc-myserver
    Status: running
    Type: Paper
    Version: 1.21.1
    Players: 3/20
    Uptime: 2h 15m

  mc-creative
    Status: stopped
    Type: Vanilla
    Version: 1.21.1
    Players: 0/20

  mc-modded
    Status: running
    Type: Forge
    Version: 1.20.4
    Players: 1/20
    Uptime: 45m
```

**JSON 출력:**
```json
{
  "servers": [
    {
      "name": "mc-myserver",
      "status": "running",
      "type": "PAPER",
      "version": "1.21.1",
      "players": { "current": 3, "max": 20 },
      "uptime": 8100
    }
  ]
}
```

---

## 월드 관리

### 월드 목록 확인

```bash
# 기본 목록
mcctl world list

# JSON 출력
mcctl world list --json
```

**출력 예시:**
```
Worlds:

  survival
    Status: locked: mc-myserver
    Size: 1.2 GB
    Path: /minecraft-servers/worlds/survival

  creative
    Status: unlocked
    Size: 856 MB
    Path: /minecraft-servers/worlds/creative

  adventure
    Status: unlocked
    Size: 2.1 GB
    Path: /minecraft-servers/worlds/adventure
```

### 월드 할당 (Interactive Mode)

```bash
mcctl world assign
```

**대화형 프롬프트 예시:**
```
◆ Assign World to Server

◇ Select world:
│ ● creative (unlocked)
│ ○ adventure (unlocked)

◇ Select server:
│ ● mc-myserver
│ ○ mc-creative
│ ○ mc-modded

◆ Assigning world...
  ✓ Created symlink
  ✓ Updated lock file

◇ World 'creative' assigned to 'mc-myserver'
```

### 월드 할당 (CLI Mode)

```bash
mcctl world assign creative mc-myserver
```

**출력 예시:**
```
✓ World 'creative' assigned to 'mc-myserver'
```

### 월드 잠금 해제 (Interactive Mode)

```bash
mcctl world release
```

**대화형 프롬프트 예시:**
```
◆ Release World Lock

◇ Select locked world:
│ ● survival (locked: mc-myserver)
│ ○ creative (locked: mc-creative)

◇ Are you sure you want to release the lock?
│ ● Yes
│ ○ No

◇ World 'survival' lock released
  Previously locked by: mc-myserver
```

### 월드 잠금 해제 (CLI Mode)

```bash
# 일반 해제
mcctl world release survival

# 강제 해제 (서버가 실행 중이어도)
mcctl world release survival --force
```

**출력 예시:**
```
✓ World 'survival' lock released
  Previously locked by: mc-myserver
```

---

## 백업 관리

백업 기능을 사용하려면 `.env` 파일에 GitHub 설정이 필요합니다:

```bash
# ~/minecraft-servers/.env
BACKUP_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
BACKUP_GITHUB_REPO=username/minecraft-worlds-backup
BACKUP_GITHUB_BRANCH=main
BACKUP_AUTO_ON_STOP=true
```

### 백업 상태 확인

```bash
mcctl backup status
```

**출력 예시 (설정됨):**
```
Backup Configuration:

  Status: Configured
  Repository: username/minecraft-worlds-backup
  Branch: main
  Last backup: 2025-01-17 14:30:00
  Auto backup: enabled
```

**출력 예시 (미설정):**
```
Backup Configuration:

  Status: Not configured

  To enable backups, set in .env:
    BACKUP_GITHUB_TOKEN=your-token
    BACKUP_GITHUB_REPO=username/repo
```

### 백업 푸시 (Interactive Mode)

```bash
mcctl backup push
```

**대화형 프롬프트 예시:**
```
◆ Backup Worlds to GitHub

◇ Enter backup message:
│ Before server upgrade

◆ Backing up...
  ✓ Committed changes
  ✓ Pushed to GitHub

◇ Backup complete!
  Commit: abc1234
```

### 백업 푸시 (CLI Mode)

```bash
mcctl backup push -m "Before server upgrade"
mcctl backup push --message "Daily backup"
```

**출력 예시:**
```
✓ Backup complete!
  Commit: abc1234
```

### 백업 히스토리

```bash
# 기본 히스토리
mcctl backup history

# JSON 출력
mcctl backup history --json
```

**출력 예시:**
```
Backup History:

  abc1234  Before server upgrade  2025-01-17
  def5678  Daily backup  2025-01-16
  ghi9012  Initial backup  2025-01-15
  ... and 5 more
```

### 백업 복원 (Interactive Mode)

```bash
mcctl backup restore
```

**대화형 프롬프트 예시:**
```
◆ Restore from Backup

◇ Select backup to restore:
│ ● abc1234 - Before server upgrade (2025-01-17)
│ ○ def5678 - Daily backup (2025-01-16)
│ ○ ghi9012 - Initial backup (2025-01-15)

◇ This will overwrite current worlds. Continue?
│ ● Yes
│ ○ No

◆ Restoring...
  ✓ Fetched backup
  ✓ Restored files

◇ Restore complete!
  Restored from: abc1234
```

### 백업 복원 (CLI Mode)

```bash
mcctl backup restore abc1234
```

**출력 예시:**
```
✓ Restore complete!
  Restored from: abc1234
```

---

## 글로벌 옵션

모든 명령어에서 사용할 수 있는 옵션:

```bash
# 커스텀 데이터 디렉토리
mcctl --root /path/to/data <command>

# JSON 출력 (지원되는 명령어)
mcctl status --json
mcctl world list --json
mcctl backup history --json

# 도움말
mcctl --help
mcctl create --help
mcctl world --help

# 버전 확인
mcctl --version
```

---

## 일반적인 워크플로우

### 1. 첫 서버 설정

```bash
# 플랫폼 초기화
mcctl init

# 첫 서버 생성 (대화형)
mcctl create

# 또는 CLI로 직접
mcctl create myserver -t PAPER -v 1.21.1

# Minecraft에서 접속
# 서버 주소: myserver.local:25565
```

### 2. 모드 서버 추가

```bash
# Forge 모드 서버 생성
mcctl create modded -t FORGE -v 1.20.4

# 상태 확인
mcctl status

# Minecraft에서 접속
# 서버 주소: modded.local:25565
```

### 3. 월드 마이그레이션

```bash
# 월드 목록 확인
mcctl world list

# 기존 서버에서 월드 잠금 해제
mcctl world release survival

# 새 서버에 월드 할당
mcctl world assign survival mc-newserver
```

### 4. 백업 및 복원

```bash
# 업그레이드 전 백업
mcctl backup push -m "Before 1.21.2 upgrade"

# 서버 업그레이드 (config.env 수정 후)
docker compose up -d mc-myserver

# 문제 발생 시 복원
mcctl backup history
mcctl backup restore abc1234
```

### 5. 서버 정리

```bash
# 사용하지 않는 서버 삭제
mcctl delete oldserver

# 월드 데이터는 보존됨
mcctl world list
```

---

## 문제 해결

### 플랫폼이 초기화되지 않음

```
Error: Platform not initialized. Run: mcctl init
```

해결: `mcctl init` 실행

### Docker가 설치되지 않음

```
Error: Docker is not installed or not running
```

해결: Docker 설치 및 실행 확인
- https://docs.docker.com/get-docker/

### mDNS가 작동하지 않음

```
Warning: avahi-daemon not found - mDNS will not work
```

해결:
```bash
# Ubuntu/Debian
sudo apt install avahi-daemon
sudo systemctl enable --now avahi-daemon

# 수동 hosts 설정 (대안)
echo "192.168.1.100 myserver.local" | sudo tee -a /etc/hosts
```

### 월드가 이미 잠김

```
Error: World 'survival' is already locked by 'mc-otherserver'
```

해결:
```bash
# 잠금 해제 후 재할당
mcctl world release survival --force
mcctl world assign survival mc-myserver
```
