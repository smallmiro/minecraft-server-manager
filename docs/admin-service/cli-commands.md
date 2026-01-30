# CLI Commands Reference

> **Note**: `mcctl admin` commands are deprecated. Use `mcctl console` instead. The `admin` command alias still works for backward compatibility but will be removed in a future release.

Complete reference for all `mcctl console` subcommands.

## Overview

The `mcctl console` command group provides management capabilities for the Admin Service:

```bash
mcctl console <subcommand> [options]
```

## Command Summary

| Command | Description |
|---------|-------------|
| `mcctl console init` | Initialize Admin Service configuration |
| `mcctl console remove` | Remove Admin Service completely |
| `mcctl console user` | Manage admin console users |
| `mcctl console api` | Manage API configuration |
| `mcctl console service` | Manage Admin Service lifecycle |

---

## mcctl console init

Initialize Admin Service configuration and create the first admin user.

### Usage

```bash
mcctl console init [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--root <path>` | Custom data directory |
| `--force` | Reinitialize even if already configured |
| `--api-port <port>` | API server port (default: 3001) |
| `--console-port <port>` | Console server port (default: 3000) |

### Interactive Flow

The command guides you through:

1. **Admin username** - Default: `admin`
2. **Admin password** - Password requirements:
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
3. **Confirm password** - Must match
4. **API access mode** - Choose security level:
   - `internal` - Local network only (recommended)
   - `api-key` - Requires X-API-Key header
   - `ip-whitelist` - IP-based access control
   - `api-key-ip` - Both API key and IP required
   - `open` - No authentication (development only)
5. **Custom ports** - Optional port configuration
6. **Additional configuration** - Based on selected mode

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

### Output Files

| File | Description |
|------|-------------|
| `.mcctl-admin.yml` | Main Admin Service configuration |
| `users.yaml` | User credentials with hashed passwords |
| `ecosystem.config.cjs` | PM2 process configuration |

---

## mcctl console remove

Remove Admin Service completely, including PM2 processes and configuration files.

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
| `users.yaml` | User credentials file |
| `ecosystem.config.cjs` | PM2 ecosystem configuration |

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
Removing configuration files...  Removed 3 configuration file(s)

Console Service removed successfully

  To reinstall, run: mcctl console init
```

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

Username            Role        Created
--------------------------------------------------
admin               admin       2025-01-15
operator1           viewer      2025-01-16

Total: 2 user(s)
```

**JSON output:**

```bash
mcctl console user list --json
```

```json
[
  {
    "id": "usr_abc123",
    "username": "admin",
    "role": "admin",
    "createdAt": "2025-01-15T10:00:00.000Z"
  },
  {
    "id": "usr_def456",
    "username": "operator1",
    "role": "viewer",
    "createdAt": "2025-01-16T14:30:00.000Z"
  }
]
```

### mcctl console user add

Add a new user account.

```bash
mcctl console user add [username] [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--role <role>` | User role: `admin` or `viewer` |
| `--password <password>` | User password |

**Interactive mode:**

```bash
mcctl console user add

? Username: operator1
? Role: Viewer - Read-only access
? Password: ********
? Confirm password: ********

User 'operator1' created successfully!
```

**CLI mode:**

```bash
mcctl console user add operator1 --role viewer --password "SecurePass123"
```

**Roles:**

| Role | Permissions |
|------|-------------|
| `admin` | Full access to all features |
| `viewer` | Read-only access (status, logs) |

### mcctl console user remove

Remove a user account.

```bash
mcctl console user remove [username] [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation prompt |

**Interactive mode:**

```bash
mcctl console user remove

? Select user to remove: operator1 (viewer)
? Are you sure you want to delete user 'operator1'? Yes

User 'operator1' deleted successfully.
```

**CLI mode:**

```bash
mcctl console user remove operator1 --force
```

!!! note "Protection"
    You cannot delete the last admin user. This prevents accidental lockout.

### mcctl console user update

Update a user's role.

```bash
mcctl console user update [username] [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--role <role>` | New role: `admin` or `viewer` |

**Example:**

```bash
# Promote to admin
mcctl console user update operator1 --role admin

# Demote to viewer
mcctl console user update operator1 --role viewer
```

### mcctl console user reset-password

Reset a user's password.

```bash
mcctl console user reset-password [username] [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--password <password>` | New password (for non-interactive use) |

**Interactive mode:**

```bash
mcctl console user reset-password operator1

? New password: ********
? Confirm password: ********

Password for 'operator1' has been reset.
```

**CLI mode:**

```bash
mcctl console user reset-password operator1 --password "NewSecurePass456"
```

---

## mcctl console api

Manage API configuration and access control.

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
  Port: 3001
  API Key: mctk_abc1...xyz9

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

? Are you sure you want to regenerate the API key? Yes

API key regenerated successfully.

New API Key: mctk_1234567890abcdef1234567890abcdef

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
| `internal` | Local network only (most secure) |
| `api-key` | External access with X-API-Key header |
| `ip-whitelist` | IP-based access control |
| `api-key-ip` | Both API key and IP required |
| `open` | No authentication (development only) |

**Options:**

| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation for dangerous modes |

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
mcctl console api whitelist <action> [ip] [options]
```

**Actions:**

| Action | Description |
|--------|-------------|
| `list` | List whitelisted IPs |
| `add <ip>` | Add IP or CIDR range |
| `remove <ip>` | Remove IP from whitelist |

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format (list only) |

**Examples:**

```bash
# List whitelist
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

Manage Admin Service lifecycle via PM2.

### Subcommands

| Subcommand | Description |
|------------|-------------|
| `start` | Start Admin Service via PM2 |
| `stop` | Stop Admin Service |
| `restart` | Restart Admin Service |
| `status` | Show service status |
| `logs` | View service logs |

### mcctl console service start

Start Admin Service processes (API and Console) via PM2.

```bash
mcctl console service start [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--api-only` | Start only mcctl-api |
| `--console-only` | Start only mcctl-console |

**Examples:**

```bash
# Start all services
mcctl console service start

# Start API only
mcctl console service start --api-only

# Start console only
mcctl console service start --console-only
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
    URL: http://localhost:3000
    CPU: 0%
    Memory: 80.5 MB
    Uptime: 3s
    Restarts: 0

  All services healthy
```

### mcctl console service stop

Stop Admin Service processes.

```bash
mcctl console service stop [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--api-only` | Stop only mcctl-api |
| `--console-only` | Stop only mcctl-console |

**Examples:**

```bash
# Stop all services
mcctl console service stop

# Stop API only
mcctl console service stop --api-only
```

### mcctl console service restart

Restart Admin Service processes.

```bash
mcctl console service restart [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--api-only` | Restart only mcctl-api |
| `--console-only` | Restart only mcctl-console |

**Examples:**

```bash
# Restart all services
mcctl console service restart

# Restart API only
mcctl console service restart --api-only
```

### mcctl console service status

Show Admin Service status via PM2.

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
    URL: http://localhost:3000
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
    "url": "http://localhost:3000"
  },
  "healthy": true
}
```

### mcctl console service logs

View Admin Service logs via PM2.

```bash
mcctl console service logs [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `-f, --follow` | Follow log output (stream) |
| `--api-only` | Show only mcctl-api logs |
| `--console-only` | Show only mcctl-console logs |

**Examples:**

```bash
# View recent logs
mcctl console service logs

# Follow logs in real-time
mcctl console service logs -f

# View API logs only
mcctl console service logs --api-only

# Follow console logs
mcctl console service logs --console-only -f
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
mcctl console user add operator1 --role viewer --password "SecurePass123"
```

**Switch to API Key Mode:**

```bash
mcctl console api mode api-key
# Save the displayed API key
```

**Configure IP Whitelist:**

```bash
mcctl console api mode ip-whitelist
mcctl console api whitelist add 192.168.1.0/24
mcctl console api whitelist add 10.0.0.0/8
mcctl console api whitelist list
```

**Check Service Health:**

```bash
mcctl console service status
mcctl console service logs --api-only
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

**Complete Removal:**

```bash
mcctl console remove
```
