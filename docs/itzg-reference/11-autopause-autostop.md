# Autopause / Autostop

Features to save server resources when no players are online.

## Autopause

Pauses the server process when no players are online.

### Enable

```yaml
environment:
  ENABLE_AUTOPAUSE: "true"
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AUTOPAUSE` | `false` | Enable Autopause |
| `AUTOPAUSE_TIMEOUT_EST` | `3600` | Wait time (seconds) after last player leaves before pausing |
| `AUTOPAUSE_TIMEOUT_INIT` | `600` | Wait time (seconds) after server start without any connections before pausing |
| `AUTOPAUSE_TIMEOUT_KN` | `120` | Wait time (seconds) after port connection attempt before pausing |
| `AUTOPAUSE_PERIOD` | `10` | Status check interval (seconds) |
| `AUTOPAUSE_KNOCK_INTERFACE` | `eth0` | Network interface |

### Additional Options

| Variable | Description |
|----------|-------------|
| `MAX_TICK_TIME` | Set to `-1` to disable watchdog (recommended) |
| `DEBUG_AUTOPAUSE` | `true` - Enable debugging output |

### Basic Example

```yaml
services:
  mc:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      ENABLE_AUTOPAUSE: "true"
      AUTOPAUSE_TIMEOUT_EST: "300"    # Pause after 5 minutes
      AUTOPAUSE_TIMEOUT_INIT: "120"   # 2 minutes after server start
      MAX_TICK_TIME: "-1"             # Disable watchdog
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
```

### Rootless Environment (Podman)

Additional configuration required for rootless containers:

```yaml
services:
  mc:
    image: itzg/minecraft-server
    cap_add:
      - CAP_NET_RAW
    environment:
      EULA: "TRUE"
      ENABLE_AUTOPAUSE: "true"
      SKIP_SUDO: "true"
```

Docker CLI:

```bash
docker run -d \
  --cap-add=CAP_NET_RAW \
  -e EULA=TRUE \
  -e ENABLE_AUTOPAUSE=true \
  -e SKIP_SUDO=true \
  itzg/minecraft-server
```

---

## Autostop

Completely stops the server when no players are online.

### Enable

```yaml
environment:
  ENABLE_AUTOSTOP: "TRUE"
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AUTOSTOP` | `false` | Enable Autostop |
| `AUTOSTOP_TIMEOUT_EST` | `3600` | Wait time (seconds) after last player leaves before stopping |
| `AUTOSTOP_TIMEOUT_INIT` | `1800` | Wait time (seconds) after server start without any connections before stopping |
| `AUTOSTOP_PERIOD` | `10` | Status check interval (seconds) |

### Additional Options

| Variable | Description |
|----------|-------------|
| `DEBUG_AUTOSTOP` | `true` - Enable debugging output |
| `USES_PROXY_PROTOCOL` | `true` - When using HAProxy/Fly.io |

### Basic Example

```yaml
services:
  mc:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      ENABLE_AUTOSTOP: "TRUE"
      AUTOSTOP_TIMEOUT_EST: "600"    # Stop after 10 minutes
      AUTOSTOP_TIMEOUT_INIT: "300"   # 5 minutes after server start
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
```

### Temporarily Disable Autostop

Create `/data/.skip-stop` file to prevent autostop:

```bash
docker exec mc touch /data/.skip-stop
```

Remove:

```bash
docker exec mc rm /data/.skip-stop
```

---

## Autopause vs Autostop Comparison

| Feature | Autopause | Autostop |
|---------|-----------|----------|
| Behavior | Pause process | Stop container |
| Recovery Speed | Instant | Requires server restart |
| Resource Savings | Medium | High |
| Use Case | Quick recovery needed | Maximum resource savings |

---

## Using with Proxy

### HAProxy / Fly.io

```yaml
environment:
  ENABLE_AUTOSTOP: "TRUE"
  USES_PROXY_PROTOCOL: "true"
```

---

## Troubleshooting

### Enable Debugging

```yaml
environment:
  DEBUG_AUTOPAUSE: "true"
  # or
  DEBUG_AUTOSTOP: "true"
```

### Common Issues

1. **Network Interface Issues**
   ```yaml
   environment:
     AUTOPAUSE_KNOCK_INTERFACE: "eth0"  # Specify correct interface
   ```

2. **Watchdog Timeout**
   ```yaml
   environment:
     MAX_TICK_TIME: "-1"  # Disable watchdog
   ```

3. **Rootless Permission Issues**
   ```yaml
   cap_add:
     - CAP_NET_RAW
   environment:
     SKIP_SUDO: "true"
   ```

---

## Complete Examples

### Autopause Configuration

```yaml
services:
  mc:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"

      # Autopause settings
      ENABLE_AUTOPAUSE: "true"
      AUTOPAUSE_TIMEOUT_EST: "300"
      AUTOPAUSE_TIMEOUT_INIT: "120"
      AUTOPAUSE_PERIOD: "10"
      MAX_TICK_TIME: "-1"

      # Memory
      MEMORY: "4G"
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
```

### Autostop Configuration

```yaml
services:
  mc:
    image: itzg/minecraft-server
    restart: unless-stopped
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"

      # Autostop settings
      ENABLE_AUTOSTOP: "TRUE"
      AUTOSTOP_TIMEOUT_EST: "600"
      AUTOSTOP_TIMEOUT_INIT: "300"

      # Memory
      MEMORY: "4G"
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
```
