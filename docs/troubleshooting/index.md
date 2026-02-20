# Troubleshooting

This guide covers common issues and their solutions when using mcctl and the Minecraft Docker Server platform.

## Quick Diagnostics

Before diving into specific issues, run these commands to gather information:

```bash
# Check overall status
mcctl status --detail

# Check mc-router health
mcctl status router

# Check specific server logs
mcctl logs <server-name> -n 100

# Test RCON connection
mcctl console <server-name>
```

---

## Common Issues

### Server Won't Start

**Symptoms:** Server container exits immediately or fails to start.

**Diagnosis:**

```bash
mcctl logs <server-name> -n 100
```

**Common Causes:**

| Cause | Log Message | Solution |
|-------|-------------|----------|
| Wrong Java version | `UnsupportedClassVersionError` | Change image tag (java8, java17, java21) |
| Out of memory | `OutOfMemoryError` | Increase `MEMORY` in config.env |
| EULA not accepted | `EULA must be accepted` | Set `EULA=TRUE` in .env |
| Port conflict | `Address already in use` | Check other services using the port |
| Corrupt world | `java.io.IOException` | Restore from backup |

**Java Version Guide:**

| Minecraft Version | Required Java |
|-------------------|---------------|
| 1.21+ | Java 21 |
| 1.18 - 1.20.4 | Java 17 or 21 |
| Forge 1.16.5 and below | Java 8 |

### Cannot Connect to Server

**Symptoms:** Minecraft client shows "Can't connect to server" or "Connection refused".

**Diagnosis:**

```bash
# Check if mc-router is running
mcctl status router

# Check if server is running
mcctl status <server-name>

# Test RCON connection
mcctl console <server-name>
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| mc-router not running | `mcctl router start` |
| Server not running | `mcctl start <server-name>` |
| Wrong hostname | Use correct format: `<server>.<ip>.nip.io:25565` |
| Firewall blocking | Open port 25565 |
| DNS not resolving | Use IP address directly or check nip.io |

### Slow Performance

**Symptoms:** Server lag, high TPS, slow chunk loading.

**Diagnosis:**

```bash
mcctl status <server-name> --detail
```

**Solutions:**

```bash
# Enable Aikar's JVM flags
mcctl config <server-name> USE_AIKAR_FLAGS true

# Reduce view distance
mcctl config <server-name> VIEW_DISTANCE 8

# Reduce simulation distance
mcctl config <server-name> SIMULATION_DISTANCE 6

# Restart server
mcctl stop <server-name> && mcctl start <server-name>
```

### World Corruption

**Symptoms:** Missing chunks, corrupted blocks, server crashes on load.

**Diagnosis:**

```bash
# Check world lock status
mcctl world list

# Check server logs for errors
mcctl logs <server-name> | grep -i error
```

**Solutions:**

1. **Restore from backup:**
   ```bash
   mcctl backup restore
   ```

2. **Check world locking:**
   ```bash
   # Ensure world is not assigned to multiple servers
   mcctl world list

   # Release and reassign if needed
   mcctl world release <world-name>
   mcctl world assign <world-name> <server-name>
   ```

### Mods/Plugins Not Loading

**Symptoms:** Server starts but mods or plugins don't appear.

**Diagnosis:**

```bash
mcctl logs <server-name> | grep -i "mod\|plugin"
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Wrong server type | Use FORGE/FABRIC for mods, PAPER for plugins |
| Version mismatch | Match mod version with Minecraft version |
| Missing dependencies | Install required dependency mods |
| File permissions | Check file ownership in shared/ directory |

---

## Getting Help

If your issue isn't covered here:

1. **Check server logs:** `mcctl logs <server-name> -n 200`
2. **Check Docker logs:** `docker logs mc-<server-name>`
3. **Ask the AI Assistant:** [AI Assistant](https://notebooklm.google.com/notebook/e91b656e-0d95-45b4-a961-fb1610b13962)
4. **Open a GitHub Issue:** [GitHub Issues](https://github.com/smallmiro/minecraft-server-manager/issues)

When reporting issues, please include:

- mcctl version (`mcctl --version`)
- Docker version (`docker --version`)
- Operating system
- Relevant log output
- Steps to reproduce
