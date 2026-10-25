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
Checking prerequisites...
  ✓ Node.js            v20.10.0  (>= 18.0.0)
  ✓ Docker Engine      v24.0.7  (>= 24.0.0)
  ✓ Docker Compose     v2.24.5  (>= 2.20.0)
  ✓ PM2                v6.0.14  (>= 6.0.0)

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

Creating admin user...  Admin user created
Checking mcctl-api installation...  mcctl-api ready
Checking mcctl-console installation...  mcctl-console ready
Resolving service script paths...  Using production node_modules paths
Generating PM2 ecosystem config...  PM2 ecosystem config generated
Saving configuration...  Configuration saved

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

  Console usage analytics is on (anonymous install ID and page paths, sent to Google Analytics). To turn it off, set "telemetry": false in /home/user/minecraft-servers/.mcctl.json.
```

The last line appears only while usage analytics is on (see [Usage Analytics](web-console.md#usage-analytics)).

#### Step 2: Start Services

```bash
mcctl console service start --console
```

`--console` starts mcctl-api and mcctl-console. Without a flag, the command asks which services to start when both are installed.

Wait for services to start. The command checks each service over HTTP for up to 15 seconds before it prints the status, and exits with code 1 if a service is not healthy:

```
[INFO] Starting console services via PM2...
[INFO]   Started mcctl-api
[INFO]   Started mcctl-console
[INFO] Console services started successfully

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
| `PORT` | Listening port of each service, set in its `env` block | `5001` (mcctl-api), `5000` (mcctl-console) |
| `HOSTNAME` | Console server hostname | `0.0.0.0` |
| `MCCTL_API_URL` | Internal API URL | `http://localhost:5001` |
| `NODE_ENV` | Environment mode | `production` |
| `LOG_LEVEL` | mcctl-api log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` | `info` when `NODE_ENV=production`, otherwise `debug` |
| `WORLD_UPLOAD_MAX_SIZE` | Max world ZIP size in bytes for `POST /api/worlds/upload` | `1073741824` (1 GB) |
| `BETTER_AUTH_SECRET` | Console session secret, written to `<root>/.env` by `mcctl console init`. Changing it signs everyone out | Generated |
| `BETTER_AUTH_BASE_URL` | Public URL of the console, read from `<root>/.env`. Set it when users open the console from an address other than `localhost`, a private LAN address, or a `.local` name (see [Can't Log In](#cant-log-in)) | `http://localhost:<console port>` |

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
        AUTH_MODE: 'ip-whitelist', // written for the "internal" access mode, see the note below the example
        AUTH_IP_WHITELIST: '127.0.0.1,::1,::ffff:127.0.0.1',
        // AUTH_API_KEY is added for the api-key access modes
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '500M',
      // Shutdown waits for a running auto-backup to re-enable auto-save (#734)
      kill_timeout: 130000,
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
        // MCCTL_API_KEY is added for the api-key access modes
        // BETTER_AUTH_SECRET is written to .env, not here
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
    `mcctl console init` writes the access mode to `AUTH_MODE` as the value mcctl-api recognises: `internal` → `ip-whitelist` limited to loopback (127.0.0.1, ::1), `api-key-ip` → `combined`, `open` → `disabled`; `api-key` and `ip-whitelist` are written as is.

Only the services you selected during `mcctl console init` appear in the file. Installations that predate the `.services/` directory keep their packages in `<root>/node_modules/`, and `mcctl console init` still uses that location when the packages are found there.

`kill_timeout: 130000` gives mcctl-api time to finish a running auto-backup when it shuts down. Files written by versions before v3.0.0 do not have it; see [Give mcctl-api time to finish an auto-backup](../advanced/upgrade-runbook.md#pm2-kill-timeout).

### Access Modes

`mcctl console init` asks for the access mode during setup. The mode, API key and IP whitelist are written to the `env` block of `ecosystem.config.cjs` (`AUTH_MODE`, `AUTH_API_KEY`, `AUTH_IP_WHITELIST`), which is what the running mcctl-api reads. The `mcctl console api` commands do not change those values yet (see the warning in [CLI Commands](cli-commands.md#mcctl-console-api)), so to switch modes, change the key or change the IP whitelist today, reinitialize with `mcctl console init --force`.

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

!!! warning "Include 127.0.0.1 when you install mcctl-console"
    The web console calls mcctl-api from the same host, so a list without `127.0.0.1` makes every console request fail with HTTP 403. Write the address: an entry `localhost` is accepted by the prompt but does not match any request. The same applies to `api-key-ip`.

#### api-key-ip

Requires both a valid API key AND a client IP from the whitelist.


#### open (Development Only)

!!! danger "Security Risk"
    This mode disables all authentication. Never use in production!


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
{"status":"ok","timestamp":"2026-10-25T12:00:00.000Z"}
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

4. **Check the address you sign in from:** The console accepts sign-ins from `localhost`, private LAN addresses (`10.x`, `172.16.x`-`172.31.x`, `192.168.x`), `.local` names, and the URL in `BETTER_AUTH_BASE_URL`. For any other address, such as a Tailscale `100.x` address, a domain name, or an HTTPS reverse proxy, set `BETTER_AUTH_BASE_URL` to that URL in `~/minecraft-servers/.env` and restart the console:
   ```bash
   mcctl console service restart --console
   ```
   See [Login Fails](web-console.md#login-fails) for details.

### API Returns 401 Unauthorized

1. **Check access mode** (the running API reads it from `ecosystem.config.cjs`; `mcctl console api status` shows `api-config.json` instead):
   ```bash
   grep AUTH_MODE ~/minecraft-servers/ecosystem.config.cjs
   ```

2. **Verify API key (if using api-key mode):**
   - Ensure `X-API-Key` header is included in requests
   - The key in use is `AUTH_API_KEY` in `ecosystem.config.cjs`. To get a new one, reinitialize with `mcctl console init --force`

3. **Check IP whitelist (if using ip-whitelist mode):** a client IP that is not in the list gets HTTP 403
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
mcctl console service start --console
```

`--force` does not preserve your settings. It stops the PM2 services and deletes `.mcctl-admin.yml` and `ecosystem.config.cjs`, so you choose the API access mode again, the ports return to the defaults unless you pass `--api-port` and `--console-port`, and a new API key is generated for the api-key modes. The console database `data/mcctl.db` is kept: other users stay as they are. The session secret `BETTER_AUTH_SECRET` in `.env` is kept as well, so other users stay signed in. If you enter the email of an existing admin, that user is deleted (including its sessions) and created again with the password you enter now. If you enter a different email, the existing admin stays and a new admin is added.

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
