# External Access with playit.gg

Allow external players to join your Minecraft servers without port forwarding, firewall changes, or a static IP address using [playit.gg](https://playit.gg) tunneling.

## Overview

By default, servers created with mcctl are accessible only on your local network (via nip.io or mDNS). **playit.gg** provides a free tunneling service that gives your server a public domain name, allowing anyone on the internet to connect.

### How It Works

```
External Players (Internet)
        |
  playit.gg cloud
  (TCP tunnel relay)
        |
  playit-agent container
  (network_mode: host)
        |
  forwards to localhost:25565
        |
  mc-router (:25565)
  reads hostname from Minecraft handshake
        |
   +----+----+
   |         |
 mc-aa    mc-bb
```

1. External players connect to your playit.gg domain (e.g., `xx-xx.craft.playit.gg`)
2. playit.gg cloud relays the TCP connection to the playit-agent running on your host
3. playit-agent forwards traffic to `localhost:25565` where mc-router listens
4. mc-router reads the hostname from the Minecraft handshake packet and routes to the correct server

### What playit.gg Provides

| Feature | Free Tier | Premium |
|---------|-----------|---------|
| TCP tunnels | Unlimited | Unlimited |
| Domain | `xx-xx.craft.playit.gg` | Custom domain support |
| Bandwidth | Unlimited | Unlimited |
| Players | No limit | No limit |
| Regions | Auto-selected | Selectable |

!!! note "playit.gg vs Other Tunneling Solutions"
    playit.gg is specifically designed for game server tunneling and supports raw TCP passthrough, which is required for Minecraft's protocol. Generic HTTP tunnels (ngrok, Cloudflare Tunnels) do not work with Minecraft.

## Prerequisites

Before setting up external access, ensure you have:

- [x] mcctl installed and platform initialized (`mcctl init`)
- [x] At least one Minecraft server created (`mcctl create`)
- [x] Docker running
- [x] A [playit.gg account](https://playit.gg) (free)

## Quick Start

Set up external access in 6 steps:

```bash
# 1. Create a playit.gg agent and get your SECRET_KEY
#    Visit: https://playit.gg/account/agents/new-docker

# 2. Configure playit.gg in your platform
mcctl playit setup
# Enter your SECRET_KEY when prompted

# 3. Start the playit-agent
mcctl playit start

# 4. Create a Minecraft Java tunnel in the playit.gg dashboard
#    Visit: https://playit.gg/account/tunnels
#    - Click "Add Tunnel"
#    - Select "Minecraft Java"
#    - Local Address: localhost:25565
#    - Save and note the assigned domain (e.g., xx-xx.craft.playit.gg)

# 5. Register the playit domain with your server
mcctl create myserver -t PAPER -v 1.21.1 --playit-domain xx-xx.craft.playit.gg
# Or for an existing server, edit the docker-compose.yml labels

# 6. Share your domain with friends!
#    They connect to: xx-xx.craft.playit.gg
```

## Step-by-Step Setup Guide

### Step 1: Create a playit.gg Agent

1. Go to [playit.gg](https://playit.gg) and sign up for a free account
2. Navigate to **Account** > **Agents** > **[New Docker Agent](https://playit.gg/account/agents/new-docker)**
3. Name your agent (e.g., "minecraft-host")
4. Copy the **SECRET_KEY** displayed on the page

!!! warning "Keep Your SECRET_KEY Safe"
    The SECRET_KEY is shown only once. Save it in a secure location. If lost, you must create a new agent.

### Step 2: Configure playit.gg in mcctl

You can configure playit.gg during initial platform setup or afterwards.

=== "During mcctl init"
    ```bash
    # With the --playit-key flag
    mcctl init --playit-key YOUR_SECRET_KEY

    # Or interactively (you will be prompted)
    mcctl init
    # When asked "Enable playit.gg tunneling?", select Yes
    # Enter your SECRET_KEY when prompted
    ```

=== "After Platform Setup"
    ```bash
    # Run the playit setup command
    mcctl playit setup
    # Enter your SECRET_KEY when prompted
    ```

=== "Skip playit.gg"
    ```bash
    # Explicitly disable during init
    mcctl init --no-playit
    ```

This saves the `PLAYIT_SECRET_KEY` to your `.env` file and enables the playit profile.

### Step 3: Start the playit-agent

```bash
mcctl playit start
```

Verify the agent is running:

```bash
mcctl playit status
```

Expected output:

```
=== playit.gg Agent Status ===

  Agent:      running
  SECRET_KEY: configured

REGISTERED SERVERS

  No servers with playit.gg domains configured

  Dashboard: https://playit.gg/account/tunnels
```

### Step 4: Create a Minecraft Java Tunnel

1. Go to [playit.gg Dashboard](https://playit.gg/account/tunnels)
2. Click **Add Tunnel**
3. Select **Minecraft Java** as the tunnel type
4. Set **Local Address** to `localhost:25565`
5. Click **Create**
6. Note the assigned domain (e.g., `xx-xx.craft.playit.gg`)

!!! tip "One Tunnel for All Servers"
    You only need **one** playit.gg tunnel pointing to `localhost:25565`. mc-router handles routing to the correct server based on the hostname in the Minecraft handshake.

    However, for multiple servers to be independently accessible from external players, each server needs its own playit.gg tunnel and domain.

### Step 5: Register the Domain with Your Server

=== "New Server"
    ```bash
    # Create a server with playit domain
    mcctl create myserver -t PAPER -v 1.21.1 --playit-domain xx-xx.craft.playit.gg
    ```

=== "Existing Server"
    Add the playit domain to the mc-router.host label in your server's `docker-compose.yml`:

    ```yaml
    # ~/minecraft-servers/servers/myserver/docker-compose.yml
    services:
      mc-myserver:
        labels:
          mc-router.host: "myserver.192.168.1.100.nip.io,xx-xx.craft.playit.gg"
    ```

    Then restart the server:

    ```bash
    mcctl stop myserver && mcctl start myserver
    ```

### Step 6: Connect and Share

External players can now connect to your server using the playit.gg domain:

```
Server Address: xx-xx.craft.playit.gg
```

No port number is needed since playit.gg maps to the standard Minecraft port (25565).

LAN players can still use the original addresses:

```
LAN: myserver.192.168.1.100.nip.io:25565
External: xx-xx.craft.playit.gg
```

## Custom Domain Setup (Premium)

With a playit.gg premium plan or a domain you own, you can configure a custom domain for your server.

### DNS Configuration

You have two options for DNS records:

=== "A/CNAME Record"
    Point your domain directly to the playit.gg tunnel:

    ```
    # A record (if playit provides an IP)
    minecraft.example.com    A      <playit-tunnel-ip>

    # CNAME record (if playit provides a domain)
    minecraft.example.com    CNAME  xx-xx.craft.playit.gg
    ```

    Players connect with: `minecraft.example.com`

=== "SRV Record"
    Use an SRV record to specify a non-standard port or add a subdomain:

    ```
    _minecraft._tcp.mc.example.com    SRV    0 5 <port> xx-xx.craft.playit.gg
    ```

    Players connect with: `mc.example.com`

    !!! info "SRV Record Fields"
        | Field | Value | Description |
        |-------|-------|-------------|
        | Service | `_minecraft` | Service identifier |
        | Protocol | `_tcp` | Minecraft uses TCP |
        | Priority | `0` | Lowest priority wins |
        | Weight | `5` | Load balancing weight |
        | Port | `<port>` | The port assigned by playit.gg |
        | Target | `xx-xx.craft.playit.gg` | playit.gg tunnel domain |

### A/CNAME vs SRV Comparison

| Feature | A/CNAME | SRV |
|---------|---------|-----|
| Setup complexity | Simple | Moderate |
| Custom port | No (must be 25565) | Yes |
| Subdomain support | Direct | Via service record |
| Client compatibility | All clients | Most clients (some older launchers may not support SRV) |
| TTL propagation | Fast | May take longer |

### Update mc-router Label

After configuring your custom domain, update the server's mc-router.host label:

```yaml
labels:
  mc-router.host: "myserver.192.168.1.100.nip.io,minecraft.example.com"
```

## Managing playit-agent

### CLI Commands

| Command | Description |
|---------|-------------|
| `mcctl playit start` | Start the playit-agent container |
| `mcctl playit stop` | Stop the playit-agent container |
| `mcctl playit status` | Show agent status and registered servers |
| `mcctl playit setup` | Configure or reconfigure SECRET_KEY |

### Checking Status

```bash
mcctl playit status
```

Output with registered servers:

```
=== playit.gg Agent Status ===

  Agent:      running
  SECRET_KEY: configured
  Uptime:     2d 5h 30m

REGISTERED SERVERS

  SERVER              EXTERNAL DOMAIN
  ------              ---------------
  myserver            xx-xx.craft.playit.gg
  creative            yy-yy.craft.playit.gg

  Dashboard: https://playit.gg/account/tunnels
```

### JSON Output

For scripting and automation:

```bash
mcctl playit status --json
```

```json
{
  "agentStatus": "running",
  "agentRunning": true,
  "secretKeyConfigured": true,
  "enabled": true,
  "uptime": "2d 5h 30m",
  "servers": [
    {
      "serverName": "myserver",
      "playitDomain": "xx-xx.craft.playit.gg"
    }
  ]
}
```

## Web Console Management

If you have the Management Console set up, you can monitor and control playit.gg from the web interface.

### Dashboard

The main dashboard shows playit.gg status alongside other platform information. The **PlayitSummaryCard** displays:

- Agent running/stopped status
- Number of servers with playit.gg domains
- Quick link to the playit.gg dashboard

### Server Detail Page

Each server's detail page includes a **ConnectionInfoCard** that shows:

- LAN connection address (nip.io/mDNS)
- External connection address (playit.gg domain, if configured)
- Connection status indicators

### Routing Page

The routing page shows the **PlayitSection** with:

- Agent status and uptime
- All registered servers and their external domains
- Start/stop controls for the playit-agent

### API Endpoints

The Management Console API provides these playit.gg endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/playit/status` | Get agent status and server domains |
| `POST` | `/api/playit/start` | Start the playit-agent |
| `POST` | `/api/playit/stop` | Stop the playit-agent |

## Troubleshooting

### Agent Won't Start

1. **Check SECRET_KEY is configured:**
   ```bash
   mcctl playit status
   # SECRET_KEY should show "configured"
   ```

2. **Verify Docker is running:**
   ```bash
   docker ps
   ```

3. **Check agent logs:**
   ```bash
   docker logs playit-agent
   ```

4. **Reconfigure if needed:**
   ```bash
   mcctl playit setup
   ```

### External Players Can't Connect

1. **Verify the agent is running:**
   ```bash
   mcctl playit status
   # Agent should show "running"
   ```

2. **Check the tunnel exists in the playit.gg dashboard:**
   - Visit [https://playit.gg/account/tunnels](https://playit.gg/account/tunnels)
   - Ensure a Minecraft Java tunnel exists with `localhost:25565`

3. **Verify mc-router.host label includes the playit domain:**
   ```bash
   docker inspect mc-myserver | grep mc-router.host
   # Should include the playit.gg domain
   ```

4. **Test local connection first:**
   ```bash
   # If LAN connection works but external doesn't, the issue is in the tunnel
   mcctl status myserver
   ```

5. **Check mc-router logs:**
   ```bash
   docker logs router 2>&1 | grep playit
   ```

### Connection Timeout

- The playit.gg agent needs a few seconds to establish the tunnel after starting
- Wait 10-15 seconds after `mcctl playit start` before testing
- Check your internet connection on the host machine

### Domain Not Resolving

- Ensure the tunnel is active in the playit.gg dashboard
- For custom domains, verify DNS records have propagated:
  ```bash
  nslookup minecraft.example.com
  # or
  dig minecraft.example.com
  ```
- DNS propagation can take up to 48 hours for new records

## Security Best Practices

!!! warning "Security Considerations"
    Opening your server to the internet exposes it to potential abuse. Follow these practices to stay safe.

### Enable Whitelist

Restrict who can join your server:

```bash
mcctl whitelist myserver on
mcctl whitelist myserver add TrustedPlayer1
mcctl whitelist myserver add TrustedPlayer2
```

### Keep Online Mode Enabled

Online mode verifies player identities through Mojang servers:

```bash
mcctl config myserver ONLINE_MODE true
```

!!! danger "Never Disable Online Mode on Public Servers"
    Disabling online mode (`ONLINE_MODE=false`) allows anyone to join with any username, including impersonating administrators.

### Change Default RCON Password

```bash
# In ~/minecraft-servers/.env
RCON_PASSWORD=a-very-secure-random-password
```

### Monitor Server Activity

```bash
# Check who is online
mcctl player online myserver

# View server logs for suspicious activity
mcctl logs myserver -f

# Review audit logs
mcctl audit list --recent
```

### Protect Your SECRET_KEY

- Never share your playit.gg SECRET_KEY publicly
- The key is stored in `~/minecraft-servers/.env` which is gitignored by default
- If compromised, revoke the agent in the playit.gg dashboard and create a new one

## Limitations

### Free Tier Limitations

| Limitation | Details |
|------------|---------|
| Domain name | Auto-assigned (e.g., `xx-xx.craft.playit.gg`) |
| Region selection | Automatic (nearest region) |
| Custom domains | Not available |
| Priority routing | Standard |

### Technical Limitations

| Limitation | Details |
|------------|---------|
| Latency | Adds ~10-50ms depending on region and distance |
| Protocol | TCP only (sufficient for Minecraft) |
| Bedrock Edition | Not supported by this setup (Java Edition only) |
| network_mode | playit-agent uses `host` mode (required for localhost forwarding) |

### Comparison with Other Solutions

| Solution | Port Forwarding | Setup Difficulty | Latency | Cost |
|----------|----------------|-----------------|---------|------|
| **playit.gg** | Not needed | Easy | Low-Medium | Free |
| **Tailscale/ZeroTier** | Not needed | Medium | Low | Free (limited) |
| **Port Forwarding** | Required | Medium | None | Free |
| **Cloud Hosting** | Not needed | Complex | Varies | Paid |

!!! tip "When to Use playit.gg vs VPN Mesh"
    - **playit.gg**: Best for public or semi-public servers where you want anyone with the domain to connect
    - **Tailscale/ZeroTier**: Best for private servers with a fixed group of trusted friends (see [Networking Guide](networking.md#vpn-mesh-networks))

## Docker Configuration Reference

The playit-agent is defined in your platform's `docker-compose.yml` with a Docker Compose profile:

```yaml
services:
  playit:
    image: ghcr.io/playit-cloud/playit-agent:0.16
    container_name: playit-agent
    network_mode: host
    environment:
      - SECRET_KEY=${PLAYIT_SECRET_KEY:?PLAYIT_SECRET_KEY must be set in .env}
    restart: unless-stopped
    profiles:
      - playit
```

Key points:

- **`network_mode: host`**: Required so the agent can forward to `localhost:25565` where mc-router listens
- **`profiles: [playit]`**: The agent only starts when explicitly activated (via `mcctl playit start` or `docker compose --profile playit up -d`)
- **`image: ghcr.io/playit-cloud/playit-agent:0.16`**: Pinned to version 0.16 for stability

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PLAYIT_SECRET_KEY` | Yes (if enabled) | Agent authentication key from playit.gg |

## See Also

- **[Networking Guide](networking.md)** - LAN networking with nip.io, mDNS, and VPN mesh
- **[Quick Start](../getting-started/quickstart.md)** - Basic server setup
- **[CLI Commands](../cli/commands.md)** - Full command reference
- **[Management Console](../console/index.md)** - Web-based server management
- **[playit.gg Documentation](https://playit.gg/docs)** - Official playit.gg documentation
