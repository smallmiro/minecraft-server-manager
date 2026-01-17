# Sending Commands

Various methods to send commands to the server.

## RCON (Default Method)

RCON is enabled by default.

### Using rcon-cli

```bash
# Interactive mode
docker exec -i mc rcon-cli

# Execute single command
docker exec mc rcon-cli say Hello World
docker exec mc rcon-cli op player_name
docker exec mc rcon-cli stop
```

### RCON Configuration

```yaml
environment:
  ENABLE_RCON: "true"        # Default
  RCON_PASSWORD: "secure_password"
  RCON_PORT: "25575"         # Default
```

### Using Docker Secrets

```yaml
environment:
  RCON_PASSWORD_FILE: "/run/secrets/rcon_password"

secrets:
  rcon_password:
    file: ./rcon_password.txt
```

---

## Console Pipe

When not using RCON:

```yaml
environment:
  ENABLE_RCON: "false"
  CREATE_CONSOLE_IN_PIPE: "true"
```

```bash
docker exec --user 1000 mc mc-send-to-console op player_name
```

---

## Interactive Console

### Docker CLI

```bash
docker attach mc
# Detach: Ctrl+P, Ctrl+Q
```

### Docker Compose

```bash
docker compose attach mc
# Detach: Ctrl+P, Ctrl+Q
```

### Configuration Requirements

```yaml
services:
  mc:
    image: itzg/minecraft-server
    tty: true
    stdin_open: true
```

> **Note**: Full interactive console (auto-completion, color output) requires RCON.

---

## SSH Access

Remote SSH console:

### Configuration

```yaml
environment:
  ENABLE_SSH: "true"
  RCON_PASSWORD: "secure_password"  # Used as SSH password
```

### Port Mapping

```yaml
ports:
  - "25565:25565"
  - "2222:2222"
```

### Connection

```bash
ssh anyuser@server-ip -p 2222
# Password: RCON_PASSWORD value
```

### Security Recommendations

```yaml
ports:
  - "25565:25565"
  - "127.0.0.1:2222:2222"  # Allow local access only
```

---

## WebSocket Console

Web-based console access:

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBSOCKET_CONSOLE` | `false` | Enable WebSocket |
| `WEBSOCKET_ADDRESS` | `0.0.0.0:80` | Bind address |
| `WEBSOCKET_PASSWORD` | - | Access password |
| `WEBSOCKET_LOG_BUFFER_SIZE` | `50` | Log buffer size |

```yaml
environment:
  WEBSOCKET_CONSOLE: "true"
  WEBSOCKET_ADDRESS: "0.0.0.0:8080"
  WEBSOCKET_PASSWORD: "secure_password"
```

### Port Mapping

```yaml
ports:
  - "25565:25565"
  - "8080:8080"
```

### Authentication

Use `Sec-WebSocket-Protocol` header when connecting via WebSocket:
- First: `mc-server-runner-ws-v1`
- Second: password

### Security Settings

```yaml
environment:
  WEBSOCKET_CONSOLE: "true"
  WEBSOCKET_PASSWORD: "secure_password"
  WEBSOCKET_ALLOWED_ORIGINS: "https://admin.example.com"
  WEBSOCKET_DISABLE_ORIGIN_CHECK: "false"
```

---

## Automatic Command Execution

Automatic commands based on server events:

```yaml
environment:
  # On server startup
  RCON_CMDS_STARTUP: |
    gamerule keepInventory true
    whitelist on

  # On player connect
  RCON_CMDS_ON_CONNECT: |
    say Welcome!

  # On first player connect
  RCON_CMDS_FIRST_CONNECT: |
    say Server is active!

  # On last player disconnect
  RCON_CMDS_LAST_DISCONNECT: |
    say Server is empty
```

---

## Example Configurations

### Basic RCON

```yaml
services:
  mc:
    image: itzg/minecraft-server
    tty: true
    stdin_open: true
    environment:
      EULA: "TRUE"
      RCON_PASSWORD: "my_secure_password"
    ports:
      - "25565:25565"
      - "25575:25575"
    volumes:
      - ./data:/data
```

### SSH + WebSocket

```yaml
services:
  mc:
    image: itzg/minecraft-server
    tty: true
    stdin_open: true
    environment:
      EULA: "TRUE"
      RCON_PASSWORD: "my_secure_password"

      # SSH
      ENABLE_SSH: "true"

      # WebSocket
      WEBSOCKET_CONSOLE: "true"
      WEBSOCKET_ADDRESS: "0.0.0.0:8080"
      WEBSOCKET_PASSWORD: "ws_password"
    ports:
      - "25565:25565"
      - "127.0.0.1:2222:2222"   # SSH (local only)
      - "127.0.0.1:8080:8080"   # WebSocket (local only)
    volumes:
      - ./data:/data
```

---

## Command Summary

| Method | Command/Configuration | Usage |
|--------|----------------------|-------|
| RCON CLI | `docker exec mc rcon-cli <cmd>` | Default method |
| Console Pipe | `mc-send-to-console <cmd>` | When RCON is disabled |
| Interactive | `docker attach mc` | Real-time interaction |
| SSH | `ssh user@host -p 2222` | Remote access |
| WebSocket | Web client | Web-based management |
