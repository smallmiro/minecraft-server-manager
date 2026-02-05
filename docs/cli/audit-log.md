# Audit Log Management

The audit log system tracks all critical operations performed on your Minecraft servers, providing a comprehensive activity history for compliance, troubleshooting, and security auditing.

## Overview

Audit logs are automatically generated for:
- **Server lifecycle**: create, delete, start, stop, restart
- **Player management**: whitelist add/remove, ban/unban, op/deop, kick
- **Audit maintenance**: log purge operations

Logs are stored in SQLite database at `~/.minecraft-servers/audit.db` with automatic cleanup after 90 days (configurable).

## Commands

### `mcctl audit list`

List audit logs with optional filtering.

**Syntax:**
```bash
mcctl audit list [options]
```

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `--limit <number>` | number | Maximum number of logs to display (default: 50) |
| `--action <action>` | string | Filter by action type |
| `--actor <actor>` | string | Filter by who performed the action |
| `--target <name>` | string | Filter by target server/player name |
| `--status <status>` | success\|failure | Filter by operation status |
| `--from <date>` | ISO date | Start date (e.g., 2026-01-01) |
| `--to <date>` | ISO date | End date |

**Action Types:**
- `server.create` - Server creation
- `server.delete` - Server deletion
- `server.start` - Server startup
- `server.stop` - Server shutdown
- `server.restart` - Server restart
- `player.whitelist.add` - Player added to whitelist
- `player.whitelist.remove` - Player removed from whitelist
- `player.ban` - Player banned
- `player.unban` - Player unbanned
- `player.op` - Player granted operator status
- `player.deop` - Player operator status revoked
- `player.kick` - Player kicked from server
- `audit.purge` - Audit logs purged

**Examples:**

```bash
# List recent 50 logs (default)
mcctl audit list

# List 100 most recent logs
mcctl audit list --limit 100

# Show only server creation events
mcctl audit list --action server.create

# Show all actions by specific user
mcctl audit list --actor cli:local

# Show failed operations
mcctl audit list --status failure

# Show logs for specific server
mcctl audit list --target myserver

# Date range query
mcctl audit list --from 2026-01-01 --to 2026-01-31

# Combined filters
mcctl audit list --action server.start --status failure --limit 20
```

**Output Format:**
```
Audit Logs (25 entries):

2026-02-05 14:32:15  server.create              cli:local       server:myserver        success
2026-02-05 14:30:45  player.whitelist.add       web:admin       player:Steve           success
2026-02-05 14:28:10  server.start               api:service     server:survival        failure
```

---

### `mcctl audit stats`

Show statistical overview of audit logs.

**Syntax:**
```bash
mcctl audit stats
```

**Output:**
```
Audit Log Statistics:

Total Logs: 1,234
Success: 1,180
Failure: 54


By Action:

  server.start                   456
  server.stop                    432
  player.whitelist.add           123
  server.create                   89
  player.ban                      45
  ...


By Actor:

  cli:local            678
  web:admin            456
  api:service          100
```

**Use Cases:**
- Monitor most frequent operations
- Identify users with most activity
- Track failure rates
- Audit compliance reporting

---

### `mcctl audit purge`

Delete old audit logs to free up database space.

**Syntax:**
```bash
mcctl audit purge [options]
```

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `--days <number>` | number | Delete logs older than N days (default: 90) |
| `--before <date>` | ISO date | Delete logs before specific date |
| `--dry-run` | boolean | Preview without actually deleting |
| `--force` | boolean | Skip confirmation prompt |

**Examples:**

```bash
# Delete logs older than 90 days (with confirmation)
mcctl audit purge

# Delete logs older than 30 days
mcctl audit purge --days 30

# Delete logs before specific date
mcctl audit purge --before 2026-01-01

# Preview what would be deleted
mcctl audit purge --days 60 --dry-run

# Force purge without confirmation
mcmcctl audit purge --days 180 --force
```

**Output:**
```
[DRY RUN] Would delete 234 audit logs older than 2025-11-07T00:00:00.000Z

# Or with actual deletion:
✓ Deleted 234 audit logs
```

**Note**: Purge operations are themselves logged in the audit log.

---

## Configuration

Audit log behavior is configured via environment variables in `.env` file:

```bash
# ~/.minecraft-servers/.env

# Automatic cleanup of old logs
AUDIT_AUTO_CLEANUP=true

# Retention period in days (default: 90)
AUDIT_RETENTION_DAYS=90
```

**AUDIT_AUTO_CLEANUP:**
- `true` (default): Automatically delete logs older than `AUDIT_RETENTION_DAYS` on system startup
- `false`: Disable automatic cleanup (manual purge only)

**AUDIT_RETENTION_DAYS:**
- Number of days to retain audit logs before auto-cleanup
- Default: 90 days
- Recommended: 30-180 days depending on compliance requirements

## Storage

**Database Location:**
```
~/.minecraft-servers/audit.db
```

**Schema:**
```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_name TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  error_message TEXT,
  timestamp TEXT NOT NULL
);

CREATE INDEX idx_action ON audit_logs(action);
CREATE INDEX idx_actor ON audit_logs(actor);
CREATE INDEX idx_target_name ON audit_logs(target_name);
CREATE INDEX idx_status ON audit_logs(status);
CREATE INDEX idx_timestamp ON audit_logs(timestamp);
```

**Details Field:**
JSON-encoded additional context. Examples:

```json
// Server creation
{
  "type": "PAPER",
  "version": "1.21.1",
  "memory": "4G"
}

// Player ban
{
  "reason": "Griefing",
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5"
}

// Audit purge
{
  "deletedCount": 234,
  "cutoffDate": "2025-11-07T00:00:00.000Z"
}
```

## Best Practices

### Retention Policy

| Environment | Recommended Retention | Reason |
|-------------|----------------------|--------|
| Development | 30 days | Frequent testing, less critical |
| Staging | 60 days | Pre-production validation |
| Production | 90-180 days | Compliance, troubleshooting |
| Compliance-Critical | 365+ days | Regulatory requirements |

### Regular Review

```bash
# Weekly review of failures
mcctl audit list --status failure --limit 100

# Monthly statistics report
mcctl audit stats > monthly-audit-$(date +%Y-%m).txt

# Quarterly cleanup
mcctl audit purge --days 180 --dry-run
```

### Troubleshooting

**Check recent server failures:**
```bash
mcctl audit list --action server.start --status failure --limit 10
```

**Identify who deleted a server:**
```bash
mcctl audit list --action server.delete --target myserver
```

**Track player management activity:**
```bash
mcctl audit list --action player.ban
mcctl audit list --action player.whitelist.add --actor web:admin
```

## See Also

- [Admin Service - Audit Log API](../admin-service/audit-log-api.md)
- [Web Console - Audit Log UI](../admin-service/audit-log-ui.md)
- [Troubleshooting](../troubleshooting/index.md)
