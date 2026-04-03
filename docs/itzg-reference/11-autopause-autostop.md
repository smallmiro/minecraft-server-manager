# Autopause / Autostop

Features to save server resources when no players are online.

## Native Auto-Pause (Minecraft 1.21.2+)

!!! tip "Recommended for Minecraft 1.21.2+"
    Starting from Minecraft 1.21.2, the server natively supports auto-pause functionality.
    This is simpler and more reliable than the container-level AutoPause feature below.

Minecraft 1.21.2 introduced the `pause-when-empty-seconds` server property, which pauses
the game tick loop when no players are connected. The `itzg/minecraft-server` image exposes
this as the `PAUSE_WHEN_EMPTY_SECONDS` environment variable.

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PAUSE_WHEN_EMPTY_SECONDS` | - | Seconds to wait before pausing when no players are connected |

### Example

```yaml
services:
  mc:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      PAUSE_WHEN_EMPTY_SECONDS: "300"  # Pause after 5 minutes
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
```

### Native vs Container-Level Comparison

| Feature | Native Auto-Pause | Container AutoPause |
|---------|-------------------|---------------------|
| Minecraft Version | 1.21.2+ only | Any version |
| Configuration | Single env var | Multiple env vars |
| Mechanism | Game tick pause | Process suspension |
| Network Handling | Built-in | Requires knock detection |
| Rootless Support | No extra config | Requires `CAP_NET_RAW` |
| Complexity | Low | Medium |

---

## Autopause (Container-Level)

!!! warning "Legacy Feature for Minecraft < 1.21.2"
    For Minecraft 1.21.2+, use the native `PAUSE_WHEN_EMPTY_SECONDS` above.
    The container-level AutoPause below is recommended only for older Minecraft versions.

!!! warning "GraalVM Incompatibility"
    As of 2026.2.0, auto-pause is **temporarily disabled** when using GraalVM images
    (`java21-graalvm`, `java17-graalvm`). Use standard OpenJDK/HotSpot Java images
    for auto-pause functionality.

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
| `AUTOPAUSE_STATUS_RETRY_LIMIT` | `10` | Number of retries for server status check |
| `AUTOPAUSE_STATUS_RETRY_INTERVAL` | `2` | Interval (seconds) between status check retries |

### Additional Options

| Variable | Description |
|----------|-------------|
| `MAX_TICK_TIME` | Set to `-1` to disable watchdog (recommended) |
| `DEBUG_AUTOPAUSE` | `true` - Enable debugging output |

### State Files

The autopause feature uses files in `/data` to manage state:

| File | Description |
|------|-------------|
| `.paused` | Created when the server is paused, deleted when resumed. Can be used to check pause status. |
| `.skip-pause` | Create this file to temporarily skip auto-pause. Remove to re-enable. |

```bash
# Check if server is currently paused
docker exec mc test -f /data/.paused && echo "Paused" || echo "Running"

# Temporarily disable auto-pause
docker exec mc touch /data/.skip-pause

# Re-enable auto-pause
docker exec mc rm /data/.skip-pause
```

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

!!! note "Requirements for Rootless"
    - `CAP_NET_RAW` capability is required for knock detection
    - Set `SKIP_SUDO=true` to avoid sudo-related issues
    - Consider using `slirp4netns` port forwarder for better compatibility

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

Podman with slirp4netns:

```bash
podman run -d \
  --cap-add=CAP_NET_RAW \
  --network slirp4netns:port_handler=slirp4netns \
  -e EULA=TRUE \
  -e ENABLE_AUTOPAUSE=true \
  -e SKIP_SUDO=true \
  -p 25565:25565 \
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
| `USES_PROXY_PROTOCOL` | `true` - Enable PROXY Protocol support (for HAProxy, Fly.io, etc.) |

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

| Feature | Native Auto-Pause | Autopause (Container) | Autostop |
|---------|-------------------|-----------------------|----------|
| Minecraft Version | 1.21.2+ | Any | Any |
| Behavior | Game tick pause | Process suspension | Stop container |
| Recovery Speed | Instant | Instant | Requires server restart |
| Resource Savings | Low-Medium | Medium | High |
| Configuration | Simple (1 var) | Complex (multiple vars) | Moderate |
| Use Case | Modern servers | Older servers, quick recovery | Maximum resource savings |

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

4. **Status Check Failures**
   ```yaml
   environment:
     AUTOPAUSE_STATUS_RETRY_LIMIT: "20"      # Increase retry limit
     AUTOPAUSE_STATUS_RETRY_INTERVAL: "5"     # Increase retry interval
   ```

---

## Complete Examples

### Native Auto-Pause (Recommended for 1.21.2+)

```yaml
services:
  mc:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.21.4"

      # Native auto-pause
      PAUSE_WHEN_EMPTY_SECONDS: "300"  # Pause after 5 minutes

      # Memory
      MEMORY: "4G"
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
```

### Autopause Configuration (Legacy)

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
