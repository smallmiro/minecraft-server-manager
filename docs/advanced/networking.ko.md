# 네트워킹 가이드

nip.io, mDNS, mc-router를 사용하여 Minecraft 서버의 호스트네임 기반 라우팅을 설정합니다.

## 개요

플랫폼은 다음 호스트네임 방식을 지원합니다:

| 방법 | URL 예제 | 클라이언트 설정 | 접속 가능한 곳 |
|------|----------|----------------|----------|
| **nip.io** (권장) | `myserver.192.168.1.100.nip.io:25565` | 없음 | 이름에 든 IP에 접근할 수 있는 네트워크 (LAN, VPN) |
| **mDNS** | `myserver.local:25565` | avahi/Bonjour | LAN만 |

mc-router는 클라이언트가 보낸 호스트네임으로 서버를 고르므로 `192.168.1.100:25565` 같은 IP만으로는 서버에 접속할 수 없습니다. 인터넷에서 접속하려면 [외부 접속](external-access.ko.md)을 참조하세요.

## nip.io Magic DNS

**모든 사용자에게 권장됩니다.**

nip.io는 IP 주소가 포함된 호스트네임을 자동으로 해석하는 magic DNS 서비스입니다:

```
myserver.192.168.1.100.nip.io → 192.168.1.100
creative.192.168.1.100.nip.io → 192.168.1.100
modded.192.168.1.100.nip.io   → 192.168.1.100
```

### 작동 방식

1. 클라이언트가 `myserver.192.168.1.100.nip.io:25565`에 접속
2. DNS 쿼리가 nip.io 서비스로 전달
3. nip.io가 호스트네임에서 `192.168.1.100`을 추출
4. `192.168.1.100`을 IP 주소로 반환
5. 클라이언트가 `192.168.1.100:25565`에 접속
6. mc-router가 호스트네임 `myserver.192.168.1.100.nip.io`로 연결 수신
7. mc-router가 호스트네임을 기반으로 올바른 서버로 라우팅

### 설정

`.env`에 호스트 IP를 설정합니다:

```bash
# ~/minecraft-servers/.env
HOST_IP=192.168.1.100
```

서버를 생성하면 mcctl이 두 호스트네임을 모두 서버의 `mc-router.host` 라벨에 넣습니다:

- `myserver.192.168.1.100.nip.io:25565` (nip.io, `HOST_IPS`의 주소마다 하나, 없으면 `HOST_IP`)
- `myserver.local:25565` (mDNS)

`mcctl status`의 HOSTNAME 열에서 확인할 수 있습니다.

### 장점

- **클라이언트 설정 불필요** - 즉시 작동
- **여러 네트워크에서 작동** - 이름에 든 IP에 접근할 수 있는 모든 네트워크(LAN, `HOST_IPS`의 VPN 주소 등)에서 접속 가능
- **간단한 설정** - .env에 HOST_IP만 설정
- **다중 서버** - 각 서버가 고유한 호스트네임을 가짐

### 요구사항

- DNS 해석을 위한 인터넷 접속
- .env에 HOST_IP가 올바르게 설정됨
- mc-router가 실행 중이어야 함

---

## mDNS (Multicast DNS)

mDNS는 `.local` 호스트네임이 로컬 네트워크에서 작동하게 합니다.

### 작동 방식

1. avahi-daemon이 로컬 네트워크에 호스트네임을 브로드캐스트
2. mDNS를 지원하는 클라이언트가 호스트네임을 발견
3. 수동 /etc/hosts 설정 불필요

### 서버 설정

#### avahi-daemon 설치

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

=== "Arch Linux"
    ```bash
    sudo pacman -S avahi nss-mdns
    sudo systemctl enable --now avahi-daemon
    ```

#### 호스트네임 등록

avahi-daemon이 설치되어 있으면 `mcctl create`가 `<name>.local`을 등록합니다. 첫 번째 호스트 주소(`HOST_IPS`, 없으면 `HOST_IP`; IPv4만)로 `/etc/avahi/hosts`에 `<ip> <name>.local`을 추가하고 sudo로 avahi-daemon을 재시작합니다:

- `/etc/avahi/hosts`가 있으면 sudo 비밀번호를 묻습니다. 스크립트에서는 `--sudo-password`를 넘기거나 `MCCTL_SUDO_PASSWORD`를 설정하세요. Enter를 누르면 비밀번호 없이 sudo를 시도합니다.
- 비밀번호 없이 쓰려면 mcctl이 실행하는 명령을 허용하세요. 예를 들어 `/etc/sudoers.d/mcctl`에:

    ```
    %docker ALL=(ALL) NOPASSWD: /usr/bin/tee -a /etc/avahi/hosts
    %docker ALL=(ALL) NOPASSWD: /usr/bin/sed -i * /etc/avahi/hosts
    %docker ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart avahi-daemon
    ```

- sudo가 실패해도 서버는 생성되고 mcctl이 경고를 출력합니다. 이때는 아래처럼 직접 추가하세요.
- `mcctl delete`는 같은 방식으로 `<name>.local` 줄을 지웁니다.

수동 등록:

```bash
# 항목 추가
echo "192.168.1.100 myserver.local" | sudo tee -a /etc/avahi/hosts

# avahi 재시작
sudo systemctl restart avahi-daemon
```

### 클라이언트 설정

| OS | 필요한 설정 |
|----|------------|
| **Linux** | avahi-daemon 설치 (보통 사전 설치됨) |
| **macOS** | 없음 (Bonjour 내장) |
| **Windows** | Bonjour 설치 (iTunes 또는 Bonjour Print Services) |

#### Windows 클라이언트

1. [Bonjour Print Services](https://support.apple.com/kb/DL999) 다운로드
2. 설치 후 재시작
3. `.local` 호스트네임이 해석됨

#### Linux 클라이언트

```bash
# Ubuntu/Debian
sudo apt install avahi-daemon libnss-mdns

# nss-mdns가 설정되었는지 확인
grep mdns /etc/nsswitch.conf
# 다음과 같이 표시되어야 함: hosts: files mdns4_minimal [NOTFOUND=return] dns
```

### mDNS 문제 해결

```bash
# avahi가 실행 중인지 확인
systemctl status avahi-daemon

# 등록된 호스트네임 목록
cat /etc/avahi/hosts

# 해석 테스트
avahi-resolve -n myserver.local

# 네트워크 인터페이스 확인
avahi-daemon --check
```

---

## mc-router 설정

mc-router는 호스트네임 기반 라우팅과 자동 스케일링을 처리합니다.

!!! info "고정된 버전"
    플랫폼은 재현 가능한 배포를 위해 `docker-compose.yml`에서 `itzg/mc-router`를 `1.47.1`로 고정합니다.
    `1.42.0` 대비 이 릴리스는 이벤트 기반 Docker 폴링(자동 스케일 반응성 향상),
    타임존(`TZ`) 지원, `--log-level` 옵션을 추가했습니다. 호환성을 깨는 변경(breaking change)은 없으며,
    여기서 사용하는 라벨 기반 `--in-docker` 자동 스케일 방식은 설정 변경이 필요하지 않습니다.

    `1.46`부터 mc-router는 non-root 사용자로 실행됩니다. compose 파일이 `group_add: ["${DOCKER_GID:-999}"]`로
    Docker 소켓의 그룹을 추가하며, `mcctl init`/`mcctl upgrade`가 `DOCKER_GID`를 감지해 `.env`에 기록합니다.

### mcctl로 라우터 관리

```bash
# 라우터 상태 확인
mcctl status router

# 라우터 시작 (docker-compose.yml을 바꾼 뒤에는 컨테이너도 다시 만듦)
mcctl router start

# 실행 중인 컨테이너 재시작 (현재 설정 유지)
mcctl router restart

# 라우터 중지
mcctl router stop
```

### Docker 라벨

각 서버는 mc-router 검색을 위해 Docker 라벨을 사용합니다. `mcctl create`가 자동으로 설정합니다:

```yaml
# servers/myserver/docker-compose.yml (자동 생성됨)
services:
  mc-myserver:
    labels:
      mc-router.host: "myserver.local,myserver.192.168.1.100.nip.io"
```

### 자동 스케일링 설정

mc-router 설정은 `.env`가 아니라 `~/minecraft-servers/docker-compose.yml`의 `router` 서비스에 있습니다:

```yaml
services:
  router:
    environment:
      IN_DOCKER: "true"
      AUTO_SCALE_UP: "true"          # 접속 시 서버 시작
      AUTO_SCALE_DOWN: "true"        # 유휴 서버 중지 (참고 사항 확인)
      AUTO_SCALE_DOWN_AFTER: "10m"   # 서버를 중지하기 전 유휴 시간
      DOCKER_TIMEOUT: "120s"         # 서버 시작 대기 시간 (Go time.Duration: 120s, 2m; 정수만 쓰면 실패)
```

수정한 뒤 라우터를 다시 만듭니다(`mcctl router restart`는 예전 설정을 유지합니다):

```bash
mcctl router start
```

`mcctl upgrade`는 라우터의 `image`와 `group_add`만 바꾸므로 직접 수정한 내용은 유지됩니다.

서버 하나만 자동 스케일링을 끄려면 `servers/<name>/server.yaml`에서 `routing.autoScale.up` 또는 `routing.autoScale.down`을 `false`로 바꾸고 `mcctl migrate spec <name>`을 실행한 뒤 컨테이너를 다시 만드세요. 실행 중이면 `mcctl stop <name> && mcctl start <name>`, 중지 상태면 `mcctl start <name>`입니다. 이 값은 서버의 `mc-router.auto-scale-up` / `mc-router.auto-scale-down` 라벨이 됩니다.

!!! info "AUTO_SCALE_DOWN"
    mc-router v1.39.1 이후 자동 스케일 다운이 완전히 지원됩니다.
    서버는 설정된 유휴 시간 초과 후 자동으로 중지됩니다 (기본값: 10분).
    이전에 플레이어 연결 끊김을 유발했던 경쟁 조건이 수정되었습니다.
    자세한 내용은 [mc-router #507](https://github.com/itzg/mc-router/issues/507)을 참조하세요.

### 다중 호스트네임

여러 네트워크(LAN + VPN)에서 동시에 접속하려면 다중 IP를 설정합니다:

```bash
# ~/minecraft-servers/.env
HOST_IPS=192.168.1.100,100.64.0.5
```

각 IP에 대해 호스트네임이 생성됩니다:
- `myserver.192.168.1.100.nip.io` (LAN)
- `myserver.100.64.0.5.nip.io` (VPN)

!!! tip "HOST_IP vs HOST_IPS"
    - `HOST_IP`: 단일 IP 주소 (기본)
    - `HOST_IPS`: 쉼표로 구분된 다중 IP (VPN mesh용)

    `HOST_IPS`가 설정되면 `HOST_IP`보다 우선합니다.

---

## VPN Mesh 네트워크

Tailscale이나 ZeroTier 같은 VPN mesh를 사용하면 어디서든 서버에 접속할 수 있습니다.

### 왜 VPN Mesh를 사용하나요?

| 시나리오 | 해결책 |
|---------|--------|
| 친구가 다른 네트워크에 있음 | VPN mesh로 가상 LAN 구성 |
| 외부에서 홈 서버 접속 | 포트포워딩 없이 VPN으로 접속 |
| 여러 위치에서 접속 | 다중 IP로 모든 네트워크 지원 |

### Tailscale 설정

[Tailscale](https://tailscale.com/)은 무료 VPN mesh 서비스입니다.

#### 1. Tailscale 설치

=== "Ubuntu/Debian"
    ```bash
    curl -fsSL https://tailscale.com/install.sh | sh
    sudo tailscale up
    ```

=== "Arch Linux"
    ```bash
    sudo pacman -S tailscale
    sudo systemctl enable --now tailscaled
    sudo tailscale up
    ```

#### 2. Tailscale IP 확인

```bash
tailscale ip -4
# 예: 100.64.0.5
```

#### 3. mcctl에 다중 IP 설정

```bash
# ~/minecraft-servers/.env
# LAN IP + Tailscale IP
HOST_IPS=192.168.1.100,100.64.0.5
```

#### 4. 서버 재생성 또는 라벨 업데이트

```bash
# 새 서버는 IP마다 호스트네임을 자동으로 받음
mcctl create myserver

# 기존 서버: "Host IP(s)"를 고르고 모든 주소를 선택한 뒤
# "Update existing servers with new IP hostnames?"에 yes로 답함
mcctl init --reconfigure

# mc-router가 실행 중인지 확인
mcctl router start

# 실행 중인 서버마다 컨테이너를 다시 만들어 새 호스트네임 적용
mcctl stop myserver && mcctl start myserver
```

컨테이너는 생성될 때의 호스트네임을 유지하며, 재시작으로는 새 호스트네임이 적용되지 않습니다. 중지된 서버는 `mcctl start <name>`이 컨테이너를 다시 만들고 시작합니다. 다시 만들되 중지된 상태로 두려면 `~/minecraft-servers`에서 `docker compose up --no-start --no-deps mc-<name>`을 실행하세요.

#### 5. 클라이언트 접속

친구도 Tailscale을 설치하고 같은 네트워크에 초대한 후:

```
# Minecraft에서 서버 추가
myserver.100.64.0.5.nip.io:25565
```

### ZeroTier 설정

[ZeroTier](https://zerotier.com/)는 또 다른 무료 VPN mesh 서비스입니다.

#### 1. ZeroTier 설치

```bash
curl -s https://install.zerotier.com | sudo bash
```

#### 2. 네트워크 생성 및 참여

1. [my.zerotier.com](https://my.zerotier.com/)에서 네트워크 생성
2. Network ID 복사 (예: `8056c2e21c000001`)
3. 네트워크 참여:
   ```bash
   sudo zerotier-cli join 8056c2e21c000001
   ```

#### 3. ZeroTier IP 확인

```bash
sudo zerotier-cli listnetworks
# 또는
ip addr show zt*
# 예: 10.147.20.1
```

#### 4. mcctl에 다중 IP 설정

```bash
# ~/minecraft-servers/.env
HOST_IPS=192.168.1.100,10.147.20.1
```

### 다중 VPN 동시 사용

Tailscale과 ZeroTier를 동시에 사용할 수도 있습니다:

```bash
# ~/minecraft-servers/.env
# LAN + Tailscale + ZeroTier
HOST_IPS=192.168.1.100,100.64.0.5,10.147.20.1
```

모든 네트워크에서 접속 가능:
- `myserver.192.168.1.100.nip.io:25565` (LAN)
- `myserver.100.64.0.5.nip.io:25565` (Tailscale)
- `myserver.10.147.20.1.nip.io:25565` (ZeroTier)

### VPN Mesh 문제 해결

```bash
# Tailscale 상태 확인
tailscale status

# ZeroTier 상태 확인
sudo zerotier-cli listnetworks

# 호스트네임 라벨 확인
docker inspect mc-myserver | grep mc-router.host

# mc-router 로그에서 호스트네임 확인
mcctl logs router -n 200 | grep myserver
```

!!! warning "VPN IP 변경 시"
    VPN IP가 바뀌면 `mcctl init --reconfigure`를 실행해 새 IP를 선택하고 기존 서버 갱신을 승인한 뒤, 4단계처럼 서버마다 컨테이너를 다시 만드세요. 첫 번째 주소가 바뀌었다면 `/etc/avahi/hosts`의 `<name>.local` 줄도 고치세요. mcctl은 이 줄을 다시 쓰지 않습니다.

### 디버그 모드

`~/minecraft-servers/docker-compose.yml`의 `router` 서비스 `environment:`에 `DEBUG: "true"`를 추가합니다:

```yaml
services:
  router:
    environment:
      DEBUG: "true"
```

그런 다음 라우터를 다시 만들고 로그를 확인합니다:

```bash
mcctl router start
mcctl logs router -f
```

---

## 네트워크 아키텍처

### Docker 네트워크

모든 Minecraft 컨테이너는 공유 Docker 네트워크에서 실행됩니다. `mcctl init`이 서브넷 `172.28.0.0/16`의 브리지 네트워크 `minecraft-net`을 만들고, compose 파일은 이를 외부 네트워크로 사용합니다:

```yaml
# docker-compose.yml
networks:
  minecraft-net:
    external: true
    name: ${MINECRAFT_NETWORK:-minecraft-net}
```

`.env`의 `MINECRAFT_SUBNET`은 사용되지 않습니다.

### 포트 매핑

mc-router만 포트 25565를 노출합니다:

```yaml
services:
  router:
    ports:
      - "25565:25565"            # 공개 포트
      - "127.0.0.1:25580:8080"   # mc-router 관리 API (localhost 전용)
```

개별 Minecraft 서버는 포트를 노출하지 않습니다 - mc-router를 통해 접근합니다.

### 컨테이너 검색

mc-router는 Docker 소켓을 사용하여 컨테이너를 검색합니다:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

---

## 커스텀 도메인 설정

프로덕션 배포의 경우 자체 도메인을 사용합니다.

### DNS 설정

서버를 가리키는 A 레코드를 추가합니다:

```
survival.minecraft.example.com  A  192.168.1.100
creative.minecraft.example.com  A  192.168.1.100
```

### 서버 설정

도메인을 서버의 커스텀 호스트네임으로 추가합니다:

- 웹 콘솔: 서버 상세 > **Options** > **Hostnames / Domains** > **Custom Domains**에서 추가한 뒤 **Save**
- 또는 `servers/survival/server.yaml`의 `routing.customHostnames`에 추가하고 `mcctl migrate spec survival` 실행

mcctl은 `mc-router.host` 라벨에 도메인과 함께 `survival.local`과 nip.io 호스트네임을 유지합니다. 재시작으로는 호스트네임이 적용되지 않으므로 컨테이너를 다시 만드세요. 실행 중이면 `mcctl stop survival && mcctl start survival`, 중지 상태면 `mcctl start survival`입니다.

### HTTPS/TLS

Minecraft는 HTTPS가 아닌 자체 프로토콜을 사용합니다. 게임 연결에는 TLS가 필요하지 않습니다.

---

## 방화벽 설정

### 필요한 포트

| 포트 | 프로토콜 | 용도 |
|------|----------|------|
| 25565 | TCP | Minecraft 클라이언트 연결 |
| 5353 | UDP | mDNS (로컬 네트워크만) |

### UFW (Ubuntu)

```bash
sudo ufw allow 25565/tcp comment "Minecraft"
sudo ufw allow 5353/udp comment "mDNS"
```

### firewalld (CentOS/RHEL)

```bash
sudo firewall-cmd --permanent --add-port=25565/tcp
sudo firewall-cmd --permanent --add-service=mdns
sudo firewall-cmd --reload
```

---

## 문제 해결

### 연결 거부됨

1. mc-router가 실행 중인지 확인:
   ```bash
   mcctl status router
   mcctl router start   # 실행 중이 아니면
   ```

2. 호스트네임이 설정되었는지 확인:
   ```bash
   mcctl status myserver --detail
   ```

3. DNS 해석 테스트:
   ```bash
   nslookup myserver.192.168.1.100.nip.io
   ```

### 서버가 시작되지 않음

1. `docker-compose.yml`의 `router` 서비스에서 `DOCKER_TIMEOUT`을 확인하고, `mcctl router start`로 라우터를 다시 만듭니다:
   ```yaml
   # ~/minecraft-servers/docker-compose.yml (router environment)
   DOCKER_TIMEOUT: "180s"   # 서버 시작이 오래 걸리면 증가
   ```

2. 서버 로그 확인:
   ```bash
   mcctl logs myserver
   ```

### mDNS가 작동하지 않음

1. 서버에서 avahi가 실행 중인지 확인
2. 클라이언트가 mDNS를 지원하는지 확인
3. 동일한 네트워크 서브넷인지 확인
4. 방화벽이 포트 5353/udp를 허용하는지 확인

## 참고

- **[빠른 시작](../getting-started/quickstart.ko.md)** - 기본 서버 설정
- **[환경 변수](../configuration/environment.ko.md)** - 모든 설정 옵션
- **[mc-router 문서](https://github.com/itzg/mc-router)** - 전체 mc-router 레퍼런스
