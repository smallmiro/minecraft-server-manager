# Audit Log Management

The audit log records the operations performed on your Minecraft servers, giving an activity history for troubleshooting and security auditing.

## Overview

The CLI and mcctl-api (which also serves the web console) write audit log entries, for example for:

- **Servers**: create, delete, start, stop, restart, configuration and hostname changes
- **Players**: whitelist, ban/unban, op/deop and OP level, kick
- **Worlds, mods and more**: world changes and map renders, mods, playit.gg, router restart, platform settings, file browser actions, backup and config snapshot schedules
- **Audit maintenance**: log purge operations

Logs are stored in the SQLite database `<root>/data/audit.db` (default `~/minecraft-servers/data/audit.db`). Old entries are deleted only by `mcctl audit purge` or when [automatic cleanup](#configuration) is enabled.

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

`--action` takes the full name, such as `server.create` or `player.whitelist.add`:

| Prefix | Actions |
|--------|---------|
| `server.` | `create`, `delete`, `start`, `stop`, `restart`, `config`, `hostname` |
| `player.` | `whitelist.add`, `whitelist.remove`, `whitelist.toggle`, `ban`, `unban`, `op`, `op.level`, `deop`, `kick` |
| `world.` | `create`, `delete`, `assign`, `release`, `map.render` |
| `mod.` | `add`, `remove` |
| `playit.` | `start`, `stop` |
| `router.` | `restart` |
| `platform.` | `settings.update` |
| `file.` | `read`, `write`, `delete`, `mkdir`, `rename`, `upload`, `download` |
| `backup.schedule.` | `create`, `update`, `delete`, `enable`, `disable`, `run` |
| `config.snapshot.` | `create`, `delete`, `restore` |
| `config.snapshot.schedule.` | `create`, `update`, `delete`, `enable`, `disable` |
| `audit.` | `purge` |

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

Entries are listed newest first; the time uses the system's locale format.

```
Audit Logs (25 entries):

2/5/2026, 2:32:15 PM server.create             cli:local       server:myserver      success
2/5/2026, 2:30:45 PM player.whitelist.add      web:admin       player:Steve         success
2/5/2026, 2:28:10 PM server.start              api:service     server:survival      failure
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

Total Logs: 1234
Success: 1180
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
mcctl audit purge --days 180 --force
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

Automatic cleanup is configured with two environment variables:

```bash
# ~/minecraft-servers/.env

# Delete old logs automatically (default: off)
AUDIT_AUTO_CLEANUP=true

# Retention period in days (default: 90)
AUDIT_RETENTION_DAYS=90
```

**AUDIT_AUTO_CLEANUP:**
- `true`: While new entries are written, entries older than `AUDIT_RETENTION_DAYS` are deleted (after every 100 new entries, or 24 hours after the last cleanup)
- Unset or any other value (default): no automatic cleanup; use `mcctl audit purge`

mcctl-api reads both variables from `<root>/.env`, so the cleanup runs in mcctl-api. The CLI reads them only from the shell environment.

**AUDIT_RETENTION_DAYS:**
- Number of days to retain audit logs before auto-cleanup
- Default: 90 days
- Recommended: 30-180 days depending on compliance requirements

## Storage

**Database Location:**
```
~/minecraft-servers/data/audit.db
```

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_name TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL CHECK(status IN ('success', 'failure')),
  error_message TEXT,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
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
  "server": "survival",
  "reason": "Griefing"
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

- [Management Console - Audit Log API](../console/audit-log-api.md)
- [Web Console - Audit Log UI](../console/audit-log-ui.md)
- [Troubleshooting](../troubleshooting/index.md)
