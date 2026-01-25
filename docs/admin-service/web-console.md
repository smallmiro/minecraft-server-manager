# Web Console Guide

User guide for the mcctl-console web management interface.

## Overview

The mcctl-console provides a modern web interface for managing your Docker Minecraft servers. Built with Next.js and featuring real-time updates, it offers a user-friendly alternative to CLI commands.

**Default URL:** `http://localhost:3000`

## Accessing the Console

### First Time Login

1. Start Admin Service:
   ```bash
   mcctl admin service start
   ```

2. Open your browser and navigate to `http://localhost:3000`

3. Enter your credentials:
   - **Username:** The admin username created during `mcctl admin init`
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

### Status Refresh

The dashboard automatically refreshes server status:

- **Default interval:** 30 seconds
- **Manual refresh:** Click the refresh button in the header

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
   mcctl admin service status
   ```

2. **Verify Port:**
   ```bash
   netstat -tlnp | grep 3000
   ```

3. **Check Logs:**
   ```bash
   mcctl admin service logs --console-only
   ```

### Login Fails

1. **Verify Credentials:**
   ```bash
   mcctl admin user list
   ```

2. **Reset Password:**
   ```bash
   mcctl admin user reset-password admin
   ```

3. **Check NextAuth Configuration:**
   Ensure `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are set correctly

### Server Status Not Updating

1. **Check API Health:**
   ```bash
   curl http://localhost:3001/health
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
   mcctl admin service logs --api-only
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
