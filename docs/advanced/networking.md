# Networking Guide

Configure hostname-based routing for your Minecraft servers using nip.io, mDNS, and mc-router.

## Overview

The platform supports these hostname methods:

| Method | URL Example | Client Setup | Reachable From |
|--------|-------------|--------------|----------------|
| **nip.io** (Recommended) | `myserver.192.168.1.100.nip.io:25565` | None | Networks that can reach the IP in the name (LAN, VPN) |
| **mDNS** | `myserver.local:25565` | avahi/Bonjour | LAN only |

mc-router picks the server by the hostname the client sends, so a bare IP such as `192.168.1.100:25565` does not reach a server. For access from the internet, see [External Access](external-access.md).

## nip.io Magic DNS

**Recommended for all users.**

nip.io is a magic DNS service that automatically resolves hostnames containing IP addresses:

```
myserver.192.168.1.100.nip.io → 192.168.1.100
creative.192.168.1.100.nip.io → 192.168.1.100
modded.192.168.1.100.nip.io   → 192.168.1.100
```

### How It Works

1. Client connects to `myserver.192.168.1.100.nip.io:25565`
2. DNS query goes to nip.io service
3. nip.io extracts `192.168.1.100` from hostname
4. Returns `192.168.1.100` as the IP address
5. Client connects to `192.168.1.100:25565`
6. mc-router receives connection with hostname `myserver.192.168.1.100.nip.io`
7. mc-router routes to the correct server based on hostname

### Configuration

Set your host IP in `.env`:

```bash
# ~/minecraft-servers/.env
HOST_IP=192.168.1.100
```

When you create a server, mcctl puts both hostnames in its `mc-router.host` label:

- `myserver.192.168.1.100.nip.io:25565` (nip.io, one per address in `HOST_IPS`, else `HOST_IP`)
- `myserver.local:25565` (mDNS)

`mcctl status` shows them in the HOSTNAME column.

### Benefits

- **No client configuration** - Works immediately
- **Works across your networks** - From any network that can reach the IP in the name, such as your LAN or a VPN address in `HOST_IPS`
- **Simple setup** - Just set HOST_IP in .env
- **Multiple servers** - Each server gets a unique hostname

### Requirements

- Internet access for DNS resolution
- HOST_IP correctly set in .env
- mc-router must be running

---

## mDNS (Multicast DNS)

mDNS allows `.local` hostnames to work on local networks.

### How It Works

1. avahi-daemon broadcasts hostname on local network
2. Clients with mDNS support discover the hostname
3. No manual /etc/hosts configuration needed

### Server Setup

#### Install avahi-daemon

=== "Ubuntu/Debian"
    ```bash
    sudo apt install avahi-daemon
    sudo systemctl enable --now avahi-daemon
    ```

=== "CentOS/RHEL"
    ```bash
    sudo dnf install avahi
    sudo systemctl enable --now avahi-daemon
    ```

=== "Arch Linux"
    ```bash
    sudo pacman -S avahi nss-mdns
    sudo systemctl enable --now avahi-daemon
    ```

#### Register Hostnames

`mcctl create` registers `<name>.local` when avahi-daemon is installed. It appends `<ip> <name>.local` to `/etc/avahi/hosts` and restarts avahi-daemon with sudo, using the first host address (`HOST_IPS`, else `HOST_IP`; IPv4 only):

- It asks for your sudo password when `/etc/avahi/hosts` exists. For scripts, pass `--sudo-password` or set `MCCTL_SUDO_PASSWORD`. Press Enter to try sudo without a password.
- For passwordless operation, allow the commands mcctl runs, for example in `/etc/sudoers.d/mcctl`:

    ```
    %docker ALL=(ALL) NOPASSWD: /usr/bin/tee -a /etc/avahi/hosts
    %docker ALL=(ALL) NOPASSWD: /usr/bin/sed -i * /etc/avahi/hosts
    %docker ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart avahi-daemon
    ```

- If sudo fails, the server is still created and mcctl prints a warning; add the line by hand (below).
- `mcctl delete` removes the `<name>.local` line the same way.

Manual registration:

```bash
# Add entry
echo "192.168.1.100 myserver.local" | sudo tee -a /etc/avahi/hosts

# Restart avahi
sudo systemctl restart avahi-daemon
```

### Client Setup

| OS | Setup Required |
|----|----------------|
| **Linux** | Install avahi-daemon (usually pre-installed) |
| **macOS** | None (Bonjour built-in) |
| **Windows** | Install Bonjour (iTunes or Bonjour Print Services) |

#### Windows Client

1. Download [Bonjour Print Services](https://support.apple.com/kb/DL999)
2. Install and restart
3. `.local` hostnames will resolve

#### Linux Client

```bash
# Ubuntu/Debian
sudo apt install avahi-daemon libnss-mdns

# Verify nss-mdns is configured
grep mdns /etc/nsswitch.conf
# Should show: hosts: files mdns4_minimal [NOTFOUND=return] dns
```

### Troubleshooting mDNS

```bash
# Check if avahi is running
systemctl status avahi-daemon

# List registered hostnames
cat /etc/avahi/hosts

# Test resolution
avahi-resolve -n myserver.local

# Check network interface
avahi-daemon --check
```

---

## mc-router Configuration

mc-router handles hostname-based routing and auto-scaling.

!!! info "Pinned version"
    The platform pins `itzg/mc-router` to `1.47.1` in `docker-compose.yml` for reproducible deployments.
    Compared to `1.42.0`, this release adds event-based Docker polling (faster auto-scale reactions),
    timezone (`TZ`) support, and a `--log-level` option. There are no breaking changes, and the
    label-based `--in-docker` auto-scale workflow used here needs no configuration changes.

    Since `1.46`, mc-router runs as a non-root user. The compose file adds the Docker socket's group via
    `group_add: ["${DOCKER_GID:-999}"]`; `mcctl init`/`mcctl upgrade` detect and write `DOCKER_GID` to `.env`.

### Router Management with mcctl

```bash
# Check router status
mcctl status router

# Start router (also recreates it after docker-compose.yml changes)
mcctl router start

# Restart the running container (keeps its current settings)
mcctl router restart

# Stop router
mcctl router stop
```

### Docker Labels

Each server uses Docker labels for mc-router discovery. These are automatically configured by `mcctl create`:

```yaml
# servers/myserver/docker-compose.yml (auto-generated)
services:
  mc-myserver:
    labels:
      mc-router.host: "myserver.local,myserver.192.168.1.100.nip.io"
```

### Auto-scaling Settings

mc-router's settings are in the `router` service of `~/minecraft-servers/docker-compose.yml`, not in `.env`:

```yaml
services:
  router:
    environment:
      IN_DOCKER: "true"
      AUTO_SCALE_UP: "true"          # Start servers on connect
      AUTO_SCALE_DOWN: "true"        # Stop idle servers (see note)
      AUTO_SCALE_DOWN_AFTER: "10m"   # Idle time before a server is stopped
      DOCKER_TIMEOUT: "120s"         # Wait time (Go time.Duration: 120s, 2m; bare integers fail)
```

After editing, recreate the router (`mcctl router restart` keeps the old settings):

```bash
mcctl router start
```

`mcctl upgrade` changes only the router `image` and `group_add`, so your edits stay.

To turn auto-scaling off for one server, set `routing.autoScale.up` or `routing.autoScale.down` to `false` in `servers/<name>/server.yaml`, run `mcctl migrate spec <name>`, then recreate its container: `mcctl stop <name> && mcctl start <name>` when it runs, `mcctl start <name>` when it is stopped. These become the server's `mc-router.auto-scale-up` / `mc-router.auto-scale-down` labels.

!!! info "AUTO_SCALE_DOWN"
    Auto scale down is fully enabled and supported since mc-router v1.39.1.
    Servers will automatically stop after the configured idle timeout (default: 10 minutes).
    The race condition that previously caused player disconnections has been fixed.
    See [mc-router #507](https://github.com/itzg/mc-router/issues/507) for details.

### Multiple Hostnames

To allow connections from multiple networks (LAN + VPN), configure multiple IPs:

```bash
# ~/minecraft-servers/.env
HOST_IPS=192.168.1.100,100.64.0.5
```

This creates hostnames for each IP:
- `myserver.192.168.1.100.nip.io` (LAN)
- `myserver.100.64.0.5.nip.io` (VPN)

!!! tip "HOST_IP vs HOST_IPS"
    - `HOST_IP`: Single IP address (default)
    - `HOST_IPS`: Comma-separated multiple IPs (for VPN mesh)

    When `HOST_IPS` is set, it takes precedence over `HOST_IP`.

---

## VPN Mesh Networks

Using a VPN mesh like Tailscale or ZeroTier allows access to your server from anywhere.

### Why Use VPN Mesh?

| Scenario | Solution |
|----------|----------|
| Friends on different networks | VPN mesh creates virtual LAN |
| Access home server remotely | VPN access without port forwarding |
| Connect from multiple locations | Multiple IPs support all networks |

### Tailscale Setup

[Tailscale](https://tailscale.com/) is a free VPN mesh service.

#### 1. Install Tailscale

=== "Ubuntu/Debian"
    ```bash
    curl -fsSL https://tailscale.com/install.sh | sh
    sudo tailscale up
    ```

=== "Arch Linux"
    ```bash
    sudo pacman -S tailscale
    sudo systemctl enable --now tailscaled
    sudo tailscale up
    ```

#### 2. Get Tailscale IP

```bash
tailscale ip -4
# Example: 100.64.0.5
```

#### 3. Configure Multiple IPs in mcctl

```bash
# ~/minecraft-servers/.env
# LAN IP + Tailscale IP
HOST_IPS=192.168.1.100,100.64.0.5
```

#### 4. Recreate Servers or Update Labels

```bash
# New servers automatically get a hostname for each IP
mcctl create myserver

# Existing servers: choose "Host IP(s)", select every address,
# and answer yes to "Update existing servers with new IP hostnames?"
mcctl init --reconfigure

# Make sure mc-router runs
mcctl router start

# Recreate each running server so its container gets the new hostnames
mcctl stop myserver && mcctl start myserver
```

A container keeps the hostnames it was created with; a restart does not apply new ones. `mcctl start <name>` recreates and starts a stopped server; to recreate it and leave it stopped, run `docker compose up --no-start --no-deps mc-<name>` in `~/minecraft-servers`.

#### 5. Client Connection

Have friends install Tailscale and invite them to your network, then:

```
# Add server in Minecraft
myserver.100.64.0.5.nip.io:25565
```

### ZeroTier Setup

[ZeroTier](https://zerotier.com/) is another free VPN mesh service.

#### 1. Install ZeroTier

```bash
curl -s https://install.zerotier.com | sudo bash
```

#### 2. Create and Join Network

1. Create network at [my.zerotier.com](https://my.zerotier.com/)
2. Copy Network ID (e.g., `8056c2e21c000001`)
3. Join the network:
   ```bash
   sudo zerotier-cli join 8056c2e21c000001
   ```

#### 3. Get ZeroTier IP

```bash
sudo zerotier-cli listnetworks
# or
ip addr show zt*
# Example: 10.147.20.1
```

#### 4. Configure Multiple IPs in mcctl

```bash
# ~/minecraft-servers/.env
HOST_IPS=192.168.1.100,10.147.20.1
```

### Using Multiple VPNs Simultaneously

You can use both Tailscale and ZeroTier at the same time:

```bash
# ~/minecraft-servers/.env
# LAN + Tailscale + ZeroTier
HOST_IPS=192.168.1.100,100.64.0.5,10.147.20.1
```

Accessible from all networks:
- `myserver.192.168.1.100.nip.io:25565` (LAN)
- `myserver.100.64.0.5.nip.io:25565` (Tailscale)
- `myserver.10.147.20.1.nip.io:25565` (ZeroTier)

### VPN Mesh Troubleshooting

```bash
# Check Tailscale status
tailscale status

# Check ZeroTier status
sudo zerotier-cli listnetworks

# Verify hostname labels
docker inspect mc-myserver | grep mc-router.host

# Check mc-router logs for hostname
mcctl logs router -n 200 | grep myserver
```

!!! warning "When VPN IP Changes"
    If your VPN IP changes, run `mcctl init --reconfigure`, select the new IPs, accept updating existing servers, then recreate each server as in step 4. If the first address changed, also fix the `<name>.local` lines in `/etc/avahi/hosts`; mcctl does not rewrite them.

### Debug Mode

Add `DEBUG: "true"` to the `environment:` of the `router` service in `~/minecraft-servers/docker-compose.yml`:

```yaml
services:
  router:
    environment:
      DEBUG: "true"
```

Then recreate the router and follow its log:

```bash
mcctl router start
mcctl logs router -f
```

---

## Network Architecture

### Docker Network

All Minecraft containers run on a shared Docker network. `mcctl init` creates it as a bridge network named `minecraft-net` with subnet `172.28.0.0/16`, and the compose file uses it as an external network:

```yaml
# docker-compose.yml
networks:
  minecraft-net:
    external: true
    name: ${MINECRAFT_NETWORK:-minecraft-net}
```

`MINECRAFT_SUBNET` in `.env` is not used.

### Port Mapping

Only mc-router exposes port 25565:

```yaml
services:
  router:
    ports:
      - "25565:25565"            # Public port
      - "127.0.0.1:25580:8080"   # mc-router management API (localhost only)
```

Individual Minecraft servers don't expose ports - they're accessed through mc-router.

### Container Discovery

mc-router uses the Docker socket to discover containers:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

---

## Custom Domain Setup

For production deployments, use your own domain.

### DNS Configuration

Add A records pointing to your server:

```
survival.minecraft.example.com  A  192.168.1.100
creative.minecraft.example.com  A  192.168.1.100
```

### Server Configuration

Add the domain as a custom hostname of the server:

- Web console: server detail > **Options** > **Hostnames / Domains** > **Custom Domains**, then **Save**
- Or add it under `routing.customHostnames` in `servers/survival/server.yaml` and run `mcctl migrate spec survival`

mcctl keeps `survival.local` and the nip.io hostnames in the `mc-router.host` label next to your domain. Then recreate the container, since a restart does not apply hostnames: `mcctl stop survival && mcctl start survival` when it runs, `mcctl start survival` when it is stopped.

### HTTPS/TLS

Minecraft uses its own protocol, not HTTPS. TLS is not needed for the game connection.

---

## Firewall Configuration

### Required Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 25565 | TCP | Minecraft client connections |
| 5353 | UDP | mDNS (local network only) |

### UFW (Ubuntu)

```bash
sudo ufw allow 25565/tcp comment "Minecraft"
sudo ufw allow 5353/udp comment "mDNS"
```

### firewalld (CentOS/RHEL)

```bash
sudo firewall-cmd --permanent --add-port=25565/tcp
sudo firewall-cmd --permanent --add-service=mdns
sudo firewall-cmd --reload
```

---

## Troubleshooting

### Connection Refused

1. Check mc-router is running:
   ```bash
   mcctl status router
   mcctl router start   # if it is not running
   ```

2. Check hostname is configured:
   ```bash
   mcctl status myserver --detail
   ```

3. Test DNS resolution:
   ```bash
   nslookup myserver.192.168.1.100.nip.io
   ```

### Server Not Starting

1. Check `DOCKER_TIMEOUT` of the `router` service in `docker-compose.yml`, then recreate the router with `mcctl router start`:
   ```yaml
   # ~/minecraft-servers/docker-compose.yml (router environment)
   DOCKER_TIMEOUT: "180s"   # Increase if server takes long to start
   ```

2. Check server logs:
   ```bash
   mcctl logs myserver
   ```

### mDNS Not Working

1. Verify avahi is running on server
2. Check client has mDNS support
3. Ensure same network subnet
4. Check firewall allows port 5353/udp

## See Also

- **[Quick Start](../getting-started/quickstart.md)** - Basic server setup
- **[Environment Variables](../configuration/environment.md)** - All configuration options
- **[mc-router Documentation](https://github.com/itzg/mc-router)** - Full mc-router reference
