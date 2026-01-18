# Examples Collection

Docker-compose examples for various use cases.

## Basic Servers

### Vanilla Server

```yaml
services:
  mc:
    image: itzg/minecraft-server
    tty: true
    stdin_open: true
    restart: unless-stopped
    environment:
      EULA: "TRUE"
      VERSION: "1.20.4"
      MEMORY: "2G"
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
```

### Paper Server

```yaml
services:
  mc:
    image: itzg/minecraft-server
    tty: true
    stdin_open: true
    restart: unless-stopped
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"
      MEMORY: "4G"
      USE_AIKAR_FLAGS: "true"
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
```

---

## Modded Servers

### Forge Server

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    tty: true
    stdin_open: true
    restart: unless-stopped
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      VERSION: "1.20.1"
      MEMORY: "6G"
      USE_AIKAR_FLAGS: "true"
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
```

### Fabric Server

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    tty: true
    stdin_open: true
    restart: unless-stopped
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"
      MEMORY: "4G"
      MODRINTH_PROJECTS: |
        fabric-api
        lithium
        phosphor
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
```

---

## Modpack Servers

### CurseForge Modpack

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    tty: true
    stdin_open: true
    restart: unless-stopped
    environment:
      EULA: "TRUE"
      TYPE: "AUTO_CURSEFORGE"
      CF_API_KEY: "${CF_API_KEY}"
      CF_SLUG: "all-the-mods-9"
      MEMORY: "8G"
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
```

### Modrinth Modpack

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    tty: true
    stdin_open: true
    restart: unless-stopped
    environment:
      EULA: "TRUE"
      TYPE: "MODRINTH"
      MODRINTH_MODPACK: "cobblemon-modpack"
      MEMORY: "6G"
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
```

---

## Bedrock Compatible Server

Support Bedrock clients using GeyserMC:

```yaml
services:
  mc:
    image: itzg/minecraft-server:latest
    pull_policy: daily
    tty: true
    stdin_open: true
    restart: unless-stopped
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"
      MEMORY: "4G"
      PLUGINS: |
        https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot
        https://download.geysermc.org/v2/projects/floodgate/versions/latest/builds/latest/downloads/spigot
    ports:
      - "25565:25565"
      - "19132:19132/udp"
    volumes:
      - ./data:/data
```

---

## Resource Saving

### Lazymc (Server Sleep When Idle)

```yaml
networks:
  minecraft-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.18.0.0/16

services:
  lazymc:
    image: ghcr.io/joesturge/lazymc-docker-proxy:latest
    restart: unless-stopped
    networks:
      minecraft-network:
        ipv4_address: 172.18.0.2
    volumes:
      - data:/server:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    ports:
      - "25565:25565"

  mc:
    image: itzg/minecraft-server:java21
    restart: no
    networks:
      minecraft-network:
        ipv4_address: 172.18.0.3
    labels:
      - lazymc.enabled=true
      - lazymc.group=mc
      - lazymc.server.address=mc:25565
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      MEMORY: "4G"
    volumes:
      - data:/data

volumes:
  data:
```

### Lazytainer (Traffic-Based Management)

```yaml
services:
  lazytainer:
    image: ghcr.io/vmorganp/lazytainer:master
    restart: unless-stopped
    environment:
      VERBOSE: "false"
    ports:
      - "25565:25565"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    labels:
      - lazytainer.group.minecraft.sleepMethod=stop
      - lazytainer.group.minecraft.ports=25565
      - lazytainer.group.minecraft.minPacketThreshold=2
      - lazytainer.group.minecraft.inactiveTimeout=600

  mc:
    image: itzg/minecraft-server:latest
    restart: unless-stopped
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      MEMORY: "4G"
    volumes:
      - ./data:/data
    labels:
      - lazytainer.group=minecraft
    network_mode: service:lazytainer
```

### Autopause

```yaml
services:
  mc:
    image: itzg/minecraft-server
    tty: true
    stdin_open: true
    restart: unless-stopped
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      MEMORY: "4G"
      ENABLE_AUTOPAUSE: "true"
      AUTOPAUSE_TIMEOUT_EST: "300"
      MAX_TICK_TIME: "-1"
    ports:
      - "25565:25565"
    volumes:
      - ./data:/data
```

---

## Production Setup

### Complete Production Configuration

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    tty: true
    stdin_open: true
    restart: unless-stopped
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"

      # Memory and Performance
      MEMORY: "8G"
      USE_AIKAR_FLAGS: "true"
      VIEW_DISTANCE: "10"
      SIMULATION_DISTANCE: "8"

      # Server Settings
      MOTD: "Welcome to Production Server"
      MAX_PLAYERS: "100"
      DIFFICULTY: "normal"
      PVP: "true"
      TZ: "Asia/Seoul"

      # Security
      ENABLE_WHITELIST: "true"
      WHITELIST_FILE: "/config/whitelist.txt"
      OPS_FILE: "/config/ops.txt"
      RCON_PASSWORD_FILE: "/run/secrets/rcon_password"

      # Logging
      LOG_TIMESTAMP: "true"
      ROLLING_LOG_MAX_FILES: "14"

      # Monitoring
      ENABLE_JMX: "true"
      JMX_HOST: "0.0.0.0"
    ports:
      - "25565:25565"
      - "7091:7091"
    volumes:
      - mc-data:/data
      - ./config:/config:ro
    secrets:
      - rcon_password
    healthcheck:
      test: mc-health
      start_period: 2m
      interval: 10s
      retries: 24
    deploy:
      resources:
        limits:
          memory: 10G
        reservations:
          memory: 8G

secrets:
  rcon_password:
    file: ./secrets/rcon_password.txt

volumes:
  mc-data:
```

---

## Multi-Server

### Running Multiple Servers Simultaneously

```yaml
services:
  survival:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      SERVER_NAME: "Survival"
      MEMORY: "4G"
    ports:
      - "25565:25565"
    volumes:
      - ./survival-data:/data

  creative:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      SERVER_NAME: "Creative"
      MODE: "creative"
      MEMORY: "2G"
    ports:
      - "25566:25565"
    volumes:
      - ./creative-data:/data

  modded:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      VERSION: "1.20.1"
      SERVER_NAME: "Modded"
      MEMORY: "6G"
    ports:
      - "25567:25565"
    volumes:
      - ./modded-data:/data
```
