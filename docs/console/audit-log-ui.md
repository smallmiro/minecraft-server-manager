# Audit Log Web Console Guide

The Web Console provides a user-friendly interface for viewing and managing audit logs through the mcctl-console service.

## Accessing the Audit Logs

**URL:**
```
http://localhost:5000/audit-logs
```

**Navigation:**
From the main dashboard, click **Audit Logs** in the sidebar navigation.

## Features Overview

### 1. Audit Log Table

The main audit log table displays recent activity with the following columns:

| Column | Description |
|--------|-------------|
| **Timestamp** | When the action occurred (local timezone) |
| **Action** | Type of action (with color-coded chip) |
| **Actor** | Who performed the action |
| **Target** | What was affected (server/player/audit) |
| **Status** | Success (green checkmark) or Failure (red X) |
| **Details** | Expandable row with full context |

**Table Features:**
- Sortable columns (click header to sort)
- Expandable rows (click row to view details)
- Pagination (50 entries per page by default)
- Auto-refresh (30-second intervals)
- Real-time updates via SSE

### 2. Filtering

Use the filter panel to narrow down results:

**Filter Options:**
- **Action Type**: Dropdown with all action types
- **Actor**: Text input for actor filter
- **Target Name**: Text input for server/player name
- **Status**: Success/Failure toggle
- **Date Range**: Calendar picker for from/to dates

**Quick Filters:**
- All Logs
- Server Operations
- Player Management
- Failures Only
- Last 24 Hours
- Last 7 Days
- Last 30 Days

**Example Workflow:**
1. Select "Failures Only" quick filter
2. Choose "Last 24 Hours" date range
3. Click "Apply Filters"
4. Review failed operations

### 3. Expandable Details

Click any log entry to view full details:

**Expanded View Includes:**
- Full timestamp with milliseconds
- Error message (if failure)
- JSON details object (formatted and syntax-highlighted)
- Copy button for ID
- Link to related entity (server/player)

**Example Details (Server Creation):**
```json
{
  "type": "PAPER",
  "version": "1.21.1",
  "memory": "4G",
  "worldOptions": {
    "type": "new",
    "seed": null
  }
}
```

### 4. Statistics Dashboard Widget

The main dashboard includes an **Audit Log Stats** widget:

**Displays:**
- Total logs count
- Success vs Failure ratio (pie chart)
- Top 5 actions (bar chart)
- Top 5 actors (bar chart)
- Recent failures (list)

**Refresh:**
- Auto-updates every 60 seconds
- Manual refresh button

### 5. Server Activity Tab

Each server detail page includes an **Activity** tab showing server-specific audit logs:

**Shows:**
- All actions related to that server
- Filtered by `targetName: <server-name>`
- Same filtering and sorting options
- Timeline view (chronological)

**Use Cases:**
- Track server lifecycle (create → start → stop → delete)
- Review who modified server settings
- Debug server startup failures

### 6. Export Functionality

Export audit logs for external analysis or compliance:

**Export Formats:**
- **CSV**: Spreadsheet-compatible
- **JSON**: Full data with details
- **PDF**: Printable report (with filters applied)

**How to Export:**
1. Apply desired filters
2. Click **Export** button in toolbar
3. Select format (CSV/JSON/PDF)
4. File downloads automatically

**CSV Example:**
```csv
Timestamp,Action,Actor,Target Type,Target Name,Status,Error Message
2026-02-05 14:32:15,server.create,cli:local,server,myserver,success,
2026-02-05 14:30:45,player.whitelist.add,web:admin,player,Steve,success,
```

### 7. Purge Old Logs

Delete old audit logs through the UI:

**Access:**
- Click **Settings** icon in audit log page
- Select **Purge Logs**

**Purge Dialog:**
- Select retention period (30/60/90/180 days or custom date)
- Preview deletion count
- Confirm with password (admin only)

**Safety Features:**
- Dry-run preview before deletion
- Confirmation dialog
- Cannot purge logs less than 7 days old

## Real-time Updates

The audit log page uses Server-Sent Events (SSE) for real-time updates:

**Live Indicator:**
- Green dot: Connected and receiving updates
- Red dot: Disconnected (click to reconnect)

**When New Log Arrives:**
- Row briefly highlights (yellow fade)
- Counter updates
- Statistics refresh

**Auto-scroll:**
- Toggle auto-scroll to see latest logs as they arrive
- Disabled by default to prevent disruption

## Action Color Coding

Actions are color-coded by category:

| Color | Category | Actions |
|-------|----------|---------|
| Blue | Server Lifecycle | create, start, stop, restart, delete |
| Green | Player Add | whitelist.add, op |
| Yellow | Player Modify | kick, unban, deop |
| Red | Player Remove | whitelist.remove, ban |
| Purple | Maintenance | audit.purge |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F` | Focus filter search |
| `R` | Refresh logs |
| `E` | Open export dialog |
| `Esc` | Close expanded details |
| `/` | Focus search bar |
| `↑`/`↓` | Navigate rows |
| `Enter` | Expand selected row |

## Permissions

Audit log access requires appropriate role:

| Role | Permissions |
|------|-------------|
| **Admin** | Full access (view, export, purge) |
| **Operator** | View and export only |
| **Viewer** | View only (no export or purge) |

## Troubleshooting

### Logs Not Updating

**Symptoms:**
- Live indicator shows red dot
- No new logs appearing

**Solutions:**
1. Check network connection
2. Click reconnect button
3. Refresh page (F5)
4. Verify mcctl-api service is running

### Performance Issues

**Symptoms:**
- Slow page load with large result sets

**Solutions:**
1. Reduce date range filter
2. Apply action filter
3. Increase pagination size in settings
4. Enable server-side pagination

### Missing Logs

**Symptoms:**
- Expected logs not appearing

**Possible Causes:**
1. Auto-cleanup deleted old logs (check retention settings)
2. Manual purge was performed
3. Filters hiding logs (reset filters)
4. Time zone mismatch (check browser timezone)

## See Also

- [CLI - Audit Log Commands](../cli/audit-log.md)
- [API - Audit Log Reference](./audit-log-api.md)
- [Configuration Guide](../configuration/environment.md)
