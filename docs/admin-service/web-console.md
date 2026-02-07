# Web Console Guide

User guide for the mcctl-console web management interface.

## Overview

The mcctl-console provides a modern web interface for managing your Docker Minecraft servers. Built with Next.js and featuring real-time updates, it offers a user-friendly alternative to CLI commands.

**Default URL:** `http://localhost:5000`

## Architecture

mcctl-console uses a Backend-for-Frontend (BFF) proxy pattern for secure API communication:

```
+------------------+      +-------------------+      +---------------+
|   Web Browser    | ---> |   mcctl-console   | ---> |   mcctl-api   |
|   (React/Query)  |      |   (Next.js BFF)   |      |   (Fastify)   |
+------------------+      +-------------------+      +---------------+
       ^                          |
       |                   Session Auth +
       |                   X-API-Key forwarding
       |
   React Query
   (auto-refresh)
```

### Why BFF Proxy?

1. **Security**: API keys stay server-side, never exposed to browser
2. **Session Management**: Better Auth handles user authentication
3. **Type Safety**: Shared TypeScript interfaces between frontend and backend
4. **Caching**: React Query provides optimistic updates and caching

### API Routes (BFF Layer)

The console proxies requests through Next.js API routes:

| Console Route | Method | Description |
|---------------|--------|-------------|
| `/api/servers` | GET | List all servers |
| `/api/servers` | POST | Create new server |
| `/api/servers/:name` | GET | Get server details |
| `/api/servers/:name` | DELETE | Delete server |
| `/api/servers/:name/start` | POST | Start server |
| `/api/servers/:name/stop` | POST | Stop server |
| `/api/servers/:name/restart` | POST | Restart server |
| `/api/servers/:name/exec` | POST | Execute RCON command |
| `/api/servers/:name/logs` | GET | Get server logs |
| `/api/worlds` | GET | List all worlds |
| `/api/worlds` | POST | Create new world |
| `/api/worlds/:name` | GET | Get world details |
| `/api/worlds/:name` | DELETE | Delete world |
| `/api/worlds/:name/assign` | POST | Assign world to server |
| `/api/worlds/:name/release` | POST | Release world lock |

### React Query Hooks

The console provides type-safe React Query hooks for data fetching:

```typescript
// Server operations
const { data: servers } = useServers();           // Auto-refresh every 10s
const { data: server } = useServer('myserver');   // Auto-refresh every 5s
const startMutation = useStartServer();
const stopMutation = useStopServer();
const execMutation = useExecCommand();

// World operations
const { data: worlds } = useWorlds();             // Auto-refresh every 30s
const assignMutation = useAssignWorld();
const releaseMutation = useReleaseWorld();
```

All hooks automatically handle:

- Loading states
- Error handling
- Cache invalidation on mutations
- Optimistic updates

## Accessing the Console

### First Time Login

1. Start Admin Service:
   ```bash
   mcctl console service start
   ```

2. Open your browser and navigate to `http://localhost:5000`

3. Enter your credentials:
   - **Username:** The admin username created during `mcctl console init`
   - **Password:** The admin password

4. Click **Sign In**

!!! tip "Remember Me"
    Your session will persist for 24 hours by default. For longer sessions, modify `MCCTL_JWT_EXPIRY` in your configuration.

### Session Management

- Sessions expire after the configured JWT expiry time
- Refresh tokens are used to extend active sessions
- Click **Sign Out** in the user menu to end your session

## Dashboard

The dashboard provides an overview of all your Minecraft servers.

### Server List

Each server card displays:

- **Server Name** - The unique identifier
- **Status Indicator**
  - Green: Running and healthy
  - Yellow: Starting or health check in progress
  - Red: Stopped or unhealthy
- **Server Type** - PAPER, VANILLA, FORGE, FABRIC, etc.
- **Version** - Minecraft version
- **Players** - Current/Maximum player count
- **Hostname** - Connection address for Minecraft clients

### Quick Actions

From the dashboard, you can:

- **Start** stopped servers (play button)
- **Stop** running servers (stop button)
- **Restart** servers (refresh button)
- **View Details** - Click on server card

### Real-time Status (SSE)

Since v1.11, the dashboard uses Server-Sent Events (SSE) for real-time server status updates:

- **No polling**: Status updates are pushed instantly via SSE
- **Automatic reconnection**: Reconnects on connection loss
- **Manual refresh**: Click the refresh button in the header

## Server Detail Page

Click on any server to view detailed information.

### Server Information

- **Container Name** - Docker container identifier
- **Status** - Running state and health
- **Uptime** - Time since last start
- **Memory** - Allocated memory
- **World** - Current world name and size

### Players Section

- **Online Players** - List of currently connected players
- **Player Count** - Current / Maximum

### Statistics

- **CPU Usage** - Current CPU utilization
- **Memory Usage** - RAM consumption

### Server Controls

| Button | Action | Description |
|--------|--------|-------------|
| Start | Start server | Available when stopped |
| Stop | Stop server | Graceful shutdown |
| Restart | Restart server | Stop then start |
| View Logs | Open logs panel | View console output |

### Console Panel

The console panel allows you to:

1. **View Logs** - See recent server output
2. **Execute Commands** - Run RCON commands

#### Executing Commands

1. Click **View Logs** or the console icon
2. Type a command in the input field
3. Press **Enter** or click **Send**
4. View the command output

**Common Commands:**

| Command | Description |
|---------|-------------|
| `list` | Show online players |
| `say <message>` | Broadcast message to all players |
| `give <player> <item> [amount]` | Give item to player |
| `time set day` | Set time to day |
| `weather clear` | Clear weather |
| `save-all` | Save world data |
| `stop` | Stop the server |

## World Management (v1.11+)

The Worlds page (`/worlds`) provides full world management:

- **World List**: Shows name, size, lock status, and assigned server
- **Create World**: Create new world with optional seed
- **Assign World**: Assign to server (only non-running servers shown)
- **Release Lock**: Release world lock from server
- **Delete World**: Delete with confirmation dialog
- **Reset World**: Reset world data with safety checks (server must be stopped)

## Server Options Tab (v1.11+)

The Options tab on Server Detail page allows:

- View server configuration (config.env values)
- Edit configuration through web UI
- Real-time config updates via REST API

## Audit Logs (v1.10+)

The Audit Logs page (`/audit-logs`) provides activity tracking:

- **Filterable Table**: Filter by action, actor, target, status, date range
- **Statistics Overview**: Total events, action breakdown, success/failure rates
- **Detail View**: Click any entry for full details
- **Export**: Export audit data
- **Real-time Streaming**: SSE stream for new audit events
- **Dashboard Widget**: Recent Activity Feed on dashboard
- **Server Activity**: Per-server audit history in Server Detail Activity tab

## Routing Page (v1.13+)

The Routing page (`/routing`) provides:

- Avahi mDNS hostname monitoring
- Hostname routing configuration and status

## User Interface Elements

### Navigation Bar

- **Logo/Home** - Return to dashboard
- **User Menu** - Account options and sign out
- **Theme Toggle** - Switch between light and dark mode

### Server Cards

```
+---------------------------+
|  Server Name        [>]   |
|  PAPER 1.21.1             |
|                           |
|  Status: Running          |
|  Players: 3/20            |
|  survival.nip.io:25565    |
|                           |
|  [Start] [Stop] [Restart] |
+---------------------------+
```

### Status Indicators

| Color | Meaning |
|-------|---------|
| Green | Running, healthy |
| Yellow | Starting, transitioning |
| Red | Stopped, unhealthy |
| Gray | Unknown, not configured |

## Best Practices

### Security

1. **Use Strong Passwords** - Follow the password requirements during setup
2. **Limit Access** - Use `ip-whitelist` mode to restrict access
3. **Use HTTPS** - Configure a reverse proxy with SSL for production
4. **Regular Updates** - Keep the Admin Service updated

### Monitoring

1. **Check Dashboard Regularly** - Monitor server health and player counts
2. **Review Logs** - Check for errors or unusual activity
3. **Set Up Alerts** - Consider external monitoring for critical servers

### Performance

1. **Don't Overload** - Don't run too many commands simultaneously
2. **Graceful Shutdowns** - Use stop instead of force-killing containers
3. **Regular Backups** - Use `mcctl backup` before major changes

## Troubleshooting

### Can't Access Console

1. **Check Service Status:**
   ```bash
   mcctl console service status
   ```

2. **Verify Port:**
   ```bash
   netstat -tlnp | grep 5000
   ```

3. **Check Logs:**
   ```bash
   pm2 logs mcctl-console --lines 100
   ```

### Login Fails

1. **Verify Credentials:**
   ```bash
   mcctl console user list
   ```

2. **Reset Password:**
   ```bash
   mcctl console user reset-password admin
   ```

3. **Check NextAuth Configuration:**
   Ensure `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are set correctly

### Server Status Not Updating

1. **Check API Health:**
   ```bash
   curl http://localhost:5001/health
   ```

2. **Verify Docker Socket:**
   Ensure Docker socket is mounted correctly in `docker-compose.admin.yml`

3. **Check Network:**
   Ensure mcctl-console can reach mcctl-api

### Commands Not Working

1. **Verify Server is Running:**
   Server must be in `running` state

2. **Check RCON:**
   RCON must be enabled on the server

3. **View API Logs:**
   ```bash
   mcctl console service logs --api-only
   ```

## Mobile Access

The web console is responsive and works on mobile devices:

- **Phone** - Simplified card layout, collapsible menus
- **Tablet** - Full dashboard with optimized controls
- **Desktop** - Full feature set

!!! tip "Mobile Considerations"
    - Use landscape mode for better command input
    - Enable 2FA if accessing from mobile
    - Consider VPN for secure mobile access

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+/` | Focus command input |
| `Enter` | Send command |
| `Escape` | Close modal/panel |
| `r` | Refresh dashboard (when not in input) |

## Screenshots

!!! note "Screenshots Placeholder"
    Screenshots will be added in a future update. The actual interface may vary slightly from the descriptions above.

### Dashboard View
_[Screenshot: Dashboard showing multiple server cards with status indicators]_

### Server Detail View
_[Screenshot: Server detail page with player list and controls]_

### Console Panel
_[Screenshot: Console panel with command input and log output]_

### Login Page
_[Screenshot: Login page with username and password fields]_
