# Networking Guide

Configure hostname-based routing for your Minecraft servers using nip.io, mDNS, and mc-router.

## Overview

The platform supports three connection methods:

| Method | URL Example | Client Setup | Works Remotely |
|--------|-------------|--------------|----------------|
| **nip.io** (Recommended) | `myserver.192.168.1.100.nip.io:25565` | None | Yes |
| **mDNS** | `myserver.local:25565` | avahi/Bonjour | LAN only |
| **Direct IP** | `192.168.1.100:25565` | None | Yes |

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

When you create a server, mcctl automatically configures both nip.io and mDNS hostnames:

```bash
mcctl create myserver
# Hostnames:
#   - myserver.192.168.1.100.nip.io:25565 (nip.io)
#   - myserver.local:25565 (mDNS)
```

### Benefits

- **No client configuration** - Works immediately
- **Works remotely** - Accessible from any network with internet
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

mcctl automatically registers hostnames when creating servers:

```bash
mcctl create myserver
# Registers myserver.local with avahi-daemon
```

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

### Router Management with mcctl

```bash
# Check router status
mcctl status router

# Start router
mcctl router start

# Restart router (after config changes)
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

Configure in `~/minecraft-servers/.env`:

```bash
# Auto-scaling configuration
AUTO_SCALE_UP=true       # Start servers on connect
AUTO_SCALE_DOWN=false    # Stop idle servers (see note)
DOCKER_TIMEOUT=120       # Wait time for server startup (seconds)
```

Then restart the router:

```bash
mcctl router restart
```

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
# New servers automatically get multiple hostnames
mcctl create myserver

# For existing servers, run migration script
cd ~/minecraft-servers
./scripts/migrate-nip-io.sh
```

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
docker logs router 2>&1 | grep myserver
```

!!! warning "When VPN IP Changes"
    If your VPN IP changes, update `.env` and run `./scripts/migrate-nip-io.sh` again.

### Debug Mode

Enable mc-router debug output in `.env`:

```bash
# ~/minecraft-servers/.env
DEBUG=true
```

Then restart:

```bash
mcctl router restart
```

---

## Network Architecture

### Docker Network

All Minecraft containers run on a shared Docker network:

```yaml
# docker-compose.yml
networks:
  minecraft-net:
    name: ${MINECRAFT_NETWORK:-minecraft-net}
    driver: bridge
    ipam:
      config:
        - subnet: ${MINECRAFT_SUBNET:-172.28.0.0/16}
```

### Port Mapping

Only mc-router exposes port 25565:

```yaml
services:
  router:
    ports:
      - "25565:25565"  # Public port
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

Update the mc-router.host label:

```yaml
labels:
  mc-router.host: "survival.minecraft.example.com"
```

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

1. Check Docker timeout in `.env`:
   ```bash
   # ~/minecraft-servers/.env
   DOCKER_TIMEOUT=180  # Increase if server takes long to start
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
