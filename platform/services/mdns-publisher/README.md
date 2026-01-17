# mDNS Publisher

Automatically broadcasts mDNS (Bonjour/Zeroconf) A records for Minecraft servers, enabling clients to connect without manual hosts file configuration.

## How It Works

1. **Docker Event Monitoring**: Watches for container start/die events via Docker socket
2. **Label Detection**: Reads `mc-router.host` labels from containers
3. **mDNS Broadcasting**: Registers/unregisters A records using the zeroconf library
4. **Automatic Discovery**: Clients on the same LAN can resolve `.local` hostnames automatically

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     mdns-publisher                           │
│                    (host network mode)                       │
├─────────────────────────────────────────────────────────────┤
│  Docker SDK          │           Zeroconf                    │
│  - Monitor events    │           - Register A records        │
│  - Read labels       │           - Broadcast on mDNS         │
│  - container start   │           - Unregister on stop        │
│  - container die     │                                       │
└─────────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
    Docker Socket                   LAN (multicast)
    /var/run/docker.sock            224.0.0.251:5353
```

## Usage

### Starting the Service

```bash
# Build and start
docker compose up -d mdns-publisher

# Check logs
docker logs -f mdns-publisher

# Check health
curl http://localhost:5353/health
```

### Minecraft Server Labels

Servers must have the `mc-router.host` label to be discovered:

```yaml
# servers/ironwood/docker-compose.yml
services:
  mc-ironwood:
    labels:
      - "mc-router.host=ironwood.local"
```

### Client Connection

With mDNS publisher running, clients can connect directly:

```
Server Address: ironwood.local:25565
```

No hosts file modification needed!

## Client Requirements

| OS | mDNS Support | Notes |
|----|--------------|-------|
| Linux | avahi-daemon | Usually pre-installed on Ubuntu/Debian |
| macOS | Built-in Bonjour | No setup needed |
| Windows | Bonjour Print Services | Install from Apple or with iTunes |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |
| `HEALTH_PORT` | `5353` | Port for health check endpoint |

## Health Check

The service exposes a health endpoint:

```bash
# Check health
curl http://localhost:5353/health

# Response
{
  "status": "healthy",
  "registered_hostnames": ["ironwood.local"],
  "count": 1
}
```

## Troubleshooting

### Check if mDNS is Working

```bash
# Linux (requires avahi-utils)
avahi-browse -art | grep minecraft

# macOS
dns-sd -B _minecraft._tcp

# Test hostname resolution
ping ironwood.local
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Hostname not resolving | Check if avahi-daemon is running (Linux) |
| Service not starting | Verify Docker socket permissions |
| No mDNS broadcast | Ensure host network mode is enabled |

### Debug Mode

```bash
# Start with debug logging
docker compose up -d mdns-publisher
docker exec mdns-publisher sh -c "LOG_LEVEL=DEBUG python mdns_publisher.py"
```

## Development

### Local Testing

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally (requires Docker socket access)
python mdns_publisher.py
```

### Building

```bash
# Build image
docker build -t mdns-publisher .

# Run container
docker run --rm --network host \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  mdns-publisher
```
