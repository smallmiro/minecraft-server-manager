# 서버 시작 및 중지 가이드

mcctl로 관리하는 Minecraft 서버의 시작, 중지, 재시작 방법을 종합적으로 정리한 가이드입니다.

## 개요

서버 수명주기를 관리하는 여러 가지 방법이 있습니다:

| 방법 | 범위 | 적합한 용도 |
|------|------|-------------|
| [mcctl CLI](#mcctl-cli-명령어) | 개별 서버 또는 전체 서버 | 일상적인 관리 |
| [Docker Compose](#docker-compose-직접-사용) | 전체 인프라 또는 개별 컨테이너 | 고급 사용자 |
| [Web Console](#web-console) | 브라우저를 통한 개별 서버 관리 | 시각적 관리 |
| [PM2](#pm2-서비스-관리) | Management Console 서비스 | 콘솔 수명주기 |
| [Auto-Scale](#auto-scale-mc-router) | 플레이어 활동에 따른 자동 시작/중지 | 자동 운영 |

---

## mcctl CLI 명령어

### 전체 인프라 시작

mc-router와 모든 Minecraft 서버를 시작합니다:

```bash
mcctl up
```

`docker compose up -d`와 동일합니다. mc-router와 등록된 모든 서버를 포함한 전체 플랫폼을 시작합니다.

### 전체 인프라 중지

모든 서버, mc-router를 중지하고 Docker 네트워크를 제거합니다:

```bash
mcctl down
```

`docker compose down`을 실행하여 모든 mc-* 컨테이너를 중지합니다.

### 개별 서버 시작

```bash
# 특정 서버 시작
mcctl start myserver

# 모든 Minecraft 서버 시작 (mc-router 제외)
mcctl start --all
```

| 옵션 | 단축 | 설명 |
|------|------|------|
| `--all` | `-a` | 모든 Minecraft 서버 시작 (라우터 제외) |

### 개별 서버 중지

```bash
# 특정 서버 중지
mcctl stop myserver

# 모든 Minecraft 서버 중지 (mc-router 제외)
mcctl stop --all
```

| 옵션 | 단축 | 설명 |
|------|------|------|
| `--all` | `-a` | 모든 Minecraft 서버 중지 (라우터 제외) |

### 서버 재시작

서버를 재시작하려면 (예: 설정 변경 후):

```bash
mcctl stop myserver && mcctl start myserver
```

!!! tip "재시작이 필요한 경우"
    다음 변경 후에는 서버를 재시작해야 합니다:

    - `config.env` 설정 변경
    - `server.properties` 수정
    - 모드/플러그인 추가 또는 제거
    - 메모리 할당량 변경

### mc-router 독립 관리

```bash
mcctl router start     # mc-router만 시작
mcctl router stop      # mc-router만 중지
mcctl router restart   # mc-router 재시작
```

플레이어가 호스트네임 라우팅으로 서버에 접속하려면 mc-router가 실행 중이어야 합니다.

---

## Docker Compose 직접 사용

Docker Compose 명령어를 직접 사용하려는 고급 사용자를 위한 방법입니다. 모든 명령어는 플랫폼 루트 디렉토리(기본값: `~/minecraft-servers`)에서 실행해야 합니다.

### 전체 시작

```bash
cd ~/minecraft-servers
docker compose up -d
```

### 전체 중지

```bash
cd ~/minecraft-servers
docker compose down
```

### 개별 컨테이너 시작/중지

```bash
# 특정 서버 컨테이너 시작
docker compose up -d mc-myserver

# 특정 서버 컨테이너 중지
docker compose stop mc-myserver

# 특정 컨테이너 재시작
docker compose restart mc-myserver
```

### 컨테이너 상태 확인

```bash
docker compose ps
```

!!! note "mcctl CLI 사용 권장"
    Docker Compose 명령어도 동작하지만, `mcctl` 명령어는 mDNS 등록이나 compose 파일 관리 등 추가 작업도 처리합니다. Docker Compose 직접 사용은 문제 해결이나 고급 시나리오에서만 권장합니다.

---

## Web Console

Management Console은 `http://localhost:5000`에서 브라우저 기반 서버 관리 인터페이스를 제공합니다.

### 사전 요구사항

Management Console이 설치되고 실행 중이어야 합니다:

```bash
mcctl console init       # 최초 설정
mcctl console service start   # 콘솔 시작
```

### Web UI를 통한 서버 제어

**대시보드**에서 각 서버 카드의 빠른 액션 버튼을 사용합니다:

| 버튼 | 동작 | 사용 가능 시점 |
|------|------|----------------|
| 재생 (Start) | 서버 시작 | 서버가 중지된 상태 |
| 중지 (Stop) | 정상 종료 | 서버가 실행 중 |
| 재시작 (Restart) | 중지 후 시작 | 서버가 실행 중 |

### 서버 상세 페이지

서버 카드를 클릭하면 상세 제어에 접근할 수 있습니다:

1. 서버 제어 섹션의 **시작/중지/재시작** 버튼
2. **콘솔 패널** - `stop`을 포함한 RCON 명령어 실행
3. **실시간 상태** - SSE 기반 실시간 상태 업데이트 (폴링 없음)

### REST API

프로그래밍 방식 제어를 위한 API 엔드포인트:

```bash
# 서버 시작
curl -X POST http://localhost:5001/servers/myserver/start

# 서버 중지
curl -X POST http://localhost:5001/servers/myserver/stop

# 서버 재시작
curl -X POST http://localhost:5001/servers/myserver/restart
```

인증 세부사항은 [API 참조](../api/index.ko.md)를 확인하세요.

---

## PM2 서비스 관리

PM2는 Minecraft 서버가 아닌 Management Console 서비스(mcctl-api, mcctl-console)를 관리합니다.

### 콘솔 서비스 명령어

```bash
# Management Console 서비스 시작
mcctl console service start

# Management Console 서비스 중지
mcctl console service stop

# Management Console 서비스 재시작
mcctl console service restart

# 서비스 상태 확인
mcctl console service status
```

### PM2 직접 명령어

```bash
# 관리 중인 모든 프로세스 확인
pm2 list

# 로그 확인
pm2 logs mcctl-api
pm2 logs mcctl-console

# 서비스 재시작
pm2 restart mcctl-api
pm2 restart mcctl-console
```

!!! warning "PM2와 Minecraft 서버의 차이"
    PM2는 **Management Console** (API + Web UI)을 관리하며, Minecraft 서버를 관리하지 않습니다. Minecraft 서버는 Docker 컨테이너로 관리됩니다.

---

## Auto-Scale (mc-router)

mc-router는 플레이어 활동에 따라 서버를 자동으로 시작/중지하는 기능을 지원합니다. 리소스 최적화를 위한 권장 방법입니다.

### 동작 원리

1. **Auto-Scale Up**: 플레이어가 대기 중인 서버의 호스트네임에 접속하면, mc-router가 자동으로 Docker 컨테이너를 시작합니다
2. **Auto-Scale Down**: 설정된 유휴 시간 동안 플레이어가 없으면, mc-router가 컨테이너를 중지합니다

```
플레이어 접속 → mc-router 감지 → Docker 컨테이너 시작 → 플레이어 입장
                                                            ↓
                                                    10분간 플레이어 없음
                                                            ↓
                                                mc-router 컨테이너 중지
```

### 설정

`.env`에서 Auto-Scale을 설정합니다:

```bash
# 플레이어 접속 시 자동 시작 활성화
AUTO_SCALE_UP=true

# 유휴 시 자동 중지 활성화
AUTO_SCALE_DOWN=true

# 중지까지의 유휴 시간 (1m, 5m, 10m, 30m, 1h)
AUTO_SCALE_DOWN_AFTER=10m

# 컨테이너 시작 타임아웃 (초)
DOCKER_TIMEOUT=120

# 서버 시작 중 표시되는 커스텀 MOTD
AUTO_SCALE_ASLEEP_MOTD=§e§lServer is sleeping§r\n§7Connect to wake up!
```

설정 변경 후 mc-router를 재시작합니다:

```bash
mcctl router restart
```

### 플레이어 경험

Auto-Scale이 활성화된 경우:

- **대기 중인 서버**: 플레이어에게 커스텀 MOTD가 표시되고 재시도를 요청합니다
- **시작 중인 서버**: 컨테이너가 시작되는 동안 잠시 대기합니다 (보통 30~120초)
- **실행 중인 서버**: 수동으로 시작한 서버와 동일한 정상 게임플레이

!!! tip "접속 시 자동 시작"
    Auto-Scale이 활성화되면 수동으로 서버를 시작할 필요가 없습니다. 플레이어가 접속하면 서버가 자동으로 시작됩니다.

---

## 빠른 참조

### 일반적인 시나리오

=== "전체 시작"

    ```bash
    mcctl up
    ```

=== "전체 중지"

    ```bash
    mcctl down
    ```

=== "서버 하나 재시작"

    ```bash
    mcctl stop myserver && mcctl start myserver
    ```

=== "모든 서버만 시작"

    ```bash
    mcctl start --all
    ```

=== "모든 서버만 중지"

    ```bash
    mcctl stop --all
    ```

### 명령어 요약

| 작업 | 명령어 |
|------|--------|
| 전체 시작 (라우터 + 서버) | `mcctl up` |
| 전체 중지 | `mcctl down` |
| 서버 하나 시작 | `mcctl start <name>` |
| 서버 하나 중지 | `mcctl stop <name>` |
| 모든 서버 시작 (라우터 제외) | `mcctl start --all` |
| 모든 서버 중지 (라우터 제외) | `mcctl stop --all` |
| mc-router만 시작 | `mcctl router start` |
| mc-router만 중지 | `mcctl router stop` |
| mc-router 재시작 | `mcctl router restart` |
| 콘솔 서비스 시작 | `mcctl console service start` |
| 콘솔 서비스 중지 | `mcctl console service stop` |

### 인프라 vs 서버

인프라 명령어와 서버 명령어의 차이:

| 범위 | 시작 | 중지 | 영향 범위 |
|------|------|------|-----------|
| **전체 인프라** | `mcctl up` | `mcctl down` | mc-router + 모든 서버 + 네트워크 |
| **모든 서버** | `mcctl start --all` | `mcctl stop --all` | 모든 Minecraft 서버 (라우터 제외) |
| **개별 서버** | `mcctl start <name>` | `mcctl stop <name>` | Minecraft 서버 하나 |
| **라우터만** | `mcctl router start` | `mcctl router stop` | mc-router만 |
| **콘솔 서비스** | `mcctl console service start` | `mcctl console service stop` | API + Web UI (PM2) |

## 관련 문서

- [CLI 명령어 참조](../cli/commands.ko.md) - 전체 명령어 참조
- [네트워킹 가이드](../advanced/networking.ko.md) - 호스트네임 라우팅과 DNS
- [Web Console 가이드](../console/web-console.ko.md) - Web UI 상세 정보
- [API 참조](../api/index.ko.md) - REST API 엔드포인트
