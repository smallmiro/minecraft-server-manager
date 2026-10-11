# Installation Guide

This guide covers installing and configuring the Management Console for Docker Minecraft servers.

## Prerequisites

Before installing Management Console, ensure you have:

- [x] **Node.js 18 or higher**
  ```bash
  node --version  # Should be v18.0.0 or higher
  ```

- [x] **PM2 6 or higher installed globally**
  ```bash
  npm install -g pm2
  pm2 --version  # Should be 6.0.0 or higher
  ```

- [x] **Docker Engine 24+ and Docker Compose 2.20+**
  ```bash
  docker --version
  docker compose version
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

1. **Services to install** - `mcctl-api` is selected by default; also select `mcctl-console` to install the web console
2. **Admin email** - Used to sign in to the web console (e.g., `admin@example.com`)
3. **Admin name** (default: `Administrator`)
4. **Admin password** - Must contain:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
5. **API access mode** - Choose based on your security needs
6. **Additional configuration** based on selected mode

The admin email, name, and password are asked only when `mcctl-console` is selected. Ports are not asked; to change them, see [Method 2](#method-2-custom-port-configuration).

Example session:

```
$ mcctl console init

Initialize Console Service

  Node.js: v20.10.0
  PM2: 6.0.14

? Select services to install: mcctl-api, mcctl-console

  Selected services:
    ✓ mcctl-api
    ✓ mcctl-console

? Admin email? admin@example.com
? Admin name? Administrator
? Admin password? ********
? API access mode? internal - Local network only (default, most secure)

Creating admin user...  done
Generating PM2 ecosystem config...  done
Saving configuration...  done

Console Service initialized!

  Configuration:
    Config file: /home/user/minecraft-servers/.mcctl-admin.yml
    Console DB:  /home/user/minecraft-servers/data/mcctl.db
    PM2 config:  /home/user/minecraft-servers/ecosystem.config.cjs
    Access mode: internal

  Endpoints:
    API:     http://localhost:5001
    Console: http://localhost:5000

  Next steps:
    1. Start the service: mcctl console service start
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

`mcctl console init` never asks for ports interactively; the `--api-port` and `--console-port` flags are the only way to set them. The defaults are `5001` for the API and `5000` for the console.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCCTL_ROOT` | Data directory path | `~/minecraft-servers` |
| `PORT` | API server port | `5001` |
| `HOSTNAME` | Console server hostname | `0.0.0.0` |
| `MCCTL_API_URL` | Internal API URL | `http://localhost:5001` |
| `NODE_ENV` | Environment mode | `production` |
| `LOG_LEVEL` | mcctl-api log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` | `info` when `NODE_ENV=production`, otherwise `debug` |
| `WORLD_UPLOAD_MAX_SIZE` | Max world ZIP size in bytes for `POST /api/worlds/upload` | `1073741824` (1 GB) |

### PM2 Ecosystem Configuration

The `mcctl console init` command generates `ecosystem.config.cjs` in the data directory (`<root>/ecosystem.config.cjs`, where `<root>` is `MCCTL_ROOT`, default `~/minecraft-servers`). The service packages are installed under `<root>/.services/`, and the file points to them with absolute paths. The values below are an example for `<root>` = `/home/user/minecraft-servers`:

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'mcctl-api',
      script: '/home/user/minecraft-servers/.services/node_modules/@minecraft-docker/mcctl-api/dist/index.js',
      cwd: '/home/user/minecraft-servers',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
        HOST: '0.0.0.0',
        MCCTL_ROOT: '/home/user/minecraft-servers',
        AUTH_MODE: 'internal', // see the note below the example
        // AUTH_API_KEY and AUTH_IP_WHITELIST are added for the matching access modes
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '500M',
    },
    {
      name: 'mcctl-console',
      script: '/home/user/minecraft-servers/.services/node_modules/@minecraft-docker/mcctl-console/.next/standalone/platform/services/mcctl-console/server.js',
      cwd: '/home/user/minecraft-servers',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        HOSTNAME: '0.0.0.0',
        MCCTL_API_URL: 'http://localhost:5001',
        MCCTL_ROOT: '/home/user/minecraft-servers',
        BETTER_AUTH_SECRET: '<generated secret>',
        BETTER_AUTH_BASE_URL: 'http://localhost:5000',
        // MCCTL_API_KEY is added for the api-key access modes
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '500M',
    },
  ],
};
```

!!! note "`AUTH_MODE` values"
    `AUTH_MODE` receives the access mode you chose in `mcctl console init`. The values mcctl-api's authentication plugin recognises are `disabled`, `api-key`, `ip-whitelist`, `basic` and `combined`; `internal`, `api-key-ip` and `open`, which `mcctl console init` can write, are not in that list. Tracked in [#633](https://github.com/smallmiro/minecraft-server-manager/issues/633).

Only the services you selected during `mcctl console init` appear in the file. Installations that predate the `.services/` directory keep their packages in `<root>/node_modules/`, and `mcctl console init` still uses that location when the packages are found there.

### Access Modes

`mcctl console init` asks for the access mode during setup. The mode, API key and IP whitelist are written to the `env` block of `ecosystem.config.cjs` (`AUTH_MODE`, `AUTH_API_KEY`, `AUTH_IP_WHITELIST`), which is what the running mcctl-api reads. The `mcctl console api` commands do not change those values yet (see the warning in [CLI Commands](cli-commands.md#mcctl-console-api), tracked in [#633](https://github.com/smallmiro/minecraft-server-manager/issues/633)), so to switch modes, change the key or change the IP whitelist today, reinitialize with `mcctl console init --force`.

#### internal (Recommended for Production)

Internal access only, no external exposure. The most secure option for home/local deployments.

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

To get a new API key, reinitialize with `mcctl console init --force`. `mcctl console api key regenerate` currently does not change the key the running API uses.

#### ip-whitelist

Only allows access from specified IP addresses or CIDR ranges.

```bash
mcctl console init
# Select "ip-whitelist" when prompted
# Enter allowed IPs when prompted (comma-separated)
```

To change the allowed IPs, reinitialize with `mcctl console init --force` and enter the new list. `mcctl console api whitelist` currently does not change the whitelist the running API uses.

#### api-key-ip

Meant to require both a valid API key AND a client IP from the whitelist.

!!! warning "Not recognised by mcctl-api yet"
    mcctl-api does not recognise `api-key-ip`, so selecting it currently applies no IP restriction. Use `ip-whitelist` if you need one. Tracked in [#633](https://github.com/smallmiro/minecraft-server-manager/issues/633).

#### open (Development Only)

!!! danger "Security Risk"
    This mode is meant to disable all authentication. Never use in production!

!!! warning "Not recognised by mcctl-api yet"
    mcctl-api does not recognise `open`, so selecting it does not reliably disable authentication. Tracked in [#633](https://github.com/smallmiro/minecraft-server-manager/issues/633).

### User Management

#### Add Users

```bash
# Interactive mode
mcctl console user add

# CLI mode
mcctl console user add operator@example.com --role user --password "SecurePass123"
```

#### List Users

```bash
mcctl console user list
```

Output:

```
Users:

Email                         Name                Role        Created
---------------------------------------------------------------------------
admin@example.com             Administrator       admin       2025-01-15
operator@example.com          operator            user        2025-01-16

Total: 2 user(s)
```

#### Update User Role

```bash
mcctl console user update operator@example.com --role admin
```

#### Reset Password

```bash
# Interactive
mcctl console user reset-password operator@example.com

# CLI
mcctl console user reset-password operator@example.com --password "NewSecurePass456"
```

#### Remove User

```bash
mcctl console user remove operator@example.com
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
   mcctl console user reset-password admin@example.com
   ```

3. **Check configuration file** (it lives in the data directory, `~/minecraft-servers` by default):
   ```bash
   cat ~/minecraft-servers/.mcctl-admin.yml
   ```

### API Returns 401 Unauthorized

1. **Check access mode** (the running API reads it from `ecosystem.config.cjs`; `mcctl console api status` shows `api-config.json` instead):
   ```bash
   grep AUTH_MODE ~/minecraft-servers/ecosystem.config.cjs
   ```

2. **Verify API key (if using api-key mode):**
   - Ensure `X-API-Key` header is included in requests
   - The key in use is `AUTH_API_KEY` in `ecosystem.config.cjs`. To get a new one, reinitialize with `mcctl console init --force`

3. **Check IP whitelist (if using ip-whitelist mode):**
   ```bash
   grep AUTH_IP_WHITELIST ~/minecraft-servers/ecosystem.config.cjs
   ```

### PM2 Process Keeps Restarting

1. **Check logs for errors:**
   ```bash
   pm2 logs mcctl-api --lines 100
   pm2 logs mcctl-console --lines 100
   ```

2. **Check if the service packages are installed** (they are installed in the `.services/` directory of your data directory):
   ```bash
   cd ~/minecraft-servers/.services
   npm ls @minecraft-docker/mcctl-api @minecraft-docker/mcctl-console
   ```
   Installations without a `.services/` directory keep the packages in `~/minecraft-servers/node_modules`; run `npm ls` in `~/minecraft-servers` instead.

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
mcctl update
```

`mcctl update` updates the mcctl CLI and the services installed in `<root>/.services/` (`mcctl-api`, `mcctl-console` and the `shared` library) in one step. Each updated PM2 service is restarted automatically; if the output shows `Updated (restart manually)` for a service, run `mcctl console service restart`. Installations without a `.services/` directory keep the packages in `<root>/node_modules`, and `mcctl update` updates them there. When at least one service package is installed, the command also aligns the image tags of your Minecraft servers and pulls the Docker images; this is skipped with `--check` and `--cli-only`, and when no service package is installed.

| Option | Description |
|--------|-------------|
| `--check` | Only check for updates, install nothing |
| `--cli-only` | Update only the CLI and leave the services as they are |
| `--yes` | Skip the confirmation prompt |

`npm update -g @minecraft-docker/mcctl` updates only the CLI package and does not touch the services in `.services/`. See the [mcctl update reference](../cli/commands.md#mcctl-update) for all options.

### Reinitialize After Major Update

If there are breaking changes, reinitialize the console:

```bash
# Reinitialize: stops the services and deletes the console settings
mcctl console init --force

# Start services
mcctl console service start
```

`--force` does not preserve your settings. It stops the PM2 services and deletes `.mcctl-admin.yml` and `ecosystem.config.cjs`, so you choose the API access mode again, the ports return to the defaults unless you pass `--api-port` and `--console-port`, and a new API key is generated for the api-key modes. The console database `data/mcctl.db` is kept: other users stay as they are. If you enter the email of an existing admin, that user is deleted (including its sessions) and created again with the password you enter now. If you enter a different email, the existing admin stays and a new admin is added.

## Uninstallation

To remove Management Console:

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
- Delete configuration files (`.mcctl-admin.yml`, and the legacy `users.yaml` if it exists)
- Delete PM2 ecosystem config (`ecosystem.config.cjs`)

!!! warning "Data Preservation"
    Removing Management Console does not affect your Minecraft servers or world data.

!!! note "Console database is kept"
    `data/mcctl.db` (console users, sessions and per-user server permissions) and the packages in `.services/` are not removed. This is intentional, so accounts survive a reinstall. To run `mcctl console init` again with the same admin email you need `--force`; without it the command fails with `User '<email>' already exists`.

To start completely from scratch, also delete the database:

!!! danger "This cannot be undone"
    Deleting the database removes every console user, session and per-user server permission.

```bash
rm -f ~/minecraft-servers/data/mcctl.db*
```

See [`mcctl console remove`](cli-commands.md#mcctl-console-remove) for the full list of removed and kept items.

### Clean Up PM2 (Optional)

If you want to completely remove PM2 configuration:

```bash
# Remove saved process list
pm2 unstartup

# Kill PM2 daemon
pm2 kill
```
