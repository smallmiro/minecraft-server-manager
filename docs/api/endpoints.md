# API Endpoints Reference

Every route of mcctl-api, grouped by area. The [REST API Overview](index.md) explains authentication, the error format and Server-Sent Events (SSE) once; this page notes what is specific to each route.

- **Base URL:** `http://localhost:5001`. The paths below are complete; only the legacy `/servers/:id/console/exec` has no `/api` prefix.
- **Authentication:** send `X-API-Key: <key>` in `api-key` and `combined` mode ([Authentication](index.md#authentication)). Routes that need `X-Role: admin` say so.
- **Bodies** are JSON unless a route says otherwise.

## Conventions { #conventions }

- **Server names.** `:name` in `/api/servers/:name/...` is the server name without the `mc-` prefix: `survival` for the container `mc-survival`. Existing servers may have names of up to 64 letters, digits, `_` and `-` that start with a letter or digit; new servers follow the stricter rule of [POST /api/servers](#post-apiservers). Request fields that name a server (`serverName`) take the same name, never the container name.
- **World names.** `:name` in `/api/worlds/:name/...` is a directory directly under `worlds/`. Each world route lists the names it accepts.
- **Validation.** A body, query or path value outside the documented type, range or pattern is answered with `400` before the route runs ([Errors](index.md#errors)).
- **Values written to `config.env`** (seeds, MOTD, mod slugs and other free text) are refused with `400` when they contain control characters, including line breaks, or start with a quote or backtick.
- **Writes through `server.yaml`.** Routes that change a server's settings (configuration, whitelist on/off, hostnames, mods, world assignment) update `servers/<name>/server.yaml` and render `config.env` and the server's `docker-compose.yml` from it. They answer `409` when that write is refused, for example because the generated `docker-compose.yml` was edited by hand ([server.yaml](../configuration/server-yaml.md)).

---

## Health { #health }

### GET /health

Returns the service status. It needs no authentication unless `AUTH_EXCLUDE_PATHS` is changed.

```json
{
  "status": "ok",
  "timestamp": "2026-10-25T10:30:00.000Z"
}
```

The answer is always `200` while mcctl-api runs.

---

## Servers { #servers }

### GET /api/servers

Lists every server: the directories under `servers/` that have a `config.env`, and any `mc-*` container other than `mc-router`.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `include` | string | Optional. `summary` adds `type`, `version`, `memory`, `players`, `stats` per server and a top-level `totals`. Any other value returns `400`. |

**Response:**

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

| Field | Description |
|-------|-------------|
| `name` | Server name |
| `container` | Container name, `mc-<name>` |
| `status` | Container state, see below |
| `health` | `healthy`, `unhealthy`, `starting`, `none` or `unknown` |
| `hostname` | The server's `mc-router.host` label, comma-separated when it has several hostnames; `-` when there is none |

**Status values:**

| Status | Description |
|--------|-------------|
| `running` | Container is running |
| `exited` | Container has stopped |
| `created` | Container created but not started |
| `paused` | Container is paused |
| `restarting` | Container is restarting |
| `dead` | Docker reports the container as dead |
| `not_created` | The server directory exists but there is no container (`health` is `none`, `hostname` is `-`) |

**Response with `include=summary`:**

The default response above is unchanged when `include` is omitted.

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

!!! note "Summary behavior"
    - `type`, `version`, and `memory` come from the server's `config.env`.
    - `players` and `stats` are returned only for running servers. `players` is `null` when the RCON query fails or times out. `stats` (`memoryUsage`, `memoryLimit`, in bytes) is omitted when `docker stats` does not answer in time.
    - RCON and stats run in parallel for running servers with timeouts of about 2 seconds (RCON) and 3 seconds (stats), so one slow server only gets `players: null` (or no `stats`).
    - Results are cached for about 10 seconds per server.
    - `totals.playersOnline` and `totals.playersMax` sum only the servers whose players are known. `totals.running` is the number of running servers.

---

### GET /api/servers/:name

Returns details of one server.

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

| Field | Description |
|-------|-------------|
| `type`, `version`, `memory` | `TYPE`, `VERSION` and `MEMORY` from `config.env` |
| `uptime`, `uptimeSeconds` | Time since the container started; only while it runs |
| `players` | Online players from RCON `list`; only while the server runs and RCON answers |
| `stats` | From `docker stats`: memory use and limit in bytes, memory and CPU use in percent; only while the server runs |
| `worldName` | `LEVEL` (or the legacy `WORLD_NAME`) from `config.env`; `world` when neither is set |
| `worldSize` | Size of `worlds/<worldName>`; `0 B` when that directory does not exist |
| `playitDomain` | `PLAYIT_DOMAIN` from `config.env`, or `null` |

A server without a container is answered from its `config.env` with `status: "not_created"`; missing `TYPE`, `VERSION` and `MEMORY` are then shown as `PAPER`, `LATEST` and `2G`.

**Errors:** `404` when neither the container nor `servers/<name>/config.env` exists.

---

### GET /api/servers-status

Returns the current status of every server. With `follow=true` it streams instead.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `follow` | boolean | `false` | Stream as SSE |
| `interval` | integer | `5000` | Poll interval in milliseconds for the stream (1000 to 60000) |

**Response:**

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

`status` is simplified here: `running`, `exited`, `created`, `stopped` (paused, dead or no container) or `unknown` (restarting or not recognized). `health` is `healthy`, `unhealthy`, `starting`, `none` or `unknown`.

**Stream:** every `interval` the stream sends one `server-status` event per server, plus `: heartbeat` every 30 seconds.

```
event: server-status
data: {"serverName":"survival","status":"running","health":"healthy","timestamp":"2026-10-25T10:30:00.000Z"}
```

---

### GET /api/servers/:name/status

The same status object as [GET /api/servers-status](#get-apiservers-status) for one server. Takes the same `follow` and `interval` parameters; the stream sends a `server-status` event every `interval`.

**Errors:** `404` when the server does not exist.

---

### POST /api/servers

Creates a server: writes `servers/<name>/` (with `server.yaml`, `config.env` and `docker-compose.yml`), adds `<name>.local` to `/etc/avahi/hosts` when the host address is known, and starts the container.

**Request body:**

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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | 2 to 32 characters: a lowercase letter, then lowercase letters, digits and single hyphens (no trailing hyphen, no `--`). `router` is reserved |
| `type` | string | No | `PAPER` (default), `VANILLA`, `FORGE`, `FABRIC`, `SPIGOT`, `NEOFORGE`, `MODRINTH` or `AUTO_CURSEFORGE` |
| `version` | string | No | Minecraft version such as `1.21.1`, `LATEST` or a snapshot id (letters, digits, `.`, `_`, `-`; up to 64). Default `LATEST`; for `MODRINTH` and `AUTO_CURSEFORGE` no `VERSION` is written unless you send one |
| `memory` | string | No | JVM memory such as `4G` or `512M`. Default `4G`, or `6G` for `MODRINTH` and `AUTO_CURSEFORGE` |
| `seed` | string | No | World seed, up to 256 characters |
| `worldUrl` | string | No | URL of a world ZIP to download |
| `worldName` | string | No | Existing world in `worlds/` (letters, digits, `-`, `_`) |
| `autoStart` | boolean | No | Start the container after the files are written (default `true`) |
| `sudoPassword` | string | No | Sudo password for adding `<name>.local` to `/etc/avahi/hosts` (write-only). Not needed when sudo needs no password |
| `modpack` | string | For `MODRINTH`, `AUTO_CURSEFORGE` | Modrinth modpack slug, ID or URL |
| `modpackVersion` | string | No | Modpack version, up to 128 characters |
| `modLoader` | string | No | `forge`, `fabric`, `neoforge` or `quilt` |
| `excludeFiles` | string[] | No | Up to 100 mods to leave out (letters, digits, `.`, `_`, `-`), written to `MODRINTH_EXCLUDE_FILES` or `CF_EXCLUDE_MODS` |

Send at most one of `seed`, `worldUrl` and `worldName`.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `follow` | boolean | `false` | Report progress as SSE instead of one JSON reply |

**Response (201):**

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

`server.status` is `starting` when the container was started, and `created` when `autoStart` is `false` or the start did not finish. In the second case the reply also has `warning`:

- The first start failed: `warning` carries the error. The server is kept; start it later with `POST /api/servers/:name/start`.
- The container start had not finished after 120 seconds (the first start can pull the image or download mods): the reply says so in `warning`, and the start goes on in the background.

**Errors:**

| Status | When |
|--------|------|
| `400` | Invalid body; `MODRINTH` or `AUTO_CURSEFORGE` without `modpack`; `modLoader` and `version` that the modpack does not offer (checked only when both are sent and Modrinth answers); more than one of `seed`, `worldUrl`, `worldName`; `worldName` not found; a value the server files cannot hold |
| `409` | The server exists; the world it would use (`worldName`, otherwise `<name>`) is used by another server; another server's `config.env` cannot be read ([World assignment rules](#world-assignment-rules)) |
| `500` | Creation failed; `message` starts with `Failed to create server:` |

**Streaming (`follow=true`).** After the checks above, the reply switches to `text/event-stream` and sends typed messages:

```
data: {"type":"server-create","data":{"status":"initializing","message":"Initializing server creation..."}}
data: {"type":"server-create","data":{"status":"creating","message":"Creating server directory..."}}
data: {"type":"server-create","data":{"status":"configuring","message":"Registering mDNS hostname..."}}
data: {"type":"server-create","data":{"status":"starting","message":"Starting container..."}}
data: {"type":"server-create-log","data":{"log":"..."}}
data: {"type":"server-create","data":{"status":"completed","message":"Server created successfully","server":{"name":"newserver","container":"mc-newserver","status":"starting"}}}
```

When the first start fails, `completed` says `Server created, but it did not start`, `server.status` is `created` and `warning` is added. Other failures end with `{"status": "error", "message": "Server creation failed: ..."}`. The stream waits for the whole start (up to 30 minutes); the server is still created when the client disconnects.

Create and delete requests run one at a time inside mcctl-api; a request waits for the one before it. Each create writes a `server.create` audit entry.

---

### DELETE /api/servers/:name

Deletes a server. The container is stopped and removed even when it is running.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `force` | boolean | `false` | Accepted for compatibility; it changes nothing |
| `deleteWorld` | boolean | `false` | Delete the world inside the server (`servers/<name>/data/<LEVEL>`) instead of moving it to `worlds/`. Worlds in `worlds/` are never deleted |

**Request body (optional):**

| Field | Type | Description |
|-------|------|-------------|
| `sudoPassword` | string | Sudo password for removing the mDNS hostname `<name>.local` from `/etc/avahi/hosts` (write-only, never logged). Not needed with the sudoers `NOPASSWD` rule |

By default the world inside the server is moved to `worlds/<LEVEL>`. If `worlds/` already has that name or the world inside the server cannot be located with certainty (see [`mcctl delete`](../cli/commands.md#mcctl-delete)), the request fails with `409` and nothing is deleted; if Docker cannot be queried or the container cannot be stopped, it fails with `500` and nothing is deleted. A `409` after the container was removed (for example `servers/compose.yml` locked by another mcctl process, or a world move that failed) says so, names the worlds already moved to `worlds/`, and what is left to clean up. The server leaves `servers/compose.yml` before its world moves, so a start request cannot bring it back meanwhile; a failed move puts it back. A delete of a server that another process (`mcctl delete`, say) is deleting fails with `409`, and so does a server with a hand-written `servers/compose.yml` include entry (anything but `<name>/docker-compose.yml`), before anything is changed. No backup runs before the delete.

**Example:**

```bash
curl -X DELETE "http://localhost:5001/api/servers/myserver" \
  -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"sudoPassword": "your-sudo-password"}'
```

**Response:**

```json
{
  "success": true,
  "server": "myserver",
  "message": "Server deleted successfully"
}
```

When the server was deleted but its mDNS hostname could not be removed, the response adds `warning` (for example `"mDNS hostname myserver.local was not removed: sudo authentication failed; check the sudo password"`). The same goes for files left in `servers/<name>/` after it is out of `servers/compose.yml` (for example files the container wrote as root): the server counts as deleted and `warning` says to remove them with `sudo rm -rf`. Both warnings are joined with `; `.

**Errors:** `404` when the server does not exist; `409` and `500` as described above.

Deletes run one at a time with creates, and each writes a `server.delete` audit entry.

---

### POST /api/servers/:name/start

Starts a server with `docker compose up -d mc-<name>` in `MCCTL_ROOT` (60-second timeout).

**Response:**

```json
{
  "success": true,
  "server": "survival",
  "action": "start",
  "timestamp": "2026-10-25T10:30:00.000Z",
  "message": ""
}
```

`message` carries the standard output of the `docker compose` command; it may be empty.

**Errors** use the same object with `success: false`:

| Status | When | Fields |
|--------|------|--------|
| `400` | The name breaks the existing-name rule ([Conventions](#conventions)) | `error` explains the rule |
| `500` | The `docker compose` command failed, also for an unknown server | `error`: the command error; `message`: its standard error output |

Each request that passes the name check writes a `server.start` audit entry.

---

### POST /api/servers/:name/stop

Stops a server with `docker compose stop mc-<name>`. Response and errors as for [start](#post-apiserversnamestart), with `action: "stop"` and a `server.stop` audit entry.

With `BACKUP_AUTO_ON_STOP=true` in the platform `.env` and backups configured, a successful stop also starts a world backup in the background. Its result goes to the mcctl-api log; it never changes the response. When mcctl-api shuts down it waits up to 2 minutes for such a backup.

---

### POST /api/servers/:name/restart

Restarts a server with `docker compose restart mc-<name>`. Response and errors as for [start](#post-apiserversnamestart), with `action: "restart"` and a `server.restart` audit entry.

---

### POST /api/servers/:name/exec

Runs an RCON command with `docker exec mc-<name> rcon-cli -- <command>`. Because of `--`, a command that starts with `-` is passed to the server as it is.

**Request body:**

```json
{
  "command": "list"
}
```

`command` is 1 to 1024 characters.

**Response:**

```json
{
  "success": true,
  "output": "There are 3 of a max of 20 players online: Player1, Player2, Player3"
}
```

`output` is the trimmed standard output of `rcon-cli`; its standard error is not returned. `success` is `true` whenever the container exists, so an empty `output` can also mean that the command could not run, for example because the server is stopped.

**Errors:** `404` when the container does not exist.

**Common Commands:**

| Command | Description |
|---------|-------------|
| `list` | List online players |
| `say <message>` | Broadcast message |
| `give <player> <item> [count]` | Give item to player |
| `save-all` | Save world |
| `whitelist add <player>` | Add to whitelist |
| `op <player>` | Grant operator |

---

### GET /api/servers/:name/logs

Returns the container log, or streams it.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lines` | integer | `100` | Number of recent lines (1 to 10000) |
| `follow` | boolean | `false` | Stream as SSE |

**JSON response:**

```json
{
  "logs": "[10:30:15] [Server thread/INFO]: Player1 joined the game\n...",
  "lines": 100
}
```

`lines` is the number of non-empty lines returned.

**Stream (`follow=true`).** The last `lines` lines are sent first, then each new line, as typed messages; `: heartbeat` every 30 seconds. When `docker logs` ends, a `connection-closed` message is sent and the stream closes.

```
data: {"type":"server-log","data":{"log":"[10:30:15] [Server thread/INFO]: Player1 joined the game"}}

data: {"type":"connection-closed","data":{"timestamp":"2026-10-25T10:31:00.000Z"}}
```

**Errors:** `404` when the container does not exist, also for a server that has a `config.env` but no container yet.

---

## Server configuration { #server-configuration }

### GET /api/servers/:name/config

Returns the server's settings from `config.env`. Each field stands for one itzg variable, for example `maxPlayers` for `MAX_PLAYERS`, `gameMode` for `GAMEMODE` and `level` for `LEVEL`. Only variables present in `config.env` appear.

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

| Group | Fields |
|-------|--------|
| Gameplay | `difficulty` (`peaceful`, `easy`, `normal`, `hard`), `gameMode` (`survival`, `creative`, `adventure`, `spectator`), `maxPlayers` (1 to 1000), `pvp`, `forceGamemode`, `hardcore`, `allowFlight`, `allowNether`, `enableCommandBlock`, `spawnProtection` (0 to 256), `spawnAnimals`, `spawnMonsters`, `spawnNpcs` |
| World | `motd` (up to 500), `level`, `levelType` (`default`, `flat`, `largeBiomes`, `amplified`, `buffet`), `seed`, `generateStructures`, `maxWorldSize` (1 to 29999984), `icon` |
| Security | `onlineMode`, `enableWhitelist`, `enforceWhitelist`, `enforceSecureProfile` |
| Performance and JVM | `memory` (for example `4G`), `useAikarFlags`, `viewDistance` (2 to 32), `simulationDistance` (3 to 32), `maxTickTime` (-1 or more), `initMemory`, `maxMemory`, `jvmXxOpts` |
| Auto-pause and auto-stop | `enableAutopause`, `autopauseTimeoutEst`, `autopauseTimeoutInit`, `autopausePeriod`, `enableAutostop`, `autostopTimeoutEst`, `pauseWhenEmptySeconds` |
| System | `tz`, `resourcePack`, `resourcePackSha1`, `resourcePackEnforce`, `resourcePackPrompt`, `enableRcon`, `rconPassword`, `rconPort` (1024 to 65535), `stopDuration`, `uid`, `gid` |
| Remote access | `websocketConsole`, `websocketAddress`, `websocketPassword`, `websocketDisableAuthentication`, `websocketAllowedOrigins`, `websocketLogBufferSize`, `enableSsh` |
| Configuration repositories | `paperConfigRepo`, `pufferfishConfigRepo`, `purpurConfigRepo`, `serverPropertiesRepoUrl` |

**Errors:** `404` when the server or its `config.env` does not exist.

---

### PATCH /api/servers/:name/config

Changes any subset of the fields above.

**Request body:**

```json
{
  "memory": "6G",
  "motd": "Welcome back"
}
```

**Response:**

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

| Field | Description |
|-------|-------------|
| `config` | All settings after the change, as in `GET` |
| `changedFields` | Fields whose value changed |
| `restartRequired` | `true` when a changed field takes effect only after a restart, for example `memory`, `onlineMode`, `enableWhitelist`, `level`, `seed`, `rconPassword` or `tz` |

A changed `level` is a world assignment: the value must be a world name made of letters, digits, `-` and `_` (an existing legacy value sent back unchanged is kept), the server must be stopped, and no other server may use that world ([World assignment rules](#world-assignment-rules)). The world directory does not have to exist yet.

**Errors:** `400` invalid value or `level`; `404` server or `config.env` not found; `409` world assignment refused or `server.yaml` write refused.

Each change writes a `server.config` audit entry with the old and new values of the changed fields.

---

### POST /api/servers/:name/world/reset

Deletes the contents of the server's world directory `worlds/<LEVEL>` so that the next start generates a new world. A `.meta` file in that directory is kept.

**Response:**

```json
{
  "success": true,
  "message": "World data has been reset. Start the server to generate a new world.",
  "worldName": "survival"
}
```

**Errors:**

| Status | When |
|--------|------|
| `400` | The world name in the server's configuration is not usable |
| `404` | The server, or its world directory, does not exist |
| `409` | The container is running, paused, restarting or created; the server keeps its world inside `servers/<name>/data`; another server uses the same world; a server's `config.env` cannot be read |

The reset writes a `world.delete` audit entry with `type: "reset"`.

---

## Hostnames { #hostnames }

### GET /api/servers/:name/hostnames

Lists the hostnames of the server's `mc-router.host` label.

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

`<server>.local` and `<server>.<ip>.nip.io` are system hostnames; all others are custom.

**Errors:** `404` when the server or its `docker-compose.yml` does not exist.

---

### PUT /api/servers/:name/hostnames

Replaces all custom hostnames. System hostnames are kept.

**Request body:**

```json
{
  "customHostnames": ["play.example.com"]
}
```

Each hostname is 1 to 253 characters of letters, digits, `-` and `.`, is stored in lowercase, and may appear once. Names of the form `<label>.local` and `<label>.<ip>.nip.io` are refused, because those are system hostnames.

**Response:** the fields of [GET](#get-apiserversnamehostnames) plus:

| Field | Description |
|-------|-------------|
| `success` | `true` |
| `recreateRequired` | Always `true`: the new label applies when the container is recreated. Stop and start the server; a restart does not apply it |
| `playitDomain` | `PLAYIT_DOMAIN` after the change. It stays when it is still listed; when it was removed, a single newly added hostname replaces it, otherwise it is cleared. A server without a playit.gg domain keeps none |

**Errors:** `400` invalid or duplicate hostname; `404` server or `docker-compose.yml` not found; `409` `server.yaml` write refused.

Each change writes a `server.hostname` audit entry.

---

## Mods { #mods }

Mods are kept in the server's `config.env`; Modrinth projects in `MODRINTH_PROJECTS`. The mod source is `modrinth` (the only one available).

### GET /api/servers/:name/mods

```json
{
  "mods": {
    "modrinth": ["sodium", "lithium"]
  }
}
```

`mods` lists the slugs per source; it is `{}` when there are none.

**Errors:** `404` when the server does not exist.

---

### POST /api/servers/:name/mods

Adds mods. Slugs that are already listed are skipped.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slugs` | string[] | Yes | Mod slugs, at least one |
| `source` | string | No | `modrinth` (default) |

**Response:**

```json
{
  "success": true,
  "added": ["sodium"],
  "mods": ["lithium", "sodium"]
}
```

`added` lists the new slugs, `mods` the full list of that source.

**Errors:** `400` empty `slugs` or a slug `config.env` cannot hold; `404` server or `config.env` not found; `409` `server.yaml` write refused. Each request writes a `mod.add` audit entry.

---

### DELETE /api/servers/:name/mods/:slug

Removes a slug from the source that lists it.

```json
{
  "success": true,
  "removed": "sodium"
}
```

**Errors:** `404` server, `config.env` or slug not found; `409` `server.yaml` write refused. Each removal writes a `mod.remove` audit entry.

---

### GET /api/servers/:name/mods/installed

Lists the `.jar` files in `servers/<name>/data/mods/` and whether each is excluded. The exclude list is `MODRINTH_EXCLUDE_FILES`, or `CF_EXCLUDE_MODS` when `TYPE` is `AUTO_CURSEFORGE`.

```json
{
  "mods": [
    { "filename": "sodium-fabric-0.5.11.jar", "excluded": false }
  ]
}
```

`mods` is empty when the directory does not exist.

**Errors:** `404` when the server does not exist.

---

### PATCH /api/servers/:name/mods/installed/:filename/exclude

Adds the jar's file name to the exclude list, or removes it.

**Request body:**

```json
{
  "excluded": true
}
```

**Response:**

```json
{
  "success": true,
  "filename": "sodium-fabric-0.5.11.jar",
  "excluded": true,
  "excludeList": ["sodium-fabric-0.5.11.jar"],
  "restartRequired": true
}
```

**Errors:** `400` `excluded` missing, or a file name with characters other than letters, digits, `.`, `_`, `+`, `-` or not ending in `.jar`; `404` server not found or the file is not in `data/mods/`; `409` `server.yaml` write refused.

---

### GET /api/mods/search

Searches Modrinth.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | | Search text (required) |
| `limit` | integer | `10` | Results per page |
| `offset` | integer | `0` | Results to skip |
| `type` | string | | `modpack` returns modpacks only |

**Response:** `{"hits": [...], "totalHits": 120, "offset": 0, "limit": 10}`. Each hit has `slug`, `title`, `description`, `downloads`, `iconUrl`, `serverSide`, `clientSide`, `projectType`, `categories`, `author`, `license`, `sourceId` and `sourceName`.

**Errors:** `400` when `q` is missing.

---

### GET /api/mods/projects

Returns project details for several slugs.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `slugs` | string | Comma-separated slugs (required) |
| `source` | string | `modrinth` (default) |

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

A slug that is not found maps to `null`.

**Errors:** `400` when `slugs` is missing or empty.

---

### GET /api/mods/:slug/versions

Returns which loaders and Minecraft versions a modpack or mod supports. The Web Console uses it to offer only valid combinations in the create dialog.

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

`recommended` gives, per Minecraft version, the newest version of the pack for that loader. Takes `source` (default `modrinth`).

**Errors:** `404` when no versions are found.

---

### GET /api/mods/:slug/client-only

Lists mods in a modpack whose server-side support is `unsupported`, as partial file names for `excludeFiles` of [POST /api/servers](#post-apiservers).

**Query parameters:** `version` (modpack version; default the latest) and `source` (default `modrinth`).

```json
{
  "slug": "example-pack",
  "clientOnly": ["oculus", "iris"]
}
```

**Errors:** `502` with `error: "BadGateway"` when the detection fails.

---

## Files { #files }

The file routes work inside `servers/<name>/data`. `path` is relative to that directory; a leading `/` is allowed, and `/` is the directory itself. A path that leaves the directory, also through a symbolic link, is refused with `403` (`Path traversal detected`). All file routes answer `404` when the server does not exist.

Writes, deletes, new directories, renames, uploads and downloads write audit entries (`file.write`, `file.delete`, `file.mkdir`, `file.rename`, `file.upload`, `file.download`) with the actor `api:<X-User>`, or `api:console` without `X-User`.

### GET /api/servers/:name/files

Lists a directory. Entries whose name starts with `.` are left out; directories come before files, each sorted by name.

**Query parameters:** `path` (default `/`).

```json
{
  "path": "/",
  "files": [
    { "name": "plugins", "type": "directory", "size": 0, "modifiedAt": "2026-10-25T10:00:00.000Z" },
    { "name": "server.properties", "type": "file", "size": 1432, "modifiedAt": "2026-10-25T09:58:00.000Z" }
  ]
}
```

**Errors:** `400` the path is not a directory; `403`; `404` path not found.

---

### GET /api/servers/:name/files/read

Reads a file as UTF-8 text.

**Query parameters:** `path` (required).

**Response:** `{"path": "/server.properties", "content": "...", "size": 1432, "modifiedAt": "..."}`

**Errors:** `400` `path` missing or a directory; `403`; `404` file not found; `413` file larger than 5 MB.

---

### PUT /api/servers/:name/files/write

Creates or replaces a file. The content is written to a temporary file that then replaces the target.

**Query parameters:** `path` (required). **Request body:** `{"content": "..."}`, at most 5 MB.

**Response:** `{"success": true, "path": "/server.properties", "size": 1440, "modifiedAt": "..."}`

**Errors:** `400` `path` or `content` missing, or the path is a directory; `403`; `413` content larger than 5 MB.

---

### DELETE /api/servers/:name/files

Deletes a file, or a directory with everything in it.

**Query parameters:** `path` (required; `/` is refused).

**Response:** `{"success": true, "path": "/logs/old.log"}`

**Errors:** `400` `path` missing or `/`; `403`; `404` path not found.

---

### POST /api/servers/:name/files/mkdir

Creates a directory, including missing parent directories.

**Query parameters:** `path` (required).

**Response:** `{"success": true, "path": "/plugins/config"}`

**Errors:** `400` `path` missing; `403`; `409` the path exists.

---

### POST /api/servers/:name/files/rename

Renames or moves a file or directory inside the data directory.

**Request body:** `{"oldPath": "/a.txt", "newPath": "/b.txt"}`

**Response:** `{"success": true, "oldPath": "/a.txt", "newPath": "/b.txt"}`

**Errors:** `400` a path missing or `/`; `403`; `404` `oldPath` not found; `409` `newPath` exists.

---

### POST /api/servers/:name/files/upload

Uploads files with `multipart/form-data` into the directory given by `path`, which must exist. Each file part is saved under its own base name and replaces a file of the same name. A file may be at most 100 MB; when one is larger, it and the files already saved by the same request are removed and the request answers `413`.

**Query parameters:** `path` (required).

```bash
curl -X POST -H "X-API-Key: mctk_xxx" \
  -F "file=@./myplugin.jar" \
  "http://localhost:5001/api/servers/survival/files/upload?path=/plugins"
```

**Response:** `{"success": true, "path": "/plugins", "files": ["myplugin.jar"]}`

**Errors:** `400` `path` missing; `403`; `404` directory not found; `413` file larger than 100 MB.

---

### GET /api/servers/:name/files/download

Sends a file as `application/octet-stream` with `Content-Disposition: attachment`.

**Query parameters:** `path` (required).

**Errors:** `400` `path` missing or a directory; `403`; `404` file not found.

---

## Players and access lists { #players }

Online players come from RCON `list` while the server runs. Known players come from the files in `servers/<name>/data`: `usercache.json`, `ops.json`, `whitelist.json`, `banned-players.json` and the player data files.

The roster, player detail, live positions, whitelist and whitelist status reads also work for a server that has only a `config.env`. Changes, the ban and operator lists and kick answer `404` when the server has no container yet.

### GET /api/servers/:name/players

Lists the merged online (RCON) and known (files) players. It works while the server is stopped: `roster` then comes from the files only, and `online`, `max` and `players` are `0` and empty. The same happens when RCON does not answer.

**Query parameters:** `follow` and `interval` as for [GET /api/servers-status](#get-apiservers-status). The stream sends `event: players` with the JSON below every `interval`, plus `: heartbeat` every 30 seconds.

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

`roster` lists online players first, then the others by last seen (newest first), then by name.

**Errors:** `404` when the server does not exist.

---

### GET /api/servers/:name/players/:uuid

Returns one known player. `uuid` must be a dashed Minecraft UUID.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `include` | string | Comma-separated extras: `stats`, `nbt`, `sessions`, in any order. An unknown value returns `400` |

- `stats` adds `stats` from the player's `stats/<uuid>.json` and `advancements/<uuid>.json`, or `null` when there is no stats file.
- `nbt` adds `data` (last saved position, dimension, health, food, XP level, game mode and an inventory summary from the player data file) and `livePosition` (current position over RCON, only while the player is online and the server runs). Each is `null` when it is not available.
- `sessions` adds `sessions`: visit count, total play time, last seen and up to 20 recent sessions, newest first. mcctl-api collects them every 30 seconds from the `joined the game` and `left the game` lines of each running server's log and stores them in `data/players.db` under `MCCTL_ROOT`; on its first run it reads back up to 24 hours of log. A player without history gets `visitCount: 0`, `totalPlaytimeSeconds: 0`, `lastSeen: null` and `recent: []`.

A key that was not requested is left out of the response.

**Response with `?include=stats,nbt,sessions`:**

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

**Errors:** `404` when the server does not exist or the player is not known.

---

### GET /api/servers/:name/players/live

Returns the positions of the online players over RCON; the list is empty when the server is stopped.

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

Each entry can also have `health`, `food` and `xpLevel`. Takes `follow` and `interval`; the stream sends `event: players-live` with the same object.

**Errors:** `404` when the server does not exist.

---

### GET /api/players/:username

Looks up a player with the Mojang API.

```json
{
  "username": "Notch",
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "skinUrl": "https://crafatar.com/avatars/069a79f444e94726a5befca90e38aaf5?overlay"
}
```

`username` has the spelling Mojang returns.

**Errors:** `404` unknown player; `500` the Mojang API failed.

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

- While the server runs, names come from RCON `whitelist list` and UUIDs from `whitelist.json` (`uuid` is `""` for a name the file does not have); `source` is `rcon`. When RCON returns no names, the file is read.
- Otherwise the list comes from `whitelist.json` (`source: "file"`), or from the `WHITELIST` variable in `config.env` when the file is empty (`source: "config"`, empty `uuid`).
- `enabled` is `ENABLE_WHITELIST` from `config.env`.

**Errors:** `404` when the server does not exist.

---

### POST /api/servers/:name/whitelist

Adds a player.

**Request body:** `{"player": "Steve"}` (1 to 16 characters).

**Response:**

```json
{
  "success": true,
  "message": "Added Steve to the whitelist",
  "source": "rcon"
}
```

While the server runs, RCON `whitelist add` is used and `message` is the server's reply. When that reply reports an error (for example `already whitelisted`), or the server is stopped, the player is written to `whitelist.json` with the UUID from Mojang (`source: "file+reload"` and RCON `whitelist reload` while running, `source: "file"` with `(will apply on next server start)` while stopped).

Each request writes a `player.whitelist.add` audit entry.

---

### DELETE /api/servers/:name/whitelist/:player

Removes a player, with the same RCON and file handling as adding (`whitelist remove`; the file match ignores case). The reply has the same fields. Each request writes a `player.whitelist.remove` audit entry.

---

### GET /api/servers/:name/whitelist/status

```json
{
  "enabled": true,
  "source": "config"
}
```

`enabled` is `ENABLE_WHITELIST` from `config.env`.

---

### PUT /api/servers/:name/whitelist/status

Turns the whitelist on or off.

**Request body:** `{"enabled": true}`

Writes `ENABLE_WHITELIST` and, while the server runs, also sends RCON `whitelist on` or `whitelist off`. The reply is the status object above.

**Errors:** `404` server or container not found; `409` `server.yaml` write refused. Each change writes a `player.whitelist.toggle` audit entry.

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

While the server runs, the names come from RCON `banlist players` and the other fields are empty (`expires` is `forever`). Otherwise `banned-players.json` is read. `source` is `file` in both cases.

---

### POST /api/servers/:name/bans

Bans a player.

**Request body:** `{"player": "Griefer", "reason": "Griefing is not allowed"}` (`reason` optional).

While the server runs, RCON `ban` is used and `message` is its reply (`source: "rcon"`). While it is stopped, the player is added to `banned-players.json` with the UUID from Mojang (`source: "file"`, `message` ends with `(will apply on next server start)`). Each request writes a `player.ban` audit entry.

---

### DELETE /api/servers/:name/bans/:player

Unbans a player: RCON `pardon` while running, otherwise removed from `banned-players.json`. The reply has the same fields as a ban. Each request writes a `player.unban` audit entry.

---

### GET /api/servers/:name/ops

Reads `ops.json`.

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

`role` is the name of the level: `Moderator` (1), `Gamemaster` (2), `Admin` (3), `Owner` (4).

---

### POST /api/servers/:name/ops

Adds an operator to `ops.json`, or changes the level of an existing one. No RCON command is sent.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `player` | string | Yes | Player name, 1 to 16 characters |
| `level` | integer | No | 1 to 4, default `4` |

**Response:**

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

**Errors:** `404` when no UUID can be looked up from Mojang for the player. Each request writes a `player.op` audit entry.

---

### PATCH /api/servers/:name/ops/:player

Changes an operator's level in `ops.json` (the name match ignores case).

**Request body:** `{"level": 2}` (1 to 4).

**Response:** as for [POST /api/servers/:name/ops](#post-apiserversnameops).

**Errors:** `404` when the player is not an operator. Each change writes a `player.op.level` audit entry.

---

### DELETE /api/servers/:name/ops/:player

Removes an operator from `ops.json`.

```json
{
  "success": true,
  "message": "Removed operator status from TrustedPlayer",
  "source": "file"
}
```

**Errors:** `404` when the player is not an operator. Each removal writes a `player.deop` audit entry.

---

### POST /api/servers/:name/kick

Kicks an online player with RCON `kick`.

**Request body:** `{"player": "AFKPlayer", "reason": "AFK timeout"}` (`reason` optional).

```json
{
  "success": true,
  "message": "Kicked AFKPlayer: AFK timeout"
}
```

`message` is the server's reply, or `Kicked <player>` when it is empty.

**Errors:** `400` when the server is not running; `404` when the container does not exist. Each request writes a `player.kick` audit entry.

---

## Worlds { #worlds }

### World assignment rules { #world-assignment-rules }

A world is assigned to a server by the server's `LEVEL` in `servers/<name>/config.env` (legacy `WORLD_NAME` is read when `LEVEL` is unset; unset means itzg's default `world`). There is no lock file: `worlds/.locks` is no longer read, written or created.

- **One world, one server.** A world and its `<world>_nether` / `<world>_the_end` folders count as one world. A world used by another server cannot be assigned. This applies to `POST /api/worlds/:name/assign`, `POST /api/worlds` with `serverName`, `POST /api/servers` (including the new server's default world `<name>`) and `PATCH /api/servers/:name/config` with `level`. Deleting a server frees its world for reuse.
- **Stopped server only.** Assign, release, `POST /api/worlds` with `serverName` and `PATCH /api/servers/:name/config` with `level` are refused while the container is running, paused, restarting or created. Nothing is stopped automatically.
- **Fail-closed.** If any server's `config.env` cannot be read, or its `LEVEL` cannot be interpreted safely (path separators, `.`/`..`, quotes, control characters, Compose interpolation such as `${VAR}` outside single quotes, or an unsupported `--universe` location), every assignment change and world delete/reset is refused until it is fixed. Legacy names such as `My World` are still accepted as existing values; new names must be letters, digits, `-` or `_`, and may not end in `_nether` or `_the_end`.
- **Status codes** for world assign/release/delete/create and config `level`: invalid world name `400`, unknown server or world `404`, everything else refused by these rules `409` (conflict, server running, undetermined config).
- **Config snapshot restore** answers `409` when the restored `config.env` would assign a world another server uses, or change the world of a running server (even with force), and when the restored `docker-compose.yml` sets `LEVEL`, `WORLD_NAME` or `EXTRA_ARGS` in `environment` or changes the `/worlds` or `/data` volume mapping.
- **World reset.** `POST /api/servers/:name/world/reset` is refused for servers that keep their world inside `servers/<name>/data` and when another server uses the same world.

---

### GET /api/worlds

Lists the worlds in `worlds/` with the servers they are assigned to.

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

| Field | Description |
|-------|-------------|
| `servers` | Names of the servers whose `LEVEL` points at the world |
| `isLocked`, `lockedBy` | Aliases for "assigned" and the first of `servers` |
| `dimensions` | Whether the split folders `<name>_nether` and `<name>_the_end` exist. They are not listed as worlds of their own, and their size is included in `size` |
| `assignmentWarnings` | `string[]`: one entry per world used by more than one server and per server whose `config.env` cannot be read. Duplicates from older installs are reported, not fixed |

---

### GET /api/worlds/:name

Returns one world, with the same fields as an item of [GET /api/worlds](#get-apiworlds), wrapped in `world`.

`:name` may be any directory name directly under `worlds/`, including legacy names such as `My World` (URL-encode it as `My%20World`). A name that starts with `.` or contains `/`, `\` or control characters answers `400`; a name that is not a directory directly under `worlds/`, such as a plain file, answers `404`. A split dimension folder such as `survival_nether` is part of `survival` and is not found on its own.

---

### POST /api/worlds

Creates the directory `worlds/<name>` with a `.meta` file (name, seed, creation time). The world itself is generated when a server starts with it. With `serverName`, that server's `LEVEL` (and `SEED`, when given) is set to the new world.

**Request body:**

```json
{
  "name": "myworld",
  "seed": "12345",
  "serverName": "myserver",
  "autoStart": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | World name: letters, digits, `-`, `_` |
| `seed` | string | No | World seed |
| `serverName` | string | No | Server to assign the world to (must be stopped; `409` if another server uses the world) |
| `autoStart` | boolean | No | Start that server afterwards (default `false`) |

**Response (201):**

```json
{
  "success": true,
  "worldName": "myworld",
  "seed": "12345",
  "serverName": "myserver",
  "started": false
}
```

`started` is `false` when the start was not requested or failed; the world is created in both cases.

**Errors:** `400` invalid name or seed, a world with that name exists, or no server exists at all (`No servers available. Create a server first.`); `404` unknown `serverName`; `409` as in the [World assignment rules](#world-assignment-rules). Each request writes a `world.create` audit entry.

---

### POST /api/worlds/upload

Imports a world from a ZIP file. The request is `multipart/form-data` with one `.zip` file part that contains a `level.dat`.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | World name (required): letters, digits, `-`, `_` |
| `seed` | string | Accepted and not used |

```bash
curl -X POST -H "X-API-Key: mctk_xxx" \
  -F "file=@./myworld.zip" \
  "http://localhost:5001/api/worlds/upload?name=myworld"
```

**Response (201):** `{"success": true, "worldName": "myworld"}`

**Errors:** `400` not a `.zip` file, no file part, or the archive could not be imported; `409` a world with that name exists; `413` the file is larger than `WORLD_UPLOAD_MAX_SIZE` (default 1 GB). Each request writes a `world.create` audit entry with `source: "upload"`.

---

### POST /api/worlds/:name/assign

Assigns the world to a server by setting the server's `LEVEL`. The server must be stopped.

**Request body:**

```json
{
  "serverName": "survival"
}
```

**Response:**

```json
{
  "success": true,
  "worldName": "survival",
  "serverName": "survival"
}
```

**Error (409 Conflict):**

```json
{
  "error": "Conflict",
  "message": "World 'survival' is assigned to 'creative'; assign another world to 'creative' or delete it first"
}
```

**Errors:** `400` invalid world name (including legacy names and names ending in `_nether` or `_the_end`); `404` unknown world or server; `409` the world is used by another server, the server is not stopped, the server keeps its world inside `servers/<name>/data`, or a `config.env` cannot be read. Each request writes a `world.assign` audit entry.

---

### POST /api/worlds/:name/release

Switch the server using the world back to its own default world `<server>`: an existing free `worlds/<server>` is adopted, otherwise it is created on the next start. The world stays in `worlds/`. The server must be stopped. Releasing a server from its own default world, a world assigned to more than one server, or a server whose world is inside `servers/<name>/data` is refused with `409`.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `force` | boolean | false | Accepted and ignored |

**Response:**

```json
{
  "success": true,
  "worldName": "survival",
  "previousServer": "survival",
  "fallbackWorld": "survival",
  "fallbackExists": false
}
```

`fallbackWorld` is the world the previous server now uses. `fallbackExists` is `false` when `worlds/<fallbackWorld>` does not exist yet and will be created on the next start. Each request writes a `world.release` audit entry.

---

### DELETE /api/worlds/:name

Deletes `worlds/<name>` together with its split dimension folders `<name>_nether` and `<name>_the_end`. Refused with `409` while any server uses the world. Servers that keep their world inside `servers/<name>/data` (no `EXTRA_ARGS=--universe /worlds/`) do not block deleting `worlds/<name>`.

`:name` follows the rule of [GET /api/worlds/:name](#get-apiworldsname): legacy names such as `My World` can be deleted, and a name that is not a directory directly under `worlds/` is not found (`404`), so nothing outside `worlds/` is deleted.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `force` | boolean | false | Accepted for compatibility; does not delete a world a server uses |

**Response:**

```json
{
  "success": true,
  "worldName": "oldworld",
  "size": "500 MB"
}
```

`size` is the size of `worlds/<name>`. Each request writes a `world.delete` audit entry.

---

### GET /api/worlds/:name/info

Returns what is inside a world: `level.dat` metadata, the dimensions present on disk, the size and the number of region files.

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

**Errors:** `404` when the world does not exist.

---

### GET /api/worlds/:name/players

Returns the last saved position of each player from the world's player data files: `{"players": [...]}` with the entry fields of [live positions](#get-apiserversnameplayerslive).

**Errors:** `404` when the world does not exist.

---

### GET /api/worlds/:name/map/status

Tells whether a BlueMap web map has been rendered for the world.

```json
{
  "rendered": true,
  "maps": ["overworld", "nether"],
  "lastModified": "2026-10-25T09:30:00.000Z"
}
```

Before the first render the reply is `{"rendered": false, "maps": []}`.

The map and block statistics routes (`/map/...`, `/stats`, `/stats/analyze`) accept only world names made of letters, digits, `-` and `_`; other names answer `400`.

---

### POST /api/worlds/:name/map/render

Renders a static web map with the BlueMap CLI in a Docker container (2 GB memory limit; the image is built on first use). The server does not have to run. The output is stored in `maps/<name>/web` under `MCCTL_ROOT`.

**Request body (optional):**

| Field | Type | Description |
|-------|------|-------------|
| `dimensions` | string[] | `overworld`, `nether`, `end`; default all dimensions present in the world |
| `force` | boolean | Render everything again instead of reusing cached tiles |

**Query parameters:** `follow` (boolean): report progress as SSE.

**Response:**

```json
{
  "world": "survival",
  "maps": ["overworld", "nether"],
  "webroot": "/home/user/minecraft-servers/maps/survival/web",
  "entry": "/home/user/minecraft-servers/maps/survival/web/index.html"
}
```

**Stream (`follow=true`):** `progress` events with `{"map": "overworld", "percent": 42, "eta": "20 seconds"}` (`eta` when BlueMap reports one), then `done` with the response above, or `error` with `{"message": "..."}`.

**Errors:** `404` world not found; `500` render failed (exit code 137 is reported as a possible out-of-memory). Each render writes a `world.map.render` audit entry.

---

### GET /api/worlds/:name/map/web/*

Serves the files of the rendered map, for example `/api/worlds/survival/map/web/index.html`. An empty path serves `index.html`. When a requested file exists only as `<file>.gz`, it is sent decompressed.

**Errors:** `403` a path outside the map directory; `404` file not found.

---

### POST /api/worlds/:name/map/markers

Reads the generated structures (villages, fortresses, temples and more) from the world's region data and writes them as BlueMap markers into the rendered map, per rendered dimension. Tiles are not rendered again.

```json
{
  "counts": { "overworld": 12, "nether": 3 },
  "total": 15
}
```

**Errors:** `404` world not found; `409` the map has not been rendered yet.

---

### GET /api/worlds/:name/stats

Returns the last block statistics analysis, stored in `stats/<name>.json` under `MCCTL_ROOT`.

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

**Errors:** `404` when no analysis has run yet.

---

### POST /api/worlds/:name/stats/analyze

Scans every region file of the world and counts blocks and ores. The result is returned and saved for [GET /api/worlds/:name/stats](#get-apiworldsnamestats). The analysis stops after `STATS_ANALYZE_TIMEOUT_MS` (default 10 minutes) and when the client disconnects.

**Query parameters:** `follow` (boolean): report progress as SSE.

**Stream (`follow=true`):** `progress` events with `{"dimension": "overworld", "regionsDone": 10, "regionsTotal": 64}`, then `done` with the result, `cancelled`, or `error` with `{"message": "..."}` (also for the timeout).

**Errors:** `404` world not found; `500` the analysis failed, timed out (`error: "GatewayTimeout"`) or was cancelled (`error: "Cancelled"`).

---

## Router { #router }

### GET /api/router/status

Returns mc-router status and routing information.

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

| Field | Description |
|-------|-------------|
| `status` | Router container status |
| `health` | Health check status |
| `port` | External listening port |
| `uptime` / `uptimeSeconds` | Router uptime as a display string and in seconds (optional) |
| `mode` | Always `--in-docker (auto-discovery)`: mc-router finds servers through their Docker labels. Auto-scale settings are in `autoScale` |
| `routes` | One entry per hostname of each server container |
| `image` | Router container image (optional) |
| `autoScale` | Global auto-scale settings of the router container (optional) |
| `resolver` | Host addresses used for `<server>.<ip>.nip.io` hostnames (optional) |
| `avahi` | `avahi-daemon` status (optional) |
| `playit` | playit.gg summary: `enabled`, `agentRunning`, `secretKeyConfigured`. Omitted when the playit status cannot be read |

**`router.autoScale`:**

| Field | Type | Description |
|-------|------|-------------|
| `up` | boolean | Global `AUTO_SCALE_UP`: start a stopped server when a client connects. A missing or invalid value is `false` |
| `down` | boolean | Global `AUTO_SCALE_DOWN`: stop an idle server. A missing or invalid value is `false` |
| `downAfter` | string | `AUTO_SCALE_DOWN_AFTER` as written (Go duration, for example `10m`). Absent when not set |
| `asleepMotd` | string | `AUTO_SCALE_ASLEEP_MOTD` as written; may contain a literal `\n` and `§` color codes. Absent when not set |

**`router.resolver`:**

| Field | Type | Description |
|-------|------|-------------|
| `hostIps` | string[] | Host addresses, using the same rule as server creation: the comma-separated `HOST_IPS` / `HOST_IP` lists in `.env`, else the probed host address |
| `hostIp` | string | The first entry of `hostIps`. Absent when no address is known |

**`router.routes[]` fields:**

| Field | Type | Description |
|-------|------|-------------|
| `hostname` | string | Hostname from the server's `mc-router.host` label |
| `target` | string | Backend `container:25565` |
| `serverStatus` | string | Container status, as in [GET /api/servers](#get-apiservers) |
| `serverType`, `serverVersion` | string | `TYPE` and `VERSION` from the server's `config.env`. Absent when not set |
| `autoScaleUp` | boolean | The server's `mc-router.auto-scale-up` label if it parses as a boolean, else the router global. Always `false` while the global `AUTO_SCALE_UP` is off, because mc-router ignores stopped containers then |
| `autoScaleDown` | boolean | The server's `mc-router.auto-scale-down` label if it parses as a boolean, else the router global |
| `discoveredByRouter` | boolean | Whether mc-router lists this hostname in its management API (`127.0.0.1:25580` `/routes`) |

When a field can be absent:

- `discoveredByRouter` is absent for every route when mc-router is not running or its management API cannot be read.
- While the global `AUTO_SCALE_UP` is off, stopped routes are not judged and have no `discoveredByRouter`, because mc-router ignores stopped containers in that mode. Running routes are still judged.
- `autoScaleUp` / `autoScaleDown` are absent when they cannot be determined (no usable label and no known router global).

**Errors:** `500` when the status cannot be read.

---

### GET /api/router/status/stream

Streams the same payload as [GET /api/router/status](#get-apirouterstatus).

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `interval` | integer | 5000 | Poll interval in milliseconds (1000..60000) |

**Events:**

| Event | Data | Description |
|-------|------|-------------|
| `router-status` | Same payload as `GET /api/router/status` | Sent on connect, then only when the status changes |
| `router-status-error` | `{ "timestamp": "..." }` | A poll failed. Clients should fall back to polling `GET /api/router/status`; the next good payload is sent again even if unchanged |

- Changes that only affect `uptimeSeconds` are ignored. The displayed `uptime` string does count as a change.
- Connections that use the same `interval` share one poll.
- A `: heartbeat` comment is sent every 30 seconds.

**Example:**

```bash
curl -N "http://localhost:5001/api/router/status/stream?interval=5000" \
  -H "X-API-Key: mctk_xxx"
```

---

### GET /api/router/logs/stream

Follows the mc-router logs in real time (`docker logs -f mc-router`). Each log line becomes one `router-log` event.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tail` | integer | 100 | Number of recent log lines to replay first. Clamped to 1..500; an empty or non-numeric value falls back to 100 |

**Example:**

```bash
curl -N "http://localhost:5001/api/router/logs/stream?tail=50" \
  -H "X-API-Key: mctk_xxx"
```

**Events:**

| Event | Data | Description |
|-------|------|-------------|
| `connected` | `{ "timestamp": "..." }` | Sent once when the stream opens |
| `router-log` | `RouterLogEvent` | One per log line |
| `end` | `{ "code": 0, "error"?: "..." }` | The log process exited (`code` is `null` when it could not be run); the stream is closed after it |

A `: heartbeat` comment is sent every 30 seconds. When the client disconnects, the server-side `docker logs -f mc-router` process is killed.

```
event: connected
data: {"timestamp":"2026-10-24T09:12:03.418Z"}

event: router-log
data: {"ts":"2026-10-24T09:12:01Z","kind":"connect","hostname":"survival.192.168.1.100.nip.io","target":"mc-survival:25565","player":"Steve","raw":"time=\"2026-10-24T09:12:01Z\" level=info msg=\"Connecting to backend\" backendHostPort=\"mc-survival:25565\" player=Steve/069a79f4-44e9-4726-a5be-fca90e38aaf5 server=survival.192.168.1.100.nip.io"}
```

**`RouterLogEvent`:**

| Field | Type | Description |
|-------|------|-------------|
| `ts` | string | The log line's `time` field. Absent when the line is not in logfmt |
| `kind` | string | `connect`, `wake`, `error` or `info` |
| `hostname` | string | Hostname the client asked for. Only on `connect`, `wake` and `error` events, when present in the line |
| `target` | string | Backend `host:port` the connection was routed to. Same conditions as `hostname` |
| `player` | string | Player name. Only on login connections, not on status pings |
| `raw` | string | The original log line |

Kind mapping:

| Condition | `kind` |
|-----------|--------|
| Log level `warning` or higher (`warning`, `error`, `fatal`, `panic`) | `error` |
| Message `Connecting to backend` | `connect` |
| Message `Scaling up backend server` or `Woke up backend server` | `wake` |
| Any other line, including lines that cannot be parsed | `info` (only `raw`, plus `ts` when known) |

---

### POST /api/router/restart

Restarts the mc-router container by running `docker compose restart router`. Active player connections through the router are dropped while it restarts.

Authentication follows the global API authentication. The request has no body. In the Web Console, the restart button is shown to administrators only.

**Response (200):**

```json
{
  "success": true,
  "message": "mc-router restarted"
}
```

**Response (500):**

```json
{
  "error": "InternalServerError",
  "message": "Failed to restart mc-router"
}
```

`message` carries the error reported by `docker compose` when it failed.

An audit log entry is written for every request: action `router.restart`, status `success` or `failure`, target type `service`, target name `mc-router`.

---

## Backups { #backups }

World backups are pushed to a GitHub repository configured with `BACKUP_GITHUB_TOKEN` and `BACKUP_GITHUB_REPO` (and optionally `BACKUP_GITHUB_BRANCH`) in the platform `.env`.

### GET /api/backup/status

```json
{
  "configured": true,
  "repository": "username/minecraft-worlds",
  "branch": "main",
  "lastBackup": "2026-01-31T10:30:00.000Z"
}
```

`branch` is `main` when `BACKUP_GITHUB_BRANCH` is not set, also when backups are not configured. `repository` and `lastBackup` are omitted when unknown.

---

### POST /api/backup/push

Pushes the worlds to the backup repository. A running server is flushed first (RCON `save-off` and `save-all flush`, then `save-on` after the copy); when RCON does not answer, the push fails instead of copying a world that is being written.

**Request body (optional):**

```json
{
  "message": "Before server upgrade",
  "allowMissing": false
}
```

`allowMissing`: consent to drop worlds that are in the last backup but missing now; without it such a push is refused with `400`.

**Response:**

```json
{
  "success": true,
  "commitHash": "abc1234",
  "message": "Backup pushed successfully"
}
```

When nothing changed, the push succeeds with `"message": "No changes to backup"`.

**Errors:**

| Status | When |
|--------|------|
| `400` | Not configured (`Backup is not configured: set BACKUP_GITHUB_TOKEN and BACKUP_GITHUB_REPO in .env`), worlds missing without `allowMissing`, nothing to back up, or an unsupported world layout |
| `409` | Another backup operation is running, or a restore did not finish |
| `500` | The push failed, for example because RCON did not answer |
| `503` | Docker could not be queried |

---

### GET /api/backup/history

Lists the last 20 backup commits.

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

**Errors:** `400` `{"error": "BadRequest", "message": "Backup not configured"}`.

---

### POST /api/backup/restore

Restores the worlds from a backup commit.

**Request body:**

```json
{
  "commitHash": "abc1234"
}
```

`commitHash` has at least 7 characters. All servers must be stopped. The data that was replaced is kept in `backups/restore-previous/<timestamp>/` (the last 3 are kept). The request never waits for input.

**Response:**

```json
{
  "success": true,
  "message": "Restored to commit abc1234"
}
```

**Errors:** `409` servers running, another backup running, unfinished restore, or `LEVEL` conflict; `404` unknown commit; `503` Docker cannot be queried.

!!! warning "Restore Impact"
    Restoring a backup will overwrite current world data. Stop all servers before restoring.

---

### GET /api/backup/schedules

Lists the backup schedules. Schedules are stored in `backups/meta/backup-schedules.db`; each run pushes a backup and then applies the schedule's retention policy.

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

Creates a schedule. **Response (201):** the schedule object.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Schedule name |
| `cron` | string | Yes | Cron expression |
| `maxCount` | number | No | Keep at most this many backups (1 or more) |
| `maxAgeDays` | number | No | Remove backups older than this many days (1 or more) |
| `enabled` | boolean | No | Whether the schedule runs (default `true`) |

**Errors:** `400` invalid cron expression or empty name. Each create writes a `backup.schedule.create` audit entry.

---

### GET /api/backup/schedules/:id

Returns one schedule. **Errors:** `404`.

---

### PUT /api/backup/schedules/:id

Changes `name`, `cron`, `maxCount` or `maxAgeDays` (each optional). Returns the schedule. **Errors:** `404`.

---

### PATCH /api/backup/schedules/:id/toggle

Enables or disables a schedule. **Request body:** `{"enabled": true}`. Returns the schedule. **Errors:** `404`.

---

### DELETE /api/backup/schedules/:id

Deletes a schedule. **Response:** `{"success": true, "message": "Schedule deleted"}`. **Errors:** `404`.

---

## Config snapshots { #config-snapshots }

A config snapshot stores copies of the configuration files directly in `servers/<name>/`: `server.yaml`, `config.env`, `docker-compose.yml` and other `.yml`, `.yaml`, `.json` and `.properties` files up to 1 MB. Files in `servers/<name>/data` are not included. Snapshots are kept under `backups/meta/` in `MCCTL_ROOT`.

**Snapshot object:**

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

`scheduleId` is present for snapshots made by a schedule.

### GET /api/servers/:name/config-snapshots

**Query parameters:** `limit` (1 to 100, default 20), `offset` (default 0).

**Response:** `{"snapshots": [ ... ], "total": 12}`

**Errors:** `404` server not found.

---

### POST /api/servers/:name/config-snapshots

Creates a snapshot. **Request body (optional):** `{"description": "..."}` (up to 500 characters). **Response (201):** the snapshot object.

**Errors:** `404` server not found. Each create writes a `config.snapshot.create` audit entry.

---

### GET /api/servers/:name/config-snapshots/:id

Returns one snapshot. **Errors:** `404` unknown snapshot, or one that belongs to another server.

---

### DELETE /api/servers/:name/config-snapshots/:id

Deletes a snapshot. **Response:** `204` without body. **Errors:** `404`.

---

### POST /api/servers/:name/config-snapshots/:id/restore

Writes the files of a snapshot back to `servers/<name>/`.

**Request body (optional):**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `createSnapshotBeforeRestore` | boolean | `true` | Take a safety snapshot of the current files first |
| `force` | boolean | `false` | Restore while the server is running |

**Response:** `{"restored": { snapshot }, "safetySnapshot": { snapshot }}`; `safetySnapshot` is absent when none was taken.

**Errors:** `404` unknown snapshot; `409` the server is running (without `force`), or the restored files break a [world assignment rule](#world-assignment-rules). Each restore writes a `config.snapshot.restore` audit entry.

---

### GET /api/config-snapshots/:id1/diff/:id2

Compares two snapshots.

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

`status` is `added`, `modified` or `deleted`.

**Errors:** `404` when either snapshot does not exist.

---

### GET /api/config-snapshot-schedules

Lists snapshot schedules. **Query parameters:** `serverName` (optional filter).

**Response:** `{"schedules": [ ... ]}`. Each schedule has `id`, `serverName`, `name`, `cronExpression`, `cronHumanReadable`, `enabled`, `retentionCount`, `lastRunAt`, `lastRunStatus`, `createdAt` and `updatedAt`.

---

### POST /api/config-snapshot-schedules

Creates a schedule. **Response (201):** the schedule.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `serverName` | string | Yes | Server name |
| `name` | string | Yes | Schedule name |
| `cronExpression` | string | Yes | Cron expression, for example `0 3 * * *` |
| `retentionCount` | number | No | Snapshots to keep, 1 to 100 (default 10) |
| `enabled` | boolean | No | Default `true` |

**Errors:** `400` invalid values. Each create writes a `config.snapshot.schedule.create` audit entry.

---

### GET /api/config-snapshot-schedules/:id

Returns one schedule. **Errors:** `404`.

---

### PUT /api/config-snapshot-schedules/:id

Changes `name`, `cronExpression` or `retentionCount`. Returns the schedule. **Errors:** `400`, `404`.

---

### PATCH /api/config-snapshot-schedules/:id/toggle

**Request body:** `{"enabled": false}`. Returns the schedule. **Errors:** `404`.

---

### DELETE /api/config-snapshot-schedules/:id

Deletes a schedule; its snapshots are kept. **Response:** `204` without body. **Errors:** `404`.

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

| Field | Description |
|-------|-------------|
| `enabled` | `true` when `playitEnabled` is set in `.mcctl.json` or `PLAYIT_SECRET_KEY` is set in `.env` |
| `agentRunning` | Whether the `playit-agent` container runs |
| `secretKeyConfigured` | Whether `PLAYIT_SECRET_KEY` is set |
| `containerStatus` | Status of the `playit-agent` container |
| `uptime`, `uptimeSeconds` | Only while the agent runs |
| `servers` | Per server: `PLAYIT_DOMAIN` as `playitDomain` (or `null`) and the `mc-router.host` label as `lanHostname` |

---

### POST /api/playit/start

Starts the `playit-agent` container. **Response:** `{"success": true, "message": "playit-agent started"}`. **Errors:** `500` with the reason. Each request writes a `playit.start` audit entry.

---

### POST /api/playit/stop

Stops the `playit-agent` container. **Response:** `{"success": true, "message": "playit-agent stopped"}`. **Errors:** `500`. Each request writes a `playit.stop` audit entry.

---

## Platform Settings { #platform-settings }

These routes read and write the platform `.env` (`<MCCTL_ROOT>/.env`). Both answer `403` with `{"error": "Forbidden", "message": "Administrator role required"}` unless the request has `X-Role: admin`, and both send `Cache-Control: no-store`. Before `mcctl init` they answer `404` (`Platform not initialized (run mcctl init)`).

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

| Field | Description |
|-------|-------------|
| `revision` | Version of the file content; send it back with `PUT` |
| `settings[].type` | `string`, `secret`, `boolean`, `enum`, `integer`, `port`, `ipv4`, `ipv4-list`, `tz` or `repo` |
| `settings[].status` | `supported`, `readonly`, `shadowed`, `legacy` or `unknown` |
| `settings[].value` / `configured` | Secrets never return a value, only `configured` |
| `settings[].restartScope` | What has to restart for a change: `none`, `next-create`, `router`, `servers`, `playit`, `api` or `console` |
| `runtime` | Values that `ecosystem.config.cjs` sets for the services, read-only here: `AUTH_MODE` of the running API, and `BETTER_AUTH_SECRET` / `BETTER_AUTH_BASE_URL` while the ecosystem file still defines them |

---

### PUT /api/platform-settings

**Request body:**

```json
{
  "revision": "5f2a...",
  "set": { "HOST_IP": "192.168.1.100" },
  "remove": ["OLD_KEY"]
}
```

- A secret sent as `""` keeps its current value; a secret is cleared only through `remove`.
- The file is written atomically with mode `0600`; comments and key order are kept.

**Response:**

```json
{
  "revision": "8c1d...",
  "changedKeys": ["HOST_IP"],
  "removedKeys": ["OLD_KEY"],
  "restartScopes": ["next-create"]
}
```

**Errors:**

| Status | When |
|--------|------|
| `400` | Invalid values, read-only keys, a key in both `set` and `remove`, removing a required key. The body adds `errors: [{"key", "message"}]` |
| `403` | `X-Role` is not `admin` |
| `404` | Platform not initialized |
| `409` | `revision` is stale (the body adds `currentRevision`), or the change would move a server's world location against the [world assignment rules](#world-assignment-rules) (the body adds `servers`) |

Each request writes a `platform.settings.update` audit entry with key names only, never values.

---

## Audit logs { #audit-logs }

Audit entries are stored in `data/audit.db` under `MCCTL_ROOT`. The CLI and mcctl-api write to the same database.

### GET /api/audit-logs

Lists entries, newest first.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | Action filter. When several comma-separated actions are given, only the first is applied; an unknown action applies no filter |
| `actor` | string | Exact actor, for example `api:console` |
| `targetType` | string | Exact target type, for example `server` |
| `targetName` | string | Exact target name |
| `status` | string | `success` or `failure`; other values apply no filter |
| `from` | ISO 8601 | Start of the time range |
| `to` | ISO 8601 | End of the time range |
| `limit` | number | 1 to 200, default 50 |
| `offset` | number | Entries to skip, default 0 |
| `sort` | string | `timestamp:desc` (default) or `timestamp:asc`. `timestamp:asc` reverses the returned page; the page itself is selected newest first |

**Response:**

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

`filters` echoes the filter parameters as sent.

---

### GET /api/audit-logs/stats

Returns statistics over all entries. There are no query parameters.

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

| Field | Description |
|-------|-------------|
| `byAction` | Count per action that occurs |
| `byStatus` | Count of `success` and `failure` |
| `byActor` | Count per actor among the newest 1000 entries |
| `recentActivity` | The 10 newest entries |
| `oldestEntry`, `newestEntry` | Timestamps, or `null` when there are no entries |

---

### GET /api/audit-logs/:id

Returns one entry with related entries.

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

`sameTarget` and `sameActor` list up to 10 other entries each.

**Errors:** `404` when the entry does not exist.

---

### GET /api/audit-logs/stream

Streams new entries as SSE.

```
event: connected
data: {"timestamp":"2026-02-05T14:30:00.000Z"}

event: audit-log
data: {"id":"...","action":"server.start","actor":"api:console","targetType":"server","targetName":"myserver","details":null,"status":"success","errorMessage":null,"timestamp":"2026-02-05T14:35:00.000Z"}

event: heartbeat
data: {"timestamp":"2026-02-05T14:35:30.000Z"}
```

| Event | Description |
|-------|-------------|
| `connected` | Sent once when the stream opens |
| `audit-log` | An entry written by this mcctl-api process. Entries written by the CLI are not streamed |
| `heartbeat` | Every 30 seconds |

The stream takes no filter parameters; every entry is sent.

---

### DELETE /api/audit-logs

Deletes entries older than a date. Needs `X-Role: admin`.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `before` | ISO 8601 date-time | Yes | Delete entries older than this |
| `dryRun` | boolean | No | Only count the entries (default `false`) |

```bash
curl -X DELETE "http://localhost:5001/api/audit-logs" \
  -H "X-API-Key: mctk_xxx" \
  -H "X-Role: admin" \
  -H "Content-Type: application/json" \
  -d '{"before": "2025-11-07T00:00:00.000Z", "dryRun": true}'
```

**Response:**

```json
{
  "deleted": 234,
  "dryRun": true,
  "message": "234 audit log entries would be deleted before 2025-11-07T00:00:00.000Z"
}
```

Without `dryRun` the message is `<n> audit log entries deleted before <before>`, and an `audit.purge` entry is written when entries were deleted.

**Errors:** `400` `before` missing or not a date-time; `403` `{"error": "Forbidden", "message": "Admin access required for audit log purge"}`.

---

### Audit log entries { #audit-log-entries }

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID |
| `action` | string | Action, see below |
| `actor` | string | Who did it, see below |
| `targetType` | string | Kind of target |
| `targetName` | string | Name of the target |
| `details` | object or `null` | Context of the action; its fields depend on the action |
| `status` | string | `success` or `failure` |
| `errorMessage` | string or `null` | Error of a failed action |
| `timestamp` | string | ISO 8601 |

**Actions:**

| Area | Actions |
|------|---------|
| Servers | `server.create`, `server.delete`, `server.start`, `server.stop`, `server.restart`, `server.config`, `server.hostname` |
| Players | `player.whitelist.add`, `player.whitelist.remove`, `player.whitelist.toggle`, `player.ban`, `player.unban`, `player.op`, `player.op.level`, `player.deop`, `player.kick` |
| Worlds | `world.create`, `world.delete`, `world.assign`, `world.release`, `world.map.render` |
| Files | `file.read`, `file.write`, `file.delete`, `file.mkdir`, `file.rename`, `file.upload`, `file.download` |
| Mods | `mod.add`, `mod.remove` |
| Backup schedules | `backup.schedule.create`, `backup.schedule.update`, `backup.schedule.delete`, `backup.schedule.enable`, `backup.schedule.disable`, `backup.schedule.run` |
| Config snapshots | `config.snapshot.create`, `config.snapshot.delete`, `config.snapshot.restore`, `config.snapshot.schedule.create`, `config.snapshot.schedule.update`, `config.snapshot.schedule.delete`, `config.snapshot.schedule.enable`, `config.snapshot.schedule.disable` |
| System | `audit.purge`, `platform.settings.update`, `playit.start`, `playit.stop`, `router.restart` |

**Actors:**

| Actor | Written by |
|-------|------------|
| `api:console` | Most mcctl-api routes |
| `api:<user>` | File routes and `PUT /api/platform-settings`, with the user from `X-User` (`api:console` without it) |
| `cli:local` | `mcctl` commands |
| `scheduler` | Retention cleanup after a scheduled backup |

**Target types** in use: `server`, `world`, `player`, `service` (`mc-router`, `playit`), `system` (audit purge), `platform` (`.env`), `backup`, `backup-schedule`, `config-snapshot-schedule`, `audit`.

---

## Legacy { #legacy }

### POST /api/auth/login

Checks a username and password against `<MCCTL_ROOT>/users.yaml`. Current mcctl versions do not create this file: Web Console accounts live in the console database and are managed with `mcctl console user`. On a new install this route therefore answers `401`. It also needs the normal API authentication.

**Request body:**

```json
{
  "username": "admin",
  "password": "secret"
}
```

**Response (200):**

```json
{
  "id": "user-123",
  "username": "admin",
  "role": "admin",
  "name": "admin"
}
```

**Response (401):**

```json
{
  "error": "Unauthorized",
  "message": "Invalid username or password"
}
```

An empty `username` or `password` also answers `401` (`Username and password are required`). A failure while reading the file answers `500` with `{"error": "Internal Server Error", "message": "Authentication service error"}`.

---

### GET /api/auth/me

Returns the user given in the `X-User` and `X-Role` headers.

**Headers:**

| Header | Description |
|--------|-------------|
| `X-User` | Username |
| `X-Role` | User role; `role` is `user` when it is missing |

**Response:**

```json
{
  "username": "admin",
  "role": "admin"
}
```

Without `X-User` the answer is `401` with `{"error": "Unauthorized", "message": "Not authenticated"}`.

---

### POST /servers/:id/console/exec

Alternative endpoint for RCON command execution, without the `/api` prefix. `:id` is the server name (a value that already starts with `mc-` is used as the container name). It runs `docker exec mc-<id> rcon-cli -- <command>` and does not check that the server exists.

**Request body:**

```json
{
  "command": "help"
}
```

**Response:**

```json
{
  "output": "...",
  "exitCode": 0
}
```

`output` is the trimmed standard output, or the standard error when there is no output. `exitCode` is the exit code of `docker exec` (1 when it could not run). A command of only spaces answers `400` with `error: "ValidationError"`.

---

## Code Examples { #code-examples }

### Python

```python
import requests

API_URL = "http://localhost:5001"
API_KEY = "mctk_your_key_here"

headers = {"X-API-Key": API_KEY}

# List servers
response = requests.get(f"{API_URL}/api/servers", headers=headers)
servers = response.json()["servers"]

# Start a server
requests.post(f"{API_URL}/api/servers/survival/start", headers=headers)

# Execute command
response = requests.post(
    f"{API_URL}/api/servers/survival/exec",
    headers=headers,
    json={"command": "list"}
)
print(response.json()["output"])

# Create a world and assign it to the stopped server "survival"
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

// List servers
const servers = await fetch(`${API_URL}/api/servers`, { headers })
  .then(res => res.json());

// Start a server
await fetch(`${API_URL}/api/servers/survival/start`, {
  method: "POST",
  headers
});

// Execute command
const result = await fetch(`${API_URL}/api/servers/survival/exec`, {
  method: "POST",
  headers,
  body: JSON.stringify({ command: "list" })
}).then(res => res.json());
console.log(result.output);

// Stream logs (SSE). fetch can send X-API-Key; the browser EventSource cannot.
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

# List servers
curl -H "X-API-Key: $API_KEY" "$API_URL/api/servers"

# Start server
curl -X POST -H "X-API-Key: $API_KEY" "$API_URL/api/servers/survival/start"

# Execute command
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command": "list"}' \
  "$API_URL/api/servers/survival/exec"

# List worlds
curl -H "X-API-Key: $API_KEY" "$API_URL/api/worlds"

# Create world
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "newworld", "seed": "12345"}' \
  "$API_URL/api/worlds"

# Assign world to the stopped server "survival"
curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"serverName": "survival"}' \
  "$API_URL/api/worlds/newworld/assign"

# Follow logs (SSE)
curl -N -H "X-API-Key: $API_KEY" "$API_URL/api/servers/survival/logs?follow=true"
```
