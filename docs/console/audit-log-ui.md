# Audit Log Web Console Guide

The **Audit** page of the web console shows the audit log that mcctl-api and the mcctl CLI write: server lifecycle, player management, worlds, backups, configuration and file operations. For the same data on the command line or over HTTP, see [CLI - Audit Log Commands](../cli/audit-log.md) and the [API Reference](../api/endpoints.md).

![Audit Log](../images/audit-log.png)

## Accessing the Audit Log

- Click **Audit** in the top navigation bar, or **View All** in the dashboard's **Recent Activity** card.
- URL: `http://localhost:5000/audit-logs`

Every signed-in user, with the Admin or the User role, can view and export the audit log. The per-server permissions (Viewer, Operator, Owner) do not limit it.

## Live Updates

The page header shows **Live** with a green dot while the real-time (SSE) connection is open, and **Disconnected** with a gray dot while it is not. The page reconnects on its own every 3 seconds.

The list does not reload by itself. When new entries arrive, a banner above the filters says "N new logs available - Click to refresh"; click it to load them. Changing a filter also reloads the list.

## Statistics

Four cards at the top summarize the whole audit log, whatever filters are set. They refresh every 30 seconds.

| Card | Value |
|------|-------|
| **Total Logs** | Number of entries |
| **Success Rate** | Share of entries with the status success |
| **Failures** | Number of failed entries |
| **Active Users** | Number of distinct actors in the latest 1,000 entries |

## Filters

The **Filters** panel can be collapsed, shows how many filters are active, and has a **Clear All** button. A filter applies as soon as you change it and is kept in the page URL, so a filtered view can be bookmarked.

| Filter | Description |
|--------|-------------|
| **From** / **To** | Date range in whole days (UTC) |
| **Action** | One action: Create, Delete, Start, Stop, Restart, Whitelist Add, Whitelist Remove, Ban, Unban, Op, Deop, Kick, Purge or Platform Settings. Choosing a target type narrows the list to server or player actions |
| **Target type** | **All**, **Server** or **Player** |
| **Status** | **All**, **Success** or **Failure** |
| **Target Name** | Exact name of the target, such as a server, world or player |
| **Actor** | Exact actor as recorded, for example `api:console` or `cli:local` |

Other recorded actions (worlds, backups and their schedules, config snapshots, mods, files, playit.gg, mc-router) are not in the **Action** list. Find them with **Target Name** or **Actor**, or with [`mcctl audit list --action <action>`](../cli/audit-log.md#mcctl-audit-list).

Player actions done in the web console are recorded with the server as the target and the player name in the details; the CLI records the player as the target. The **Player** target type therefore shows only player actions from the CLI.

## Log Table

| Column | Description |
|--------|-------------|
| **Timestamp** | Relative time such as "21m ago"; hover for the exact time |
| **Action** | Action label in a colored chip (see [Action Colors](#action-colors)) |
| **Actor** | `console` for actions from the web console (recorded as `api:console`), the user name for Platform Settings changes and file operations (recorded as `api:<user>`), and a `local` chip for CLI commands (recorded as `cli:local`) |
| **Target** | Name of the target, such as a server, world or player. A server links to its detail page, a player to the Players page |
| **Status** | **OK** (green) or **Error** (red) |

- A row with details or an error message has an arrow at the start; click it to show them below the row. Failed entries start expanded.
- Click a row to open the detail drawer (see [Log Details](#log-details)).
- Choose 25, 50 (default) or 100 rows per page.

The server **Activity** tab shows the same table for one server, without the Target column, with an **Action** filter, a status toggle and a **View Full History** link to this page (see the [Web Console Guide](web-console.md#activity-tab)).

## Log Details

The drawer on the right shows the entry's **ID**, **Timestamp** (to the second, with the time zone), **Action**, **Status**, **Actor**, **Target** (`<type>/<name>`), the error message of a failed entry, and a **Details** table with the recorded fields. For a server creation the details are `type`, `version`, `memory`, `modpack`, `modpackVersion`, `modLoader` and `excludeFiles`.

**Related Logs** has two tabs: up to 10 other entries with the **Same Target** and up to 10 with the **Same Actor**, newest first.

## Export

Click **Export** in the Filters panel to open **Export Audit Logs**:

1. Choose **CSV** or **JSON**.
2. Check **Applied Filters** and **Estimated Rows**. The export uses the filters currently set.
3. Click **Export CSV** or **Export JSON**. The file is saved as `audit-logs-<timestamp>.csv` or `audit-logs-<timestamp>.json`.

An export has at most 5,000 rows. When more entries match, the dialog says so; narrow the filters to export the rest.

CSV example:

```csv
ID,Timestamp,Action,Actor,Target Type,Target Name,Status,Error Message,Details
7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f,2026-10-24T14:32:15.123Z,server.start,api:console,server,survival,success,"",""
2b8e9f10-1a2b-4c3d-9e4f-5a6b7c8d9e0f,2026-10-24T14:30:45.020Z,player.whitelist.add,cli:local,player,Steve,success,"","{""server"":""survival""}"
```

The JSON file contains `exportedAt`, `filters`, `total` and the `logs` array.

## Action Colors

| Color | Actions |
|-------|---------|
| Green | Create, Whitelist Add, Unban |
| Red | Delete, Ban, Kick |
| Blue | Start, Op |
| Amber | Stop, Whitelist Remove, Deop, Platform Settings |
| Purple | Restart |
| Gray | Purge, and every action without its own label (shown by its name, such as `world.create`) |

## Purging Old Logs

The web console has no purge control. Delete old entries with [`mcctl audit purge`](../cli/audit-log.md#mcctl-audit-purge) (`--dry-run` shows what would be deleted) or with `DELETE /api/audit-logs`, which requires the Admin role. With `AUDIT_AUTO_CLEANUP=true` in the platform `.env`, entries older than `AUDIT_RETENTION_DAYS` (default 90) are deleted automatically.

## Troubleshooting

### Logs Not Updating

**Symptoms:**
- The header shows **Disconnected**
- New actions do not raise the "new logs available" banner

**Solutions:**
1. Wait a few seconds: the page reconnects every 3 seconds
2. Reload the page (F5)
3. Check that mcctl-api and mcctl-console are running: `mcctl console service status`

### Slow Page

**Symptoms:**
- The table loads slowly with many entries

**Solutions:**
1. Narrow the date range
2. Filter by action, target or actor
3. Choose fewer rows per page

### Missing Logs

**Symptoms:**
- Expected entries do not appear

**Possible Causes:**
1. Automatic cleanup deleted old entries (`AUDIT_AUTO_CLEANUP`, `AUDIT_RETENTION_DAYS`)
2. A manual purge was run
3. Filters hide them: click **Clear All**
4. The action is not in the **Action** list: search by **Target Name** or **Actor** instead
5. A player action from the web console is filed under the server, not under the **Player** target type

## See Also

- [CLI - Audit Log Commands](../cli/audit-log.md)
- [API Reference](../api/endpoints.md)
- [Audit Log Variables](../configuration/environment.md#audit-log-variables)
- [Web Console Guide](web-console.md)
