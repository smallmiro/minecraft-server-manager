# 네트워킹 가이드

nip.io, mDNS, mc-router를 사용하여 Minecraft 서버의 호스트네임 기반 라우팅을 설정합니다.

## 개요

플랫폼은 세 가지 접속 방법을 지원합니다:

| 방법 | URL 예제 | 클라이언트 설정 | 원격 접속 |
|------|----------|----------------|----------|
| **nip.io** (권장) | `myserver.192.168.1.100.nip.io:25565` | 없음 | 가능 |
| **mDNS** | `myserver.local:25565` | avahi/Bonjour | LAN만 |
| **직접 IP** | `192.168.1.100:25565` | 없음 | 가능 |

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

서버를 생성할 때 mcctl이 자동으로 nip.io와 mDNS 호스트네임을 모두 설정합니다:

```bash
mcctl create myserver
# 호스트네임:
#   - myserver.192.168.1.100.nip.io:25565 (nip.io)
#   - myserver.local:25565 (mDNS)
```

### 장점

- **클라이언트 설정 불필요** - 즉시 작동
- **원격 접속 가능** - 인터넷이 있는 모든 네트워크에서 접근 가능
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

mcctl이 서버 생성 시 자동으로 호스트네임을 등록합니다:

```bash
mcctl create myserver
# avahi-daemon에 myserver.local 등록
```

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

### Docker 라벨

각 서버는 mc-router 검색을 위해 Docker 라벨을 사용합니다:

```yaml
# servers/myserver/docker-compose.yml
services:
  mc-myserver:
    labels:
      mc-router.host: "myserver.local,myserver.192.168.1.100.nip.io"
```

### 자동 스케일링 설정

`docker-compose.yml`에서 설정합니다:

```yaml
services:
  router:
    image: itzg/mc-router
    environment:
      IN_DOCKER: "true"
      AUTO_SCALE_UP: "true"       # 접속 시 서버 시작
      AUTO_SCALE_DOWN: "false"    # 유휴 서버 중지 (참고 사항 확인)
      DOCKER_TIMEOUT: "120"       # 서버 시작 대기 시간 (초)
      AUTO_SCALE_ASLEEP_MOTD: "서버가 대기 중입니다. 접속하면 시작됩니다!"
```

!!! warning "AUTO_SCALE_DOWN"
    Auto scale down은 타임아웃 후 플레이어 연결을 끊을 수 있는 버그로 인해 현재 기본적으로 비활성화되어 있습니다. 주의하여 활성화하세요.

### 다중 호스트네임

서버에 여러 호스트네임을 설정할 수 있습니다:

```yaml
labels:
  mc-router.host: "myserver.local,myserver.example.com,survival.mynetwork.local"
```

### 디버그 모드

mc-router 디버그 출력 활성화:

```yaml
services:
  router:
    environment:
      DEBUG: "true"
```

---

## 네트워크 아키텍처

### Docker 네트워크

모든 Minecraft 컨테이너는 공유 Docker 네트워크에서 실행됩니다:

```yaml
# docker-compose.yml
networks:
  minecraft-net:
    name: ${MINECRAFT_NETWORK:-minecraft-net}
    driver: bridge
    ipam:
      config:
        - subnet: ${MINECRAFT_SUBNET:-172.28.0.0/16}
```

### 포트 매핑

mc-router만 포트 25565를 노출합니다:

```yaml
services:
  router:
    ports:
      - "25565:25565"  # 공개 포트
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

mc-router.host 라벨을 업데이트합니다:

```yaml
labels:
  mc-router.host: "survival.minecraft.example.com"
```

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
   docker ps | grep mc-router
   ```

2. 호스트네임이 설정되었는지 확인:
   ```bash
   docker inspect mc-myserver | grep mc-router.host
   ```

3. DNS 해석 테스트:
   ```bash
   nslookup myserver.192.168.1.100.nip.io
   ```

### 서버가 시작되지 않음

1. Docker 타임아웃 확인:
   ```yaml
   DOCKER_TIMEOUT: "180"  # 서버 시작이 오래 걸리면 증가
   ```

2. 서버 로그 확인:
   ```bash
   docker logs mc-myserver
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
