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
| Wrong Java version | `UnsupportedClassVersionError` | Change the image tag (`java8`, `java17`, `java21`, `java25`); see below |
| Out of memory | `OutOfMemoryError` | Increase `MEMORY` in config.env |
| EULA not accepted | `EULA must be accepted` | mcctl sets `EULA: "TRUE"` in each server's `docker-compose.yml`; restore that line if the file was edited by hand |
| Port conflict | `Address already in use` | Check other services using the port |
| Corrupt world | `java.io.IOException` | Restore from backup |

**Java Version Guide:**

| Minecraft Version | Required Java |
|-------------------|---------------|
| 26.x and `LATEST` | Java 25 |
| 1.20.5–1.21.x | Java 21 |
| 1.17–1.20.4 | Java 17 |
| 1.16.5 and older | Java 8 |

To change the tag, edit `image` in `servers/<name>/docker-compose.yml` (mcctl takes the change into `server.yaml`), then stop and start the server. `mcctl update` keeps a pinned tag: one that starts with a release version (for example `2026.10.0-java21`) or a digest.

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
| DNS not resolving | Check nip.io (`nslookup <server>.<ip>.nip.io`) or use `<server>.local` on the LAN; a bare IP has no route in mc-router |

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
# Check which servers use each world
mcctl world list

# Check server logs for errors
mcctl logs <server-name> | grep -i error
```

**Solutions:**

1. **Restore from backup:**
   ```bash
   mcctl backup restore
   ```

2. **Check world assignments:**
   ```bash
   # Ensure world is not assigned to multiple servers
   mcctl world list

   # Move a world to another server (both servers stopped)
   mcctl world release <world-name>
   mcctl world assign <world-name> <server-name>
   ```

### World Assignment Refused

**Symptoms:** `mcctl world assign`, `mcctl world release`, `mcctl world new --server`, `mcctl create --world`, `mcctl config <server> LEVEL <world>`, `mcctl world delete`, or the matching Web Console and API actions are refused (API: `409 Conflict`).

**Cause:** A world is assigned to a server by its `LEVEL` in `servers/<name>/config.env` (there is no lock file), and one world can be used by one server only. The request is refused when:

- another server already uses the world (a world and its `<world>_nether` / `<world>_the_end` folders count as one world), or a server uses the world you try to delete (`--force` does not override this)
- the server is running, paused, restarting or created (nothing is stopped for you)
- the server keeps its world inside `servers/<name>/data`: it cannot get another world, and its world cannot be released, until `mcctl migrate worlds` moves the world to `worlds/`
- any server's `config.env` cannot be read, or its `LEVEL` cannot be interpreted safely (path separators, `.`/`..`, quotes, control characters, `${VAR}` outside single quotes, or an unsupported `--universe` location). Every assignment change and world delete/reset is refused until it is fixed

**Diagnosis:**

```bash
# Shows "assigned: <servers>" per world and warnings for duplicates and unreadable configs
mcctl world list

# See which world each server uses
grep -E '^(LEVEL|WORLD_NAME)=' servers/*/config.env
```

**Solution:**

1. Stop the server (`mcctl stop <server-name>`).
2. To free a world another server uses, run `mcctl world release <world-name>` on that stopped server. It switches back to its own default world `<server>`.
3. If a `config.env` is reported as unreadable, fix its `LEVEL` line to a plain `LEVEL=<name>` and run the command again.
4. If the error says the server keeps its world inside `servers/<name>/data`, stop the server and run `mcctl migrate worlds --server <server-name>` first.
5. A server in the `created` state (for example after `mcctl update` recreated it) is not stopped by `mcctl stop`. Start it once, then stop it: `mcctl start <server-name> && mcctl stop <server-name>`.

!!! note "Duplicate assignments from older installs"
    Older versions allowed two servers on the same world. These are reported, not fixed: `mcctl world list` shows `assigned: a, b` with a warning, `GET /api/worlds` returns them in `assignmentWarnings`, and the Web Console shows a warning alert. Assign another world to all but one of the servers.

!!! tip "Leftover `worlds/.locks`"
    `mcctl` no longer reads, writes or creates `worlds/.locks`. An existing directory is harmless and `rm -rf worlds/.locks` is safe.

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

### sudo Password Written to /etc/avahi/hosts (before 2.32.0)

**Affected:** You created servers with mcctl earlier than 2.32.0 and supplied a sudo password through `MCCTL_SUDO_PASSWORD`, `--sudo-password`, or the web console's sudo password field.

If sudo did not need to ask for the password at that moment (credentials cached from a recent `sudo`, or `NOPASSWD` in sudoers), the password line was appended to `/etc/avahi/hosts` in plain text. This file is readable by every user on the host. 2.32.0 fixes this; existing files are not changed automatically.

**Check:** list the lines that are not comments, blank lines, or a single `<IPv4> <name>.local` entry:

```bash
grep -nvE '^[[:space:]]*(#|$)|^[0-9.]+[[:space:]]+[^[:space:]]+\.local[[:space:]]*$' /etc/avahi/hosts
```

No output means the file is clean. Each printed line starts with its line number. A line that is your password, or an entry with several IPs such as `192.168.1.10,100.64.0.5 myserver.local`, must be fixed.

**Fix:**

1. Delete the bad line by its number (replace `<N>`) and restart avahi:

    ```bash
    sudo sed -i '<N>d' /etc/avahi/hosts
    sudo systemctl restart avahi-daemon
    ```

2. If a password line was there, change that account's password with `passwd`.
3. For a multi-IP entry, set `HOST_IP` in `.env` to one IPv4 address (or use `HOST_IPS` for several), then add the entry again: `echo '192.168.1.10 myserver.local' | sudo tee -a /etc/avahi/hosts`.

### mc-router Cannot Read the Docker Socket

**Symptoms:** `mcctl logs router` shows `permission denied` for `/var/run/docker.sock`; no server is routed or started on connect.

**Cause:** mc-router 1.46+ runs as a non-root user and reads the socket through `group_add: ["${DOCKER_GID:-999}"]` in `docker-compose.yml`. `DOCKER_GID` in `.env` must match the socket's group.

**Fix:**

```bash
stat -c %g /var/run/docker.sock                  # socket group ID (Linux)
grep '^DOCKER_GID=' ~/minecraft-servers/.env     # must match
mcctl upgrade                                    # sets DOCKER_GID from the socket and patches the router service
mcctl router start                               # recreate mc-router with the new group
```

### Web Console Returns 500 After a Node.js Change

**Symptoms:** Console pages return HTTP 500, and `pm2 logs mcctl-console` shows `NODE_MODULE_VERSION` or `ERR_DLOPEN_FAILED`.

**Cause:** The native `better-sqlite3` module was built for a different Node.js version than the one the PM2 daemon runs.

**Fix:** `mcctl console service status` prints the steps: `pm2 kill`, switch to the Node.js version you installed mcctl with (for example `nvm use 22`), then `mcctl console service start`. See also [Upgrade Runbook, step 4](../advanced/upgrade-runbook.md#4-restart-api--console-if-needed).

### `mcctl console` Cannot Connect

**Symptoms:** `mcctl console <server-name>` (or `mcctl rcon <server-name>`) prints `Failed to connect to RCON`.

**Cause:** `mcctl console` connects over TCP to the container's IP address on the Docker network. The server must be fully started, and the host must reach that IP; Docker Desktop on macOS may not expose it.

**Fix:** Wait until `mcctl logs <server-name>` shows `Done`, or use `mcctl exec <server-name> <command>`, which runs `rcon-cli` inside the container.

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
