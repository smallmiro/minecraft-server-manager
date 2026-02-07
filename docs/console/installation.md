# Installation Guide

This guide covers installing and configuring the Management Console for Docker Minecraft servers.

## Prerequisites

Before installing Management Console, ensure you have:

- [x] **Node.js 18 or higher**
  ```bash
  node --version  # Should be v18.0.0 or higher
  ```

- [x] **PM2 installed globally**
  ```bash
  npm install -g pm2
  pm2 --version
  ```

- [x] **mcctl installed and initialized**
  ```bash
  npm install -g @minecraft-docker/mcctl
  mcctl init
  ```

- [x] **At least one Minecraft server created**
  ```bash
  mcctl status
  ```

- [x] **Ports available**
  - Port 5000 for web console
  - Port 5001 for API

## Installation Methods

### Method 1: CLI Installation (Recommended)

The simplest way to install Management Console is using the mcctl CLI.

#### Step 1: Initialize Management Console

```bash
mcctl console init
```

This interactive command will prompt you for:

1. **Admin username** (default: `admin`)
2. **Admin password** - Must contain:
   - At least 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
3. **Confirm password** - Must match
4. **API access mode** - Choose based on your security needs
5. **Custom ports** (optional) - Configure API and console ports
6. **Additional configuration** based on selected mode

Example session:

```
$ mcctl console init

Initialize Console Service

  Node.js: v20.10.0
  PM2: 5.3.0

? Admin username? admin
? Admin password? ********
? Confirm password? ********
? API access mode? internal - Local network only (default, most secure)
? Configure custom ports? No

Creating admin user...  done
Generating PM2 ecosystem config...  done
Saving configuration...  done

Console Service initialized!

  Configuration:
    Config file: /home/user/minecraft-servers/.mcctl-admin.yml
    Users file:  /home/user/minecraft-servers/users.yaml
    PM2 config:  /home/user/minecraft-servers/platform/ecosystem.config.cjs
    Access mode: internal

  Endpoints:
    Console: http://localhost:5000
    API:     http://localhost:5001

  Next steps:
    1. Start the console service: mcctl console service start
    2. Access the console in your browser
```

#### Step 2: Start Services

```bash
mcctl console service start
```

Wait for services to start:

```
Starting console services via PM2...
  Started mcctl-api
  Started mcctl-console
Console services started successfully

  Console Service Status (PM2)

  mcctl-api
    Status: online
    PID: 12345
    CPU: 0%
    Memory: 50.2 MB
    Uptime: 5s
    Restarts: 0

  mcctl-console
    Status: online
    PID: 12346
    URL: http://localhost:5000
    CPU: 0%
    Memory: 80.5 MB
    Uptime: 3s
    Restarts: 0

  All services healthy
```

### Method 2: Custom Port Configuration

For environments with port conflicts, specify custom ports during initialization:

```bash
mcctl console init --api-port 8001 --console-port 8000
```

Or configure interactively:

```bash
mcctl console init

# When prompted "Configure custom ports?" select Yes
# Then enter your desired API and console ports
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCCTL_ROOT` | Data directory path | `~/minecraft-servers` |
| `PORT` | API server port | `5001` |
| `HOSTNAME` | Console server hostname | `0.0.0.0` |
| `MCCTL_API_URL` | Internal API URL | `http://localhost:5001` |
| `NODE_ENV` | Environment mode | `production` |

### PM2 Ecosystem Configuration

The `mcctl console init` command generates `ecosystem.config.cjs` in your platform directory:

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'mcctl-api',
      script: 'node_modules/@minecraft-docker/mcctl-api/dist/index.js',
      cwd: process.env.MCCTL_ROOT || '.',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
        HOST: '0.0.0.0',
        MCCTL_ROOT: process.env.MCCTL_ROOT || '.',
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '500M',
    },
    {
      name: 'mcctl-console',
      script: 'node_modules/@minecraft-docker/mcctl-console/.next/standalone/...',
      // ... console configuration
    },
  ],
};
```

### Access Modes

#### internal (Recommended for Production)

Only allows access from the local network. The most secure option for home/local deployments.

```bash
mcctl console init
# Select "internal" when prompted for API access mode
```

#### api-key

Requires `X-API-Key` header for all API requests.

```bash
mcctl console init
# Select "api-key" when prompted
# An API key will be generated and displayed
```

After initialization, your API key will be displayed. Save it securely.

To regenerate the API key:

```bash
mcctl console api key regenerate
```

#### ip-whitelist

Only allows access from specified IP addresses or CIDR ranges.

```bash
mcctl console init
# Select "ip-whitelist" when prompted
# Enter allowed IPs when prompted (comma-separated)
```

After initialization, manage the whitelist:

```bash
mcctl console api whitelist add 192.168.1.100
mcctl console api whitelist add 10.0.0.0/8
mcctl console api whitelist list
```

#### api-key-ip (Highest Security)

Requires both a valid API key AND the client IP must be in the whitelist.

```bash
mcctl console init
# Select "api-key-ip" when prompted
```

#### open (Development Only)

!!! danger "Security Risk"
    This mode disables all authentication. Never use in production!

```bash
mcctl console api mode open --force
```

### User Management

#### Add Users

```bash
# Interactive mode
mcctl console user add

# CLI mode
mcctl console user add operator1 --role viewer --password "SecurePass123"
```

#### List Users

```bash
mcctl console user list
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
mcctl console user update operator1 --role admin
```

#### Reset Password

```bash
# Interactive
mcctl console user reset-password operator1

# CLI
mcctl console user reset-password operator1 --password "NewSecurePass456"
```

#### Remove User

```bash
mcctl console user remove operator1
```

!!! note "Last Admin Protection"
    You cannot delete the last admin user. This prevents accidental lockout.

## Verification

### Check Service Status

```bash
mcctl console service status
```

### Verify API Health

```bash
curl http://localhost:5001/health
```

Expected response:

```json
{"status":"healthy"}
```

### Access Web Console

1. Open browser to `http://localhost:5000`
2. Log in with admin credentials
3. Verify server list is displayed

## Troubleshooting

### Services Won't Start

1. **Check Node.js version:**
   ```bash
   node --version  # Must be v18.0.0 or higher
   ```

2. **Check PM2 is installed:**
   ```bash
   pm2 --version
   ```

3. **Check for port conflicts:**
   ```bash
   netstat -tlnp | grep -E "5000|5001"
   # or on macOS
   lsof -i :5000
   lsof -i :5001
   ```

4. **View service logs:**
   ```bash
   mcctl console service logs -f
   ```

5. **Check PM2 process list:**
   ```bash
   pm2 list
   pm2 logs mcctl-api
   pm2 logs mcctl-console
   ```

### Can't Log In

1. **Verify user exists:**
   ```bash
   mcctl console user list
   ```

2. **Reset password:**
   ```bash
   mcctl console user reset-password admin
   ```

3. **Check configuration file:**
   ```bash
   cat ~/.mcctl-admin.yml
   ```

### API Returns 401 Unauthorized

1. **Check access mode:**
   ```bash
   mcctl console api status
   ```

2. **Verify API key (if using api-key mode):**
   - Ensure `X-API-Key` header is included in requests
   - Regenerate key if needed: `mcctl console api key regenerate`

3. **Check IP whitelist (if using ip-whitelist mode):**
   ```bash
   mcctl console api whitelist list
   ```

### PM2 Process Keeps Restarting

1. **Check logs for errors:**
   ```bash
   pm2 logs mcctl-api --lines 100
   pm2 logs mcctl-console --lines 100
   ```

2. **Check if dependencies are installed:**
   ```bash
   cd ~/minecraft-servers
   npm ls @minecraft-docker/mcctl-api
   npm ls @minecraft-docker/mcctl-console
   ```

3. **Restart services:**
   ```bash
   mcctl console service restart
   ```

## Auto-Start on Boot

Configure PM2 to start services automatically on system boot:

```bash
# Generate startup script
pm2 startup

# Follow the instructions to run the displayed command
# For example:
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# Save current process list
pm2 save
```

Now your services will automatically start when the system boots.

## Upgrading

### Update mcctl and Services

```bash
# Stop services
mcctl console service stop

# Update mcctl globally
npm update -g @minecraft-docker/mcctl

# Start services
mcctl console service start
```

### Reinitialize After Major Update

If there are breaking changes, reinitialize the console:

```bash
# Stop services
mcctl console service stop

# Reinitialize (keeps user data)
mcctl console init --force

# Start services
mcctl console service start
```

## Uninstallation

To completely remove Management Console:

```bash
# Remove console service (interactive)
mcctl console remove

# Or force remove without confirmation
mcctl console remove --force

# Keep configuration files for later reinstall
mcctl console remove --keep-config
```

This will:

- Stop and remove PM2 processes (mcctl-api, mcctl-console)
- Delete configuration files (.mcctl-admin.yml, users.yaml)
- Delete PM2 ecosystem config (ecosystem.config.cjs)

!!! warning "Data Preservation"
    Removing Management Console does not affect your Minecraft servers or world data.

### Clean Up PM2 (Optional)

If you want to completely remove PM2 configuration:

```bash
# Remove saved process list
pm2 unstartup

# Kill PM2 daemon
pm2 kill
```
