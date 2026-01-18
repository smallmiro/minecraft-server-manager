# Healthcheck

Docker healthcheck configuration and monitoring options.

## Default Healthcheck

The image includes a default healthcheck:

```yaml
healthcheck:
  test: mc-health
  start_period: 1m
  interval: 5s
  retries: 20
```

## Healthcheck Commands

| Command | Description |
|---------|-------------|
| `mc-health` | Default healthcheck |
| `mc-monitor status` | Detailed status check |

## Docker Compose Configuration

### Basic Configuration

```yaml
services:
  mc:
    image: itzg/minecraft-server
    healthcheck:
      test: mc-health
      start_period: 1m
      interval: 5s
      retries: 20
```

### Custom Configuration

```yaml
services:
  mc:
    image: itzg/minecraft-server
    healthcheck:
      test: mc-health
      start_period: 3m    # Modpacks may have longer startup times
      interval: 10s
      retries: 30
      timeout: 10s
```

## Disabling Healthcheck

### Disable via Environment Variable

For orchestration systems (like Portainer) that cannot disable the default healthcheck:

```yaml
environment:
  DISABLE_HEALTHCHECK: "true"
```

### Disable via Docker Compose

```yaml
services:
  mc:
    image: itzg/minecraft-server
    healthcheck:
      disable: true
      test: ["NONE"]
```

## Healthcheck Parameters

| Parameter | Description | Recommended Value |
|-----------|-------------|-------------------|
| `test` | Healthcheck command | `mc-health` |
| `start_period` | Wait time after container start before first check | `1m` ~ `5m` |
| `interval` | Check interval | `5s` ~ `30s` |
| `retries` | Number of allowed failures | `10` ~ `30` |
| `timeout` | Command timeout | `5s` ~ `15s` |

## Recommended Settings by Server Type

### Vanilla / Paper

```yaml
healthcheck:
  test: mc-health
  start_period: 1m
  interval: 5s
  retries: 20
```

### Forge / Fabric (Modded Servers)

```yaml
healthcheck:
  test: mc-health
  start_period: 3m    # Account for mod loading time
  interval: 10s
  retries: 30
```

### Large Modpacks

```yaml
healthcheck:
  test: mc-health
  start_period: 5m    # Large modpack loading time
  interval: 15s
  retries: 40
```

## Monitoring Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_HOST` | `localhost` | Monitoring target host |
| `SERVER_PORT` | `25565` | Monitoring target port |

## Unsupported Versions

**Minecraft Beta 1.8 and earlier versions** do not support server ping, so healthcheck will not work:

```yaml
environment:
  DISABLE_HEALTHCHECK: "true"
  VERSION: "b1.7.3"
```

## Using with Autopause

Healthcheck configuration when using Autopause:

```yaml
services:
  mc:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      ENABLE_AUTOPAUSE: "true"
      MAX_TICK_TIME: "-1"
    healthcheck:
      test: mc-health
      start_period: 1m
      interval: 5s
      retries: 20
```

## External Monitoring Integration

### Prometheus / Grafana

Collect metrics using mc-monitor:

```bash
docker exec mc mc-monitor status --json
```

### Status Check Script

```bash
#!/bin/bash
if docker exec mc mc-health; then
    echo "Server is healthy"
else
    echo "Server is unhealthy"
    # Send notification, etc.
fi
```

## Complete Example

```yaml
services:
  mc:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"
      MEMORY: "4G"
    healthcheck:
      test: mc-health
      start_period: 2m
      interval: 10s
      retries: 24
      timeout: 10s
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
    restart: unless-stopped
```
