# playit.gg를 이용한 외부 접속

포트 포워딩, 방화벽 설정 변경, 고정 IP 없이도 외부 플레이어가 Minecraft 서버에 접속할 수 있도록 [playit.gg](https://playit.gg) 터널링을 설정합니다.

## 개요

기본적으로 mcctl로 생성한 서버는 로컬 네트워크에서만 접속 가능합니다 (nip.io 또는 mDNS 사용). **playit.gg**는 무료 터널링 서비스로, 서버에 공개 도메인 이름을 부여하여 인터넷 어디에서나 접속할 수 있게 합니다.

### 동작 원리

```
외부 플레이어 (인터넷)
        |
  playit.gg 클라우드
  (TCP 터널 릴레이)
        |
  playit-agent 컨테이너
  (network_mode: host)
        |
  localhost:25565로 포워딩
        |
  mc-router (:25565)
  Minecraft 핸드셰이크에서 호스트네임 확인
        |
   +----+----+
   |         |
 mc-aa    mc-bb
```

1. 외부 플레이어가 playit.gg 도메인(예: `xx-xx.craft.playit.gg`)에 접속합니다
2. playit.gg 클라우드가 TCP 연결을 호스트의 playit-agent로 릴레이합니다
3. playit-agent가 mc-router가 수신 대기하는 `localhost:25565`로 트래픽을 전달합니다
4. mc-router가 Minecraft 핸드셰이크 패킷에서 호스트네임을 읽어 올바른 서버로 라우팅합니다

### playit.gg 제공 기능

| 기능 | 무료 | 프리미엄 |
|------|------|----------|
| TCP 터널 | 무제한 | 무제한 |
| 도메인 | `xx-xx.craft.playit.gg` | 커스텀 도메인 지원 |
| 대역폭 | 무제한 | 무제한 |
| 플레이어 | 제한 없음 | 제한 없음 |
| 리전 | 자동 선택 | 선택 가능 |

!!! note "playit.gg vs 다른 터널링 솔루션"
    playit.gg는 게임 서버 터널링에 특화되어 있으며, Minecraft 프로토콜에 필요한 raw TCP passthrough를 지원합니다. 일반 HTTP 터널(ngrok, Cloudflare Tunnels)은 Minecraft에서 작동하지 않습니다.

## 사전 요구사항

외부 접속을 설정하기 전에 다음을 확인합니다:

- [x] mcctl 설치 및 플랫폼 초기화 완료 (`mcctl init`)
- [x] Minecraft 서버 1개 이상 생성 (`mcctl create`)
- [x] Docker 실행 중
- [x] [playit.gg 계정](https://playit.gg) (무료)

## 빠른 시작

6단계로 외부 접속을 설정합니다:

```bash
# 1. playit.gg 에이전트를 생성하고 SECRET_KEY를 받습니다
#    방문: https://playit.gg/account/agents/new-docker

# 2. 플랫폼에 playit.gg를 설정합니다
mcctl playit setup
# 프롬프트에서 SECRET_KEY를 입력합니다

# 3. playit-agent를 시작합니다
mcctl playit start

# 4. playit.gg 대시보드에서 Minecraft Java 터널을 생성합니다
#    방문: https://playit.gg/account/tunnels
#    - "Add Tunnel" 클릭
#    - "Minecraft Java" 선택
#    - Local Address: localhost:25565
#    - 저장하고 할당된 도메인을 기록합니다 (예: xx-xx.craft.playit.gg)

# 5. playit 도메인을 서버에 등록합니다
mcctl create myserver -t PAPER -v 1.21.1 --playit-domain xx-xx.craft.playit.gg
# 기존 서버는 docker-compose.yml 라벨을 수정합니다

# 6. 도메인을 친구들에게 공유합니다!
#    접속 주소: xx-xx.craft.playit.gg
```

## 상세 설정 가이드

### 1단계: playit.gg 에이전트 생성

1. [playit.gg](https://playit.gg)에 접속하여 무료 계정을 생성합니다
2. **Account** > **Agents** > **[New Docker Agent](https://playit.gg/account/agents/new-docker)**로 이동합니다
3. 에이전트 이름을 지정합니다 (예: "minecraft-host")
4. 페이지에 표시된 **SECRET_KEY**를 복사합니다

!!! warning "SECRET_KEY를 안전하게 보관하세요"
    SECRET_KEY는 한 번만 표시됩니다. 안전한 곳에 저장하세요. 분실 시 새 에이전트를 생성해야 합니다.

### 2단계: mcctl에서 playit.gg 설정

초기 플랫폼 설정 시 또는 이후에 playit.gg를 설정할 수 있습니다.

=== "mcctl init 시"
    ```bash
    # --playit-key 플래그 사용
    mcctl init --playit-key YOUR_SECRET_KEY

    # 또는 대화형으로 (프롬프트가 표시됩니다)
    mcctl init
    # "Enable playit.gg tunneling?" 질문에 Yes를 선택합니다
    # 프롬프트에서 SECRET_KEY를 입력합니다
    ```

=== "플랫폼 설정 후"
    ```bash
    # playit setup 명령을 실행합니다
    mcctl playit setup
    # 프롬프트에서 SECRET_KEY를 입력합니다
    ```

=== "playit.gg 건너뛰기"
    ```bash
    # init 시 명시적으로 비활성화
    mcctl init --no-playit
    ```

이 명령은 `PLAYIT_SECRET_KEY`를 `.env` 파일에 저장하고 playit 프로필을 활성화합니다.

### 3단계: playit-agent 시작

```bash
mcctl playit start
```

에이전트가 실행 중인지 확인합니다:

```bash
mcctl playit status
```

예상 출력:

```
=== playit.gg Agent Status ===

  Agent:      running
  SECRET_KEY: configured

REGISTERED SERVERS

  No servers with playit.gg domains configured

  Dashboard: https://playit.gg/account/tunnels
```

### 4단계: Minecraft Java 터널 생성

1. [playit.gg 대시보드](https://playit.gg/account/tunnels)에 접속합니다
2. **Add Tunnel**을 클릭합니다
3. 터널 타입으로 **Minecraft Java**를 선택합니다
4. **Local Address**를 `localhost:25565`로 설정합니다
5. **Create**를 클릭합니다
6. 할당된 도메인을 기록합니다 (예: `xx-xx.craft.playit.gg`)

!!! tip "모든 서버에 하나의 터널"
    `localhost:25565`를 가리키는 playit.gg 터널은 **하나**만 필요합니다. mc-router가 Minecraft 핸드셰이크의 호스트네임을 기반으로 올바른 서버로 라우팅합니다.

    단, 여러 서버가 외부에서 독립적으로 접근 가능하려면 각 서버마다 별도의 playit.gg 터널과 도메인이 필요합니다.

### 5단계: 서버에 도메인 등록

=== "새 서버"
    ```bash
    # playit 도메인과 함께 서버 생성
    mcctl create myserver -t PAPER -v 1.21.1 --playit-domain xx-xx.craft.playit.gg
    ```

=== "기존 서버"
    서버의 `docker-compose.yml`에서 mc-router.host 라벨에 playit 도메인을 추가합니다:

    ```yaml
    # ~/minecraft-servers/servers/myserver/docker-compose.yml
    services:
      mc-myserver:
        labels:
          mc-router.host: "myserver.192.168.1.100.nip.io,xx-xx.craft.playit.gg"
    ```

    서버를 재시작합니다:

    ```bash
    mcctl stop myserver && mcctl start myserver
    ```

### 6단계: 접속 및 공유

외부 플레이어는 이제 playit.gg 도메인으로 서버에 접속할 수 있습니다:

```
서버 주소: xx-xx.craft.playit.gg
```

playit.gg가 표준 Minecraft 포트(25565)로 매핑하므로 포트 번호는 필요하지 않습니다.

LAN 플레이어는 기존 주소를 계속 사용할 수 있습니다:

```
LAN: myserver.192.168.1.100.nip.io:25565
외부: xx-xx.craft.playit.gg
```

## 커스텀 도메인 설정 (프리미엄)

playit.gg 프리미엄 플랜 또는 보유한 도메인이 있으면, 서버에 커스텀 도메인을 설정할 수 있습니다.

### DNS 설정

DNS 레코드에 두 가지 옵션이 있습니다:

=== "A/CNAME 레코드"
    도메인을 playit.gg 터널로 직접 지정합니다:

    ```
    # A 레코드 (playit이 IP를 제공하는 경우)
    minecraft.example.com    A      <playit-tunnel-ip>

    # CNAME 레코드 (playit이 도메인을 제공하는 경우)
    minecraft.example.com    CNAME  xx-xx.craft.playit.gg
    ```

    플레이어 접속 주소: `minecraft.example.com`

=== "SRV 레코드"
    비표준 포트를 지정하거나 서브도메인을 추가할 때 SRV 레코드를 사용합니다:

    ```
    _minecraft._tcp.mc.example.com    SRV    0 5 <port> xx-xx.craft.playit.gg
    ```

    플레이어 접속 주소: `mc.example.com`

    !!! info "SRV 레코드 필드"
        | 필드 | 값 | 설명 |
        |------|-----|------|
        | Service | `_minecraft` | 서비스 식별자 |
        | Protocol | `_tcp` | Minecraft는 TCP 사용 |
        | Priority | `0` | 낮은 값이 우선 |
        | Weight | `5` | 로드 밸런싱 가중치 |
        | Port | `<port>` | playit.gg가 할당한 포트 |
        | Target | `xx-xx.craft.playit.gg` | playit.gg 터널 도메인 |

### A/CNAME vs SRV 비교

| 기능 | A/CNAME | SRV |
|------|---------|-----|
| 설정 난이도 | 간단 | 보통 |
| 커스텀 포트 | 불가 (25565 고정) | 가능 |
| 서브도메인 지원 | 직접 지정 | 서비스 레코드 경유 |
| 클라이언트 호환성 | 모든 클라이언트 | 대부분 (일부 구형 런처 미지원) |
| TTL 전파 | 빠름 | 느릴 수 있음 |

### mc-router 라벨 업데이트

커스텀 도메인을 설정한 후, 서버의 mc-router.host 라벨을 업데이트합니다:

```yaml
labels:
  mc-router.host: "myserver.192.168.1.100.nip.io,minecraft.example.com"
```

## playit-agent 관리

### CLI 명령어

| 명령어 | 설명 |
|--------|------|
| `mcctl playit start` | playit-agent 컨테이너 시작 |
| `mcctl playit stop` | playit-agent 컨테이너 중지 |
| `mcctl playit status` | 에이전트 상태 및 등록된 서버 확인 |
| `mcctl playit setup` | SECRET_KEY 설정 또는 재설정 |

### 상태 확인

```bash
mcctl playit status
```

등록된 서버가 있는 경우의 출력:

```
=== playit.gg Agent Status ===

  Agent:      running
  SECRET_KEY: configured
  Uptime:     2d 5h 30m

REGISTERED SERVERS

  SERVER              EXTERNAL DOMAIN
  ------              ---------------
  myserver            xx-xx.craft.playit.gg
  creative            yy-yy.craft.playit.gg

  Dashboard: https://playit.gg/account/tunnels
```

### JSON 출력

스크립팅 및 자동화용:

```bash
mcctl playit status --json
```

```json
{
  "agentStatus": "running",
  "agentRunning": true,
  "secretKeyConfigured": true,
  "enabled": true,
  "uptime": "2d 5h 30m",
  "servers": [
    {
      "serverName": "myserver",
      "playitDomain": "xx-xx.craft.playit.gg"
    }
  ]
}
```

## Web Console 관리

Management Console을 설정한 경우, 웹 인터페이스에서 playit.gg를 모니터링하고 제어할 수 있습니다.

### 대시보드

메인 대시보드에 다른 플랫폼 정보와 함께 playit.gg 상태가 표시됩니다. **PlayitSummaryCard**에서 다음을 확인할 수 있습니다:

- 에이전트 실행/중지 상태
- playit.gg 도메인이 설정된 서버 수
- playit.gg 대시보드 바로가기 링크

### 서버 상세 페이지

각 서버의 상세 페이지에 **ConnectionInfoCard**가 포함되어 있어 다음을 확인할 수 있습니다:

- LAN 접속 주소 (nip.io/mDNS)
- 외부 접속 주소 (playit.gg 도메인, 설정된 경우)
- 접속 상태 표시

### 라우팅 페이지

라우팅 페이지에서 **PlayitSection**으로 다음을 확인할 수 있습니다:

- 에이전트 상태 및 가동 시간
- 모든 등록된 서버와 외부 도메인
- playit-agent 시작/중지 제어

### API 엔드포인트

Management Console API에서 제공하는 playit.gg 엔드포인트:

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| `GET` | `/api/playit/status` | 에이전트 상태 및 서버 도메인 조회 |
| `POST` | `/api/playit/start` | playit-agent 시작 |
| `POST` | `/api/playit/stop` | playit-agent 중지 |

## 문제 해결

### 에이전트가 시작되지 않음

1. **SECRET_KEY 설정 확인:**
   ```bash
   mcctl playit status
   # SECRET_KEY가 "configured"로 표시되어야 합니다
   ```

2. **Docker 실행 확인:**
   ```bash
   docker ps
   ```

3. **에이전트 로그 확인:**
   ```bash
   docker logs playit-agent
   ```

4. **필요시 재설정:**
   ```bash
   mcctl playit setup
   ```

### 외부 플레이어가 접속할 수 없음

1. **에이전트 실행 확인:**
   ```bash
   mcctl playit status
   # Agent가 "running"으로 표시되어야 합니다
   ```

2. **playit.gg 대시보드에서 터널 확인:**
   - [https://playit.gg/account/tunnels](https://playit.gg/account/tunnels) 방문
   - `localhost:25565`를 가리키는 Minecraft Java 터널이 있는지 확인

3. **mc-router.host 라벨에 playit 도메인이 포함되어 있는지 확인:**
   ```bash
   docker inspect mc-myserver | grep mc-router.host
   # playit.gg 도메인이 포함되어 있어야 합니다
   ```

4. **LAN 접속을 먼저 테스트:**
   ```bash
   # LAN 접속은 되는데 외부 접속이 안 되면 터널 문제입니다
   mcctl status myserver
   ```

5. **mc-router 로그 확인:**
   ```bash
   docker logs router 2>&1 | grep playit
   ```

### 접속 시간 초과

- playit.gg 에이전트는 시작 후 터널을 설정하는 데 몇 초가 필요합니다
- `mcctl playit start` 후 10-15초 정도 기다린 후 테스트합니다
- 호스트 머신의 인터넷 연결을 확인합니다

### 도메인이 해석되지 않음

- playit.gg 대시보드에서 터널이 활성 상태인지 확인합니다
- 커스텀 도메인의 경우 DNS 레코드가 전파되었는지 확인합니다:
  ```bash
  nslookup minecraft.example.com
  # 또는
  dig minecraft.example.com
  ```
- 새 레코드의 DNS 전파에는 최대 48시간이 소요될 수 있습니다

## 보안 모범 사례

!!! warning "보안 고려사항"
    서버를 인터넷에 공개하면 잠재적인 악용에 노출됩니다. 안전을 위해 다음 사항을 준수하세요.

### 화이트리스트 활성화

서버에 접속할 수 있는 사람을 제한합니다:

```bash
mcctl whitelist myserver on
mcctl whitelist myserver add TrustedPlayer1
mcctl whitelist myserver add TrustedPlayer2
```

### 온라인 모드 유지

온라인 모드는 Mojang 서버를 통해 플레이어 신원을 확인합니다:

```bash
mcctl config myserver ONLINE_MODE true
```

!!! danger "공개 서버에서 온라인 모드를 비활성화하지 마세요"
    온라인 모드를 비활성화하면(`ONLINE_MODE=false`) 누구든지 아무 사용자 이름으로 접속할 수 있으며, 관리자를 사칭할 수 있습니다.

### 기본 RCON 비밀번호 변경

```bash
# ~/minecraft-servers/.env에서
RCON_PASSWORD=매우-안전한-랜덤-비밀번호
```

### 서버 활동 모니터링

```bash
# 온라인 플레이어 확인
mcctl player online myserver

# 의심스러운 활동을 위한 서버 로그 확인
mcctl logs myserver -f

# 감사 로그 확인
mcctl audit list --recent
```

### SECRET_KEY 보호

- playit.gg SECRET_KEY를 공개적으로 공유하지 마세요
- 키는 기본적으로 gitignore되는 `~/minecraft-servers/.env`에 저장됩니다
- 노출된 경우, playit.gg 대시보드에서 에이전트를 취소하고 새로 생성하세요

## 제한 사항

### 무료 티어 제한

| 제한 사항 | 세부 내용 |
|-----------|----------|
| 도메인 이름 | 자동 할당 (예: `xx-xx.craft.playit.gg`) |
| 리전 선택 | 자동 (가장 가까운 리전) |
| 커스텀 도메인 | 미지원 |
| 우선 라우팅 | 표준 |

### 기술적 제한

| 제한 사항 | 세부 내용 |
|-----------|----------|
| 지연 시간 | 리전 및 거리에 따라 ~10-50ms 추가 |
| 프로토콜 | TCP만 지원 (Minecraft에 충분) |
| Bedrock Edition | 이 설정에서는 미지원 (Java Edition 전용) |
| network_mode | playit-agent는 `host` 모드 사용 (localhost 포워딩에 필요) |

### 다른 솔루션과 비교

| 솔루션 | 포트 포워딩 | 설정 난이도 | 지연 시간 | 비용 |
|--------|------------|------------|----------|------|
| **playit.gg** | 불필요 | 쉬움 | 낮음-보통 | 무료 |
| **Tailscale/ZeroTier** | 불필요 | 보통 | 낮음 | 무료 (제한적) |
| **포트 포워딩** | 필요 | 보통 | 없음 | 무료 |
| **클라우드 호스팅** | 불필요 | 복잡 | 다양 | 유료 |

!!! tip "playit.gg vs VPN Mesh 사용 시기"
    - **playit.gg**: 도메인을 가진 누구나 접속할 수 있는 공개 또는 반공개 서버에 적합
    - **Tailscale/ZeroTier**: 고정된 신뢰할 수 있는 친구 그룹의 비공개 서버에 적합 ([네트워킹 가이드](networking.ko.md#vpn-mesh-네트워크) 참조)

## Docker 설정 참조

playit-agent는 플랫폼의 `docker-compose.yml`에 Docker Compose 프로필로 정의되어 있습니다:

```yaml
services:
  playit:
    image: ghcr.io/playit-cloud/playit-agent:0.16
    container_name: playit-agent
    network_mode: host
    environment:
      - SECRET_KEY=${PLAYIT_SECRET_KEY:?PLAYIT_SECRET_KEY must be set in .env}
    restart: unless-stopped
    profiles:
      - playit
```

주요 사항:

- **`network_mode: host`**: mc-router가 수신 대기하는 `localhost:25565`로 에이전트가 포워딩하기 위해 필요합니다
- **`profiles: [playit]`**: 에이전트는 명시적으로 활성화할 때만 시작됩니다 (`mcctl playit start` 또는 `docker compose --profile playit up -d`)
- **`image: ghcr.io/playit-cloud/playit-agent:0.16`**: 안정성을 위해 버전 0.16으로 고정되어 있습니다

### 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `PLAYIT_SECRET_KEY` | 예 (활성화 시) | playit.gg의 에이전트 인증 키 |

## 참고 문서

- **[네트워킹 가이드](networking.ko.md)** - nip.io, mDNS, VPN mesh를 이용한 LAN 네트워킹
- **[빠른 시작](../getting-started/quickstart.ko.md)** - 기본 서버 설정
- **[CLI 명령어](../cli/commands.ko.md)** - 전체 명령어 참조
- **[Management Console](../console/index.ko.md)** - 웹 기반 서버 관리
- **[playit.gg 문서](https://playit.gg/docs)** - playit.gg 공식 문서
