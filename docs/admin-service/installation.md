# Installation Guide

This guide covers installing and configuring the Admin Service for Docker Minecraft servers.

## Prerequisites

Before installing Admin Service, ensure you have:

- [x] **mcctl installed and initialized**
  ```bash
  npm install -g @minecraft-docker/mcctl
  mcctl init
  ```

- [x] **Docker running**
  ```bash
  docker --version
  docker compose version
  ```

- [x] **At least one Minecraft server created**
  ```bash
  mcctl status
  ```

- [x] **Ports available**
  - Port 3000 for web console
  - Port 3001 for API (internal)

## Installation Methods

### Method 1: CLI Installation (Recommended)

The simplest way to install Admin Service is using the mcctl CLI.

#### Step 1: Initialize Admin Service

```bash
mcctl admin init
```

This interactive command will prompt you for:

1. **Admin username** (default: `admin`)
2. **Admin password** - Must contain:
   - At least 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
3. **API access mode** - Choose based on your security needs
4. **Additional configuration** based on selected mode

Example session:

```
$ mcctl admin init

Initialize Admin Service

? Admin username? admin
? Admin password? ********
? Confirm password? ********
? API access mode? internal - Docker network only (default, most secure)

Creating admin user...  done
Saving configuration...  done

Admin Service initialized!

  Configuration:
    Config file: /home/user/minecraft-servers/admin.yaml
    Users file:  /home/user/minecraft-servers/users.yaml
    Access mode: internal

  Endpoints:
    Console: http://localhost:3000
    API:     http://localhost:3001

  Next steps:
    1. Start the admin service: mcctl admin service start
    2. Access the console in your browser
```

#### Step 2: Start Services

```bash
mcctl admin service start
```

Wait for services to start and become healthy:

```
Starting admin services...
[+] Running 2/2
 ✔ Container mcctl-api      Healthy
 ✔ Container mcctl-console  Started

Admin services started successfully

  Admin Service Status

  mcctl-api
    Status: running
    Port: 3001
    Health: healthy
    Uptime: 5s

  mcctl-console
    Status: running
    Port: 3000
    URL: http://localhost:3000
    Health: healthy
    Uptime: 3s

  All services healthy
```

### Method 2: Docker Compose (Manual)

For advanced users who prefer manual Docker configuration.

#### Step 1: Ensure docker-compose.admin.yml Exists

The file should be at `~/minecraft-servers/docker-compose.admin.yml`. If not, copy from templates:

```bash
cp templates/docker-compose.admin.yml ~/minecraft-servers/
```

#### Step 2: Configure Environment

Create or edit `~/minecraft-servers/.env`:

```bash
# Admin Service Configuration
MCCTL_ROOT=~/minecraft-servers
MCCTL_JWT_SECRET=your-secure-jwt-secret-here
MCCTL_JWT_EXPIRY=24h
NEXTAUTH_SECRET=your-secure-nextauth-secret-here
NEXTAUTH_URL=http://localhost:3000

# API Configuration
API_ACCESS_MODE=internal
API_KEY=

# Optional: Custom ports
# MCCTL_API_PORT=3001
# MCCTL_CONSOLE_PORT=3000
```

#### Step 3: Create Admin User

```bash
mcctl admin user add admin --role admin --password "YourSecurePassword123"
```

#### Step 4: Start with Docker Compose

```bash
cd ~/minecraft-servers
docker compose -f docker-compose.admin.yml up -d
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCCTL_ROOT` | Data directory path | `~/minecraft-servers` |
| `MCCTL_JWT_SECRET` | JWT signing secret | `change-me-in-production` |
| `MCCTL_JWT_EXPIRY` | JWT token expiry | `24h` |
| `NEXTAUTH_SECRET` | NextAuth.js secret | `change-me-in-production` |
| `NEXTAUTH_URL` | Console URL | `http://localhost:3000` |
| `API_ACCESS_MODE` | API authentication mode | `internal` |
| `API_KEY` | API key (if using api-key mode) | - |
| `LOG_LEVEL` | Logging level | `info` |
| `MCCTL_API_PORT` | API server port | `3001` |
| `MCCTL_CONSOLE_PORT` | Console port | `3000` |

### Access Modes

#### internal (Recommended for Production)

Only allows access from within the Docker network. The API is not exposed to the host.

```bash
mcctl admin api mode internal
```

#### api-key

Requires `X-API-Key` header for all API requests.

```bash
mcctl admin api mode api-key
```

After setting this mode, your API key will be displayed. Save it securely.

To regenerate the API key:

```bash
mcctl admin api key regenerate
```

#### ip-whitelist

Only allows access from specified IP addresses or CIDR ranges.

```bash
mcctl admin api mode ip-whitelist
mcctl admin api whitelist add 192.168.1.100
mcctl admin api whitelist add 10.0.0.0/8
```

#### api-key-ip (Highest Security)

Requires both a valid API key AND the client IP must be in the whitelist.

```bash
mcctl admin api mode api-key-ip
mcctl admin api whitelist add 192.168.1.0/24
```

#### open (Development Only)

!!! danger "Security Risk"
    This mode disables all authentication. Never use in production!

```bash
mcctl admin api mode open --force
```

### User Management

#### Add Users

```bash
# Interactive mode
mcctl admin user add

# CLI mode
mcctl admin user add operator1 --role viewer --password "SecurePass123"
```

#### List Users

```bash
mcctl admin user list
```

Output:

```
Users:

Username            Role        Created
--------------------------------------------------
admin               admin       2025-01-15
operator1           viewer      2025-01-16

Total: 2 user(s)
```

#### Update User Role

```bash
mcctl admin user update operator1 --role admin
```

#### Reset Password

```bash
# Interactive
mcctl admin user reset-password operator1

# CLI
mcctl admin user reset-password operator1 --password "NewSecurePass456"
```

#### Remove User

```bash
mcctl admin user remove operator1
```

!!! note "Last Admin Protection"
    You cannot delete the last admin user. This prevents accidental lockout.

## Verification

### Check Service Status

```bash
mcctl admin service status
```

### Verify API Health

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{"status":"healthy"}
```

### Access Web Console

1. Open browser to `http://localhost:3000`
2. Log in with admin credentials
3. Verify server list is displayed

## Troubleshooting

### Services Won't Start

1. **Check Docker is running:**
   ```bash
   docker ps
   ```

2. **Check for port conflicts:**
   ```bash
   netstat -tlnp | grep -E "3000|3001"
   ```

3. **View service logs:**
   ```bash
   mcctl admin service logs -f
   ```

### Can't Log In

1. **Verify user exists:**
   ```bash
   mcctl admin user list
   ```

2. **Reset password:**
   ```bash
   mcctl admin user reset-password admin
   ```

3. **Check NextAuth configuration:**
   Ensure `NEXTAUTH_SECRET` is set in `.env`

### API Returns 401 Unauthorized

1. **Check access mode:**
   ```bash
   mcctl admin api status
   ```

2. **Verify API key (if using api-key mode):**
   - Ensure `X-API-Key` header is included in requests
   - Regenerate key if needed: `mcctl admin api key regenerate`

3. **Check IP whitelist (if using ip-whitelist mode):**
   ```bash
   mcctl admin api whitelist list
   ```

### Container Health Check Fails

1. **View container logs:**
   ```bash
   docker logs mcctl-api
   docker logs mcctl-console
   ```

2. **Restart services:**
   ```bash
   mcctl admin service restart
   ```

## Upgrading

### Update to Latest Version

```bash
# Stop services
mcctl admin service stop

# Pull latest images
docker pull minecraft-docker/mcctl-api:latest
docker pull minecraft-docker/mcctl-console:latest

# Start services
mcctl admin service start
```

### Rebuild from Source

```bash
# Stop services
mcctl admin service stop

# Navigate to project root
cd ~/minecraft

# Build new images
pnpm build
docker compose -f platform/docker-compose.admin.yml build

# Start services
mcctl admin service start
```

## Uninstallation

To completely remove Admin Service:

```bash
# Stop and remove containers
mcctl admin service stop
docker compose -f ~/minecraft-servers/docker-compose.admin.yml down -v

# Remove configuration files (optional)
rm ~/minecraft-servers/admin.yaml
rm ~/minecraft-servers/users.yaml
rm ~/minecraft-servers/api-config.json
```

!!! warning "Data Preservation"
    Removing Admin Service does not affect your Minecraft servers or world data.
