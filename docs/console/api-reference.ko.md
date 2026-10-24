# API 레퍼런스

mcctl-api 서버의 완전한 REST API 문서입니다.

## 개요

mcctl-api는 Docker Minecraft 서버를 관리하기 위한 RESTful 인터페이스를 제공합니다. 모든 엔드포인트는 JSON 응답을 반환합니다.

**기본 URL:** `http://localhost:5001`

**문서:** 서비스가 실행 중일 때 `/docs`에서 Swagger UI를 사용할 수 있습니다.

## 인증

인증은 구성된 접근 모드를 기반으로 합니다.

### API 키 인증

`api-key` 또는 `combined` 모드를 사용할 때, 요청 헤더에 API 키를 포함합니다:

```http
X-API-Key: mctk_your_api_key_here
```

### 기본 인증

`basic` 모드를 사용할 때, Authorization 헤더에 자격 증명을 포함합니다:

```http
Authorization: Basic base64(username:password)
```

### curl 예제

```bash
# API 키 인증
curl -H "X-API-Key: mctk_your_key" http://localhost:5001/api/servers

# 기본 인증
curl -u admin:password http://localhost:5001/api/servers
```

## 엔드포인트

### 상태 확인

#### GET /health

API 서버 상태를 확인합니다.

**인증:** 필요 없음

**응답:**

```json
{
  "status": "healthy"
}
```

**상태 코드:**

| 코드 | 설명 |
|------|------|
| 200 | 서비스 정상 |
| 503 | 서비스 비정상 |

---

### 서버 관리

#### GET /api/servers

모든 Minecraft 서버를 조회합니다.

**응답:**

```json
{
  "servers": [
    {
      "name": "survival",
      "container": "mc-survival",
      "status": "running",
      "health": "healthy",
      "hostname": "survival.192.168.1.100.nip.io"
    },
    {
      "name": "creative",
      "container": "mc-creative",
      "status": "exited",
      "health": "none",
      "hostname": "creative.192.168.1.100.nip.io"
    }
  ],
  "total": 2
}
```

**서버 상태 값:**

| 상태 | 설명 |
|------|------|
| `running` | 컨테이너 실행 중 |
| `exited` | 컨테이너 중지됨 |
| `created` | 컨테이너 생성됨(시작 안 됨) |
| `paused` | 컨테이너 일시 중지됨 |

**상태 값:**

| 상태 | 설명 |
|------|------|
| `healthy` | 헬스 체크 통과 |
| `unhealthy` | 헬스 체크 실패 |
| `starting` | 헬스 체크 진행 중 |
| `none` | 헬스 체크 구성 안 됨 |

---

#### GET /api/servers/:name

특정 서버의 상세 정보를 조회합니다.

**매개변수:**

| 매개변수 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 서버 이름 (`mc-` 접두사 없이) |

**응답:**

```json
{
  "server": {
    "name": "survival",
    "container": "mc-survival",
    "status": "running",
    "health": "healthy",
    "hostname": "survival.192.168.1.100.nip.io",
    "type": "PAPER",
    "version": "1.21.1",
    "memory": "4G",
    "uptime": "2d 5h 30m",
    "uptimeSeconds": 192600,
    "players": {
      "online": 3,
      "max": 20,
      "list": ["Player1", "Player2", "Player3"]
    },
    "stats": {
      "cpu": "15.2%",
      "memory": "2.1GB / 4GB"
    },
    "worldName": "survival",
    "worldSize": "1.2 GB"
  }
}
```

**오류 응답 (404):**

```json
{
  "error": "NotFound",
  "message": "Server 'unknown' not found"
}
```

---

#### GET /api/servers/:name/logs

서버 콘솔 로그를 조회합니다.

**매개변수:**

| 매개변수 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 서버 이름 |

**쿼리 매개변수:**

| 매개변수 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `lines` | integer | 100 | 반환할 로그 라인 수 |

**예제:**

```bash
curl "http://localhost:5001/api/servers/survival/logs?lines=50"
```

**응답:**

```json
{
  "logs": "[10:30:15] [Server thread/INFO]: Player1 joined the game\n[10:30:20] [Server thread/INFO]: Player1 has made the advancement [Getting Wood]",
  "lines": 50
}
```

---

### 서버 액션

#### POST /api/servers/:name/start

중지된 서버를 시작합니다.

**매개변수:**

| 매개변수 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 서버 이름 |

**응답:**

```json
{
  "success": true,
  "server": "survival",
  "action": "start",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "message": "Server started successfully"
}
```

**오류 응답:**

```json
{
  "success": false,
  "server": "survival",
  "action": "start",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "error": "Failed to execute action",
  "message": "Container already running"
}
```

---

#### POST /api/servers/:name/stop

실행 중인 서버를 중지합니다.

**매개변수:**

| 매개변수 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 서버 이름 |

**응답:**

```json
{
  "success": true,
  "server": "survival",
  "action": "stop",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "message": "Server stopped successfully"
}
```

---

#### POST /api/servers/:name/restart

서버를 재시작합니다 (중지 후 시작).

**매개변수:**

| 매개변수 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 서버 이름 |

**응답:**

```json
{
  "success": true,
  "server": "survival",
  "action": "restart",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "message": "Server restarted successfully"
}
```

---

### 콘솔 명령

#### POST /api/servers/:name/exec

서버에서 RCON 명령을 실행합니다.

**매개변수:**

| 매개변수 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 서버 이름 |

**요청 본문:**

```json
{
  "command": "list"
}
```

**응답:**

```json
{
  "success": true,
  "output": "There are 3 of a max of 20 players online: Player1, Player2, Player3"
}
```

**명령어 예제:**

```bash
# 플레이어 목록
curl -X POST http://localhost:5001/api/servers/survival/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "list"}'

# 메시지 방송
curl -X POST http://localhost:5001/api/servers/survival/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "say Server will restart in 5 minutes!"}'

# 플레이어에게 아이템 지급
curl -X POST http://localhost:5001/api/servers/survival/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "give Player1 diamond 64"}'

# 월드 저장
curl -X POST http://localhost:5001/api/servers/survival/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "save-all"}'
```

---

### 서버 생성/삭제

#### POST /api/servers

새 Minecraft 서버를 생성합니다.

**요청 본문:**

```json
{
  "name": "newserver",
  "type": "PAPER",
  "version": "1.21.1",
  "memory": "4G",
  "seed": "12345",
  "autoStart": true
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | string | 예 | 서버 이름 (영숫자, 하이픈 허용) |
| `type` | string | 아니오 | 서버 유형: PAPER, VANILLA, FORGE, FABRIC 등 (기본값: PAPER) |
| `version` | string | 아니오 | Minecraft 버전 (기본값: LATEST) |
| `memory` | string | 아니오 | 메모리 할당 (예: "4G") |
| `seed` | string | 아니오 | 월드 시드 |
| `worldUrl` | string | 아니오 | 월드 ZIP 다운로드 URL |
| `worldName` | string | 아니오 | 사용할 기존 월드 이름 |
| `autoStart` | boolean | 아니오 | 생성 후 서버 시작 (기본값: true) |

**응답 (201):**

```json
{
  "success": true,
  "server": {
    "name": "newserver",
    "container": "mc-newserver",
    "status": "starting"
  }
}
```

**오류 응답 (409 - 충돌):**

```json
{
  "error": "Conflict",
  "message": "Server 'newserver' already exists"
}
```

서버가 쓸 월드(`worldName`, 없으면 기본 월드 `<이름>`)가 다른 서버에 배정되어 있거나, 다른 서버의 `config.env`를 해석할 수 없을 때도 `409`를 반환합니다(#670). [월드 할당 규칙](../cli/commands.md#world-assignment-rules)을 참고하세요.

---

#### DELETE /api/servers/:name

Minecraft 서버를 삭제합니다.

**매개변수:**

| 매개변수 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 서버 이름 |

**쿼리 매개변수:**

| 매개변수 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `force` | boolean | false | 호환용으로 받음. 실행 중인 서버는 항상 정지한 뒤 삭제 |
| `deleteWorld` | boolean | false | 서버 안의 월드(`servers/<name>/data/<LEVEL>`)를 `worlds/`로 옮기지 않고 삭제. `worlds/`의 월드는 지우지 않음 |

**요청 본문(선택):**

| 필드 | 타입 | 설명 |
|------|------|------|
| `sudoPassword` | string | `/etc/avahi/hosts`에서 mDNS 호스트명 `<name>.local`을 지울 때 쓰는 sudo 비밀번호(쓰기 전용, 로그에 남지 않음). sudoers `NOPASSWD` 규칙이 있으면 필요 없음 |

기본 동작은 서버 안의 월드를 `worlds/<LEVEL>`로 옮기는 것입니다. `worlds/`에 같은 이름이 이미 있거나, 서버 안의 월드 위치를 확정할 수 없으면([`mcctl delete`](../cli/commands.ko.md#mcctl-delete) 참고) `409`로 실패하고 아무것도 지우지 않습니다. Docker 조회나 컨테이너 정지에 실패하면 `500`으로 실패하고 아무것도 지우지 않습니다. 컨테이너를 지운 뒤의 `409`(예: 다른 mcctl 프로세스가 `servers/compose.yml`을 잠금, 월드 이동 실패)는 그 사실과 이미 `worlds/`로 옮긴 월드, 남은 정리 작업을 알려 줍니다. 서버는 월드를 옮기기 전에 `servers/compose.yml`에서 빠지므로 그동안 시작 요청이 서버를 되살리지 못하고, 이동이 실패하면 다시 넣습니다. 다른 프로세스(예: `mcctl delete`)가 삭제 중인 서버를 삭제하면 `409`로 실패합니다. `servers/compose.yml`에 그 서버의 손으로 쓴 include 항목(`<name>/docker-compose.yml` 외의 형태)이 있어도 아무것도 바꾸기 전에 `409`로 실패합니다. 삭제 전에 백업은 하지 않습니다.

**예제:**

```bash
curl -X DELETE "http://localhost:5001/api/servers/myserver" \
  -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"sudoPassword": "your-sudo-password"}'
```

**응답:**

```json
{
  "success": true,
  "server": "myserver",
  "message": "Server deleted successfully"
}
```

서버는 삭제했지만 mDNS 호스트명을 지우지 못하면 응답에 `warning`이 붙습니다(예: `"mDNS hostname myserver.local was not removed: sudo authentication failed; check the sudo password"`). `servers/compose.yml`에서 빠진 뒤 `servers/<name>/`에 파일이 남은 경우(예: 컨테이너가 root로 만든 파일)도 같습니다. 서버는 삭제된 것으로 보고 `warning`이 `sudo rm -rf`로 지우라고 알려 줍니다. 두 경고가 함께 있으면 `; `로 이어 붙입니다.

!!! note "월드 데이터 보존"
    서버를 삭제해도 월드 데이터는 삭제되지 않습니다. 월드는 공유 `/worlds/` 디렉터리에 저장됩니다.

---

### 라우터 상태

#### GET /api/router/status

mc-router 상태와 라우팅 정보를 조회합니다.

**응답:**

```json
{
  "router": {
    "name": "mc-router",
    "status": "running",
    "health": "healthy",
    "port": 25565,
    "uptime": "5d 12h 30m",
    "uptimeSeconds": 477000,
    "mode": "auto-scale",
    "routes": [
      {
        "hostname": "survival.192.168.1.100.nip.io",
        "target": "mc-survival:25565",
        "serverStatus": "running",
        "autoScaleUp": true,
        "autoScaleDown": true,
        "discoveredByRouter": true
      },
      {
        "hostname": "creative.192.168.1.100.nip.io",
        "target": "mc-creative:25565",
        "serverStatus": "exited",
        "autoScaleUp": true,
        "autoScaleDown": false,
        "discoveredByRouter": true
      }
    ],
    "image": "itzg/mc-router:1.47.1",
    "autoScale": {
      "up": true,
      "down": true,
      "downAfter": "10m",
      "asleepMotd": "§e§lServer is sleeping§r\\n§7Connect to wake up!"
    },
    "resolver": {
      "hostIp": "192.168.1.100",
      "hostIps": ["192.168.1.100"]
    }
  },
  "avahi": {
    "name": "avahi-daemon",
    "status": "running",
    "type": "system"
  },
  "playit": {
    "enabled": false,
    "agentRunning": false,
    "secretKeyConfigured": false
  }
}
```

| 필드 | 설명 |
|------|------|
| `status` | 라우터 컨테이너 상태 |
| `health` | 헬스 체크 상태 |
| `port` | 외부 리스닝 포트 |
| `uptime` / `uptimeSeconds` | 라우터 가동 시간(표시용 문자열과 초 단위, 선택) |
| `mode` | 라우팅 모드 (자동 스케일 활성화) |
| `routes` | 호스트명-서버 매핑 목록 |
| `image` | 라우터 컨테이너 이미지 (선택) |
| `autoScale` | 라우터 컨테이너의 전역 자동 스케일 설정 (선택) |
| `resolver` | `<server>.<ip>.nip.io` 호스트명에 쓰는 호스트 주소 (선택) |
| `avahi` | `avahi-daemon` 상태 (선택) |
| `playit` | playit.gg 요약: `enabled`, `agentRunning`, `secretKeyConfigured`. playit 상태를 읽지 못하면 생략됩니다 |

**`router.autoScale`:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `up` | boolean | 전역 `AUTO_SCALE_UP`: 클라이언트가 접속하면 중지된 서버를 시작합니다. 값이 없거나 잘못되면 `false` |
| `down` | boolean | 전역 `AUTO_SCALE_DOWN`: 유휴 서버를 중지합니다. 값이 없거나 잘못되면 `false` |
| `downAfter` | string | `AUTO_SCALE_DOWN_AFTER`를 적은 그대로(Go duration, 예: `10m`). 설정하지 않으면 없음 |
| `asleepMotd` | string | `AUTO_SCALE_ASLEEP_MOTD`를 적은 그대로. 문자 그대로의 `\n`과 `§` 색상 코드가 들어갈 수 있습니다. 설정하지 않으면 없음 |

**`router.resolver`:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `hostIps` | string[] | 호스트 주소 목록. 서버 생성과 같은 규칙을 씁니다: `.env`의 `HOST_IPS` / `HOST_IP`(쉼표로 구분한 목록), 없으면 탐지한 호스트 주소 |
| `hostIp` | string | `hostIps`의 첫 번째 항목. 알려진 주소가 없으면 없음 |

**`router.routes[]` 선택 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `autoScaleUp` | boolean | 서버의 `mc-router.auto-scale-up` 레이블이 boolean으로 해석되면 그 값, 아니면 라우터 전역 값. 전역 `AUTO_SCALE_UP`이 꺼져 있으면 mc-router가 중지된 컨테이너를 무시하므로 항상 `false` |
| `autoScaleDown` | boolean | 서버의 `mc-router.auto-scale-down` 레이블이 boolean으로 해석되면 그 값, 아니면 라우터 전역 값 |
| `discoveredByRouter` | boolean | mc-router가 관리 API(`127.0.0.1:25580` `/routes`)에 이 호스트명을 나열하는지 여부 |

필드가 없을 수 있는 경우:

- mc-router가 실행 중이 아니거나 관리 API를 읽을 수 없으면 모든 route에서 `discoveredByRouter`가 없습니다.
- 전역 `AUTO_SCALE_UP`이 꺼져 있는 동안에는 mc-router가 중지된 컨테이너를 무시하므로, 중지된 route는 판정하지 않아 `discoveredByRouter`가 없습니다. 실행 중인 route는 계속 판정합니다.
- `autoScaleUp` / `autoScaleDown`은 값을 알 수 없으면(쓸 수 있는 레이블도 없고 라우터 전역 값도 모르는 경우) 없습니다.

---

### 라우터 재시작

#### POST /api/router/restart

`docker compose restart router`를 실행해 mc-router 컨테이너를 재시작합니다. 재시작하는 동안 라우터를 거치는 플레이어 연결이 끊어집니다.

인증은 전역 API 인증을 따릅니다. 요청 본문은 없습니다.

**예시:**

```bash
curl -X POST "http://localhost:5001/api/router/restart" \
  -H "X-API-Key: mctk_xxx"
```

**응답 (200):**

```json
{
  "success": true,
  "message": "mc-router restarted"
}
```

**응답 (500):**

```json
{
  "error": "InternalServerError",
  "message": "Failed to restart mc-router"
}
```

실패했을 때 `message`에는 `docker compose`가 보고한 오류가 담깁니다.

모든 요청에 감사 로그가 남습니다: action `router.restart`, status `success` 또는 `failure`, target type `service`, target name `mc-router`.

!!! note "콘솔에서는 관리자 전용"
    웹 콘솔에서 `POST /api/router/restart`는 관리자 역할을 요구하는(`requireAdmin`) BFF 라우트이며, 라우터 페이지의 재시작 버튼은 관리자에게만 보입니다.

---

### 라우터 로그 스트림 (SSE)

#### GET /api/router/logs/stream

mc-router 로그를 실시간으로 따라갑니다(`docker logs -f mc-router`). 로그 한 줄이 `router-log` 이벤트 하나가 됩니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `tail` | integer | 100 | 먼저 재생할 최근 로그 줄 수. 1..500으로 보정되며, 비어 있거나 숫자가 아니면 100 |

**예시:**

```bash
curl -N "http://localhost:5001/api/router/logs/stream?tail=50" \
  -H "X-API-Key: mctk_xxx"
```

**이벤트:**

| 이벤트 | 데이터 | 설명 |
|--------|--------|------|
| `connected` | `{ "timestamp": "..." }` | 스트림이 열릴 때 한 번 전송 |
| `router-log` | `RouterLogEvent` | 로그 한 줄마다 하나 |
| `end` | `{ "code": 0, "error"?: "..." }` | 로그 프로세스가 종료됨(실행하지 못하면 `code`는 `null`). 이후 스트림이 닫힙니다 |

30초마다 `: heartbeat` 주석이 전송됩니다. 클라이언트가 연결을 끊으면 서버 쪽 `docker logs -f mc-router` 프로세스를 종료합니다.

```
event: connected
data: {"timestamp":"2026-10-24T09:12:03.418Z"}

event: router-log
data: {"ts":"2026-10-24T09:12:01Z","kind":"connect","hostname":"survival.192.168.1.100.nip.io","target":"mc-survival:25565","player":"Steve","raw":"time=\"2026-10-24T09:12:01Z\" level=info msg=\"Connecting to backend\" backendHostPort=\"mc-survival:25565\" player=Steve/069a79f4-44e9-4726-a5be-fca90e38aaf5 server=survival.192.168.1.100.nip.io"}
```

**`RouterLogEvent`:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `ts` | string | 로그 줄의 `time` 필드. logfmt가 아닌 줄에는 없음 |
| `kind` | string | `connect`, `wake`, `error`, `info` 중 하나 |
| `hostname` | string | 클라이언트가 요청한 호스트명. `connect`, `wake`, `error` 이벤트에서 줄에 값이 있을 때만 |
| `target` | string | 연결을 보낸 백엔드 `host:port`. `hostname`과 같은 조건 |
| `player` | string | 플레이어 이름. 상태 핑이 아닌 로그인 연결에만 있음 |
| `raw` | string | 원본 로그 줄 |

`kind` 결정 규칙:

| 조건 | `kind` |
|------|--------|
| 로그 레벨이 `warning` 이상(`warning`, `error`, `fatal`, `panic`) | `error` |
| 메시지 `Connecting to backend` | `connect` |
| 메시지 `Scaling up backend server` 또는 `Woke up backend server` | `wake` |
| 그 밖의 줄(해석할 수 없는 줄 포함) | `info` (`raw`만, 알 수 있으면 `ts` 추가) |

---

### 라우터 상태 스트림 (SSE)

#### GET /api/router/status/stream

`GET /api/router/status`와 같은 페이로드를 스트리밍합니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `interval` | integer | 5000 | 폴링 간격(밀리초, 1000..60000) |

**이벤트:**

| 이벤트 | 데이터 | 설명 |
|--------|--------|------|
| `router-status` | `GET /api/router/status`와 같은 페이로드 | 연결 즉시 전송하고, 이후에는 상태가 바뀔 때만 전송 |
| `router-status-error` | `{ "timestamp": "..." }` | 폴링에 실패함. 클라이언트는 `GET /api/router/status` 폴링으로 전환해야 하며, 다음 정상 페이로드는 바뀌지 않았어도 다시 전송됩니다 |

- `uptimeSeconds`만 바뀐 경우는 무시합니다. 표시용 `uptime` 문자열은 변경으로 칩니다.
- 같은 `interval`을 쓰는 연결은 폴링 하나를 공유합니다.
- 30초마다 `: heartbeat` 주석이 전송됩니다.

**예시:**

```bash
curl -N "http://localhost:5001/api/router/status/stream?interval=5000" \
  -H "X-API-Key: mctk_xxx"
```

### 플레이어 관리

#### GET /api/servers/:name/players

서버의 온라인(RCON) + 알려진(파일 기반) 플레이어를 통합 조회합니다 (#528). 서버가 정지 상태여도 조회 가능하며, 이 경우 `roster`는 파일 기반으로만 채워지고 `online`/`max`/`players`는 0/빈 배열입니다. `?follow=true&interval=<ms>`(기본값 `5000`)로 SSE 스트리밍을 지원하며, 동일한 JSON을 담은 `event: players` 이벤트와 30초 간격 하트비트를 전송합니다 — `GET /api/servers/:name/players/live`와 동일한 패턴입니다.

**응답:**

```json
{
  "serverName": "survival",
  "running": true,
  "online": 3,
  "max": 20,
  "players": ["Player1", "Player2", "Player3"],
  "roster": [
    {
      "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
      "name": "Player1",
      "lastSeen": "2026-09-20T12:34:56.000Z",
      "isOp": false,
      "isBanned": false,
      "isWhitelisted": true,
      "online": true
    }
  ]
}
```

---

#### GET /api/servers/:name/players/:uuid

UUID로 알려진 플레이어 한 명을 조회합니다 (#528, `uuid`는 대시 포함 Minecraft UUID 형식이어야 함). 서버가 정의되지 않았거나 플레이어를 알 수 없으면 404를 반환합니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `include` | string | 쉼표로 구분된 추가 데이터 목록: `stats`, `nbt`, `sessions` (순서/조합 무관, #528, Phase 2/3/4); 알 수 없는 값은 400을 반환합니다. |

`?include=stats`를 지정하면 `stats` 필드가 추가됩니다(플레이어의 `stats/<uuid>.json` + `advancements/<uuid>.json` 기반). 통계 파일이 있으면 객체, 없으면 `null`입니다.

`?include=nbt`를 지정하면 `data`(플레이어의 `playerdata/<uuid>.dat`에서 파싱한 마지막 위치/체력/게임모드/인벤토리 요약)와 `livePosition`(플레이어가 온라인이고 서버가 실행 중일 때만 RCON으로 조회하는 현재 위치) 필드가 추가됩니다. 두 필드 모두 데이터가 없으면(playerdata 파일 없음, 오프라인, 서버 중지 등) `null`입니다.

`?include=sessions`를 지정하면 `sessions` 필드가 추가됩니다: 방문 횟수, 누적 플레이타임, 마지막 접속 시각, 최근 접속/퇴장 타임라인(최신순, 최대 20개)을 담습니다. 이 이력은 배포 시점부터 서버 로그에서 수집됩니다 (최초 실행 시 컨테이너 로그 최근 24시간분을 소급 수집합니다) — 백그라운드 수집기가 30초마다 실행 중인 서버의 Docker 로그에서 `<플레이어> joined/left the game` 메시지를 파싱하여 `data/players.db`(SQLite, `MCCTL_ROOT` 하위)에 저장합니다. 신규 플레이어이거나 `players.db`가 비어 있어도 `sessions`는 `null`이 아니라 `visitCount: 0`, `totalPlaytimeSeconds: 0`, `lastSeen: null`, `recent: []` 형태의 객체로 반환됩니다.

각 키(`stats`, `data`, `livePosition`, `sessions`)는 해당하는 `include` 값을 요청하지 않으면 응답에 포함되지 않습니다.

**응답:**

```json
{
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "name": "Player1",
  "lastSeen": "2026-09-20T12:34:56.000Z",
  "isOp": false,
  "isBanned": false,
  "isWhitelisted": true,
  "online": true
}
```

**`?include=stats` 응답:**

```json
{
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "name": "Player1",
  "lastSeen": "2026-09-20T12:34:56.000Z",
  "isOp": false,
  "isBanned": false,
  "isWhitelisted": true,
  "online": true,
  "stats": {
    "playTimeSeconds": 600,
    "deaths": 3,
    "mobKills": 10,
    "playerKills": 1,
    "distanceMeters": 500,
    "blocksMined": 42,
    "itemsCrafted": 7,
    "advancementsCompleted": 1
  }
}
```

**`?include=nbt` 응답:**

```json
{
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "name": "Player1",
  "lastSeen": "2026-09-20T12:34:56.000Z",
  "isOp": false,
  "isBanned": false,
  "isWhitelisted": true,
  "online": true,
  "data": {
    "x": 10.5,
    "y": 64,
    "z": -20.25,
    "dimension": "overworld",
    "health": 20,
    "food": 18,
    "xpLevel": 7,
    "gameMode": "survival",
    "inventory": { "slotsUsed": 3, "items": [{ "id": "minecraft:diamond", "count": 12 }] }
  },
  "livePosition": { "x": 10.6, "y": 64, "z": -20.1, "dimension": "overworld" }
}
```

**`?include=sessions` 응답:**

```json
{
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "name": "Player1",
  "lastSeen": "2026-09-20T12:34:56.000Z",
  "isOp": false,
  "isBanned": false,
  "isWhitelisted": true,
  "online": true,
  "sessions": {
    "visitCount": 12,
    "totalPlaytimeSeconds": 43200,
    "lastSeen": "2026-09-27T08:13:49.000Z",
    "recent": [
      { "joinedAt": "2026-09-27T07:00:00.000Z", "leftAt": "2026-09-27T08:13:49.000Z", "durationSeconds": 4429 },
      { "joinedAt": "2026-09-26T20:00:00.000Z", "leftAt": "2026-09-26T21:30:00.000Z", "durationSeconds": 5400 }
    ]
  }
}
```

---

#### GET /api/players/:username

Mojang API에서 플레이어 정보를 조회합니다.

**매개변수:**

| 매개변수 | 타입 | 설명 |
|----------|------|------|
| `username` | string | Minecraft 사용자 이름 |

**응답:**

```json
{
  "username": "Notch",
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "skinUrl": "https://crafatar.com/avatars/069a79f444e94726a5befca90e38aaf5?overlay"
}
```

---

### 화이트리스트 관리

#### GET /api/servers/:name/whitelist

서버 화이트리스트를 조회합니다.

**응답:**

```json
{
  "players": ["Player1", "Player2"],
  "total": 2
}
```

---

#### POST /api/servers/:name/whitelist

화이트리스트에 플레이어를 추가합니다.

**요청 본문:**

```json
{
  "player": "Steve"
}
```

**응답:**

```json
{
  "success": true,
  "message": "Added Steve to whitelist"
}
```

---

#### DELETE /api/servers/:name/whitelist/:player

화이트리스트에서 플레이어를 제거합니다.

**응답:**

```json
{
  "success": true,
  "message": "Removed Steve from whitelist"
}
```

---

### 밴 관리

#### GET /api/servers/:name/bans

밴된 플레이어 목록을 조회합니다.

**응답:**

```json
{
  "players": ["Griefer1"],
  "total": 1
}
```

---

#### POST /api/servers/:name/bans

플레이어를 밴합니다.

**요청 본문:**

```json
{
  "player": "Griefer",
  "reason": "Griefing is not allowed"
}
```

**응답:**

```json
{
  "success": true,
  "message": "Banned Griefer"
}
```

---

#### DELETE /api/servers/:name/bans/:player

플레이어 밴을 해제합니다.

**응답:**

```json
{
  "success": true,
  "message": "Unbanned Griefer"
}
```

---

### 관리자 관리

#### GET /api/servers/:name/ops

서버 관리자 목록을 조회합니다.

**응답:**

```json
{
  "players": ["Admin1", "Admin2"],
  "total": 2
}
```

---

#### POST /api/servers/:name/ops

플레이어를 관리자로 추가합니다.

**요청 본문:**

```json
{
  "player": "TrustedPlayer"
}
```

**응답:**

```json
{
  "success": true,
  "message": "Made TrustedPlayer an operator"
}
```

---

#### DELETE /api/servers/:name/ops/:player

관리자 권한을 제거합니다.

**응답:**

```json
{
  "success": true,
  "message": "Removed operator status from TrustedPlayer"
}
```

---

### 플레이어 추방

#### POST /api/servers/:name/kick

서버에서 플레이어를 추방합니다.

**요청 본문:**

```json
{
  "player": "AFKPlayer",
  "reason": "AFK timeout"
}
```

**응답:**

```json
{
  "success": true,
  "message": "Kicked AFKPlayer"
}
```

---

### 백업 관리

#### GET /api/backup/status

백업 구성 상태를 조회합니다.

**응답:**

```json
{
  "configured": true,
  "repository": "username/minecraft-worlds",
  "branch": "main",
  "lastBackup": "2026-01-31T10:30:00.000Z"
}
```

---

#### POST /api/backup/push

월드 백업을 GitHub에 푸시합니다.

**요청 본문:**

```json
{
  "message": "Before server upgrade",
  "allowMissing": false
}
```

`allowMissing`(선택): 마지막 백업에 있지만 지금은 없는 월드를 백업에서도 지우는 데 동의합니다. 없으면 `400`으로 거부합니다. 변경이 없으면 `"message": "No changes to backup"`으로 성공합니다. 다른 백업이 실행 중이면 `409`입니다.

**응답:**

```json
{
  "success": true,
  "commitHash": "abc1234",
  "message": "Backup pushed successfully"
}
```

**오류 응답 (400 - 구성 안 됨):**

```json
{
  "error": "BadRequest",
  "message": "Backup not configured. Set BACKUP_GITHUB_REPO and BACKUP_GITHUB_TOKEN environment variables."
}
```

---

#### GET /api/backup/history

백업 이력(git 커밋)을 조회합니다.

**응답:**

```json
{
  "commits": [
    {
      "hash": "abc1234",
      "message": "Before server upgrade",
      "date": "2026-01-31T10:30:00.000Z",
      "author": "mcctl"
    },
    {
      "hash": "def5678",
      "message": "Daily backup",
      "date": "2026-01-30T10:30:00.000Z",
      "author": "mcctl"
    }
  ],
  "total": 2
}
```

---

#### POST /api/backup/restore

백업 커밋에서 월드를 복원합니다.

**요청 본문:**

```json
{
  "commitHash": "abc1234"
}
```

모든 서버가 중지되어 있어야 합니다. 응답 코드: `409` 서버 실행 중, 다른 백업 실행 중, 완료되지 않은 복원, LEVEL 충돌 / `404` 커밋 없음 / `503` Docker 조회 불가. 입력을 기다리지 않습니다.

**응답:**

```json
{
  "success": true,
  "message": "Restored to commit abc1234"
}
```

!!! warning "복원 시 주의사항"
    백업을 복원하면 현재 월드 데이터를 덮어씁니다. 복원 전에 모든 서버를 중지하세요.

---

## 오류 응답

모든 오류 응답은 다음 형식을 따릅니다:

```json
{
  "error": "ErrorType",
  "message": "사람이 읽을 수 있는 오류 설명"
}
```

### 일반 오류 유형

| 오류 | 상태 코드 | 설명 |
|------|----------|------|
| `AuthenticationError` | 401 | 자격 증명 누락 또는 유효하지 않음 |
| `ForbiddenError` | 403 | IP가 화이트리스트에 없음 |
| `NotFound` | 404 | 리소스를 찾을 수 없음 |
| `ValidationError` | 400 | 요청 매개변수 유효하지 않음 |
| `InternalServerError` | 500 | 서버 측 오류 |

---

## 속도 제한

현재 속도 제한이 구현되어 있지 않습니다. 프로덕션 배포 시 리버스 프록시(nginx, Traefik) 사용을 고려하세요.

---

## 코드 예제

### Python

```python
import requests

API_URL = "http://localhost:5001"
API_KEY = "mctk_your_key_here"

headers = {"X-API-Key": API_KEY}

# 서버 목록
response = requests.get(f"{API_URL}/api/servers", headers=headers)
servers = response.json()["servers"]

# 서버 시작
response = requests.post(
    f"{API_URL}/api/servers/survival/start",
    headers=headers
)

# 명령 실행
response = requests.post(
    f"{API_URL}/api/servers/survival/exec",
    headers=headers,
    json={"command": "list"}
)
print(response.json()["output"])
```

### JavaScript/TypeScript

```typescript
const API_URL = "http://localhost:5001";
const API_KEY = "mctk_your_key_here";

const headers = {
  "X-API-Key": API_KEY,
  "Content-Type": "application/json"
};

// 서버 목록
const servers = await fetch(`${API_URL}/api/servers`, { headers })
  .then(res => res.json());

// 서버 시작
await fetch(`${API_URL}/api/servers/survival/start`, {
  method: "POST",
  headers
});

// 명령 실행
const result = await fetch(`${API_URL}/api/servers/survival/exec`, {
  method: "POST",
  headers,
  body: JSON.stringify({ command: "list" })
}).then(res => res.json());

console.log(result.output);
```

### Bash/curl

```bash
#!/bin/bash
API_URL="http://localhost:5001"
API_KEY="mctk_your_key_here"

# 서버 목록
curl -H "X-API-Key: $API_KEY" "$API_URL/api/servers"

# 서버 시작
curl -X POST -H "X-API-Key: $API_KEY" "$API_URL/api/servers/survival/start"

# 서버 중지
curl -X POST -H "X-API-Key: $API_KEY" "$API_URL/api/servers/survival/stop"

# 명령 실행
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command": "list"}' \
  "$API_URL/api/servers/survival/exec"

# 로그 조회
curl -H "X-API-Key: $API_KEY" "$API_URL/api/servers/survival/logs?lines=50"
```

---

## OpenAPI/Swagger

전체 OpenAPI 명세는 다음에서 확인할 수 있습니다:

```
http://localhost:5001/docs
```

이를 통해 API 엔드포인트를 탐색하고 테스트할 수 있는 대화형 인터페이스를 제공합니다.
