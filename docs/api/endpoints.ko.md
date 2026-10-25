# API 엔드포인트 레퍼런스

mcctl-api의 모든 라우트를 영역별로 정리했습니다. 인증, 오류 형식, Server-Sent Events(SSE)는 [REST API 개요](index.ko.md)에서 한 번 설명하며, 이 페이지는 라우트마다 다른 점만 적습니다.

- **기본 URL:** `http://localhost:5001`. 아래 경로는 전체 경로이며, 레거시 `/servers/:id/console/exec`만 `/api` 접두사가 없습니다.
- **인증:** `api-key`, `combined` 모드에서는 `X-API-Key: <key>`를 보냅니다([인증](index.ko.md#authentication)). `X-Role: admin`이 필요한 라우트는 따로 표시합니다.
- **본문**은 라우트에 따로 적지 않는 한 JSON입니다.

## 규칙 { #conventions }

- **서버 이름.** `/api/servers/:name/...`의 `:name`은 `mc-` 접두사를 뺀 서버 이름입니다. 컨테이너 `mc-survival`이면 `survival`입니다. 기존 서버는 영문자 또는 숫자로 시작하고 영문자, 숫자, `_`, `-`로 이루어진 최대 64자 이름을 가질 수 있으며, 새 서버는 [POST /api/servers](#post-apiservers)의 더 엄격한 규칙을 따릅니다. 서버를 가리키는 요청 필드(`serverName`)도 같은 이름을 받으며, 컨테이너 이름은 받지 않습니다.
- **월드 이름.** `/api/worlds/:name/...`의 `:name`은 `worlds/` 바로 아래의 디렉터리입니다. 월드 라우트마다 받는 이름을 적어 두었습니다.
- **검증.** 본문, 쿼리, 경로 값이 문서에 적힌 타입, 범위, 패턴을 벗어나면 라우트가 실행되기 전에 `400`으로 응답합니다([오류](index.ko.md#errors)).
- **`config.env`에 기록되는 값**(시드, MOTD, 모드 슬러그 등 자유 텍스트)은 줄바꿈을 포함한 제어 문자가 있거나 따옴표 또는 백틱으로 시작하면 `400`으로 거부됩니다.
- **`server.yaml`을 통한 기록.** 서버 설정을 바꾸는 라우트(설정, 화이트리스트 켜기/끄기, 호스트명, 모드, 월드 할당)는 `servers/<name>/server.yaml`을 고치고 그로부터 `config.env`와 서버의 `docker-compose.yml`을 생성합니다. 이 기록이 거부되면 `409`로 응답합니다. 예를 들어 생성된 `docker-compose.yml`을 손으로 고친 경우입니다([server.yaml](../configuration/server-yaml.ko.md)).

---

## 헬스 체크 { #health }

### GET /health

서비스 상태를 돌려줍니다. `AUTH_EXCLUDE_PATHS`를 바꾸지 않았다면 인증이 필요 없습니다.

```json
{
  "status": "ok",
  "timestamp": "2026-10-25T10:30:00.000Z"
}
```

mcctl-api가 실행 중이면 항상 `200`으로 응답합니다.

---

## 서버 { #servers }

### GET /api/servers

모든 서버를 나열합니다. `config.env`가 있는 `servers/` 아래의 디렉터리와, `mc-router`를 제외한 모든 `mc-*` 컨테이너가 대상입니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `include` | string | 선택 사항입니다. `summary`를 지정하면 서버별 `type`, `version`, `memory`, `players`, `stats`와 최상위 `totals`가 추가됩니다. 다른 값은 `400`을 반환합니다. |

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

| 필드 | 설명 |
|------|------|
| `name` | 서버 이름 |
| `container` | 컨테이너 이름 `mc-<name>` |
| `status` | 컨테이너 상태. 아래 표를 참고하세요 |
| `health` | `healthy`, `unhealthy`, `starting`, `none`, `unknown` 중 하나 |
| `hostname` | 서버의 `mc-router.host` 레이블. 호스트명이 여럿이면 쉼표로 구분되고, 없으면 `-` |

**상태 값:**

| 상태 | 설명 |
|------|------|
| `running` | 컨테이너 실행 중 |
| `exited` | 컨테이너 정지됨 |
| `created` | 컨테이너 생성됨 (미시작) |
| `paused` | 컨테이너 일시정지 |
| `restarting` | 컨테이너 재시작 중 |
| `dead` | Docker가 컨테이너를 dead로 보고함 |
| `not_created` | 서버 디렉터리는 있지만 컨테이너가 없음 (`health`는 `none`, `hostname`은 `-`) |

**`include=summary` 응답:**

`include`를 생략하면 위의 기본 응답은 바뀌지 않습니다.

```json
{
  "servers": [
    {
      "name": "survival",
      "container": "mc-survival",
      "status": "running",
      "health": "healthy",
      "hostname": "survival.192.168.1.100.nip.io",
      "type": "PAPER",
      "version": "1.21.1",
      "memory": "4G",
      "players": {
        "online": 3,
        "max": 20,
        "players": ["Player1", "Player2", "Player3"]
      },
      "stats": {
        "memoryUsage": 2254857830,
        "memoryLimit": 4294967296
      }
    }
  ],
  "total": 1,
  "totals": {
    "playersOnline": 3,
    "playersMax": 20,
    "running": 1
  }
}
```

!!! note "summary 동작"
    - `type`, `version`, `memory`는 서버의 `config.env`에서 가져옵니다.
    - `players`와 `stats`는 실행 중인 서버에만 포함됩니다. RCON 조회가 실패하거나 시간 초과되면 `players`는 `null`입니다. `stats`(`memoryUsage`, `memoryLimit`, 바이트 단위)는 `docker stats`가 제때 응답하지 않으면 빠집니다.
    - 실행 중인 서버마다 RCON과 stats를 병렬로 조회하며 RCON 약 2초, stats 약 3초 타임아웃을 적용하므로, 느린 서버 하나는 `players: null`(또는 `stats` 없음)만 받습니다.
    - 결과는 서버별로 약 10초 동안 캐시됩니다.
    - `totals.playersOnline`과 `totals.playersMax`는 플레이어 수를 알 수 있는 서버만 합산합니다. `totals.running`은 실행 중인 서버 수입니다.

---

### GET /api/servers/:name

서버 하나의 상세 정보를 돌려줍니다.

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
      "players": ["Player1", "Player2", "Player3"]
    },
    "stats": {
      "memoryUsage": 2254857830,
      "memoryLimit": 4294967296,
      "memoryPercent": 52.5,
      "cpuPercent": 15.2
    },
    "worldName": "survival",
    "worldSize": "1.2 GB",
    "playitDomain": null
  }
}
```

| 필드 | 설명 |
|------|------|
| `type`, `version`, `memory` | `config.env`의 `TYPE`, `VERSION`, `MEMORY` |
| `uptime`, `uptimeSeconds` | 컨테이너가 시작된 뒤 지난 시간. 실행 중일 때만 있습니다 |
| `players` | RCON `list`로 얻은 접속 중인 플레이어. 서버가 실행 중이고 RCON이 응답할 때만 있습니다 |
| `stats` | `docker stats` 값: 메모리 사용량과 한도(바이트), 메모리와 CPU 사용률(퍼센트). 서버가 실행 중일 때만 있습니다 |
| `worldName` | `config.env`의 `LEVEL`(또는 레거시 `WORLD_NAME`). 둘 다 없으면 `world` |
| `worldSize` | `worlds/<worldName>`의 크기. 디렉터리가 없으면 `0 B` |
| `playitDomain` | `config.env`의 `PLAYIT_DOMAIN`, 없으면 `null` |

컨테이너가 없는 서버는 `config.env`를 바탕으로 `status: "not_created"`로 응답합니다. 이때 `TYPE`, `VERSION`, `MEMORY`가 없으면 각각 `PAPER`, `LATEST`, `2G`로 표시됩니다.

**오류:** 컨테이너도 `servers/<name>/config.env`도 없으면 `404`.

---

### GET /api/servers-status

모든 서버의 현재 상태를 돌려줍니다. `follow=true`이면 스트림으로 보냅니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `follow` | boolean | `false` | SSE로 스트리밍 |
| `interval` | integer | `5000` | 스트림의 조회 간격(밀리초, 1000~60000) |

**응답:**

```json
[
  {
    "serverName": "survival",
    "status": "running",
    "health": "healthy",
    "timestamp": "2026-10-25T10:30:00.000Z"
  }
]
```

여기서 `status`는 단순화된 값입니다: `running`, `exited`, `created`, `stopped`(일시정지, dead 또는 컨테이너 없음), `unknown`(재시작 중이거나 알 수 없는 상태). `health`는 `healthy`, `unhealthy`, `starting`, `none`, `unknown` 중 하나입니다.

**스트림:** `interval`마다 서버별로 `server-status` 이벤트를 하나씩 보내고, 30초마다 `: heartbeat`를 보냅니다.

```
event: server-status
data: {"serverName":"survival","status":"running","health":"healthy","timestamp":"2026-10-25T10:30:00.000Z"}
```

---

### GET /api/servers/:name/status

서버 하나에 대해 [GET /api/servers-status](#get-apiservers-status)와 같은 상태 객체를 돌려줍니다. 같은 `follow`, `interval` 파라미터를 받으며, 스트림은 `interval`마다 `server-status` 이벤트를 보냅니다.

**오류:** 서버가 없으면 `404`.

---

### POST /api/servers

서버를 생성합니다. `servers/<name>/`(`server.yaml`, `config.env`, `docker-compose.yml` 포함)을 만들고, 호스트 주소를 알 수 있으면 `<name>.local`을 `/etc/avahi/hosts`에 추가한 뒤 컨테이너를 시작합니다.

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
| `name` | string | 예 | 2~32자. 영문 소문자로 시작하고, 이어서 영문 소문자, 숫자, 하이픈 하나씩만 쓸 수 있습니다(끝에 하이픈 불가, `--` 불가). `router`는 예약되어 있습니다 |
| `type` | string | 아니오 | `PAPER`(기본값), `VANILLA`, `FORGE`, `FABRIC`, `SPIGOT`, `NEOFORGE`, `MODRINTH`, `AUTO_CURSEFORGE` |
| `version` | string | 아니오 | `1.21.1`, `LATEST`, 스냅샷 ID 같은 Minecraft 버전(영문자, 숫자, `.`, `_`, `-`; 최대 64자). 기본값은 `LATEST`이며, `MODRINTH`와 `AUTO_CURSEFORGE`는 값을 보내지 않으면 `VERSION`을 기록하지 않습니다 |
| `memory` | string | 아니오 | `4G`, `512M` 같은 JVM 메모리. 기본값은 `4G`, `MODRINTH`와 `AUTO_CURSEFORGE`는 `6G` |
| `seed` | string | 아니오 | 월드 시드, 최대 256자 |
| `worldUrl` | string | 아니오 | 내려받을 월드 ZIP의 URL |
| `worldName` | string | 아니오 | `worlds/`에 있는 기존 월드(영문자, 숫자, `-`, `_`) |
| `autoStart` | boolean | 아니오 | 파일을 기록한 뒤 컨테이너 시작(기본값 `true`) |
| `sudoPassword` | string | 아니오 | `<name>.local`을 `/etc/avahi/hosts`에 추가할 때 쓰는 sudo 비밀번호(쓰기 전용). 비밀번호 없이 sudo를 쓸 수 있으면 필요 없습니다 |
| `modpack` | string | `MODRINTH`, `AUTO_CURSEFORGE`에 필수 | Modrinth 모드팩 슬러그, ID 또는 URL |
| `modpackVersion` | string | 아니오 | 모드팩 버전, 최대 128자 |
| `modLoader` | string | 아니오 | `forge`, `fabric`, `neoforge`, `quilt` |
| `excludeFiles` | string[] | 아니오 | 빼둘 모드 최대 100개(영문자, 숫자, `.`, `_`, `-`). `MODRINTH_EXCLUDE_FILES` 또는 `CF_EXCLUDE_MODS`에 기록됩니다 |

`seed`, `worldUrl`, `worldName`은 하나만 보낼 수 있습니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `follow` | boolean | `false` | JSON 응답 하나 대신 SSE로 진행 상황을 보고 |

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

`server.status`는 컨테이너를 시작했으면 `starting`, `autoStart`가 `false`이거나 시작이 끝나지 않았으면 `created`입니다. 두 번째 경우에는 `warning`도 붙습니다:

- 첫 시작이 실패한 경우: `warning`에 오류가 담깁니다. 서버는 남아 있으므로 나중에 `POST /api/servers/:name/start`로 시작합니다.
- 컨테이너 시작이 120초 안에 끝나지 않은 경우(첫 시작은 이미지를 받거나 모드를 내려받을 수 있습니다): `warning`이 그 사실을 알리고, 시작은 백그라운드에서 계속됩니다.

**오류:**

| 상태 | 조건 |
|------|------|
| `400` | 잘못된 본문, `modpack` 없이 `MODRINTH` 또는 `AUTO_CURSEFORGE`, 모드팩이 제공하지 않는 `modLoader`와 `version` 조합(둘 다 보냈고 Modrinth가 응답할 때만 확인), `seed`·`worldUrl`·`worldName` 중 둘 이상, 없는 `worldName`, 서버 파일에 담을 수 없는 값 |
| `409` | 서버가 이미 있음, 서버가 쓸 월드(`worldName`, 없으면 `<name>`)를 다른 서버가 사용 중, 다른 서버의 `config.env`를 읽을 수 없음([월드 할당 규칙](#world-assignment-rules)) |
| `500` | 생성 실패. `message`는 `Failed to create server:`로 시작합니다 |

**스트리밍(`follow=true`).** 위의 검사를 통과하면 응답이 `text/event-stream`으로 바뀌고 타입 메시지를 보냅니다:

```
data: {"type":"server-create","data":{"status":"initializing","message":"Initializing server creation..."}}
data: {"type":"server-create","data":{"status":"creating","message":"Creating server directory..."}}
data: {"type":"server-create","data":{"status":"configuring","message":"Registering mDNS hostname..."}}
data: {"type":"server-create","data":{"status":"starting","message":"Starting container..."}}
data: {"type":"server-create-log","data":{"log":"..."}}
data: {"type":"server-create","data":{"status":"completed","message":"Server created successfully","server":{"name":"newserver","container":"mc-newserver","status":"starting"}}}
```

첫 시작이 실패하면 `completed`의 메시지는 `Server created, but it did not start`이고, `server.status`는 `created`이며 `warning`이 추가됩니다. 그 밖의 실패는 `{"status": "error", "message": "Server creation failed: ..."}`로 끝납니다. 스트림은 시작이 끝날 때까지 기다리며(최대 30분), 클라이언트가 연결을 끊어도 서버는 생성됩니다.

생성과 삭제 요청은 mcctl-api 안에서 한 번에 하나씩 실행되며, 요청은 앞선 요청이 끝날 때까지 기다립니다. 생성마다 `server.create` 감사 로그가 남습니다.

---

### DELETE /api/servers/:name

서버를 삭제합니다. 실행 중이어도 컨테이너를 정지하고 제거합니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `force` | boolean | `false` | 호환용으로 받으며 아무것도 바꾸지 않습니다 |
| `deleteWorld` | boolean | `false` | 서버 안의 월드(`servers/<name>/data/<LEVEL>`)를 `worlds/`로 옮기지 않고 삭제. `worlds/`의 월드는 지우지 않음 |

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

**오류:** 서버가 없으면 `404`, 그 밖의 `409`와 `500`은 위에서 설명한 대로입니다.

삭제는 생성과 함께 한 번에 하나씩 실행되며, 삭제마다 `server.delete` 감사 로그가 남습니다.

---

### POST /api/servers/:name/start

`MCCTL_ROOT`에서 `docker compose up -d mc-<name>`으로 서버를 시작합니다(타임아웃 60초).

**응답:**

```json
{
  "success": true,
  "server": "survival",
  "action": "start",
  "timestamp": "2026-10-25T10:30:00.000Z",
  "message": ""
}
```

`message`에는 `docker compose` 명령의 표준 출력이 담기며, 비어 있을 수 있습니다.

**오류**는 `success: false`인 같은 객체를 씁니다:

| 상태 | 조건 | 필드 |
|------|------|------|
| `400` | 이름이 기존 서버 이름 규칙([규칙](#conventions))에 맞지 않음 | `error`가 규칙을 설명 |
| `500` | `docker compose` 명령이 실패함(없는 서버도 포함) | `error`: 명령 오류, `message`: 표준 오류 출력 |

이름 검사를 통과한 요청마다 `server.start` 감사 로그가 남습니다.

---

### POST /api/servers/:name/stop

`docker compose stop mc-<name>`으로 서버를 정지합니다. 응답과 오류는 [start](#post-apiserversnamestart)와 같으며, `action: "stop"`과 `server.stop` 감사 로그를 씁니다.

플랫폼 `.env`에 `BACKUP_AUTO_ON_STOP=true`가 있고 백업이 설정되어 있으면, 정지에 성공한 뒤 백그라운드에서 월드 백업도 시작합니다. 결과는 mcctl-api 로그에 남으며 응답에는 영향을 주지 않습니다. mcctl-api가 종료될 때는 이런 백업을 최대 2분까지 기다립니다.

---

### POST /api/servers/:name/restart

`docker compose restart mc-<name>`으로 서버를 재시작합니다. 응답과 오류는 [start](#post-apiserversnamestart)와 같으며, `action: "restart"`와 `server.restart` 감사 로그를 씁니다.

---

### POST /api/servers/:name/exec

`docker exec mc-<name> rcon-cli -- <command>`로 RCON 명령을 실행합니다. `--` 덕분에 `-`로 시작하는 명령도 그대로 서버에 전달됩니다.

**요청 본문:**

```json
{
  "command": "list"
}
```

`command`는 1~1024자입니다.

**응답:**

```json
{
  "success": true,
  "output": "There are 3 of a max of 20 players online: Player1, Player2, Player3"
}
```

`output`은 `rcon-cli`의 표준 출력을 다듬은 값이며, 표준 오류는 돌려주지 않습니다. 컨테이너가 있으면 `success`는 항상 `true`이므로, `output`이 비어 있으면 서버가 정지된 경우처럼 명령을 실행하지 못한 것일 수도 있습니다.

**오류:** 컨테이너가 없으면 `404`.

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

### GET /api/servers/:name/logs

컨테이너 로그를 돌려주거나 스트리밍합니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `lines` | integer | `100` | 최근 줄 수(1~10000) |
| `follow` | boolean | `false` | SSE로 스트리밍 |

**JSON 응답:**

```json
{
  "logs": "[10:30:15] [Server thread/INFO]: Player1 joined the game\n...",
  "lines": 100
}
```

`lines`는 돌려준 줄 가운데 비어 있지 않은 줄의 수입니다.

**스트림(`follow=true`).** 먼저 최근 `lines`줄을 보낸 뒤 새 줄을 하나씩 타입 메시지로 보내고, 30초마다 `: heartbeat`를 보냅니다. `docker logs`가 끝나면 `connection-closed` 메시지를 보내고 스트림을 닫습니다.

```
data: {"type":"server-log","data":{"log":"[10:30:15] [Server thread/INFO]: Player1 joined the game"}}

data: {"type":"connection-closed","data":{"timestamp":"2026-10-25T10:31:00.000Z"}}
```

**오류:** 컨테이너가 없으면 `404`입니다. `config.env`는 있지만 아직 컨테이너가 없는 서버도 마찬가지입니다.

---

## 서버 설정 { #server-configuration }

### GET /api/servers/:name/config

`config.env`의 서버 설정을 돌려줍니다. 각 필드는 itzg 변수 하나에 대응합니다. 예를 들어 `maxPlayers`는 `MAX_PLAYERS`, `gameMode`는 `MODE`, `level`은 `LEVEL`입니다. `config.env`에 있는 변수만 나타납니다. 예전 `GAMEMODE`만 있는 서버는 그 값을 `gameMode`로 돌려주고, `gameMode`를 담은 `PATCH`는 `MODE`를 쓰고 `GAMEMODE`를 지웁니다.

```json
{
  "config": {
    "difficulty": "normal",
    "gameMode": "survival",
    "maxPlayers": 20,
    "motd": "Welcome to survival",
    "memory": "4G",
    "enableWhitelist": false
  }
}
```

| 그룹 | 필드 |
|------|------|
| 게임플레이 | `difficulty`(`peaceful`, `easy`, `normal`, `hard`), `gameMode`(`survival`, `creative`, `adventure`, `spectator`), `maxPlayers`(1~1000), `pvp`, `forceGamemode`, `hardcore`, `allowFlight`, `allowNether`, `enableCommandBlock`, `spawnProtection`(0~256), `spawnAnimals`, `spawnMonsters`, `spawnNpcs` |
| 월드 | `motd`(최대 500자), `level`, `levelType`(`default`, `flat`, `largeBiomes`, `amplified`, `buffet`), `seed`, `generateStructures`, `maxWorldSize`(1~29999984), `icon` |
| 보안 | `onlineMode`, `enableWhitelist`, `enforceWhitelist`, `enforceSecureProfile` |
| 성능과 JVM | `memory`(예: `4G`), `useAikarFlags`, `viewDistance`(2~32), `simulationDistance`(3~32), `maxTickTime`(-1 이상), `initMemory`, `maxMemory`, `jvmXxOpts` |
| 자동 일시정지와 자동 정지 | `enableAutopause`, `autopauseTimeoutEst`, `autopauseTimeoutInit`, `autopausePeriod`, `enableAutostop`, `autostopTimeoutEst`, `pauseWhenEmptySeconds` |
| 시스템 | `tz`, `resourcePack`, `resourcePackSha1`, `resourcePackEnforce`, `resourcePackPrompt`, `enableRcon`, `rconPassword`, `rconPort`(1024~65535), `stopDuration`, `uid`, `gid` |
| 원격 접근 | `websocketConsole`, `websocketAddress`, `websocketPassword`, `websocketDisableAuthentication`, `websocketAllowedOrigins`, `websocketLogBufferSize`, `enableSsh` |
| 설정 저장소 | `paperConfigRepo`, `pufferfishConfigRepo`, `purpurConfigRepo`, `serverPropertiesRepoUrl` |

**오류:** 서버 또는 `config.env`가 없으면 `404`.

---

### PATCH /api/servers/:name/config

위 필드 중 원하는 것만 바꿉니다.

**요청 본문:**

```json
{
  "memory": "6G",
  "motd": "Welcome back"
}
```

**응답:**

```json
{
  "success": true,
  "config": {
    "difficulty": "normal",
    "maxPlayers": 20,
    "memory": "6G",
    "motd": "Welcome back"
  },
  "restartRequired": true,
  "changedFields": ["memory", "motd"]
}
```

| 필드 | 설명 |
|------|------|
| `config` | 변경 후의 모든 설정(`GET`과 같은 형식) |
| `changedFields` | 값이 바뀐 필드 |
| `restartRequired` | 바뀐 필드가 재시작 후에야 적용되면 `true`입니다. 예: `memory`, `onlineMode`, `enableWhitelist`, `level`, `seed`, `rconPassword`, `tz` |

`level`을 바꾸는 것은 월드 할당입니다. 값은 영문자, 숫자, `-`, `_`로 된 월드 이름이어야 하고(기존 레거시 값을 그대로 다시 보내면 유지됩니다), 서버가 중지되어 있어야 하며, 다른 서버가 그 월드를 쓰고 있으면 안 됩니다([월드 할당 규칙](#world-assignment-rules)). 월드 디렉터리가 미리 있을 필요는 없습니다.

**오류:** 잘못된 값이나 `level`이면 `400`, 서버 또는 `config.env`가 없으면 `404`, 월드 할당이나 `server.yaml` 기록이 거부되면 `409`.

변경마다 바뀐 필드의 이전 값과 새 값을 담은 `server.config` 감사 로그가 남습니다.

---

### POST /api/servers/:name/world/reset

다음 시작 때 새 월드가 만들어지도록 서버의 월드 디렉터리 `worlds/<LEVEL>`의 내용을 지웁니다. 그 디렉터리의 `.meta` 파일은 남깁니다.

**응답:**

```json
{
  "success": true,
  "message": "World data has been reset. Start the server to generate a new world.",
  "worldName": "survival"
}
```

**오류:**

| 상태 | 조건 |
|------|------|
| `400` | 서버 설정의 월드 이름을 쓸 수 없음 |
| `404` | 서버 또는 월드 디렉터리가 없음 |
| `409` | 컨테이너가 running, paused, restarting, created 상태, 서버가 월드를 `servers/<name>/data` 안에 둠, 다른 서버가 같은 월드를 사용, 어떤 서버의 `config.env`를 읽을 수 없음 |

초기화는 `type: "reset"`을 담은 `world.delete` 감사 로그를 남깁니다.

---

## 호스트명 { #hostnames }

### GET /api/servers/:name/hostnames

서버의 `mc-router.host` 레이블에 있는 호스트명을 나열합니다.

```json
{
  "serverName": "survival",
  "hostnames": ["survival.local", "survival.192.168.1.100.nip.io", "play.example.com"],
  "systemHostnames": [
    { "hostname": "survival.local", "type": "system", "description": "mDNS (Local Network)" },
    { "hostname": "survival.192.168.1.100.nip.io", "type": "system", "description": "nip.io (192.168.1.100)" }
  ],
  "customHostnames": ["play.example.com"]
}
```

`<server>.local`과 `<server>.<ip>.nip.io`는 시스템 호스트명이고, 나머지는 모두 커스텀 호스트명입니다.

**오류:** 서버 또는 그 `docker-compose.yml`이 없으면 `404`.

---

### PUT /api/servers/:name/hostnames

커스텀 호스트명 전체를 바꿉니다. 시스템 호스트명은 유지됩니다.

**요청 본문:**

```json
{
  "customHostnames": ["play.example.com"]
}
```

각 호스트명은 영문자, 숫자, `-`, `.`로 된 1~253자이며, 소문자로 저장되고 한 번만 쓸 수 있습니다. `<label>.local`과 `<label>.<ip>.nip.io` 형식은 시스템 호스트명이므로 거부됩니다.

**응답:** [GET](#get-apiserversnamehostnames)의 필드에 다음이 더해집니다:

| 필드 | 설명 |
|------|------|
| `success` | `true` |
| `recreateRequired` | 항상 `true`: 새 레이블은 컨테이너를 다시 만들 때 적용됩니다. 서버를 정지했다가 시작하세요. 재시작으로는 적용되지 않습니다 |
| `playitDomain` | 변경 후의 `PLAYIT_DOMAIN`. 목록에 남아 있으면 유지되고, 빠졌으면 새로 추가된 호스트명이 하나일 때 그 이름으로 바뀌며 그 밖에는 지워집니다. playit.gg 도메인이 없던 서버는 계속 없습니다 |

**오류:** 잘못되었거나 중복된 호스트명이면 `400`, 서버 또는 `docker-compose.yml`이 없으면 `404`, `server.yaml` 기록이 거부되면 `409`.

변경마다 `server.hostname` 감사 로그가 남습니다.

---

## 모드 { #mods }

모드는 서버의 `config.env`에 기록되며, Modrinth 프로젝트는 `MODRINTH_PROJECTS`에 들어갑니다. 모드 소스는 `modrinth`(사용 가능한 유일한 소스)입니다.

### GET /api/servers/:name/mods

```json
{
  "mods": {
    "modrinth": ["sodium", "lithium"]
  }
}
```

`mods`는 소스별 슬러그 목록이며, 없으면 `{}`입니다.

**오류:** 서버가 없으면 `404`.

---

### POST /api/servers/:name/mods

모드를 추가합니다. 이미 있는 슬러그는 건너뜁니다.

**요청 본문:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `slugs` | string[] | 예 | 모드 슬러그, 하나 이상 |
| `source` | string | 아니오 | `modrinth`(기본값) |

**응답:**

```json
{
  "success": true,
  "added": ["sodium"],
  "mods": ["lithium", "sodium"]
}
```

`added`는 새로 추가된 슬러그, `mods`는 그 소스의 전체 목록입니다.

**오류:** `slugs`가 비었거나 `config.env`에 담을 수 없는 슬러그이면 `400`, 서버 또는 `config.env`가 없으면 `404`, `server.yaml` 기록이 거부되면 `409`. 요청마다 `mod.add` 감사 로그가 남습니다.

---

### DELETE /api/servers/:name/mods/:slug

슬러그가 있는 소스에서 그 슬러그를 지웁니다.

```json
{
  "success": true,
  "removed": "sodium"
}
```

**오류:** 서버, `config.env` 또는 슬러그가 없으면 `404`, `server.yaml` 기록이 거부되면 `409`. 삭제마다 `mod.remove` 감사 로그가 남습니다.

---

### GET /api/servers/:name/mods/installed

`servers/<name>/data/mods/`의 `.jar` 파일과 각각의 제외 여부를 나열합니다. 제외 목록은 `MODRINTH_EXCLUDE_FILES`이며, `TYPE`이 `AUTO_CURSEFORGE`이면 `CF_EXCLUDE_MODS`입니다.

```json
{
  "mods": [
    { "filename": "sodium-fabric-0.5.11.jar", "excluded": false }
  ]
}
```

디렉터리가 없으면 `mods`는 비어 있습니다.

**오류:** 서버가 없으면 `404`.

---

### PATCH /api/servers/:name/mods/installed/:filename/exclude

jar 파일 이름을 제외 목록에 넣거나 뺍니다.

**요청 본문:**

```json
{
  "excluded": true
}
```

**응답:**

```json
{
  "success": true,
  "filename": "sodium-fabric-0.5.11.jar",
  "excluded": true,
  "excludeList": ["sodium-fabric-0.5.11.jar"],
  "restartRequired": true
}
```

**오류:** `excluded`가 없거나, 파일 이름에 영문자, 숫자, `.`, `_`, `+`, `-` 외의 문자가 있거나 `.jar`로 끝나지 않으면 `400`, 서버가 없거나 파일이 `data/mods/`에 없으면 `404`, `server.yaml` 기록이 거부되면 `409`.

---

### GET /api/mods/search

Modrinth를 검색합니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `q` | string | | 검색어(필수) |
| `limit` | integer | `10` | 페이지당 결과 수 |
| `offset` | integer | `0` | 건너뛸 결과 수 |
| `type` | string | | `modpack`이면 모드팩만 돌려줍니다 |

**응답:** `{"hits": [...], "totalHits": 120, "offset": 0, "limit": 10}`. 각 결과에는 `slug`, `title`, `description`, `downloads`, `iconUrl`, `serverSide`, `clientSide`, `projectType`, `categories`, `author`, `license`, `sourceId`, `sourceName`이 있습니다.

**오류:** `q`가 없으면 `400`.

---

### GET /api/mods/projects

여러 슬러그의 프로젝트 정보를 돌려줍니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `slugs` | string | 쉼표로 구분한 슬러그(필수) |
| `source` | string | `modrinth`(기본값) |

```json
{
  "projects": {
    "sodium": {
      "slug": "sodium",
      "title": "Sodium",
      "description": "...",
      "downloads": 1000000,
      "iconUrl": "https://...",
      "author": "...",
      "categories": ["optimization"],
      "sourceUrl": "https://modrinth.com/mod/sodium"
    },
    "unknown-slug": null
  }
}
```

찾지 못한 슬러그는 `null`입니다.

**오류:** `slugs`가 없거나 비었으면 `400`.

---

### GET /api/mods/:slug/versions

모드팩이나 모드가 지원하는 로더와 Minecraft 버전을 돌려줍니다. 웹 콘솔은 생성 대화상자에서 올바른 조합만 보여 줄 때 이 값을 씁니다.

```json
{
  "slug": "example-pack",
  "loaders": ["fabric", "neoforge"],
  "byLoader": {
    "fabric": {
      "gameVersions": ["1.21.1", "1.20.1"],
      "recommended": { "1.21.1": "2.1.0", "1.20.1": "1.9.4" }
    }
  }
}
```

`recommended`는 Minecraft 버전별로 해당 로더의 가장 새로운 팩 버전을 알려 줍니다. `source`(기본값 `modrinth`)를 받습니다.

**오류:** 버전을 찾지 못하면 `404`.

---

### GET /api/mods/:slug/client-only

모드팩에 든 모드 중 서버 측 지원이 `unsupported`인 것을, [POST /api/servers](#post-apiservers)의 `excludeFiles`에 쓸 수 있는 부분 파일 이름으로 나열합니다.

**쿼리 파라미터:** `version`(모드팩 버전, 기본값은 최신)과 `source`(기본값 `modrinth`).

```json
{
  "slug": "example-pack",
  "clientOnly": ["oculus", "iris"]
}
```

**오류:** 감지에 실패하면 `error: "BadGateway"`와 함께 `502`.

---

## 파일 { #files }

파일 라우트는 `servers/<name>/data` 안에서 동작합니다. `path`는 그 디렉터리 기준의 상대 경로이며, 앞의 `/`는 허용되고 `/`는 그 디렉터리 자체입니다. 디렉터리를 벗어나는 경로는 심볼릭 링크를 거치는 경우도 포함해 `403`(`Path traversal detected`)으로 거부됩니다. 서버가 없으면 모든 파일 라우트가 `404`로 응답합니다.

쓰기, 삭제, 새 디렉터리, 이름 변경, 업로드, 다운로드는 감사 로그(`file.write`, `file.delete`, `file.mkdir`, `file.rename`, `file.upload`, `file.download`)를 남기며, 주체는 `api:<X-User>`이고 `X-User`가 없으면 `api:console`입니다.

### GET /api/servers/:name/files

디렉터리를 나열합니다. 이름이 `.`로 시작하는 항목은 빠지며, 디렉터리가 파일보다 먼저 오고 각각 이름순으로 정렬됩니다.

**쿼리 파라미터:** `path`(기본값 `/`).

```json
{
  "path": "/",
  "files": [
    { "name": "plugins", "type": "directory", "size": 0, "modifiedAt": "2026-10-25T10:00:00.000Z" },
    { "name": "server.properties", "type": "file", "size": 1432, "modifiedAt": "2026-10-25T09:58:00.000Z" }
  ]
}
```

**오류:** 경로가 디렉터리가 아니면 `400`, `403`, 경로가 없으면 `404`.

---

### GET /api/servers/:name/files/read

파일을 UTF-8 텍스트로 읽습니다.

**쿼리 파라미터:** `path`(필수).

**응답:** `{"path": "/server.properties", "content": "...", "size": 1432, "modifiedAt": "..."}`

**오류:** `path`가 없거나 디렉터리이면 `400`, `403`, 파일이 없으면 `404`, 5 MB보다 크면 `413`.

---

### PUT /api/servers/:name/files/write

파일을 만들거나 바꿉니다. 내용은 임시 파일에 먼저 쓴 뒤 대상 파일을 대체합니다.

**쿼리 파라미터:** `path`(필수). **요청 본문:** `{"content": "..."}`, 최대 5 MB.

**응답:** `{"success": true, "path": "/server.properties", "size": 1440, "modifiedAt": "..."}`

**오류:** `path`나 `content`가 없거나 경로가 디렉터리이면 `400`, `403`, 내용이 5 MB보다 크면 `413`.

---

### DELETE /api/servers/:name/files

파일을 지우거나, 디렉터리를 그 안의 모든 것과 함께 지웁니다.

**쿼리 파라미터:** `path`(필수, `/`는 거부).

**응답:** `{"success": true, "path": "/logs/old.log"}`

**오류:** `path`가 없거나 `/`이면 `400`, `403`, 경로가 없으면 `404`.

---

### POST /api/servers/:name/files/mkdir

없는 상위 디렉터리까지 포함해 디렉터리를 만듭니다.

**쿼리 파라미터:** `path`(필수).

**응답:** `{"success": true, "path": "/plugins/config"}`

**오류:** `path`가 없으면 `400`, `403`, 경로가 이미 있으면 `409`.

---

### POST /api/servers/:name/files/rename

데이터 디렉터리 안에서 파일이나 디렉터리의 이름을 바꾸거나 옮깁니다.

**요청 본문:** `{"oldPath": "/a.txt", "newPath": "/b.txt"}`

**응답:** `{"success": true, "oldPath": "/a.txt", "newPath": "/b.txt"}`

**오류:** 경로가 없거나 `/`이면 `400`, `403`, `oldPath`가 없으면 `404`, `newPath`가 이미 있으면 `409`.

---

### POST /api/servers/:name/files/upload

`multipart/form-data`로 파일을 `path` 디렉터리에 올립니다. 디렉터리는 미리 있어야 합니다. 파일 파트마다 자신의 기본 이름으로 저장되며 같은 이름의 파일을 대체합니다. 파일 하나는 최대 100 MB이며, 더 큰 파일이 있으면 그 파일과 같은 요청에서 이미 저장한 파일을 지우고 `413`으로 응답합니다.

**쿼리 파라미터:** `path`(필수).

```bash
curl -X POST -H "X-API-Key: mctk_xxx" \
  -F "file=@./myplugin.jar" \
  "http://localhost:5001/api/servers/survival/files/upload?path=/plugins"
```

**응답:** `{"success": true, "path": "/plugins", "files": ["myplugin.jar"]}`

**오류:** `path`가 없으면 `400`, `403`, 디렉터리가 없으면 `404`, 100 MB보다 큰 파일이면 `413`.

---

### GET /api/servers/:name/files/download

파일을 `Content-Disposition: attachment`와 함께 `application/octet-stream`으로 보냅니다.

**쿼리 파라미터:** `path`(필수).

**오류:** `path`가 없거나 디렉터리이면 `400`, `403`, 파일이 없으면 `404`.

---

## 플레이어와 접근 목록 { #players }

접속 중인 플레이어는 서버가 실행 중일 때 RCON `list`로 얻습니다. 알려진 플레이어는 `servers/<name>/data`의 파일(`usercache.json`, `ops.json`, `whitelist.json`, `banned-players.json`, 플레이어 데이터 파일)에서 읽습니다.

플레이어 목록, 플레이어 상세, 실시간 위치, 화이트리스트, 화이트리스트 상태 조회는 `config.env`만 있는 서버에서도 동작합니다. 변경, 밴과 관리자 목록, 강퇴는 서버에 아직 컨테이너가 없으면 `404`로 응답합니다.

### GET /api/servers/:name/players

접속 중인 플레이어(RCON)와 알려진 플레이어(파일)를 합친 목록을 돌려줍니다. 서버가 정지되어 있어도 동작하며, 이때 `roster`는 파일에서만 오고 `online`, `max`, `players`는 `0`과 빈 값입니다. RCON이 응답하지 않을 때도 같습니다.

**쿼리 파라미터:** [GET /api/servers-status](#get-apiservers-status)와 같은 `follow`, `interval`. 스트림은 `interval`마다 아래 JSON을 담은 `event: players`를, 30초마다 `: heartbeat`를 보냅니다.

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

`roster`는 접속 중인 플레이어를 먼저, 나머지는 마지막 접속 시각(최신순), 이름 순으로 나열합니다.

**오류:** 서버가 없으면 `404`.

---

### GET /api/servers/:name/players/:uuid

알려진 플레이어 한 명을 돌려줍니다. `uuid`는 하이픈이 있는 Minecraft UUID여야 합니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `include` | string | 쉼표로 구분한 추가 항목: `stats`, `nbt`, `sessions`(순서 무관). 알 수 없는 값은 `400`을 반환합니다 |

- `stats`는 플레이어의 `stats/<uuid>.json`과 `advancements/<uuid>.json`에서 읽은 `stats`를 추가하며, 통계 파일이 없으면 `null`입니다.
- `nbt`는 `data`(플레이어 데이터 파일의 마지막 저장 위치, 차원, 체력, 허기, XP 레벨, 게임 모드, 인벤토리 요약)와 `livePosition`(RCON으로 얻은 현재 위치, 플레이어가 접속 중이고 서버가 실행 중일 때만)을 추가합니다. 각각 얻을 수 없으면 `null`입니다.
- `sessions`는 `sessions`를 추가합니다: 방문 횟수, 총 플레이 시간, 마지막 접속 시각, 최근 세션 최대 20개(최신순). mcctl-api는 30초마다 실행 중인 각 서버 로그의 `joined the game`, `left the game` 줄에서 이를 수집해 `MCCTL_ROOT` 아래 `data/players.db`에 저장하며, 처음 실행할 때 최대 24시간 전 로그까지 읽습니다. 기록이 없는 플레이어는 `visitCount: 0`, `totalPlaytimeSeconds: 0`, `lastSeen: null`, `recent: []`를 받습니다.

요청하지 않은 키는 응답에서 빠집니다.

**`?include=stats,nbt,sessions` 응답:**

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
  },
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
  "livePosition": { "x": 10.6, "y": 64, "z": -20.1, "dimension": "overworld" },
  "sessions": {
    "visitCount": 12,
    "totalPlaytimeSeconds": 43200,
    "lastSeen": "2026-09-27T08:13:49.000Z",
    "recent": [
      { "joinedAt": "2026-09-27T07:00:00.000Z", "leftAt": "2026-09-27T08:13:49.000Z", "durationSeconds": 4429 }
    ]
  }
}
```

**오류:** 서버가 없거나 알려지지 않은 플레이어이면 `404`.

---

### GET /api/servers/:name/players/live

접속 중인 플레이어의 위치를 RCON으로 돌려줍니다. 서버가 정지되어 있으면 목록은 비어 있습니다.

```json
{
  "players": [
    {
      "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
      "name": "Player1",
      "x": 10.6,
      "y": 64,
      "z": -20.1,
      "dimension": "overworld",
      "online": true
    }
  ]
}
```

각 항목에는 `health`, `food`, `xpLevel`도 있을 수 있습니다. `follow`, `interval`을 받으며, 스트림은 같은 객체를 담은 `event: players-live`를 보냅니다.

**오류:** 서버가 없으면 `404`.

---

### GET /api/players/:username

Mojang API로 플레이어를 조회합니다.

```json
{
  "username": "Notch",
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "skinUrl": "https://crafatar.com/avatars/069a79f444e94726a5befca90e38aaf5?overlay"
}
```

`username`은 Mojang이 돌려준 철자입니다.

**오류:** 알 수 없는 플레이어이면 `404`, Mojang API가 실패하면 `500`.

---

### GET /api/servers/:name/whitelist

```json
{
  "players": [
    { "name": "Player1", "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5" }
  ],
  "total": 1,
  "source": "rcon",
  "enabled": true
}
```

- 서버가 실행 중이면 이름은 RCON `whitelist list`에서, UUID는 `whitelist.json`에서 가져오며(파일에 없는 이름의 `uuid`는 `""`) `source`는 `rcon`입니다. RCON이 이름을 하나도 돌려주지 않으면 파일을 읽습니다.
- 그 밖에는 `whitelist.json`에서 목록을 읽고(`source: "file"`), 파일이 비어 있으면 `config.env`의 `WHITELIST` 변수에서 읽습니다(`source: "config"`, `uuid`는 빈 값).
- `enabled`는 `config.env`의 `ENABLE_WHITELIST`입니다.

**오류:** 서버가 없으면 `404`.

---

### POST /api/servers/:name/whitelist

플레이어를 추가합니다.

**요청 본문:** `{"player": "Steve"}`(1~16자).

**응답:**

```json
{
  "success": true,
  "message": "Added Steve to the whitelist",
  "source": "rcon"
}
```

서버가 실행 중이면 RCON `whitelist add`를 쓰며 `message`는 서버의 응답입니다. 그 응답이 오류를 알리거나(예: `already whitelisted`) 서버가 정지되어 있으면, Mojang에서 얻은 UUID와 함께 플레이어를 `whitelist.json`에 기록합니다(실행 중이면 `source: "file+reload"`와 RCON `whitelist reload`, 정지 중이면 `source: "file"`과 `(will apply on next server start)`).

요청마다 `player.whitelist.add` 감사 로그가 남습니다.

---

### DELETE /api/servers/:name/whitelist/:player

추가와 같은 RCON·파일 처리로 플레이어를 지웁니다(`whitelist remove`, 파일에서는 대소문자를 가리지 않고 찾음). 응답 필드도 같습니다. 요청마다 `player.whitelist.remove` 감사 로그가 남습니다.

---

### GET /api/servers/:name/whitelist/status

```json
{
  "enabled": true,
  "source": "config"
}
```

`enabled`는 `config.env`의 `ENABLE_WHITELIST`입니다.

---

### PUT /api/servers/:name/whitelist/status

화이트리스트를 켜거나 끕니다.

**요청 본문:** `{"enabled": true}`

`ENABLE_WHITELIST`를 기록하고, 서버가 실행 중이면 RCON `whitelist on` 또는 `whitelist off`도 보냅니다. 응답은 위의 상태 객체입니다.

**오류:** 서버나 컨테이너가 없으면 `404`, `server.yaml` 기록이 거부되면 `409`. 변경마다 `player.whitelist.toggle` 감사 로그가 남습니다.

---

### GET /api/servers/:name/bans

```json
{
  "players": [
    {
      "name": "Griefer1",
      "uuid": "6f0a1e3c-1234-4cde-9abc-0123456789ab",
      "reason": "Griefing is not allowed",
      "created": "2026-10-20T08:00:00.000Z",
      "source": "mcctl-api",
      "expires": "forever"
    }
  ],
  "total": 1,
  "source": "file"
}
```

서버가 실행 중이면 이름은 RCON `banlist players`에서 가져오고 나머지 필드는 비어 있습니다(`expires`는 `forever`). 그 밖에는 `banned-players.json`을 읽습니다. 두 경우 모두 `source`는 `file`입니다.

---

### POST /api/servers/:name/bans

플레이어를 밴합니다.

**요청 본문:** `{"player": "Griefer", "reason": "Griefing is not allowed"}`(`reason`은 선택).

서버가 실행 중이면 RCON `ban`을 쓰며 `message`는 그 응답입니다(`source: "rcon"`). 정지 중이면 Mojang에서 얻은 UUID와 함께 플레이어를 `banned-players.json`에 추가합니다(`source: "file"`, `message`는 `(will apply on next server start)`로 끝남). 요청마다 `player.ban` 감사 로그가 남습니다.

---

### DELETE /api/servers/:name/bans/:player

밴을 풉니다. 실행 중이면 RCON `pardon`을 쓰고, 그 밖에는 `banned-players.json`에서 지웁니다. 응답 필드는 밴과 같습니다. 요청마다 `player.unban` 감사 로그가 남습니다.

---

### GET /api/servers/:name/ops

`ops.json`을 읽습니다.

```json
{
  "operators": [
    {
      "name": "Admin1",
      "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
      "level": 4,
      "role": "Owner",
      "bypassesPlayerLimit": false
    }
  ],
  "count": 1,
  "source": "file"
}
```

`role`은 레벨의 이름입니다: `Moderator`(1), `Gamemaster`(2), `Admin`(3), `Owner`(4).

---

### POST /api/servers/:name/ops

`ops.json`에 관리자를 추가하거나, 이미 있는 관리자의 레벨을 바꿉니다. RCON 명령은 보내지 않습니다.

**요청 본문:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `player` | string | 예 | 플레이어 이름, 1~16자 |
| `level` | integer | 아니오 | 1~4, 기본값 `4` |

**응답:**

```json
{
  "success": true,
  "operator": {
    "name": "TrustedPlayer",
    "uuid": "8667ba71-b85a-4004-af54-457a9734eed7",
    "level": 4,
    "role": "Owner",
    "bypassesPlayerLimit": false
  },
  "source": "file"
}
```

**오류:** Mojang에서 플레이어의 UUID를 조회할 수 없으면 `404`. 요청마다 `player.op` 감사 로그가 남습니다.

---

### PATCH /api/servers/:name/ops/:player

`ops.json`에서 관리자의 레벨을 바꿉니다(이름은 대소문자를 가리지 않고 찾음).

**요청 본문:** `{"level": 2}`(1~4).

**응답:** [POST /api/servers/:name/ops](#post-apiserversnameops)와 같습니다.

**오류:** 관리자가 아닌 플레이어이면 `404`. 변경마다 `player.op.level` 감사 로그가 남습니다.

---

### DELETE /api/servers/:name/ops/:player

`ops.json`에서 관리자를 지웁니다.

```json
{
  "success": true,
  "message": "Removed operator status from TrustedPlayer",
  "source": "file"
}
```

**오류:** 관리자가 아닌 플레이어이면 `404`. 삭제마다 `player.deop` 감사 로그가 남습니다.

---

### POST /api/servers/:name/kick

접속 중인 플레이어를 RCON `kick`으로 강퇴합니다.

**요청 본문:** `{"player": "AFKPlayer", "reason": "AFK timeout"}`(`reason`은 선택).

```json
{
  "success": true,
  "message": "Kicked AFKPlayer: AFK timeout"
}
```

`message`는 서버의 응답이며, 비어 있으면 `Kicked <player>`입니다.

**오류:** 서버가 실행 중이 아니면 `400`, 컨테이너가 없으면 `404`. 요청마다 `player.kick` 감사 로그가 남습니다.

---

## 월드 { #worlds }

### 월드 할당 규칙 { #world-assignment-rules }

월드는 `servers/<name>/config.env`의 `LEVEL`로 서버에 할당됩니다(`LEVEL`이 없으면 레거시 `WORLD_NAME`을 읽고, 둘 다 없으면 itzg 기본값 `world`). 잠금 파일은 없습니다. `worlds/.locks`는 더 이상 읽거나 쓰거나 만들지 않습니다.

- **월드 하나는 서버 하나.** 월드와 그 `<world>_nether` / `<world>_the_end` 폴더는 하나의 월드로 취급합니다. 다른 서버가 사용 중인 월드는 할당할 수 없습니다. `POST /api/worlds/:name/assign`, `serverName`을 넣은 `POST /api/worlds`, `POST /api/servers`(새 서버의 기본 월드 `<name>` 포함), `level`을 넣은 `PATCH /api/servers/:name/config`에 적용됩니다. 서버를 삭제하면 그 월드는 다시 쓸 수 있습니다.
- **중지된 서버만.** 컨테이너가 running, paused, restarting, created 상태이면 assign, release, `serverName`을 넣은 `POST /api/worlds`, `level`을 넣은 `PATCH /api/servers/:name/config`는 거부됩니다. 서버를 자동으로 중지하지 않습니다.
- **안전 우선(fail-closed).** 어떤 서버의 `config.env`를 읽을 수 없거나 `LEVEL`을 안전하게 해석할 수 없으면(경로 구분자, `.`/`..`, 따옴표, 제어 문자, 작은따옴표 밖의 `${VAR}` 같은 Compose 보간, 지원하지 않는 `--universe` 위치), 고칠 때까지 모든 할당 변경과 월드 삭제·초기화가 거부됩니다. `My World` 같은 레거시 이름은 기존 값으로는 계속 허용되며, 새 이름은 영문자, 숫자, `-`, `_`만 쓸 수 있고 `_nether`나 `_the_end`로 끝날 수 없습니다.
- **상태 코드**(월드 assign/release/delete/create와 config `level`): 잘못된 월드 이름 `400`, 없는 서버나 월드 `404`, 이 규칙으로 거부되는 나머지 모든 경우 `409`(충돌, 서버 실행 중, 확인할 수 없는 설정).
- **설정 스냅샷 복원**은 복원할 `config.env`가 다른 서버가 쓰는 월드를 할당하거나 실행 중인 서버의 월드를 바꾸게 되면(force를 써도), 그리고 복원할 `docker-compose.yml`의 `environment`에 `LEVEL`, `WORLD_NAME`, `EXTRA_ARGS`가 있거나 `/worlds`·`/data` 볼륨 매핑이 바뀌면 `409`로 응답합니다.
- **월드 초기화.** `POST /api/servers/:name/world/reset`은 월드를 `servers/<name>/data` 안에 두는 서버와, 다른 서버가 같은 월드를 쓰는 경우 거부됩니다.

---

### GET /api/worlds

`worlds/`의 월드와 할당된 서버를 나열합니다.

```json
{
  "worlds": [
    {
      "name": "survival",
      "path": "/home/user/minecraft-servers/worlds/survival",
      "isLocked": true,
      "lockedBy": "survival",
      "servers": ["survival"],
      "size": "1.2 GB",
      "lastModified": "2025-01-30T10:00:00.000Z",
      "dimensions": { "nether": true, "end": true }
    }
  ],
  "total": 1,
  "assignmentWarnings": []
}
```

| 필드 | 설명 |
|------|------|
| `servers` | `LEVEL`이 이 월드를 가리키는 서버의 이름 |
| `isLocked`, `lockedBy` | "할당됨"과 `servers`의 첫 항목에 대한 별칭 |
| `dimensions` | 분리된 폴더 `<name>_nether`, `<name>_the_end`가 있는지 여부. 이 폴더는 별도 월드로 나열되지 않으며 크기는 `size`에 포함됩니다 |
| `assignmentWarnings` | `string[]`: 둘 이상의 서버가 쓰는 월드마다, 그리고 `config.env`를 읽을 수 없는 서버마다 한 항목. 이전 설치의 중복 할당은 고치지 않고 알려 줍니다 |

---

### GET /api/worlds/:name

월드 하나를 [GET /api/worlds](#get-apiworlds)의 항목과 같은 필드로 `world`에 담아 돌려줍니다.

`:name`은 `worlds/` 바로 아래의 어떤 디렉터리 이름이든 될 수 있으며, `My World` 같은 레거시 이름도 됩니다(`My%20World`처럼 URL 인코딩합니다). `.`로 시작하거나 `/`, `\`, 제어 문자가 들어간 이름은 `400`으로, 일반 파일처럼 `worlds/` 바로 아래의 디렉터리가 아닌 이름은 `404`로 응답합니다. `survival_nether` 같은 분리된 차원 폴더는 `survival`의 일부이므로 따로 찾을 수 없습니다.

---

### POST /api/worlds

`.meta` 파일(이름, 시드, 생성 시각)과 함께 `worlds/<name>` 디렉터리를 만듭니다. 월드 자체는 서버가 이 월드로 시작할 때 생성됩니다. `serverName`을 주면 그 서버의 `LEVEL`(그리고 시드를 줬다면 `SEED`)을 새 월드로 설정합니다.

**요청 본문:**

```json
{
  "name": "myworld",
  "seed": "12345",
  "serverName": "myserver",
  "autoStart": false
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | string | 예 | 월드 이름: 영문자, 숫자, `-`, `_` |
| `seed` | string | 아니오 | 월드 시드 |
| `serverName` | string | 아니오 | 월드를 할당할 서버(중지되어 있어야 하며, 다른 서버가 쓰는 월드이면 `409`) |
| `autoStart` | boolean | 아니오 | 이후 그 서버 시작(기본값 `false`) |

**응답 (201):**

```json
{
  "success": true,
  "worldName": "myworld",
  "seed": "12345",
  "serverName": "myserver",
  "started": false
}
```

시작을 요청하지 않았거나 시작이 실패하면 `started`는 `false`이며, 두 경우 모두 월드는 생성됩니다.

**오류:** 이름이나 시드가 잘못되었거나, 같은 이름의 월드가 있거나, 서버가 하나도 없으면(`No servers available. Create a server first.`) `400`, 없는 `serverName`이면 `404`, [월드 할당 규칙](#world-assignment-rules)에 따라 `409`. 요청마다 `world.create` 감사 로그가 남습니다.

---

### POST /api/worlds/upload

ZIP 파일에서 월드를 가져옵니다. 요청은 `level.dat`이 든 `.zip` 파일 파트 하나를 담은 `multipart/form-data`입니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `name` | string | 월드 이름(필수): 영문자, 숫자, `-`, `_` |
| `seed` | string | 받지만 사용하지 않습니다 |

```bash
curl -X POST -H "X-API-Key: mctk_xxx" \
  -F "file=@./myworld.zip" \
  "http://localhost:5001/api/worlds/upload?name=myworld"
```

**응답 (201):** `{"success": true, "worldName": "myworld"}`

**오류:** `.zip` 파일이 아니거나, 파일 파트가 없거나, 압축 파일을 가져올 수 없으면 `400`, 같은 이름의 월드가 있으면 `409`, 파일이 `WORLD_UPLOAD_MAX_SIZE`(기본값 1 GB)보다 크면 `413`. 요청마다 `source: "upload"`를 담은 `world.create` 감사 로그가 남습니다.

---

### POST /api/worlds/:name/assign

서버의 `LEVEL`을 설정해 월드를 서버에 할당합니다. 서버가 중지되어 있어야 합니다.

**요청 본문:**

```json
{
  "serverName": "survival"
}
```

**응답:**

```json
{
  "success": true,
  "worldName": "survival",
  "serverName": "survival"
}
```

**에러 (409 Conflict):**

```json
{
  "error": "Conflict",
  "message": "World 'survival' is assigned to 'creative'; assign another world to 'creative' or delete it first"
}
```

**오류:** 잘못된 월드 이름(레거시 이름과 `_nether`, `_the_end`로 끝나는 이름 포함)이면 `400`, 없는 월드나 서버이면 `404`, 다른 서버가 쓰는 월드이거나 서버가 중지되어 있지 않거나 서버가 월드를 `servers/<name>/data` 안에 두거나 `config.env`를 읽을 수 없으면 `409`. 요청마다 `world.assign` 감사 로그가 남습니다.

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
  "previousServer": "survival",
  "fallbackWorld": "survival",
  "fallbackExists": false
}
```

`fallbackWorld`는 이전 서버가 이제 사용하는 월드입니다. `fallbackExists`가 `false`이면 `worlds/<fallbackWorld>`가 아직 없으며 다음 시작 때 만들어집니다. 요청마다 `world.release` 감사 로그가 남습니다.

---

### DELETE /api/worlds/:name

`worlds/<name>`과 그 분리된 차원 폴더 `<name>_nether`, `<name>_the_end`를 함께 삭제합니다. 서버가 하나라도 사용 중이면 `409`로 거부됩니다. 월드를 `servers/<name>/data` 안에 두는 서버(`EXTRA_ARGS=--universe /worlds/` 없음)는 `worlds/<name>` 삭제를 막지 않습니다.

`:name`은 [GET /api/worlds/:name](#get-apiworldsname)의 규칙을 따릅니다. `My World` 같은 레거시 이름도 삭제할 수 있고, `worlds/` 바로 아래의 디렉터리가 아닌 이름은 찾을 수 없으므로(`404`) `worlds/` 밖의 것은 지우지 않습니다.

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

`size`는 `worlds/<name>`의 크기입니다. 요청마다 `world.delete` 감사 로그가 남습니다.

---

### GET /api/worlds/:name/info

월드 안의 정보를 돌려줍니다: `level.dat` 메타데이터, 디스크에 있는 차원, 크기, 리전 파일 수.

```json
{
  "info": {
    "name": "survival",
    "level": {
      "levelName": "survival",
      "seed": "-4172144997902289642",
      "spawn": { "x": 0, "y": 64, "z": 0 },
      "gameMode": "survival",
      "difficulty": "normal",
      "hardcore": false,
      "dayTime": 6000,
      "dayCount": 42,
      "raining": false,
      "thundering": false,
      "versionName": "1.21.1",
      "dataVersion": 3955,
      "worldBorder": { "size": 59999968, "centerX": 0, "centerZ": 0 },
      "dataPacks": ["vanilla"],
      "gameRules": { "keepInventory": "false" }
    },
    "dimensions": { "overworld": true, "nether": true, "end": false },
    "sizeBytes": 1288490188,
    "regionCount": 64,
    "lastModified": "2026-10-25T09:00:00.000Z"
  }
}
```

**오류:** 월드가 없으면 `404`.

---

### GET /api/worlds/:name/players

월드의 플레이어 데이터 파일에서 각 플레이어의 마지막 저장 위치를 돌려줍니다. 형식은 `{"players": [...]}`이며 항목 필드는 [실시간 위치](#get-apiserversnameplayerslive)와 같습니다.

**오류:** 월드가 없으면 `404`.

---

### GET /api/worlds/:name/map/status

월드의 BlueMap 웹 지도가 렌더링되었는지 알려 줍니다.

```json
{
  "rendered": true,
  "maps": ["overworld", "nether"],
  "lastModified": "2026-10-25T09:30:00.000Z"
}
```

첫 렌더링 전에는 `{"rendered": false, "maps": []}`로 응답합니다.

지도와 블록 통계 라우트(`/map/...`, `/stats`, `/stats/analyze`)는 영문자, 숫자, `-`, `_`로 된 월드 이름만 받으며, 다른 이름은 `400`으로 응답합니다.

---

### POST /api/worlds/:name/map/render

Docker 컨테이너에서 BlueMap CLI로 정적 웹 지도를 렌더링합니다(메모리 제한 2 GB, 이미지는 처음 쓸 때 빌드). 서버가 실행 중일 필요는 없습니다. 결과는 `MCCTL_ROOT` 아래 `maps/<name>/web`에 저장됩니다.

**요청 본문(선택):**

| 필드 | 타입 | 설명 |
|------|------|------|
| `dimensions` | string[] | `overworld`, `nether`, `end`. 기본값은 월드에 있는 모든 차원 |
| `force` | boolean | 캐시된 타일을 쓰지 않고 모두 다시 렌더링 |

**쿼리 파라미터:** `follow`(boolean): SSE로 진행 상황을 보고합니다.

**응답:**

```json
{
  "world": "survival",
  "maps": ["overworld", "nether"],
  "webroot": "/home/user/minecraft-servers/maps/survival/web",
  "entry": "/home/user/minecraft-servers/maps/survival/web/index.html"
}
```

**스트림(`follow=true`):** `{"map": "overworld", "percent": 42, "eta": "20 seconds"}`를 담은 `progress` 이벤트(`eta`는 BlueMap이 알려 줄 때만)를 보내고, 끝으로 위 응답을 담은 `done` 또는 `{"message": "..."}`를 담은 `error`를 보냅니다.

**오류:** 월드가 없으면 `404`, 렌더링이 실패하면 `500`(종료 코드 137은 메모리 부족 가능성으로 보고). 렌더링마다 `world.map.render` 감사 로그가 남습니다.

---

### GET /api/worlds/:name/map/web/*

렌더링된 지도의 파일을 제공합니다. 예: `/api/worlds/survival/map/web/index.html`. 경로가 비어 있으면 `index.html`을 제공합니다. 요청한 파일이 `<file>.gz`로만 있으면 압축을 풀어 보냅니다.

**오류:** 지도 디렉터리 밖의 경로이면 `403`, 파일이 없으면 `404`.

---

### POST /api/worlds/:name/map/markers

월드의 리전 데이터에서 생성된 구조물(마을, 요새, 사원 등)을 읽어 렌더링된 지도에 BlueMap 마커로 기록합니다. 렌더링된 차원별로 기록하며, 타일은 다시 렌더링하지 않습니다.

```json
{
  "counts": { "overworld": 12, "nether": 3 },
  "total": 15
}
```

**오류:** 월드가 없으면 `404`, 지도를 아직 렌더링하지 않았으면 `409`.

---

### GET /api/worlds/:name/stats

`MCCTL_ROOT` 아래 `stats/<name>.json`에 저장된 마지막 블록 통계 분석 결과를 돌려줍니다.

```json
{
  "world": "survival",
  "analyzedAt": "2026-10-25T09:45:00.000Z",
  "durationMs": 81234,
  "dimensions": ["overworld", "nether"],
  "regionsScanned": 64,
  "totalBlocks": 402653184,
  "blockTypeCount": 412,
  "ores": { "minecraft:diamond_ore": 1832, "minecraft:iron_ore": 51204 },
  "topBlocks": [{ "id": "minecraft:stone", "count": 120034521 }]
}
```

**오류:** 아직 분석한 적이 없으면 `404`.

---

### POST /api/worlds/:name/stats/analyze

월드의 모든 리전 파일을 읽어 블록과 광석 수를 셉니다. 결과를 돌려주고, [GET /api/worlds/:name/stats](#get-apiworldsnamestats)를 위해 저장합니다. 분석은 `STATS_ANALYZE_TIMEOUT_MS`(기본값 10분)가 지나거나 클라이언트가 연결을 끊으면 멈춥니다.

**쿼리 파라미터:** `follow`(boolean): SSE로 진행 상황을 보고합니다.

**스트림(`follow=true`):** `{"dimension": "overworld", "regionsDone": 10, "regionsTotal": 64}`를 담은 `progress` 이벤트를 보내고, 끝으로 결과를 담은 `done`, `cancelled`, 또는 `{"message": "..."}`를 담은 `error`(타임아웃 포함)를 보냅니다.

**오류:** 월드가 없으면 `404`, 분석이 실패하거나 시간 초과되거나(`error: "GatewayTimeout"`) 취소되면(`error: "Cancelled"`) `500`.

---

## 라우터 { #router }

### GET /api/router/status

mc-router 상태와 라우팅 정보를 돌려줍니다.

```json
{
  "router": {
    "name": "mc-router",
    "status": "running",
    "health": "healthy",
    "port": 25565,
    "uptime": "5d 12h 30m",
    "uptimeSeconds": 477000,
    "mode": "--in-docker (auto-discovery)",
    "routes": [
      {
        "hostname": "survival.192.168.1.100.nip.io",
        "target": "mc-survival:25565",
        "serverStatus": "running",
        "serverType": "PAPER",
        "serverVersion": "1.21.1",
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
| `mode` | 항상 `--in-docker (auto-discovery)`: mc-router는 Docker 레이블로 서버를 찾습니다. 자동 스케일 설정은 `autoScale`에 있습니다 |
| `routes` | 서버 컨테이너의 호스트명마다 한 항목 |
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

**`router.routes[]` 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `hostname` | string | 서버의 `mc-router.host` 레이블에 있는 호스트명 |
| `target` | string | 백엔드 `container:25565` |
| `serverStatus` | string | 컨테이너 상태. [GET /api/servers](#get-apiservers)와 같습니다 |
| `serverType`, `serverVersion` | string | 서버 `config.env`의 `TYPE`과 `VERSION`. 설정하지 않으면 없음 |
| `autoScaleUp` | boolean | 서버의 `mc-router.auto-scale-up` 레이블이 boolean으로 해석되면 그 값, 아니면 라우터 전역 값. 전역 `AUTO_SCALE_UP`이 꺼져 있으면 mc-router가 중지된 컨테이너를 무시하므로 항상 `false` |
| `autoScaleDown` | boolean | 서버의 `mc-router.auto-scale-down` 레이블이 boolean으로 해석되면 그 값, 아니면 라우터 전역 값 |
| `discoveredByRouter` | boolean | mc-router가 관리 API(`127.0.0.1:25580` `/routes`)에 이 호스트명을 나열하는지 여부 |

필드가 없을 수 있는 경우:

- mc-router가 실행 중이 아니거나 관리 API를 읽을 수 없으면 모든 route에서 `discoveredByRouter`가 없습니다.
- 전역 `AUTO_SCALE_UP`이 꺼져 있는 동안에는 mc-router가 중지된 컨테이너를 무시하므로, 중지된 route는 판정하지 않아 `discoveredByRouter`가 없습니다. 실행 중인 route는 계속 판정합니다.
- `autoScaleUp` / `autoScaleDown`은 값을 알 수 없으면(쓸 수 있는 레이블도 없고 라우터 전역 값도 모르는 경우) 없습니다.

**오류:** 상태를 읽을 수 없으면 `500`.

---

### GET /api/router/status/stream

[GET /api/router/status](#get-apirouterstatus)와 같은 페이로드를 스트리밍합니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `interval` | integer | 5000 | 조회 간격(밀리초, 1000..60000) |

**이벤트:**

| 이벤트 | 데이터 | 설명 |
|--------|--------|------|
| `router-status` | `GET /api/router/status`와 같은 페이로드 | 연결 시 보내고, 이후에는 상태가 바뀔 때만 보냄 |
| `router-status-error` | `{ "timestamp": "..." }` | 조회 실패. 클라이언트는 `GET /api/router/status` 폴링으로 전환해야 하며, 다음 정상 페이로드는 바뀌지 않았어도 다시 보냄 |

- `uptimeSeconds`만 바뀐 경우는 무시합니다. 표시용 `uptime` 문자열이 바뀌면 변경으로 봅니다.
- 같은 `interval`을 쓰는 연결은 조회 하나를 공유합니다.
- 30초마다 `: heartbeat` 주석을 보냅니다.

**예시:**

```bash
curl -N "http://localhost:5001/api/router/status/stream?interval=5000" \
  -H "X-API-Key: mctk_xxx"
```

---

### GET /api/router/logs/stream

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
| `target` | string | 연결이 라우팅된 백엔드 `host:port`. 조건은 `hostname`과 같음 |
| `player` | string | 플레이어 이름. 로그인 연결에만 있고 상태 핑에는 없음 |
| `raw` | string | 원래 로그 줄 |

kind 판정:

| 조건 | `kind` |
|------|--------|
| 로그 레벨 `warning` 이상(`warning`, `error`, `fatal`, `panic`) | `error` |
| 메시지 `Connecting to backend` | `connect` |
| 메시지 `Scaling up backend server` 또는 `Woke up backend server` | `wake` |
| 그 밖의 모든 줄(해석할 수 없는 줄 포함) | `info` (`raw`만, `ts`는 알 때만) |

---

### POST /api/router/restart

`docker compose restart router`를 실행해 mc-router 컨테이너를 재시작합니다. 재시작하는 동안 라우터를 거치는 플레이어 연결이 끊어집니다.

인증은 전역 API 인증을 따릅니다. 요청 본문은 없습니다. 웹 콘솔에서는 재시작 버튼이 관리자에게만 보입니다.

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

---

## 백업 { #backups }

월드 백업은 플랫폼 `.env`의 `BACKUP_GITHUB_TOKEN`, `BACKUP_GITHUB_REPO`(필요하면 `BACKUP_GITHUB_BRANCH`)로 설정한 GitHub 저장소에 푸시됩니다.

### GET /api/backup/status

```json
{
  "configured": true,
  "repository": "username/minecraft-worlds",
  "branch": "main",
  "lastBackup": "2026-01-31T10:30:00.000Z"
}
```

`BACKUP_GITHUB_BRANCH`가 없으면 `branch`는 `main`이며, 백업이 설정되지 않았을 때도 같습니다. `repository`와 `lastBackup`은 알 수 없으면 빠집니다.

---

### POST /api/backup/push

월드를 백업 저장소에 푸시합니다. 실행 중인 서버는 먼저 저장 내용을 디스크에 기록하고(RCON `save-off`, `save-all flush`, 복사 뒤 `save-on`), RCON이 응답하지 않으면 기록 중인 월드를 복사하지 않고 푸시가 실패합니다.

**요청 본문(선택):**

```json
{
  "message": "Before server upgrade",
  "allowMissing": false
}
```

`allowMissing`: 마지막 백업에는 있지만 지금은 없는 월드를 빼는 데 동의합니다. 이 값이 없으면 그런 푸시는 `400`으로 거부됩니다.

**응답:**

```json
{
  "success": true,
  "commitHash": "abc1234",
  "message": "Backup pushed successfully"
}
```

바뀐 것이 없으면 `"message": "No changes to backup"`으로 성공합니다.

**오류:**

| 상태 | 조건 |
|------|------|
| `400` | 설정되지 않음(`Backup is not configured: set BACKUP_GITHUB_TOKEN and BACKUP_GITHUB_REPO in .env`), `allowMissing` 없이 월드가 빠짐, 백업할 것이 없음, 지원하지 않는 월드 구조 |
| `409` | 다른 백업 작업이 실행 중이거나, 끝나지 않은 복원이 있음 |
| `500` | 푸시 실패. 예: RCON이 응답하지 않음 |
| `503` | Docker를 조회할 수 없음 |

---

### GET /api/backup/history

최근 백업 커밋 20개를 나열합니다.

```json
{
  "commits": [
    {
      "hash": "abc1234",
      "message": "Before server upgrade",
      "date": "2026-01-31T10:30:00.000Z",
      "author": "mcctl"
    }
  ],
  "total": 1
}
```

**오류:** `400` `{"error": "BadRequest", "message": "Backup not configured"}`.

---

### POST /api/backup/restore

백업 커밋에서 월드를 복원합니다.

**요청 본문:**

```json
{
  "commitHash": "abc1234"
}
```

`commitHash`는 7자 이상입니다. 모든 서버가 중지되어 있어야 합니다. 대체된 데이터는 `backups/restore-previous/<timestamp>/`에 남으며 최근 3개를 보관합니다. 요청은 입력을 기다리지 않습니다.

**응답:**

```json
{
  "success": true,
  "message": "Restored to commit abc1234"
}
```

**오류:** 서버 실행 중, 다른 백업 실행 중, 끝나지 않은 복원, `LEVEL` 충돌이면 `409`, 알 수 없는 커밋이면 `404`, Docker를 조회할 수 없으면 `503`.

!!! warning "복원 영향"
    백업을 복원하면 현재 월드 데이터를 덮어씁니다. 복원 전에 모든 서버를 중지하세요.

---

### GET /api/backup/schedules

백업 스케줄을 나열합니다. 스케줄은 `backups/meta/backup-schedules.db`에 저장되며, 실행할 때마다 백업을 푸시한 뒤 스케줄의 보관 정책을 적용합니다.

```json
{
  "schedules": [
    {
      "id": "b7c9...",
      "name": "Nightly",
      "cronExpression": "0 3 * * *",
      "cronHumanReadable": "Daily at 3:00 AM",
      "retentionPolicy": { "maxCount": 14 },
      "enabled": true,
      "lastRunAt": "2026-10-25T03:00:00.000Z",
      "lastRunStatus": "success",
      "lastRunMessage": "Backup complete (abc1234)",
      "createdAt": "2026-10-01T12:00:00.000Z",
      "updatedAt": "2026-10-25T03:00:05.000Z"
    }
  ],
  "total": 1
}
```

---

### POST /api/backup/schedules

스케줄을 만듭니다. **응답 (201):** 스케줄 객체.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | string | 예 | 스케줄 이름 |
| `cron` | string | 예 | Cron 표현식 |
| `maxCount` | number | 아니오 | 백업을 최대 이 개수만 보관(1 이상) |
| `maxAgeDays` | number | 아니오 | 이 일수보다 오래된 백업 삭제(1 이상) |
| `enabled` | boolean | 아니오 | 스케줄 실행 여부(기본값 `true`) |

**오류:** 잘못된 cron 표현식이나 빈 이름이면 `400`. 생성마다 `backup.schedule.create` 감사 로그가 남습니다.

---

### GET /api/backup/schedules/:id

스케줄 하나를 돌려줍니다. **오류:** `404`.

---

### PUT /api/backup/schedules/:id

`name`, `cron`, `maxCount`, `maxAgeDays`(각각 선택)를 바꿉니다. 스케줄을 돌려줍니다. **오류:** `404`.

---

### PATCH /api/backup/schedules/:id/toggle

스케줄을 켜거나 끕니다. **요청 본문:** `{"enabled": true}`. 스케줄을 돌려줍니다. **오류:** `404`.

---

### DELETE /api/backup/schedules/:id

스케줄을 지웁니다. **응답:** `{"success": true, "message": "Schedule deleted"}`. **오류:** `404`.

---

## 설정 스냅샷 { #config-snapshots }

설정 스냅샷은 `servers/<name>/` 바로 아래의 설정 파일 사본을 저장합니다: `server.yaml`, `config.env`, `docker-compose.yml`과 1 MB 이하의 다른 `.yml`, `.yaml`, `.json`, `.properties` 파일입니다. `servers/<name>/data`의 파일은 포함되지 않습니다. 스냅샷은 `MCCTL_ROOT`의 `backups/meta/` 아래에 보관됩니다.

**스냅샷 객체:**

```json
{
  "id": "3f6c...",
  "serverName": "survival",
  "createdAt": "2026-10-25T10:00:00.000Z",
  "description": "Before changing view distance",
  "files": [
    { "path": "config.env", "hash": "9b1e...", "size": 812 }
  ],
  "scheduleId": "a1d2..."
}
```

`scheduleId`는 스케줄이 만든 스냅샷에만 있습니다.

### GET /api/servers/:name/config-snapshots

**쿼리 파라미터:** `limit`(1~100, 기본값 20), `offset`(기본값 0).

**응답:** `{"snapshots": [ ... ], "total": 12}`

**오류:** 서버가 없으면 `404`.

---

### POST /api/servers/:name/config-snapshots

스냅샷을 만듭니다. **요청 본문(선택):** `{"description": "..."}`(최대 500자). **응답 (201):** 스냅샷 객체.

**오류:** 서버가 없으면 `404`. 생성마다 `config.snapshot.create` 감사 로그가 남습니다.

---

### GET /api/servers/:name/config-snapshots/:id

스냅샷 하나를 돌려줍니다. **오류:** 알 수 없는 스냅샷이거나 다른 서버의 스냅샷이면 `404`.

---

### DELETE /api/servers/:name/config-snapshots/:id

스냅샷을 지웁니다. **응답:** 본문 없는 `204`. **오류:** `404`.

---

### POST /api/servers/:name/config-snapshots/:id/restore

스냅샷의 파일을 `servers/<name>/`에 되돌려 씁니다.

**요청 본문(선택):**

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `createSnapshotBeforeRestore` | boolean | `true` | 먼저 현재 파일의 안전 스냅샷을 만듦 |
| `force` | boolean | `false` | 서버가 실행 중이어도 복원 |

**응답:** `{"restored": { snapshot }, "safetySnapshot": { snapshot }}`. 안전 스냅샷을 만들지 않았으면 `safetySnapshot`은 없습니다.

**오류:** 알 수 없는 스냅샷이면 `404`, 서버가 실행 중이거나(`force` 없이) 복원할 파일이 [월드 할당 규칙](#world-assignment-rules)을 어기면 `409`. 복원마다 `config.snapshot.restore` 감사 로그가 남습니다.

---

### GET /api/config-snapshots/:id1/diff/:id2

두 스냅샷을 비교합니다.

```json
{
  "baseSnapshotId": "3f6c...",
  "compareSnapshotId": "8a2b...",
  "changes": [
    {
      "path": "config.env",
      "status": "modified",
      "oldContent": "VIEW_DISTANCE=10\n",
      "newContent": "VIEW_DISTANCE=12\n",
      "oldHash": "9b1e...",
      "newHash": "4c7d..."
    }
  ],
  "summary": { "added": 0, "modified": 1, "deleted": 0 },
  "hasChanges": true
}
```

`status`는 `added`, `modified`, `deleted` 중 하나입니다.

**오류:** 둘 중 하나라도 스냅샷이 없으면 `404`.

---

### GET /api/config-snapshot-schedules

스냅샷 스케줄을 나열합니다. **쿼리 파라미터:** `serverName`(선택 필터).

**응답:** `{"schedules": [ ... ]}`. 각 스케줄에는 `id`, `serverName`, `name`, `cronExpression`, `cronHumanReadable`, `enabled`, `retentionCount`, `lastRunAt`, `lastRunStatus`, `createdAt`, `updatedAt`이 있습니다.

---

### POST /api/config-snapshot-schedules

스케줄을 만듭니다. **응답 (201):** 스케줄.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `serverName` | string | 예 | 서버 이름 |
| `name` | string | 예 | 스케줄 이름 |
| `cronExpression` | string | 예 | Cron 표현식, 예: `0 3 * * *` |
| `retentionCount` | number | 아니오 | 보관할 스냅샷 수, 1~100(기본값 10) |
| `enabled` | boolean | 아니오 | 기본값 `true` |

**오류:** 잘못된 값이면 `400`. 생성마다 `config.snapshot.schedule.create` 감사 로그가 남습니다.

---

### GET /api/config-snapshot-schedules/:id

스케줄 하나를 돌려줍니다. **오류:** `404`.

---

### PUT /api/config-snapshot-schedules/:id

`name`, `cronExpression`, `retentionCount`를 바꿉니다. 스케줄을 돌려줍니다. **오류:** `400`, `404`.

---

### PATCH /api/config-snapshot-schedules/:id/toggle

**요청 본문:** `{"enabled": false}`. 스케줄을 돌려줍니다. **오류:** `404`.

---

### DELETE /api/config-snapshot-schedules/:id

스케줄을 지웁니다. 그 스케줄의 스냅샷은 남습니다. **응답:** 본문 없는 `204`. **오류:** `404`.

---

## playit.gg { #playit }

### GET /api/playit/status

```json
{
  "enabled": true,
  "agentRunning": true,
  "secretKeyConfigured": true,
  "containerStatus": "running",
  "uptime": "3h 12m",
  "uptimeSeconds": 11520,
  "servers": [
    {
      "serverName": "survival",
      "playitDomain": "abc-def.craft.playit.gg",
      "lanHostname": "survival.192.168.1.100.nip.io"
    }
  ]
}
```

| 필드 | 설명 |
|------|------|
| `enabled` | `.mcctl.json`에 `playitEnabled`가 있거나 `.env`에 `PLAYIT_SECRET_KEY`가 있으면 `true` |
| `agentRunning` | `playit-agent` 컨테이너 실행 여부 |
| `secretKeyConfigured` | `PLAYIT_SECRET_KEY` 설정 여부 |
| `containerStatus` | `playit-agent` 컨테이너 상태 |
| `uptime`, `uptimeSeconds` | 에이전트가 실행 중일 때만 |
| `servers` | 서버별 `PLAYIT_DOMAIN`(`playitDomain`, 없으면 `null`)과 `mc-router.host` 레이블(`lanHostname`) |

---

### POST /api/playit/start

`playit-agent` 컨테이너를 시작합니다. **응답:** `{"success": true, "message": "playit-agent started"}`. **오류:** 원인과 함께 `500`. 요청마다 `playit.start` 감사 로그가 남습니다.

---

### POST /api/playit/stop

`playit-agent` 컨테이너를 정지합니다. **응답:** `{"success": true, "message": "playit-agent stopped"}`. **오류:** `500`. 요청마다 `playit.stop` 감사 로그가 남습니다.

---

## 플랫폼 설정 { #platform-settings }

이 라우트는 플랫폼 `.env`(`<MCCTL_ROOT>/.env`)를 읽고 씁니다. 요청에 `X-Role: admin`이 없으면 두 라우트 모두 `{"error": "Forbidden", "message": "Administrator role required"}`와 함께 `403`으로 응답하며, 두 라우트 모두 `Cache-Control: no-store`를 보냅니다. `mcctl init` 전에는 `404`(`Platform not initialized (run mcctl init)`)로 응답합니다.

### GET /api/platform-settings

```json
{
  "revision": "5f2a...",
  "settings": [
    {
      "key": "HOST_IP",
      "label": "Host IP",
      "description": "Host IPv4 used for nip.io hostnames of newly created servers.",
      "group": "Network & Routing",
      "type": "ipv4",
      "status": "supported",
      "source": "platform-env",
      "editable": true,
      "secret": false,
      "value": "192.168.1.100",
      "restartScope": "next-create"
    },
    {
      "key": "BACKUP_GITHUB_TOKEN",
      "label": "GitHub token",
      "description": "Token used to push world backups.",
      "group": "Backup",
      "type": "secret",
      "status": "supported",
      "source": "platform-env",
      "editable": true,
      "secret": true,
      "configured": true,
      "restartScope": "api"
    }
  ],
  "runtime": [
    { "key": "AUTH_MODE", "source": "pm2-ecosystem", "value": "ip-whitelist" }
  ]
}
```

| 필드 | 설명 |
|------|------|
| `revision` | 파일 내용의 버전. `PUT`에 그대로 보냅니다 |
| `settings[].type` | `string`, `secret`, `boolean`, `enum`, `integer`, `port`, `ipv4`, `ipv4-list`, `tz`, `repo` 중 하나 |
| `settings[].status` | `supported`, `readonly`, `shadowed`, `legacy`, `unknown` 중 하나 |
| `settings[].value` / `configured` | 시크릿은 값을 돌려주지 않고 `configured`만 돌려줍니다 |
| `settings[].restartScope` | 변경을 적용하려면 다시 시작해야 하는 대상: `none`, `next-create`, `router`, `servers`, `playit`, `api`, `console` |
| `runtime` | `ecosystem.config.cjs`가 서비스에 설정하는 값으로, 여기서는 읽기 전용입니다: 실행 중인 API의 `AUTH_MODE`, 그리고 ecosystem 파일에 아직 정의되어 있으면 `BETTER_AUTH_SECRET` / `BETTER_AUTH_BASE_URL` |

---

### PUT /api/platform-settings

**요청 본문:**

```json
{
  "revision": "5f2a...",
  "set": { "HOST_IP": "192.168.1.100" },
  "remove": ["OLD_KEY"]
}
```

- 시크릿을 `""`로 보내면 현재 값이 유지되며, 시크릿은 `remove`로만 지울 수 있습니다.
- 파일은 모드 `0600`으로 원자적으로 기록되며, 주석과 키 순서가 유지됩니다.

**응답:**

```json
{
  "revision": "8c1d...",
  "changedKeys": ["HOST_IP"],
  "removedKeys": ["OLD_KEY"],
  "restartScopes": ["next-create"]
}
```

**오류:**

| 상태 | 조건 |
|------|------|
| `400` | 잘못된 값, 읽기 전용 키, `set`과 `remove`에 모두 있는 키, 필수 키 삭제. 본문에 `errors: [{"key", "message"}]`가 추가됩니다 |
| `403` | `X-Role`이 `admin`이 아님 |
| `404` | 플랫폼이 초기화되지 않음 |
| `409` | `revision`이 오래됨(본문에 `currentRevision` 추가), 또는 변경이 [월드 할당 규칙](#world-assignment-rules)에 어긋나게 서버의 월드 위치를 옮기게 됨(본문에 `servers` 추가) |

요청마다 값은 빼고 키 이름만 담은 `platform.settings.update` 감사 로그가 남습니다.

---

## 감사 로그 { #audit-logs }

감사 로그는 `MCCTL_ROOT` 아래 `data/audit.db`에 저장됩니다. CLI와 mcctl-api가 같은 데이터베이스에 기록합니다.

### GET /api/audit-logs

항목을 최신순으로 나열합니다.

**쿼리 파라미터:**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `action` | string | 액션 필터. 쉼표로 여러 액션을 주면 첫 번째만 적용되며, 알 수 없는 액션은 필터를 적용하지 않습니다 |
| `actor` | string | 정확한 주체. 예: `api:console` |
| `targetType` | string | 정확한 대상 타입. 예: `server` |
| `targetName` | string | 정확한 대상 이름 |
| `status` | string | `success` 또는 `failure`. 다른 값은 필터를 적용하지 않습니다 |
| `from` | ISO 8601 | 시간 범위의 시작 |
| `to` | ISO 8601 | 시간 범위의 끝 |
| `limit` | number | 1~200, 기본값 50 |
| `offset` | number | 건너뛸 항목 수, 기본값 0 |
| `sort` | string | `timestamp:desc`(기본값) 또는 `timestamp:asc`. `timestamp:asc`는 돌려줄 페이지의 순서만 뒤집으며, 페이지 자체는 최신순으로 고릅니다 |

**응답:**

```json
{
  "logs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "action": "server.create",
      "actor": "api:console",
      "targetType": "server",
      "targetName": "myserver",
      "details": {
        "type": "PAPER",
        "version": "1.21.1",
        "memory": "4G",
        "modpack": null,
        "modpackVersion": null,
        "modLoader": null,
        "excludeFiles": null
      },
      "status": "success",
      "errorMessage": null,
      "timestamp": "2026-02-05T14:32:15.123Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0,
  "filters": {
    "action": null,
    "actor": null,
    "targetType": null,
    "targetName": null,
    "status": null,
    "from": null,
    "to": null
  }
}
```

`filters`는 보낸 필터 파라미터를 그대로 돌려줍니다.

---

### GET /api/audit-logs/stats

전체 항목에 대한 통계를 돌려줍니다. 쿼리 파라미터는 없습니다.

```json
{
  "total": 1234,
  "byAction": {
    "server.start": 456,
    "server.stop": 432,
    "player.whitelist.add": 123
  },
  "byStatus": {
    "success": 1180,
    "failure": 54
  },
  "byActor": {
    "api:console": 678,
    "cli:local": 322
  },
  "recentActivity": [],
  "oldestEntry": "2025-11-07T08:00:00.000Z",
  "newestEntry": "2026-02-05T14:32:15.123Z"
}
```

| 필드 | 설명 |
|------|------|
| `byAction` | 나타나는 액션별 개수 |
| `byStatus` | `success`와 `failure`의 개수 |
| `byActor` | 최근 1000개 항목 안의 주체별 개수 |
| `recentActivity` | 최근 항목 10개 |
| `oldestEntry`, `newestEntry` | 타임스탬프. 항목이 없으면 `null` |

---

### GET /api/audit-logs/:id

항목 하나를 관련 항목과 함께 돌려줍니다.

```json
{
  "log": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "action": "server.create",
    "actor": "api:console",
    "targetType": "server",
    "targetName": "myserver",
    "details": { "type": "PAPER", "version": "1.21.1", "memory": "4G" },
    "status": "success",
    "errorMessage": null,
    "timestamp": "2026-02-05T14:32:15.123Z"
  },
  "relatedLogs": {
    "sameTarget": [
      { "id": "...", "action": "server.start", "targetName": "myserver", "timestamp": "2026-02-05T14:33:00.000Z" }
    ],
    "sameActor": []
  }
}
```

`sameTarget`과 `sameActor`는 각각 다른 항목을 최대 10개 나열합니다.

**오류:** 항목이 없으면 `404`.

---

### GET /api/audit-logs/stream

새 항목을 SSE로 스트리밍합니다.

```
event: connected
data: {"timestamp":"2026-02-05T14:30:00.000Z"}

event: audit-log
data: {"id":"...","action":"server.start","actor":"api:console","targetType":"server","targetName":"myserver","details":null,"status":"success","errorMessage":null,"timestamp":"2026-02-05T14:35:00.000Z"}

event: heartbeat
data: {"timestamp":"2026-02-05T14:35:30.000Z"}
```

| 이벤트 | 설명 |
|--------|------|
| `connected` | 스트림이 열릴 때 한 번 전송 |
| `audit-log` | 이 mcctl-api 프로세스가 기록한 항목. CLI가 기록한 항목은 스트리밍되지 않습니다 |
| `heartbeat` | 30초마다 |

스트림은 필터 파라미터를 받지 않으며, 모든 항목을 보냅니다.

---

### DELETE /api/audit-logs

지정한 날짜보다 오래된 항목을 지웁니다. `X-Role: admin`이 필요합니다.

**요청 본문:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `before` | ISO 8601 date-time | 예 | 이 시각보다 오래된 항목을 삭제 |
| `dryRun` | boolean | 아니오 | 항목 수만 셈(기본값 `false`) |

```bash
curl -X DELETE "http://localhost:5001/api/audit-logs" \
  -H "X-API-Key: mctk_xxx" \
  -H "X-Role: admin" \
  -H "Content-Type: application/json" \
  -d '{"before": "2025-11-07T00:00:00.000Z", "dryRun": true}'
```

**응답:**

```json
{
  "deleted": 234,
  "dryRun": true,
  "message": "234 audit log entries would be deleted before 2025-11-07T00:00:00.000Z"
}
```

`dryRun`이 없으면 메시지는 `<n> audit log entries deleted before <before>`이며, 항목이 지워졌으면 `audit.purge` 항목이 기록됩니다.

**오류:** `before`가 없거나 date-time이 아니면 `400`, `403` `{"error": "Forbidden", "message": "Admin access required for audit log purge"}`.

---

### 감사 로그 항목 { #audit-log-entries }

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | UUID |
| `action` | string | 액션. 아래 표를 참고하세요 |
| `actor` | string | 작업을 한 주체. 아래 표를 참고하세요 |
| `targetType` | string | 대상의 종류 |
| `targetName` | string | 대상의 이름 |
| `details` | object 또는 `null` | 작업의 맥락. 필드는 액션에 따라 다릅니다 |
| `status` | string | `success` 또는 `failure` |
| `errorMessage` | string 또는 `null` | 실패한 작업의 오류 |
| `timestamp` | string | ISO 8601 |

**액션:**

| 영역 | 액션 |
|------|------|
| 서버 | `server.create`, `server.delete`, `server.start`, `server.stop`, `server.restart`, `server.config`, `server.hostname` |
| 플레이어 | `player.whitelist.add`, `player.whitelist.remove`, `player.whitelist.toggle`, `player.ban`, `player.unban`, `player.op`, `player.op.level`, `player.deop`, `player.kick` |
| 월드 | `world.create`, `world.delete`, `world.assign`, `world.release`, `world.map.render` |
| 파일 | `file.read`, `file.write`, `file.delete`, `file.mkdir`, `file.rename`, `file.upload`, `file.download` |
| 모드 | `mod.add`, `mod.remove` |
| 백업 스케줄 | `backup.schedule.create`, `backup.schedule.update`, `backup.schedule.delete`, `backup.schedule.enable`, `backup.schedule.disable`, `backup.schedule.run` |
| 설정 스냅샷 | `config.snapshot.create`, `config.snapshot.delete`, `config.snapshot.restore`, `config.snapshot.schedule.create`, `config.snapshot.schedule.update`, `config.snapshot.schedule.delete`, `config.snapshot.schedule.enable`, `config.snapshot.schedule.disable` |
| 시스템 | `audit.purge`, `platform.settings.update`, `playit.start`, `playit.stop`, `router.restart` |

**주체:**

| 주체 | 기록하는 곳 |
|------|-------------|
| `api:console` | 대부분의 mcctl-api 라우트 |
| `api:<user>` | 파일 라우트와 `PUT /api/platform-settings`. `X-User`의 사용자이며, 헤더가 없으면 `api:console` |
| `cli:local` | `mcctl` 명령어 |
| `scheduler` | 예약 백업 뒤의 보관 정리 |

**사용 중인 대상 타입:** `server`, `world`, `player`, `service`(`mc-router`, `playit`), `system`(감사 로그 정리), `platform`(`.env`), `backup`, `backup-schedule`, `config-snapshot-schedule`, `audit`.

---

## 레거시 { #legacy }

### POST /api/auth/login

사용자 이름과 비밀번호를 `<MCCTL_ROOT>/users.yaml`과 대조합니다. 현재 버전의 mcctl은 이 파일을 만들지 않습니다. 웹 콘솔 계정은 콘솔 데이터베이스에 있으며 `mcctl console user`로 관리합니다. 그래서 새로 설치한 환경에서 이 라우트는 `401`로 응답합니다. 이 라우트에도 일반 API 인증이 필요합니다.

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

`username`이나 `password`가 비어 있어도 `401`(`Username and password are required`)입니다. 파일을 읽다가 실패하면 `{"error": "Internal Server Error", "message": "Authentication service error"}`와 함께 `500`으로 응답합니다.

---

### GET /api/auth/me

`X-User`, `X-Role` 헤더로 받은 사용자를 돌려줍니다.

**헤더:**

| 헤더 | 설명 |
|------|------|
| `X-User` | 사용자명 |
| `X-Role` | 사용자 역할. 없으면 `role`은 `user` |

**응답:**

```json
{
  "username": "admin",
  "role": "admin"
}
```

`X-User`가 없으면 `{"error": "Unauthorized", "message": "Not authenticated"}`와 함께 `401`로 응답합니다.

---

### POST /servers/:id/console/exec

`/api` 접두사가 없는 RCON 명령 실행용 대체 엔드포인트입니다. `:id`는 서버 이름입니다(이미 `mc-`로 시작하는 값은 컨테이너 이름으로 씁니다). `docker exec mc-<id> rcon-cli -- <command>`를 실행하며, 서버가 있는지는 확인하지 않습니다.

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

`output`은 다듬은 표준 출력이며, 출력이 없으면 표준 오류입니다. `exitCode`는 `docker exec`의 종료 코드입니다(실행하지 못하면 1). 공백으로만 된 명령은 `error: "ValidationError"`와 함께 `400`으로 응답합니다.

---

## 코드 예제 { #code-examples }

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

# 월드를 만들고 중지된 서버 "survival"에 할당
requests.post(
    f"{API_URL}/api/worlds",
    headers=headers,
    json={"name": "newworld", "seed": "12345", "serverName": "survival"}
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

// 명령 실행
const result = await fetch(`${API_URL}/api/servers/survival/exec`, {
  method: "POST",
  headers,
  body: JSON.stringify({ command: "list" })
}).then(res => res.json());
console.log(result.output);

// 로그 스트리밍(SSE). fetch는 X-API-Key를 보낼 수 있지만 브라우저 EventSource는 보낼 수 없습니다.
const res = await fetch(`${API_URL}/api/servers/survival/logs?follow=true`, { headers });
const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
let buffer = "";
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += value;
  const events = buffer.split("\n\n");
  buffer = events.pop() ?? "";
  for (const event of events) {
    const line = event.split("\n").find(l => l.startsWith("data: "));
    if (!line) continue;
    const message = JSON.parse(line.slice("data: ".length));
    if (message.type === "server-log") console.log(message.data.log);
  }
}
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

# 월드 목록 조회
curl -H "X-API-Key: $API_KEY" "$API_URL/api/worlds"

# 월드 생성
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "newworld", "seed": "12345"}' \
  "$API_URL/api/worlds"

# 중지된 서버 "survival"에 월드 할당
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"serverName": "survival"}' \
  "$API_URL/api/worlds/newworld/assign"

# 로그 따라가기(SSE)
curl -N -H "X-API-Key: $API_KEY" "$API_URL/api/servers/survival/logs?follow=true"
```
