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
   - `internal` - Docker network only (recommended)
   - `api-key` - Requires X-API-Key header
   - `ip-whitelist` - IP-based access control
   - `api-key-ip` - Both API key and IP required
   - `open` - No authentication (development only)
5. **Additional configuration** - Based on selected mode

### Examples

```bash
# Standard initialization
mcctl console init

# Reinitialize with force
mcctl console init --force

# Custom data directory
mcctl console init --root /opt/minecraft
```

### Output Files

| File | Description |
|------|-------------|
| `admin.yaml` | Main Admin Service configuration |
| `users.yaml` | User credentials with hashed passwords |
| `api-config.json` | API access configuration |

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
| `internal` | Docker network only (most secure) |
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

Manage Admin Service container lifecycle.

### Subcommands

| Subcommand | Description |
|------------|-------------|
| `start` | Start Admin Service containers |
| `stop` | Stop Admin Service containers |
| `restart` | Restart Admin Service containers |
| `status` | Show container status |
| `logs` | View container logs |

### mcctl console service start

Start Admin Service containers (API and Console).

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

### mcctl console service stop

Stop Admin Service containers.

```bash
mcctl console service stop
```

### mcctl console service restart

Restart Admin Service containers.

```bash
mcctl console service restart [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--api-only` | Restart only mcctl-api |
| `--console-only` | Restart only mcctl-console |

### mcctl console service status

Show Admin Service container status.

```bash
mcctl console service status [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

**Example output:**

```
  Admin Service Status

  mcctl-api
    Status: running
    Port: 3001
    Health: healthy
    Uptime: 2h 15m

  mcctl-console
    Status: running
    Port: 3000
    URL: http://localhost:3000
    Health: healthy
    Uptime: 2h 15m

  All services healthy
```

**JSON output:**

```json
{
  "api": {
    "name": "api",
    "container": "mcctl-api",
    "status": "running",
    "health": "healthy",
    "port": 3001,
    "uptime": "2h 15m"
  },
  "console": {
    "name": "console",
    "container": "mcctl-console",
    "status": "running",
    "health": "healthy",
    "port": 3000,
    "uptime": "2h 15m",
    "url": "http://localhost:3000"
  },
  "healthy": true
}
```

### mcctl console service logs

View Admin Service container logs.

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
