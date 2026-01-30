# API 레퍼런스

mcctl-api 서버의 완전한 REST API 문서입니다.

## 개요

mcctl-api는 Docker Minecraft 서버를 관리하기 위한 RESTful 인터페이스를 제공합니다. 모든 엔드포인트는 JSON 응답을 반환합니다.

**기본 URL:** `http://localhost:3001`

**문서:** 서비스가 실행 중일 때 `/docs`에서 Swagger UI를 사용할 수 있습니다.

## 인증

인증은 구성된 접근 모드를 기반으로 합니다.

### API 키 인증

`api-key` 또는 `api-key-ip` 모드를 사용할 때, 요청 헤더에 API 키를 포함합니다:

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
curl -H "X-API-Key: mctk_your_key" http://localhost:3001/api/servers

# 기본 인증
curl -u admin:password http://localhost:3001/api/servers
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
curl "http://localhost:3001/api/servers/survival/logs?lines=50"
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
curl -X POST http://localhost:3001/api/servers/survival/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "list"}'

# 메시지 방송
curl -X POST http://localhost:3001/api/servers/survival/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "say Server will restart in 5 minutes!"}'

# 플레이어에게 아이템 지급
curl -X POST http://localhost:3001/api/servers/survival/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "give Player1 diamond 64"}'

# 월드 저장
curl -X POST http://localhost:3001/api/servers/survival/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "save-all"}'
```

---

#### POST /servers/:id/console/exec

RCON 명령 실행을 위한 대체 엔드포인트입니다.

**매개변수:**

| 매개변수 | 타입 | 설명 |
|----------|------|------|
| `id` | string | 서버 이름 |

**요청 본문:**

```json
{
  "command": "help"
}
```

**응답:**

```json
{
  "output": "...",
  "exitCode": 0
}
```

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

API_URL = "http://localhost:3001"
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
const API_URL = "http://localhost:3001";
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
API_URL="http://localhost:3001"
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
http://localhost:3001/docs
```

이를 통해 API 엔드포인트를 탐색하고 테스트할 수 있는 대화형 인터페이스를 제공합니다.
