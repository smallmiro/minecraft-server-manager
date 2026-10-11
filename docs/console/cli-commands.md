# CLI Commands Reference

> **Note**: `mcctl admin` commands are deprecated. Use `mcctl console` instead. The `admin` command alias still works for backward compatibility but will be removed in a future release.

Complete reference for all `mcctl console` subcommands.

## Overview

The `mcctl console` command group provides management capabilities for the Management Console:

```bash
mcctl console <subcommand> [options]
```

## Command Summary

| Command | Description |
|---------|-------------|
| `mcctl console init` | Initialize Management Console configuration |
| `mcctl console remove` | Remove Management Console processes and configuration (keeps the console database) |
| `mcctl console user` | Manage admin console users |
| `mcctl console api` | Manage API configuration |
| `mcctl console service` | Manage Management Console lifecycle |

---

## mcctl console init

Initialize Management Console configuration and create the first admin user.

### Usage

```bash
mcctl console init [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--root <path>` | Custom data directory |
| `--force` | Skip the reinitialize confirmation and replace an existing admin user with the same email (see Reinitializing below) |
| `--api-port <port>` | API server port (default: 5001) |
| `--console-port <port>` | Console server port (default: 5000) |

### Interactive Flow

The command guides you through:

1. **Services to install** - `mcctl-api` is selected by default; also select `mcctl-console` to install the web console
2. **Admin email** - Used to sign in to the web console (e.g., `admin@example.com`)
3. **Admin name** - Default: `Administrator`
4. **Admin password** - Password requirements:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
5. **API access mode** - Choose security level:
    - `internal` - Local network only (recommended)
    - `api-key` - Requires X-API-Key header
    - `ip-whitelist` - IP-based access control
    - `api-key-ip` - Both API key and IP required
    - `open` - No authentication (development only)
6. **Additional configuration** - Based on selected mode

The admin email, name, and password are asked only when `mcctl-console` is selected. The admin account is created with the `admin` role.

The command does not ask for ports. To use ports other than the defaults, pass `--api-port` and `--console-port` (see the examples below).

### Examples

```bash
# Standard initialization
mcctl console init

# Reinitialize with force
mcctl console init --force

# Custom data directory
mcctl console init --root /opt/minecraft

# Custom ports
mcctl console init --api-port 8001 --console-port 8000
```

### Reinitializing

If the console is already initialized, the command asks whether to reinitialize. `--force` skips that question. Reinitializing:

- stops the `mcctl-api` and `mcctl-console` PM2 processes,
- deletes `.mcctl-admin.yml` and `ecosystem.config.cjs`, so the API access mode is chosen again, a new API key is generated for the api-key modes, and the ports return to the defaults unless you pass `--api-port` and `--console-port`,
- keeps `data/mcctl.db`, so other users are not touched.

If the admin email you enter already exists in `data/mcctl.db`, the command fails with `User '<email>' already exists` and suggests `mcctl console init --force`. With `--force`, that user is deleted (including its sessions) and created again with the new name and password.

### Output Files

All paths are relative to the data directory (`MCCTL_ROOT`, default `~/minecraft-servers`).

| File | Description |
|------|-------------|
| `.mcctl-admin.yml` | Main Management Console configuration |
| `data/mcctl.db` | Console user database (created only when `mcctl-console` is selected) |
| `ecosystem.config.cjs` | PM2 process configuration |

---

## mcctl console remove

Remove the Management Console PM2 processes and configuration files. The console database (`data/mcctl.db`) is kept on purpose.

### Usage

```bash
mcctl console remove [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--root <path>` | Custom data directory |
| `--force` | Skip confirmation prompt |
| `--keep-config` | Keep configuration files for later reinstall |

### What Gets Removed

| Component | Description |
|-----------|-------------|
| PM2 processes | mcctl-api, mcctl-console processes are stopped and removed |
| `.mcctl-admin.yml` | Main configuration file |
| `ecosystem.config.cjs` | PM2 ecosystem configuration |
| `users.yaml` | Legacy user credentials file (removed only if it exists) |

With `--keep-config`, the three files above are kept; only the PM2 processes are removed.

### What Is Kept

| Component | Description |
|-----------|-------------|
| `data/mcctl.db` | Console database: users, sessions and per-user server permissions. Not removed on purpose, so accounts survive a reinstall |
| `.services/` | The installed `mcctl-api` and `mcctl-console` packages |
| `api-config.json` | Settings written by `mcctl console api` (if present) |

Minecraft servers and worlds are not touched.

### Reinstalling After Removal

Because `data/mcctl.db` is kept, running `mcctl console init` again with the same admin email fails with `User '<email>' already exists`. Use `mcctl console init --force` to replace that user, or enter a different email.

To start completely from scratch, delete the database yourself:

!!! danger "This cannot be undone"
    Deleting the database removes every console user, session and per-user server permission.

```bash
# Replace ~/minecraft-servers with your data directory (MCCTL_ROOT)
rm -f ~/minecraft-servers/data/mcctl.db*
```

The `*` also removes the SQLite `-wal` and `-shm` files that sit next to the database.

### Examples

```bash
# Interactive removal (prompts for confirmation)
mcctl console remove

# Force removal without confirmation
mcctl console remove --force

# Keep configuration files
mcctl console remove --keep-config
```

### Output Example

```
  This will remove:
    - PM2 processes (mcctl-api, mcctl-console)
    - Configuration files (.mcctl-admin.yml, users.yaml)
    - PM2 ecosystem config (ecosystem.config.cjs)

? Are you sure you want to remove Console Service? Yes

Stopping and removing PM2 processes...  Stopped and removed: mcctl-api, mcctl-console
Removing configuration files...  Removed 2 configuration file(s)

Console Service removed successfully

  To reinstall, run: mcctl console init
```

The confirmation prompt still names `users.yaml`, but that file is only deleted if it exists, so a current installation reports 2 removed files (`.mcctl-admin.yml` and `ecosystem.config.cjs`).

---

## mcctl console user

Manage admin console users.

### Subcommands

| Subcommand | Description |
|------------|-------------|
| `list` | List all users |
| `add` | Add a new user |
| `remove` | Remove a user |
| `update` | Update user role |
| `reset-password` | Reset user password |

### mcctl console user list

List all registered users.

```bash
mcctl console user list [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Example output:**

```
Users:

Email                         Name                Role        Created
---------------------------------------------------------------------------
operator@example.com          Operator            user        2025-01-16
admin@example.com             Administrator       admin       2025-01-15

Total: 2 user(s)
```

**JSON output:**

```bash
mcctl console user list --json
```

```json
[
  {
    "id": "0f9e8d7c6b5a49382716f5e4d3c2b1a0",
    "name": "Operator",
    "email": "operator@example.com",
    "role": "user",
    "emailVerified": true,
    "banned": false,
    "createdAt": "2025-01-16T14:30:00.000Z",
    "updatedAt": "2025-01-16T14:30:00.000Z"
  },
  {
    "id": "a1b2c3d4e5f60718293a4b5c6d7e8f90",
    "name": "Administrator",
    "email": "admin@example.com",
    "role": "admin",
    "emailVerified": true,
    "banned": false,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
]
```

### mcctl console user add

Add a new user account. Users are identified by their email address.

```bash
mcctl console user add [email] [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--role <role>` | User role: `admin` or `user` |
| `--password <password>` | User password |

**Interactive mode:**

```bash
mcctl console user add

? Email: operator@example.com
? Name: Operator
? Role: User - Standard access
? Password: ********
? Confirm password: ********

User 'operator@example.com' created successfully!
```

The interactive password prompt requires at least 8 characters.

**CLI mode:**

```bash
mcctl console user add operator@example.com --role user --password "SecurePass123"
```

```json
{"success":true,"email":"operator@example.com"}
```

CLI mode applies only when `[email]`, `--role`, and `--password` are all given; otherwise the interactive prompts are shown. The user's name is set to the part of the email before `@`, and the password given with `--password` is not checked against the 8-character minimum.

**Roles:**

| Role | Permissions |
|------|-------------|
| `admin` | Full access to all features |
| `user` | Standard access, limited to the servers granted to the account |

### mcctl console user remove

Remove a user account.

```bash
mcctl console user remove [email] [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation prompt |

**Interactive mode:**

```bash
mcctl console user remove

? Select user to remove: operator@example.com (user)
? Are you sure you want to delete user 'operator@example.com'? Yes

User 'operator@example.com' deleted successfully.
```

**CLI mode:**

```bash
mcctl console user remove operator@example.com --force
```

!!! note "Protection"
    You cannot delete the last admin user. This prevents accidental lockout.

### mcctl console user update

Update a user's role.

```bash
mcctl console user update [email] [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--role <role>` | New role: `admin` or `user` |

**Example:**

```bash
# Promote to admin
mcctl console user update operator@example.com --role admin

# Demote to user
mcctl console user update operator@example.com --role user
```

### mcctl console user reset-password

Reset a user's password.

```bash
mcctl console user reset-password [email] [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--password <password>` | New password (for non-interactive use) |

**Interactive mode:**

```bash
mcctl console user reset-password operator@example.com

? New password: ********
? Confirm password: ********

Password for 'operator@example.com' has been reset.
```

**CLI mode:**

```bash
mcctl console user reset-password operator@example.com --password "NewSecurePass456"
```

---

## mcctl console api

Manage API configuration and access control.

These commands read and write `api-config.json` in the data directory (`MCCTL_ROOT`, default `~/minecraft-servers`). It is a separate file from the `.mcctl-admin.yml` written by `mcctl console init`. Until a command saves a change, the defaults are used: mode `internal`, port `5001`, empty IP whitelist.

!!! warning "Changes do not reach the running mcctl-api"
    These commands only change `api-config.json`. The running `mcctl-api` takes its access mode, API key and IP whitelist from the `env` block of `ecosystem.config.cjs` (`AUTH_MODE`, `AUTH_API_KEY`, `AUTH_IP_WHITELIST`), which they do not touch. A change made here therefore has no effect on the API, even after `mcctl console service restart`, and `mcctl console api status` shows the contents of `api-config.json`, not necessarily what the running API uses.

    The mode and key in effect are the ones chosen during `mcctl console init`. For now, change them by reinitializing with `mcctl console init --force`. Tracked in [#633](https://github.com/smallmiro/minecraft-server-manager/issues/633).

### Subcommands

| Subcommand | Description |
|------------|-------------|
| `status` | Show API configuration |
| `key regenerate` | Regenerate API key |
| `mode` | Change access mode |
| `whitelist` | Manage IP whitelist |

### mcctl console api status

Show current API configuration.

```bash
mcctl console api status [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Example output:**

```
API Configuration

  Access Mode: api-key
  Port: 5001
  API Key: mctk_a1b...9f3c

  IP Whitelist: (empty)

  Mode: External access with X-API-Key header
```

### mcctl console api key regenerate

Generate a new API key. All existing clients must be updated.

```bash
mcctl console api key regenerate [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation prompt |

**Example:**

```bash
mcctl console api key regenerate

? Are you sure you want to regenerate the API key? All existing clients will need to be updated. Yes

API key regenerated successfully.

New API Key: mctk_0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0

Please update all clients with the new API key.
```

### mcctl console api mode

Change the API access mode.

```bash
mcctl console api mode [mode] [options]
```

**Modes:**

| Mode | Description |
|------|-------------|
| `internal` | Docker network only (most secure) |
| `api-key` | External access with X-API-Key header |
| `ip-whitelist` | IP-based access control |
| `api-key-ip` | Both API key and IP required |
| `open` | No authentication (development only) |

**Options:**

| Option | Description |
|--------|-------------|
| `--force` | Skip the confirmation shown when switching to `open` |

On success the command prints `Access mode changed to: <mode>`.

**Examples:**

```bash
# Interactive selection
mcctl console api mode

# Direct mode change
mcctl console api mode api-key

# Force open mode (development only!)
mcctl console api mode open --force
```

### mcctl console api whitelist

Manage IP whitelist for ip-whitelist and api-key-ip modes.

```bash
mcctl console api whitelist [action] [ip] [options]
```

**Actions:**

| Action | Description |
|--------|-------------|
| `list` | List whitelisted IPs (default when `[action]` is omitted) |
| `add <ip>` | Add IP or CIDR range (IPv4 only; prompts for the value if `<ip>` is omitted) |
| `remove <ip>` | Remove IP from whitelist (prompts for a choice if `<ip>` is omitted) |

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format (list only) |

**Examples:**

```bash
# List whitelist (same as "whitelist" with no action)
mcctl console api whitelist list

# Add single IP
mcctl console api whitelist add 192.168.1.100

# Add CIDR range
mcctl console api whitelist add 10.0.0.0/8

# Remove IP
mcctl console api whitelist remove 192.168.1.100
```

---

## mcctl console service

Manage Management Console lifecycle via PM2.

### Subcommands

| Subcommand | Description |
|------------|-------------|
| `start` | Start Management Console via PM2 |
| `stop` | Stop Management Console |
| `restart` | Restart Management Console |
| `status` | Show service status |
| `logs` | View service logs |

### mcctl console service start

Start Management Console processes (API and Console) via PM2.

```bash
mcctl console service start [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--api` | Start only mcctl-api |
| `--console` | Start mcctl-console. mcctl-api is started too, because the console depends on it |

Without `--api` or `--console`, the command asks whether to start "API only" or "API + Console" when both services are installed.

**Examples:**

```bash
# Start services (asks which ones when both are installed)
mcctl console service start

# Start API only
mcctl console service start --api

# Start console (together with the API)
mcctl console service start --console
```

**Output Example:**

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

### mcctl console service stop

Stop Management Console processes.

```bash
mcctl console service stop [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--api` | Stop mcctl-api. mcctl-console is stopped too, because the console cannot run without the API |
| `--console` | Stop only mcctl-console |
| `--force` | Delete the PM2 processes and kill the PM2 daemon (this stops every process PM2 manages, not only the mcctl services) |

Without `--api` or `--console`, the command asks whether to stop "All services" or "Console only" when both services are installed.

**Examples:**

```bash
# Stop services (asks which ones when both are installed)
mcctl console service stop

# Stop the console only
mcctl console service stop --console

# Stop the API (this also stops the console)
mcctl console service stop --api
```

### mcctl console service restart

Restart Management Console processes.

```bash
mcctl console service restart [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--api` | Restart only mcctl-api |
| `--console` | Restart mcctl-console. mcctl-api is restarted too, because the console depends on it |
| `--force` | Delete the mcctl PM2 processes, kill the PM2 daemon, start the selected mcctl services again, then save the PM2 process list (`pm2 save`). Everything else PM2 manages (other apps, and an mcctl service you did not select) is stopped with the daemon, is not started again, and is missing from the saved list |

Without `--api` or `--console`, the command asks whether to restart "API only" or "API + Console" when both services are installed.

**Examples:**

```bash
# Restart services (asks which ones when both are installed)
mcctl console service restart

# Restart API only
mcctl console service restart --api
```

### mcctl console service status

Show Management Console status via PM2.

```bash
mcctl console service status [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Example output:**

```
  Console Service Status (PM2)

  mcctl-api
    Status: online
    PID: 12345
    CPU: 2%
    Memory: 52.1 MB
    Uptime: 2h 15m
    Restarts: 0

  mcctl-console
    Status: online
    PID: 12346
    URL: http://localhost:5000
    CPU: 1%
    Memory: 85.3 MB
    Uptime: 2h 15m
    Restarts: 0

  All services healthy
```

**JSON output:**

```json
{
  "api": {
    "name": "mcctl-api",
    "status": "online",
    "pid": 12345,
    "cpu": 2,
    "memory": "52.1 MB",
    "uptime": "2h 15m",
    "restarts": 0
  },
  "console": {
    "name": "mcctl-console",
    "status": "online",
    "pid": 12346,
    "cpu": 1,
    "memory": "85.3 MB",
    "uptime": "2h 15m",
    "restarts": 0,
    "url": "http://localhost:5000"
  },
  "healthy": true
}
```

### mcctl console service logs

View Management Console logs via PM2.

```bash
mcctl console service logs [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `-f, --follow` | Follow log output (stream) |
| `--api` | Show only mcctl-api logs |
| `--console` | Show mcctl-console logs (mcctl-api logs are included as well) |

The CLI help describes `--console` as "Target console service only". For `logs`, the current behavior also includes mcctl-api, the same selection as `start` and `restart`.

**Examples:**

```bash
# View recent logs
mcctl console service logs

# Follow logs in real-time
mcctl console service logs -f

# View API logs only
mcctl console service logs --api

# Follow console logs (API logs are included)
mcctl console service logs --console -f
```

Press `Ctrl+C` to stop following logs.

---

## Quick Reference

### Common Workflows

**Initial Setup:**

```bash
mcctl console init
mcctl console service start
```

**Add Operator User:**

```bash
mcctl console user add operator@example.com --role user --password "SecurePass123"
```

**Switch to API Key Mode:**

```bash
# Choose "api-key" when asked for the API access mode
mcctl console init --force
# Save the API key printed at the end (it is only shown once)
mcctl console service start
```

`mcctl console api mode` and `mcctl console api key regenerate` only change `api-config.json`, so they do not switch the running API (see the warning under [mcctl console api](#mcctl-console-api)).

**Configure IP Whitelist:**

```bash
# Choose "ip-whitelist" (or "api-key-ip") and enter the allowed IPs, comma-separated
mcctl console init --force
mcctl console service start
```

`mcctl console api whitelist` likewise only edits `api-config.json` for now.

**Check Service Health:**

```bash
mcctl console service status
mcctl console service logs --api
```

**Restart After Configuration Change:**

```bash
mcctl console service restart
```

**Auto-Start on Boot:**

```bash
pm2 startup
pm2 save
```

**Remove (keeps `data/mcctl.db`):**

```bash
mcctl console remove
```
