# 설치 가이드

이 가이드는 mcctl 설치 및 필수 의존성 설정 과정을 안내합니다.

## 사전 요구사항

mcctl을 설치하기 전에 다음 소프트웨어가 설치되어 있어야 합니다:

### Docker

Minecraft 서버를 실행하려면 Docker가 필요합니다. Docker Engine을 설치합니다:

=== "Ubuntu/Debian"
    ```bash
    # Docker 공식 GPG 키 추가
    sudo apt-get update
    sudo apt-get install ca-certificates curl
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

    # 저장소 추가
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Docker 설치
    sudo apt-get update
    sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin

    # 사용자를 docker 그룹에 추가
    sudo usermod -aG docker $USER
    newgrp docker
    ```

=== "CentOS/RHEL"
    ```bash
    sudo dnf install -y dnf-plugins-core
    sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    sudo dnf install docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo systemctl enable --now docker
    sudo usermod -aG docker $USER
    ```

=== "macOS"
    [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)을 다운로드하여 설치합니다.

Docker 설치를 확인합니다:

```bash
docker --version
# Docker version 24.0.0 이상

docker compose version
# Docker Compose version v2.20.0 이상
```

### Node.js

Node.js 18 이상이 필요합니다:

=== "nvm 사용 (권장)"
    ```bash
    # nvm 설치
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    source ~/.bashrc

    # Node.js 20 LTS 설치
    nvm install 20
    nvm use 20
    ```

=== "Ubuntu/Debian"
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ```

=== "macOS (Homebrew)"
    ```bash
    brew install node@20
    ```

Node.js 설치를 확인합니다:

```bash
node --version
# v20.0.0 이상

npm --version
# v10.0.0 이상
```

## mcctl 설치

### 전역 설치 (권장)

npm을 통해 mcctl을 전역으로 설치합니다:

```bash
npm install -g @minecraft-docker/mcctl
```

또는 pnpm 사용:

```bash
pnpm add -g @minecraft-docker/mcctl
```

설치를 확인합니다:

```bash
mcctl --version
# mcctl version 0.1.0
```

### npx 사용 (설치 없이)

설치 없이 mcctl을 실행할 수도 있습니다:

```bash
npx @minecraft-docker/mcctl --help
```

## 플랫폼 초기화

mcctl 설치 후 플랫폼을 초기화합니다:

```bash
mcctl init
```

이 명령은 `~/minecraft-servers/`에 플랫폼 디렉토리 구조를 생성합니다:

```
~/minecraft-servers/
├── docker-compose.yml     # 메인 오케스트레이션
├── .env                   # 환경 설정
├── servers/               # 서버 설정
│   ├── compose.yml        # 서버 포함 목록
│   └── _template/         # 서버 템플릿
├── worlds/                # 공유 월드 저장소
├── shared/                # 공유 플러그인/모드
│   ├── plugins/
│   └── mods/
├── scripts/               # 관리 스크립트
└── backups/               # 백업 저장소
```

!!! tip "사용자 지정 데이터 디렉토리"
    `--root` 옵션으로 사용자 지정 위치를 지정할 수 있습니다:
    ```bash
    mcctl --root /path/to/data init
    ```

## 선택사항: mDNS 설정

`.local` 호스트네임을 사용한 로컬 네트워크 검색을 위해 avahi-daemon을 설치합니다:

=== "Ubuntu/Debian"
    ```bash
    sudo apt install avahi-daemon
    sudo systemctl enable --now avahi-daemon
    ```

=== "CentOS/RHEL"
    ```bash
    sudo dnf install avahi
    sudo systemctl enable --now avahi-daemon
    ```

=== "macOS"
    macOS는 Bonjour가 내장되어 있어 추가 설치가 필요 없습니다.

!!! note "nip.io 권장"
    nip.io magic DNS는 클라이언트 설정 없이 작동하므로 mDNS보다 권장됩니다.
    자세한 내용은 [네트워킹 가이드](../advanced/networking.ko.md)를 참조하세요.

## 설정

환경 파일을 편집하여 설정을 커스터마이즈합니다:

```bash
nano ~/minecraft-servers/.env
```

주요 설정:

```bash
# 서버의 IP 주소 (nip.io에 필요)
HOST_IP=192.168.1.100

# 기본 서버 설정
DEFAULT_MEMORY=4G
DEFAULT_VERSION=1.20.4

# 타임존
TZ=Asia/Seoul

# RCON 비밀번호 (운영 환경에서는 변경하세요!)
RCON_PASSWORD=changeme
```

## 설치 확인

status 명령으로 모든 것이 작동하는지 확인합니다:

```bash
mcctl status
```

예상 출력:

```
Platform Status
===============

Router: mc-router (running)
Servers: 0

No servers configured. Create one with:
  mcctl create <name>
```

## 문제 해결

### Docker 권한 거부

권한 오류가 발생하는 경우:

```bash
# 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER

# 그룹 변경 적용
newgrp docker
```

### 포트 25565 이미 사용 중

다른 프로세스가 포트 25565를 사용 중인지 확인합니다:

```bash
sudo lsof -i :25565
```

충돌하는 서비스를 중지하거나 docker-compose.yml에서 포트를 변경합니다.

### mcctl 명령을 찾을 수 없음

npm 전역 bin이 PATH에 있는지 확인합니다:

```bash
# npm의 경우
export PATH="$PATH:$(npm config get prefix)/bin"

# 영구적으로 적용하려면 ~/.bashrc에 추가
echo 'export PATH="$PATH:$(npm config get prefix)/bin"' >> ~/.bashrc
```

## 다음 단계

- **[빠른 시작](quickstart.ko.md)** - 첫 번째 Minecraft 서버 생성
- **[CLI 명령어](../cli/commands.ko.md)** - 사용 가능한 모든 명령어 학습
- **[설정](../configuration/index.ko.md)** - 서버 설정 커스터마이즈
