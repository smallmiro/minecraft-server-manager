# Troubleshooting

Common issues and solutions.

## Debugging Environment Variables

| Variable | Description |
|----------|-------------|
| `DEBUG` | Verbose initialization log output |
| `DEBUG_EXEC` | Server startup command output |
| `DEBUG_MEMORY` | Memory allocation debugging |
| `DEBUG_AUTOPAUSE` | Autopause debugging |
| `DEBUG_AUTOSTOP` | Autostop debugging |

```yaml
environment:
  DEBUG: "true"
  DEBUG_EXEC: "true"
  DEBUG_MEMORY: "true"
```

---

## Common Issues

### Server Won't Start

**Check logs:**
```bash
docker logs mc
```

**Verbose logs:**
```yaml
environment:
  DEBUG: "true"
```

### EULA Agreement Error

```
You need to agree to the EULA
```

**Solution:**
```yaml
environment:
  EULA: "TRUE"
```

### Out of Memory

```
java.lang.OutOfMemoryError: Java heap space
```

**Solution:**
```yaml
environment:
  MEMORY: "4G"
  # or
  INIT_MEMORY: "2G"
  MAX_MEMORY: "4G"
```

### Port Conflict

```
Bind for 0.0.0.0:25565 failed: port is already allocated
```

**Solution:**
```yaml
ports:
  - "25566:25565"  # Use different external port
```

Or stop existing container:
```bash
docker stop $(docker ps -q --filter "publish=25565")
```

---

## Java Version Issues

### "class file version 65.0" Error

Java 21 required:
```yaml
image: itzg/minecraft-server:java21
```

### "Unsupported class file major version" Error

Java version too high (especially for older Forge):
```yaml
image: itzg/minecraft-server:java8
```

### Forge 1.16.5 and Below

Must use Java 8:
```yaml
image: itzg/minecraft-server:java8
environment:
  TYPE: "FORGE"
  VERSION: "1.16.5"
```

---

## Permission Issues

### "Permission denied" Error

**Set UID/GID:**
```yaml
environment:
  UID: 1000
  GID: 1000
```

**Skip ownership change:**
```yaml
environment:
  SKIP_CHOWN_DATA: "true"
```

### "Changing ownership of /data" Infinite Wait

Occurs with large data directories:
```yaml
environment:
  SKIP_CHOWN_DATA: "true"
```

### SELinux/Podman Issues

```yaml
volumes:
  - ./data:/data:Z
```

---

## Network Issues

### Cannot Connect Externally

1. **Check port forwarding**
2. **Check firewall:**
   ```bash
   sudo ufw allow 25565/tcp
   ```
3. **Check Docker port mapping:**
   ```yaml
   ports:
     - "25565:25565"
   ```

### "Connection refused" Error

Check if server has fully started:
```bash
docker logs mc | grep "Done"
```

### Connection Failure After Autopause

```yaml
environment:
  AUTOPAUSE_KNOCK_INTERFACE: "eth0"  # Correct interface
  MAX_TICK_TIME: "-1"
```

---

## Mod/Plugin Issues

### Mod Loading Failure

1. **Check Java version** (mod requirements)
2. **Check mod compatibility** (Minecraft version)
3. **Check required dependencies** (Fabric API, etc.)

### CurseForge API Error

```
CF_API_KEY is required
```

**Solution:**
```yaml
environment:
  CF_API_KEY: "${CF_API_KEY}"
```

### Modrinth Download Failure

**Auto-download dependencies:**
```yaml
environment:
  MODRINTH_DOWNLOAD_DEPENDENCIES: "required"
```

---

## Performance Issues

### Server Lag/Slow

**JVM optimization:**
```yaml
environment:
  USE_AIKAR_FLAGS: "true"
  MEMORY: "4G"
```

**Reduce view distance:**
```yaml
environment:
  VIEW_DISTANCE: "8"
  SIMULATION_DISTANCE: "6"
```

### Startup Takes Too Long

**For modpack servers:**
```yaml
healthcheck:
  start_period: 5m  # Increase startup wait time
```

---

## Healthcheck Issues

### Healthcheck Failing

**Increase startup time:**
```yaml
healthcheck:
  start_period: 3m
  retries: 30
```

**Disable healthcheck:**
```yaml
environment:
  DISABLE_HEALTHCHECK: "true"
```

### Beta Version Healthcheck

Beta 1.8 and earlier not supported:
```yaml
environment:
  DISABLE_HEALTHCHECK: "true"
```

---

## Check Image Version

```bash
docker inspect itzg/minecraft-server --format '{{json .Config.Labels}}' | jq
```

Or:
```bash
docker exec mc cat /image-version
```

---

## Log Analysis

### View Full Logs
```bash
docker logs mc
```

### Real-time Logs
```bash
docker logs -f mc
```

### Last 100 Lines
```bash
docker logs --tail 100 mc
```

### Search for Specific Errors
```bash
docker logs mc 2>&1 | grep -i error
```

---

## Container Restart

### Safe Restart
```bash
docker exec mc rcon-cli save-all
docker exec mc rcon-cli stop
docker start mc
```

### Force Restart
```bash
docker restart mc
```

### Full Recreate
```bash
docker compose down
docker compose up -d
```

---

## Reporting Issues

Information to include when reporting issues:

1. **Docker logs** (with DEBUG=true)
2. **docker-compose.yml** (remove passwords)
3. **Image version**
4. **Host OS information**

```bash
# Gather information
docker version
docker logs mc > mc_logs.txt
docker inspect mc > mc_inspect.json
```

GitHub Issues: https://github.com/itzg/docker-minecraft-server/issues
