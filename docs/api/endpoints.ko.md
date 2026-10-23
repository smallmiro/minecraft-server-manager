# API 엔드포인트 레퍼런스

mcctl-api REST 엔드포인트 전체 레퍼런스입니다.

## 헬스 체크

### GET /health

API 서버 상태를 확인합니다.

**인증:** 불필요

**응답:**

```json
{
  "status": "ok",
  "timestamp": "2025-01-30T10:30:00.000Z"
}
```

---

## 서버 엔드포인트

### GET /api/servers

전체 Minecraft 서버 목록을 조회합니다.

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
    }
  ],
  "total": 1
}
```

**상태 값:**

| 상태 | 설명 |
|------|------|
| `running` | 컨테이너 실행 중 |
| `exited` | 컨테이너 정지됨 |
| `created` | 컨테이너 생성됨 (미시작) |
| `paused` | 컨테이너 일시정지 |

---

### GET /api/servers/:name

특정 서버의 상세 정보를 조회합니다.

**파라미터:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 서버 이름 (`mc-` 접두사 제외) |

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

---

### GET /api/servers/:name/logs

서버 콘솔 로그를 조회합니다. JSON 응답과 SSE 스트리밍을 모두 지원합니다.

**파라미터:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 서버 이름 |

**쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `lines` | integer | 100 | 반환할 로그 라인 수 |
| `follow` | boolean | false | SSE 스트리밍 활성화 |

**JSON 응답 (follow=false):**

```json
{
  "logs": "[10:30:15] [Server thread/INFO]: Player1 joined the game\n...",
  "lines": 100
}
```

**SSE 응답 (follow=true):**

```
data: {"log": "[10:30:15] Player joined"}
data: {"log": "[10:30:20] Player left"}
: heartbeat
data: {"event": "closed"}
```

---

### POST /api/servers/:name/start

정지된 서버를 시작합니다.

**파라미터:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 서버 이름 |

**응답:**

```json
{
  "success": true,
  "server": "survival",
  "action": "start",
  "timestamp": "2025-01-30T10:30:00.000Z",
  "message": "Server started successfully"
}
```

---

### POST /api/servers/:name/stop

실행 중인 서버를 정지합니다.

**응답:**

```json
{
  "success": true,
  "server": "survival",
  "action": "stop",
  "timestamp": "2025-01-30T10:30:00.000Z",
  "message": "Server stopped successfully"
}
```

---

### POST /api/servers/:name/restart

서버를 재시작합니다 (정지 후 시작).

**응답:**

```json
{
  "success": true,
  "server": "survival",
  "action": "restart",
  "timestamp": "2025-01-30T10:30:00.000Z",
  "message": "Server restarted successfully"
}
```

---

### POST /api/servers/:name/exec

서버에서 RCON 명령을 실행합니다.

**파라미터:**

| 파라미터 | 타입 | 설명 |
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

**자주 사용하는 명령:**

| 명령 | 설명 |
|------|------|
| `list` | 온라인 플레이어 목록 |
| `say <message>` | 메시지 브로드캐스트 |
| `give <player> <item> [count]` | 아이템 지급 |
| `save-all` | 월드 저장 |
| `whitelist add <player>` | 화이트리스트 추가 |
| `op <player>` | 관리자 권한 부여 |

---

## 월드 엔드포인트

### 월드 할당 규칙

월드는 `servers/<name>/config.env`의 `LEVEL`로 서버에 할당됩니다(`LEVEL`이 없으면 레거시 `WORLD_NAME`을 읽고, 둘 다 없으면 itzg 기본값 `world`). 잠금 파일은 없습니다. `worlds/.locks`는 더 이상 읽거나 쓰거나 만들지 않습니다.

- **월드 하나는 서버 하나.** 월드와 그 `<world>_nether` / `<world>_the_end` 폴더는 하나의 월드로 취급합니다. 다른 서버가 사용 중인 월드는 할당할 수 없습니다. `POST /api/worlds/:name/assign`, `serverName`을 넣은 `POST /api/worlds`, `POST /api/servers`(새 서버의 기본 월드 `<name>` 포함), `level`을 넣은 `PATCH /api/servers/:name/config`에 적용됩니다. 서버를 삭제하면 그 월드는 다시 쓸 수 있습니다.
- **중지된 서버만.** 컨테이너가 running, paused, restarting, created 상태이면 assign, release, `serverName`을 넣은 `POST /api/worlds`, `level`을 넣은 `PATCH /api/servers/:name/config`는 거부됩니다. 서버를 자동으로 중지하지 않습니다.
- **안전 우선(fail-closed).** 어떤 서버의 `config.env`를 읽을 수 없거나 `LEVEL`을 안전하게 해석할 수 없으면(경로 구분자, `.`/`..`, 따옴표, 제어 문자, 작은따옴표 밖의 `${VAR}` 같은 Compose 보간, 지원하지 않는 `--universe` 위치), 고칠 때까지 모든 할당 변경과 월드 삭제·초기화가 거부됩니다. `My World` 같은 레거시 이름은 기존 값으로는 계속 허용되며, 새 이름은 영문자, 숫자, `-`, `_`만 쓸 수 있습니다.
- **상태 코드**(월드 assign/release/delete/create와 config `level`): 잘못된 월드 이름 `400`, 없는 서버나 월드 `404`, 이 규칙으로 거부되는 나머지 모든 경우 `409`(충돌, 서버 실행 중, 확인할 수 없는 설정).
- **설정 스냅샷 복원**은 복원할 `config.env`가 다른 서버가 쓰는 월드를 할당하거나 실행 중인 서버의 월드를 바꾸게 되면(force를 써도), 그리고 복원할 `docker-compose.yml`의 `environment`에 `LEVEL`, `WORLD_NAME`, `EXTRA_ARGS`가 있거나 `/worlds`·`/data` 볼륨 매핑이 바뀌면 `409`로 응답합니다.
- **월드 초기화.** `POST /api/servers/:name/world/reset`은 월드를 `servers/<name>/data` 안에 두는 서버와, 다른 서버가 같은 월드를 쓰는 경우 거부됩니다.

---

### GET /api/worlds

전체 월드 목록과 할당된 서버를 조회합니다.

**응답:**

```json
{
  "worlds": [
    {
      "name": "survival",
      "path": "/home/user/minecraft-servers/worlds/survival",
      "isLocked": true,
      "lockedBy": "mc-survival",
      "servers": ["mc-survival"],
      "size": "1.2 GB",
      "lastModified": "2025-01-30T10:00:00.000Z"
    }
  ],
  "total": 1,
  "assignmentWarnings": []
}
```

`isLocked`와 `lockedBy`는 "할당됨"의 별칭으로 남아 있습니다. 이전 설치의 중복 할당은 고치지 않고 알려 줍니다. 이 경우 `servers`에 그 월드를 쓰는 모든 서버가 들어가고, `assignmentWarnings`(`string[]`)에는 중복 월드마다, 그리고 `config.env`를 읽을 수 없는 서버마다 한 항목이 들어갑니다.

---

### GET /api/worlds/:name

월드 상세 정보를 조회합니다.

**응답:**

```json
{
  "world": {
    "name": "survival",
    "path": "/home/user/minecraft-servers/worlds/survival",
    "isLocked": true,
    "lockedBy": "mc-survival",
    "servers": ["mc-survival"],
    "size": "1.2 GB",
    "lastModified": "2025-01-30T10:00:00.000Z"
  }
}
```

---

### POST /api/worlds

새 월드를 생성합니다.

**요청 본문:**

```json
{
  "name": "myworld",
  "seed": "12345",
  "serverName": "mc-myserver",
  "autoStart": false
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | string | 예 | 월드 이름 |
| `seed` | string | 아니오 | 월드 시드 |
| `serverName` | string | 아니오 | 할당할 서버 (중지되어 있어야 하며, 다른 서버가 쓰는 월드이면 `409`) |
| `autoStart` | boolean | 아니오 | 할당 후 서버 시작 |

**응답 (201):**

```json
{
  "success": true,
  "worldName": "myworld",
  "seed": "12345",
  "serverName": "mc-myserver",
  "started": false
}
```

---

### POST /api/worlds/:name/assign

월드를 서버에 할당합니다(서버의 `LEVEL`을 설정). 서버가 중지되어 있어야 합니다.

**요청 본문:**

```json
{
  "serverName": "mc-survival"
}
```

**응답:**

```json
{
  "success": true,
  "worldName": "survival",
  "serverName": "mc-survival"
}
```

**에러 (409 Conflict):**

```json
{
  "error": "Conflict",
  "message": "World 'survival' is assigned to 'mc-creative'; assign another world to 'mc-creative' or delete it first"
}
```

---

### POST /api/worlds/:name/release

월드를 사용하던 서버를 서버 자신의 기본 월드 `<server>`로 되돌립니다. 비어 있는 `worlds/<server>`가 이미 있으면 그것을 사용하고, 없으면 다음 시작 때 만듭니다. 월드는 `worlds/`에 그대로 남습니다. 서버가 중지되어 있어야 합니다. 서버가 자신의 기본 월드를 쓰고 있거나, 월드가 둘 이상의 서버에 할당되어 있거나, 서버가 월드를 `servers/<name>/data` 안에 두고 있으면 `409`로 거부됩니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `force` | boolean | false | 받아들이지만 무시됨 |

**응답:**

```json
{
  "success": true,
  "worldName": "survival",
  "previousServer": "mc-survival",
  "fallbackWorld": "mc-survival",
  "fallbackExists": false
}
```

`fallbackWorld`는 이전 서버가 이제 사용하는 월드입니다. `fallbackExists`가 `false`이면 `worlds/<fallbackWorld>`가 아직 없으며 다음 시작 때 만들어집니다.

---

### DELETE /api/worlds/:name

월드를 삭제합니다. 서버가 하나라도 사용 중이면 `409`로 거부됩니다. 월드를 `servers/<name>/data` 안에 두는 서버(`EXTRA_ARGS=--universe /worlds/` 없음)는 `worlds/<name>` 삭제를 막지 않습니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `force` | boolean | false | 호환을 위해 받아들이지만, 서버가 사용 중인 월드는 삭제하지 않음 |

**응답:**

```json
{
  "success": true,
  "worldName": "oldworld",
  "size": "500 MB"
}
```

---

## 인증 엔드포인트

### POST /api/auth/login

자격증명으로 사용자를 인증합니다.

**요청 본문:**

```json
{
  "username": "admin",
  "password": "secret"
}
```

**응답 (200):**

```json
{
  "id": "user-123",
  "username": "admin",
  "role": "admin",
  "name": "admin"
}
```

**응답 (401):**

```json
{
  "error": "Unauthorized",
  "message": "Invalid username or password"
}
```

---

### GET /api/auth/me

현재 인증된 사용자 정보를 조회합니다.

**헤더:**

| 헤더 | 설명 |
|------|------|
| `X-User` | 사용자명 (BFF 프록시가 설정) |
| `X-Role` | 사용자 역할 (BFF 프록시가 설정) |

**응답:**

```json
{
  "username": "admin",
  "role": "admin"
}
```

---

## 에러 응답

모든 에러 응답은 다음 형식을 따릅니다:

```json
{
  "error": "ErrorType",
  "message": "사람이 읽을 수 있는 에러 설명"
}
```

### 공통 에러 타입

| 에러 | 상태 코드 | 설명 |
|------|-----------|------|
| `AuthenticationError` | 401 | 인증 정보 누락 또는 유효하지 않음 |
| `ForbiddenError` | 403 | IP가 화이트리스트에 없음 |
| `NotFound` | 404 | 리소스를 찾을 수 없음 |
| `ValidationError` | 400 | 잘못된 요청 파라미터 |
| `Conflict` | 409 | 리소스 충돌 (예: 다른 서버가 쓰는 월드, 서버 실행 중) |
| `InternalServerError` | 500 | 서버 내부 오류 |

---

## 코드 예제

### Python

```python
import requests

API_URL = "http://localhost:5001"
API_KEY = "mctk_your_key_here"

headers = {"X-API-Key": API_KEY}

# 서버 목록 조회
response = requests.get(f"{API_URL}/api/servers", headers=headers)
servers = response.json()["servers"]

# 서버 시작
requests.post(f"{API_URL}/api/servers/survival/start", headers=headers)

# 명령 실행
response = requests.post(
    f"{API_URL}/api/servers/survival/exec",
    headers=headers,
    json={"command": "list"}
)
print(response.json()["output"])

# 월드 생성
requests.post(
    f"{API_URL}/api/worlds",
    headers=headers,
    json={"name": "newworld", "seed": "12345"}
)
```

### JavaScript/TypeScript

```typescript
const API_URL = "http://localhost:5001";
const API_KEY = "mctk_your_key_here";

const headers = {
  "X-API-Key": API_KEY,
  "Content-Type": "application/json"
};

// 서버 목록 조회
const servers = await fetch(`${API_URL}/api/servers`, { headers })
  .then(res => res.json());

// 서버 시작
await fetch(`${API_URL}/api/servers/survival/start`, {
  method: "POST",
  headers
});

// SSE로 로그 스트리밍
const eventSource = new EventSource(
  `${API_URL}/api/servers/survival/logs?follow=true`
);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.log);
};
```

### Bash/curl

```bash
#!/bin/bash
API_URL="http://localhost:5001"
API_KEY="mctk_your_key_here"

# 서버 목록 조회
curl -H "X-API-Key: $API_KEY" "$API_URL/api/servers"

# 서버 시작
curl -X POST -H "X-API-Key: $API_KEY" "$API_URL/api/servers/survival/start"

# 명령 실행
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command": "list"}' \
  "$API_URL/api/servers/survival/exec"

# 월드 생성
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "newworld", "seed": "12345"}' \
  "$API_URL/api/worlds"
```
