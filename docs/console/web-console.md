# Web Console Guide

Complete user guide for the **mcctl-console** web management interface -- a modern, full-featured dashboard for managing Docker Minecraft servers from your browser.

## Overview

The mcctl-console is a Next.js web application that provides a graphical interface to every aspect of your Minecraft server infrastructure. Instead of running CLI commands, you can manage servers, worlds, players, backups, audit logs, and routing through an intuitive dark-themed UI with real-time updates powered by Server-Sent Events (SSE).

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

1. **Security**: API keys stay server-side, never exposed to the browser
2. **Session Management**: Better Auth keeps sessions in the console database (`data/mcctl.db`) and identifies them with a session cookie
3. **Type Safety**: Shared TypeScript interfaces between frontend and backend
4. **Caching**: React Query provides optimistic updates and intelligent caching

## Accessing the Console

### Signing In

![Login](../images/login.png)

1. Start the Management Console services. `--console` starts mcctl-api and mcctl-console; without a flag the command asks which services to start when both are installed:
   ```bash
   mcctl console service start --console
   ```

2. Open your browser and navigate to `http://localhost:5000`. You are redirected to the **Welcome Back** sign-in page.

3. Enter your credentials:
    - **Email:** The admin email you entered during `mcctl console init`
    - **Password:** The admin password (use the eye icon to show or hide it)

4. Click **Sign In**. After a successful login you land on the [Dashboard](#dashboard).

!!! tip "Session Persistence"
    A session stays valid for 7 days and is extended automatically (at most once every 24 hours) while you keep using the console. Click **Logout** in the user avatar menu (top-right corner) to end your session manually.

### Signing Up

![Sign Up](../images/signup.png)

If you do not have an account yet, click **Sign up** under the sign-in form ("Don't have an account? Sign up") to open the **Create Account** page:

1. Enter your **Name** and **Email**
2. Choose a **Password** (at least 8 characters) and type it again in **Confirm Password**
3. Click **Sign Up**

The account is created, you are signed in immediately, and you land on the Dashboard. Use **Sign in** under the form to go back to the sign-in page.

!!! note "New accounts start with the User role"
    New accounts get the **User** role. A User sees only the servers that an administrator or a server Owner has granted access to (see [Access Tab](#access-tab)), so the Servers page stays empty until access is granted. A server created by a User automatically gives that User the Owner permission on it. The sign-up page does not send a verification email.

---

## Dashboard

The Dashboard is your command center -- it gives you an at-a-glance overview of your entire Minecraft server infrastructure.

![Dashboard](../images/dashboard.png)

### Status Hero

Since v2.28.0, the Dashboard opens with a status hero that summarizes platform health: how many servers are online (for example, "2 of 3 servers online" with a progress bar), how many servers need attention (not running, or `unhealthy`; "All systems operational" when none), and a **Live** / **Reconnecting** chip that reflects the real-time (SSE) connection. When server data cannot be loaded, the hero says so instead of showing zero.

The **Create Server** button in the hero opens the Servers page with the [Create New Server](#creating-a-new-server) dialog already open.

### Statistics Cards

Below the status hero, four cards provide key metrics:

| Card | Description |
|------|-------------|
| **Total Servers** | The number of configured servers, with a running / stopped breakdown and a bar for the running share |
| **Online Players** | Players online on the running servers, shown as `online / max`, with "Across N running servers" (plus "M not responding" when a running server does not answer the player query). Shows `—` and "Player data unavailable" when no player data is available |
| **Worlds** | The number of worlds in your world storage, with an assigned / free breakdown |
| **mc-router** | The router's listening port (for example `:25565`) with its container status, health and number of routes. The card is green while the router runs, red while it is down or unhealthy, and amber in other states such as starting or restarting |

### Servers Panel

The left side of the Dashboard displays a **Servers** panel with a status filter (**All**, **Running**, **Stopped**, each with a count) and up to five servers. Each row shows:

- **Server name**, a **status chip** (such as `running`, `exited`, or `created`) and, when the container reports a health state, an outlined **health chip** (`healthy`, `unhealthy`, or `starting`)
- The primary hostname (the LAN nip.io address when the server has one) with a copy button; click the `+N` chip to list all hostnames
- **Players** (`online / max`) and **Memory** (`used / limit`) for a running server, the memory allocation for a stopped one, and **Type** (`TYPE · version`)
- Action buttons: **Console** (opens the [server console page](#server-console-page)), **Restart** and **Stop** for a running server, and **Start** for a stopped one. **Restart** and **Stop** ask for confirmation first, because connected players are disconnected

Click a row to open the server's detail page. When you have more than five servers, a **View All (N)** link in the panel header opens the full Servers page.

### External Access Card

On the right side, the **External Access** card shows your playit.gg tunnel status:

- How many servers have external domains configured (e.g., "1 / 3 servers")
- Current agent status (`Running` or `Stopped`) and, while the agent runs, its uptime, or a `Not configured` chip when playit.gg is not set up
- Up to three servers with their external address and a copy button
- A **Manage** link to navigate to the Routing page for detailed configuration

### Recent Activity Feed

The **Recent Activity** feed displays the latest management actions performed on your servers, such as:

- Server start/stop events
- Backup schedule changes
- Configuration modifications
- Player management actions

Each entry shows a colored dot (red for a failure, blue for backups, purple for configuration changes, config snapshots and Platform Settings, green for other server actions, gray for the rest), the action type (with a color-coded badge), the target server or resource, who performed the action, and how long ago it occurred (hover to see the exact time). Actions done in the web console show `console` as the actor (see [Audit Log](#audit-log)). Failed actions carry an extra status badge. Click **View All** to navigate to the full Audit Log page.

### Recent Updates Feed

The **Recent Updates** card shows the latest release from the project's `CHANGELOG.md` on the GitHub `main` branch: its version, date, and **Added**, **Fixed**, and **Changed** items. An **Update available** chip appears when that version is newer than the installed console, and **View all** opens the full changelog on GitHub.

The console server fetches the changelog itself (through `GET /api/changelog`) and caches it for one hour. When GitHub cannot be reached it keeps showing the last copy it fetched; without one, the card says "Unable to load updates".

---

## Servers

The Servers page is where you manage all your Minecraft servers.

![Servers](../images/servers.png)

### Server List

A summary panel at the top of the page shows a **Live** / **Reconnecting** indicator and the **+ Create Server** button. Below it, three cards show **Total servers**, **Running servers**, and **Needs attention** (stopped or unhealthy servers). Then the page displays all configured servers as cards in a grid layout. Each server card shows:

- **Server name** (e.g., `botagent`, `factory`, `wild-deity`)
- **Status badge** -- `Running` (green), `Stopped` (red), or `Created` / `Not Created`
- **Hostname** -- the primary address (the LAN nip.io address when the server has one) with the number of additional hostnames (e.g., `botagent.192.168.1.10.nip.io +2`) -- click the `+2` chip to list all hostnames
- **Container name** (e.g., `mc-botagent`)
- **Quick action button** -- Start (play) for stopped servers or Stop for running servers, in the bottom-right corner

### Filtering and Search

Above the cards, you can filter servers by status:

- **ALL** -- Show all servers
- **RUNNING** -- Show only running servers
- **STOPPED** -- Show only stopped servers

A **Search servers...** box on the right allows you to filter servers by name in real time. The number of matching servers is shown below the filters.

### Creating a New Server

![Create Server dialog](../images/server-create-dialog.png)

Click the **+ Create Server** button in the page header to open the **Create New Server** dialog. The dialog guides you through:

1. **Server Name** -- A unique identifier: 2-32 characters of lowercase letters, numbers, and hyphens, starting with a letter and not ending with a hyphen, without `--`. `router` is reserved
2. **Server Type** -- Choose a category with the toggle:
    - **Standard Server** -- Pick a **Server Type** (VANILLA, PAPER, FABRIC, FORGE, or NEOFORGE) and a **Minecraft Version** (e.g., `1.21.1` or `LATEST`). The defaults are VANILLA and `LATEST`. For other types, pin a version such as `1.21.1` if the loader doesn't support the newest Minecraft release yet
    - **Modpack** -- Search Modrinth modpacks by name (or type a slug such as `cobblemon`), then choose a **Mod Loader** and a compatible **Minecraft Version**. Client-only mods that are detected are added to **Exclude mods (optional)** automatically; you can edit that comma-separated list
3. **World Setup** -- **Default World**, **Seed** (enter a seed), or **Existing World** (pick an unassigned world)
4. **Memory** -- How much RAM to assign (default `4G` for standard servers, `6G` for modpacks)
5. **Sudo Password** -- Required for mDNS hostname registration (avahi). If you leave it empty, **Create** asks you to confirm: choose **Continue without password** when sudo on the host doesn't ask for one, or **Enter password** to go back to the field
6. **Auto-start after creation** -- Start the server as soon as it is created

Click **Create** to start. The dialog waits for mcctl-api to create the server, then steps through a progress view (**Initializing**, **Creating**, **Configuring**, **Starting**). It ends with one of:

- **Server Created Successfully**
- **Server Created with a Warning** -- The server exists, but its first start failed or is still running in the background (for example while the image is pulled). The dialog stays open and shows the reason; start or check the server from its detail page
- **Creation Failed** -- The error is shown on the Servers page

### Server Detail Page

Click on any server card to open the detailed server management view. The detail page features:

#### Header Section

- An **All servers** button to go back to the list
- The server name with a **Switch server** button next to it, which lists your servers (a green dot marks running ones) and opens the one you pick
- Chips for the current state (e.g., `Running`, `Exited`), the health (e.g., `Healthy`, `Unhealthy`, or `Unknown` when the container has no health check), the server type and the Minecraft version, and a **Reconnecting** chip while the real-time connection is being restored
- The hostname (with a copy button and the number of additional hostnames) and the uptime
- **Start** for a stopped server, or **Stop** and **Restart** for a running server
- A **⋮** menu with **Delete Server**. The confirmation dialog requires you to type the server name, and the deletion cannot be undone. A running server is stopped and removed. The dialog also asks what to do with the world: **Keep the world (move to worlds/)** is the default and moves the server's world to `worlds/` (a world already in `worlds/` is just unassigned); **Delete the world inside the server too** removes the server's own world. Worlds in `worlds/` are never deleted. If the deletion fails (for example `worlds/<name> already exists`), nothing is deleted and the error is shown in the page
- The delete dialog has an optional **Sudo Password** field, used to remove the server's `<name>.local` entry from `/etc/avahi/hosts`. Leave it empty on hosts where sudo needs no password. The password is used only for this request and is cleared when the dialog closes. If the hostname entry or some files could not be removed, the dialog changes to **Server deleted** and shows the warning; **Close** returns to the server list

#### Navigation Tabs

The server detail page is organized into ten tabs, each with an icon. The **Players** tab shows the number of online players, and the **Mods** tab shows the number of installed mod files once the Mods tab has loaded them. To open a tab directly, add `?tab=<Tab>` to the URL, for example `/servers/survival?tab=Options`.

| Tab | Description |
|-----|-------------|
| **Overview** | Server console with live log output and RCON command input, plus settings, online players, and connection details |
| **Players** | Online + offline player roster with management actions and a per-player detail view (v2.27.0+) |
| **World** | The assigned world's info, BlueMap web map, ore & block statistics, and player locations |
| **Activity** | Per-server audit history showing all actions performed on this server |
| **Mods** | Mod management -- search, install, and remove mods from Modrinth |
| **Files** | Full file manager for browsing, editing, uploading, and downloading server files |
| **Config History** | Timeline of server configuration snapshots with compare, restore, and delete |
| **Backups** | Config Snapshots and World Backups for this server |
| **Access** | User permission management -- grant, modify, or revoke access per user |
| **Options** | Server configuration editor with hostname management and game settings |

#### Resource Monitoring

Above the tabs, three cards display resource usage:

- **CPU usage** -- Current CPU utilization with one decimal, marked **High** from 70% and **Critical** from 90%
- **Memory usage** -- RAM in use against the allocated memory (`used / allocated`, in GB), with the percentage and the same **High** / **Critical** marks
- **World size** -- The disk space used by the current world, with the world name

Without resource statistics (for example while the server is stopped), the CPU and memory cards show `—` and "No data".

### Overview Tab

The Overview tab is the default view when you open a server's detail page. It serves as a real-time command center for monitoring and interacting with your server.

![Server Overview](../images/server-overview.png)

#### Console

The centerpiece of the Overview tab is the **Console** panel, which provides direct access to the server's live log output and command interface:

- **Live Log Stream** -- The console displays server log messages in real time, including timestamped entries for server events such as world loading, player connections, and game state changes. Each log line includes the timestamp and log level (e.g., `INFO`) for easy troubleshooting. Lines are colored by event: errors red, warnings amber, players joining green, players leaving blue, and the startup "Done" line green. RCON housekeeping lines are filtered out, and the header shows a **Connected** / **Disconnected** indicator for the log stream.
- **Command Input** -- At the bottom of the console, type a command after the `>` prompt (e.g., `say Hello!`, `gamemode creative Player1`, `time set day`) and press Enter or click **Send** to run it through RCON. The chips below the field (`/list`, `/tps`, `/save-all`, `/say`, `/whitelist list`) put a command into the field. The RCON reply to a command is not shown: the console shows only what the server writes to its log. The field is disabled while the server is not running or the log stream is connecting or reconnecting, and the reason is shown below it. If a request fails, the error is shown below the field.
- **Toolbar** -- The panel header has **Jump to latest** (shown when you have scrolled up), **Download logs** (saves the lines the console holds as `<server>-console.log`), **Clear console (screen only)**, and **Expand console**.
- **Auto-Scroll** -- The console follows new log entries while you are at the bottom. Scroll up to read older lines; **Jump to latest** takes you back.
- **Expanded Console** -- **Expand console** opens a full-screen **Console - `<server>`** dialog with a log level filter (**ALL**, **INFO**, **WARN**, **ERROR**), **Auto-scroll** and **Hide RCON** checkboxes, a clear-logs button, a **Reconnect** button when disconnected, **Quick** command buttons (`say`, `give`, `tp`, `gamemode`), and an **Enter command...** input with a **Send** button. Use the Up and Down arrow keys in the input to repeat commands sent in the dialog. The dialog does not show the RCON reply either.

!!! tip "Console Commands"
    The console supports all standard Minecraft server commands. You do not need to prefix commands with `/` -- simply type the command name and its arguments directly (e.g., `whitelist add Player1`).

#### Settings

The **Settings** panel below the console lists what the header does not show:

| Field | Description |
|-------|-------------|
| **Container** | The Docker container name (e.g., `mc-botagent`) |
| **Memory allocation** | The allocated memory (e.g., `4G`) |
| **World** | The world the server uses |

The server name, type, Minecraft version, hostname, and uptime are in the [header](#header-section).

#### Players

The **Players** panel shows the `online / max` player count and one row per online player, with the player's avatar and **OP** and **Whitelisted** badges. Click a row to open the [player detail modal](#player-detail-modal). When nobody is online, it shows "No players online".

#### Connection

The **Connection** card shows how clients can reach the server:

- **Addresses** -- Every hostname of the server with port `25565` and a copy button, labeled by kind: **LAN**, **Tailscale / VPN**, **nip.io**, **External** (your own domain), or **mDNS** (`.local`). LAN addresses are listed first
- **External Address** -- The playit.gg domain assigned to this server (with a copy button), or `Not configured`. This row appears when playit.gg is enabled

Copy buttons also work when the console is opened over plain HTTP from another machine, and show a message if copying fails.

### Server Console Page

The **Console** button on a running server in the Dashboard opens `/servers/<name>/console`, a full-page console for that server. The header shows the connection state (**Connected**, **Connecting**, or **Disconnected (Retry N)**), a breadcrumb (**Servers** › server name › **Console**), and a back button to the server's detail page. The console itself works like the [expanded console](#console): log level filter, **Auto-scroll**, **Hide RCON**, **Quick** command buttons, and a command input with history. It does not show the RCON reply to a command.

### Players Tab

*Available since v2.27.0.*

![Server Players](../images/server-players.png)

The **Players** tab lists every player known to the server, not just those currently online. It combines two sources:

- **Online players** -- queried live via RCON while the server is running
- **Known players** -- read from the server's files (`usercache.json`, `playerdata/`, `ops.json`, `whitelist.json`, `banned-players.json`)

Because the file-based part does not need RCON, the roster is also shown when the server is **stopped** (everyone then appears as Offline). The list updates in real time over SSE; the dot next to the `online / max` counter in the header shows whether the live connection is active.

Each row shows the player's avatar (from `mc-heads.net`), name, and badges:

| Badge | Meaning |
|-------|---------|
| **Online** / **Offline** | Current connection state |
| **OP** | Player is a server operator |
| **Banned** | Player is on the ban list |
| **Whitelisted** | Player is on the whitelist |

Offline players also show **Last saved**, the time their player data was last written by the server.

#### Player Actions

Click the **⋮** menu on a row to manage the player. Only the actions that apply to the player's current state are shown:

| Action | Shown when | Notes |
|--------|------------|-------|
| **Details** | Player has a UUID | Opens the player detail modal (see below) |
| **Kick** | Player is online | Confirmation dialog with optional reason |
| **Ban** / **Unban** | Not banned / banned | Ban asks for a reason (default: `Banned by administrator`) |
| **Make OP** / **Remove OP** | Not OP / OP | Make OP grants permission level 4 |
| **Add to Whitelist** / **Remove from Whitelist** | Not whitelisted / whitelisted | |

!!! note "Players tab vs. Players page"
    The Players tab manages the players of a single server from its detail page. The [Player Management](#player-management) page, reached from the top navigation bar, offers the whitelist/ops/ban lists with a server selector.

#### Player Detail Modal

![Player Detail](../images/player-detail.png)

Select **Details** in the action menu to open the player detail modal. The header shows the avatar, name, UUID, and the same badges as the list. The body has three sections:

**Statistics** -- values as last saved by the server (from `stats/<uuid>.json` and `advancements/<uuid>.json` in the world folder):

| Stat | Description |
|------|-------------|
| Play Time | Total in-game play time (`Xh Ym`) |
| Deaths | Number of deaths |
| Mob Kills / Player Kills | Kill counts |
| Distance Traveled | Total distance (m / km) |
| Blocks Mined | Total blocks mined |
| Items Crafted | Total items crafted |
| Advancements | Completed advancements |

If the player has no stats file yet, "No statistics recorded yet." is shown.

**Position & Status** -- parsed from the player's `playerdata/<uuid>.dat`:

- Coordinates (X / Y / Z) and dimension
- Health and food (out of 20), XP level, game mode
- Inventory summary: slots used and up to 10 item stacks

While the player is online and the server is running, the position is read live via RCON and labeled **Live position** with a **Live** badge. The modal refreshes every 5 seconds while the player is online. Offline players show **Last saved position** instead.

**Session History** -- join/leave history collected from server logs:

- **Visits**, **Total Playtime**, and **Last Seen**
- The most recent sessions (up to 20, newest first) with join → leave time and duration; a session that is still open shows **Online now**

!!! warning "Session history starts when the collector is installed"
    Session history is not read from the world files. mcctl-api parses each running server's Docker logs (`<player> joined/left the game`) every 30 seconds and stores the events in `data/players.db` (SQLite, under the platform root). History therefore only exists **from the time mcctl-api v2.27.0+ first runs the collector**. On its first pass for a server, the collector backfills at most the **last 24 hours** of that container's logs; older sessions are not recovered. After that it resumes from a per-server cursor, so a gap (for example, while mcctl-api was stopped) is filled in only if those lines are still in the container's logs — logs of a recreated container are lost. When a server is found stopped, its open sessions are closed at that time.

    Until data is collected, the section shows "No sessions recorded yet (history is collected from server logs)."

### World Tab

![Server World](../images/server-world.png)

The **World** tab shows the world assigned to the server. If no world is assigned, it shows "No world is assigned to this server." The same panel opens as **World Details** when you click a world card on the [Worlds](#worlds) page. It contains:

- **Header** -- The world name with **Overworld**, **Nether**, and **End** chips. A chip is filled when the world contains that dimension
- **Info cards** -- **Seed**, **Spawn**, **Game Mode**, **Difficulty** (with "(Hardcore)" when applicable), **Day**, **Version**, **Size**, **Border**, **Regions**, and **Weather**. Click the Seed or Spawn card to copy its value
- **Map** -- The BlueMap web map (see below)
- **Ore & Block Stats** -- Block statistics for the whole world (see below)
- **Players** -- Each known player with an `online` / `offline` chip, name, coordinates (click to copy), and dimension. Online players use live positions; offline players use the last saved position, and a notice says so when nobody is online

#### Map

![World Map](../images/world-map.png)

**Render map** generates a BlueMap web map of the world, and **Re-render** refreshes it. The render runs in a Docker container limited to 2 GB of memory; the first render also builds the BlueMap image. The map is embedded right below the buttons, with a progress bar while rendering. The map opens on the **Overworld** by default (Nether and End remain selectable in the viewer). Worlds rendered before v2.29.0 pick this up on **Re-render**. After a render, **Show structures** marks structures on the map; you can toggle the structure types in the BlueMap legend.

#### Ore & Block Stats

![World Stats](../images/world-stats.png)

**Analyze** scans every chunk of the world (it can take minutes on large worlds; progress is shown) and caches the result, and **Re-analyze** refreshes it. The panel shows when the world was last analyzed, followed by:

- **KPI cards**: total blocks, block types, regions scanned, analysis time, dimensions
- **Ores**: a donut chart with a legend (count and share), highlight chips for rare ores (gold, diamond, emerald, ancient debris), and a **Merge stone/deepslate variants** toggle
- **Top blocks**: a stacked bar by category (Stone, Earth, Wood, Fluid, Nether, Other) and a top-5 list that **Show all** expands

### Activity Tab

![Server Activity](../images/server-activity.png)

The **Activity** tab shows the audit history of this server in the same table as the [Audit Log](#audit-log) page, without the Target column:

- An **Action** dropdown (**All Actions** or a specific server action) and a status toggle (**ALL**, **SUCCESS**, **FAILURE**)
- Rows per page of 25 or 50
- A **View Full History** link that opens the Audit Log page already filtered to this server

### Mods Tab

The Mods tab provides a complete mod management interface for servers running modded platforms (FORGE, NEOFORGE, FABRIC). This tab allows you to browse, install, and remove mods directly from the [Modrinth](https://modrinth.com/) repository without manual file management.

![Server Mods](../images/server-mods.png)

!!! note "Modded Servers Only"
    The Mods tab is most useful for modded server types (FORGE, NEOFORGE, FABRIC). While the tab is visible for all servers, mod installation requires a compatible server platform.

#### Installed Mods

The **Installed Mods** card lists the mods you added, grouped under their source (e.g., `Modrinth`). Each entry shows:

- **Mod icon** -- The mod's thumbnail image from Modrinth
- **Mod name** -- The display name of the mod (e.g., `Create`)
- **Description** -- A brief summary of what the mod does (e.g., "Aesthetic Technology that empowers the Player")
- **Download count** -- The total number of downloads on Modrinth (e.g., `12.6M`), indicating the mod's popularity
- **Author** -- The mod creator's username (e.g., `simibubi`)
- **View on Modrinth** button (external link icon) -- Opens the mod's page on Modrinth in a new tab for detailed information, changelogs, and documentation
- **Remove** button (red trash icon) -- Removes the mod from the server's mod list immediately, without a confirmation prompt

When no mods have been added, the card says "No mods installed".

#### Adding New Mods

Click the **+ Add Mods** button in the top-right corner of the Installed Mods card to open the **Search Mods** dialog:

1. Type a mod name or keyword in **Search Modrinth...** -- results appear as you type
2. Review each result's icon, title, description, download count, and author
3. Click **Add** to add the mod. Mods that are already on the server show **Installed**

#### Installed Jar Files

For servers created from a modpack, the **Installed Jar Files (from modpack)** card lists every `.jar` in the mods directory. Use the **Included** / **Excluded** switch on a row to exclude a mod from the next install -- handy for client-only mods that crash a dedicated server. Before the modpack is first installed, the card says "No jar files found in the mods directory."

!!! warning "Server Restart Required"
    After adding or removing mods, or changing the exclude list, you need to restart the server for the changes to take effect. The tab shows a "Restart the server to apply mod changes." notice when a change is made.

### Files Tab

The Files tab provides a full-featured file manager for your server's file system.

![Server Files](../images/server-files.png)

#### File Browser

The file browser displays the contents of the server's data directory in a familiar list layout:

- **Breadcrumb navigation** at the top shows your current path (e.g., `root /`) and lets you click to jump to parent directories
- **Search files...** box to filter files by name within the current directory
- Each file entry shows the file name, size, and last modified date
- **Folders** are listed first, followed by files

#### File Operations

The toolbar provides several actions:

| Action | Description |
|--------|-------------|
| **Upload** | Upload files to the current directory via a drag-and-drop dialog |
| **New Folder** | Create a new directory in the current path |
| **Refresh** | Reload the file listing |

The **⋮** menu at the end of each row provides:

- **Open** -- Open a folder (folders only)
- **Edit** -- Open an editable file in the editor (text files only)
- **Download** -- Download the file to your local machine (files only)
- **Rename** -- Change the file or folder name
- **Delete** -- Remove the file or folder after a confirmation dialog. For critical files you must type the file name to confirm

#### Smart File Editors

The file manager includes intelligent editors that adapt to the file type:

- **server.properties** -- Opens a specialized editor with a **Form** view (categorized, searchable fields) and a **Raw** view (plain text)
- **Player data files** (whitelist.json, ops.json, banned-players.json) -- Opens a dedicated player editor with Mojang API integration for username lookup
- **Text files** (.txt, .md, .json, .yml, .yaml, .properties, .cfg, .conf, .ini, .toml, .xml, .csv, .log, .sh, .bat) -- Opens a code editor with syntax awareness
- **Other files** -- Available for download only

!!! warning "Editing server.properties"
    The `server.properties` editor changes the file of the running server directly. Those edits do not survive recreating the server container. For persistent settings, use the [Options tab](#options-tab).

### Config History Tab

![Config History](../images/server-config-history.png)

The **Config History** tab keeps a timeline of configuration snapshots for this server. A snapshot captures the server's configuration files (`server.properties`, `config.env`, etc.), so you can compare versions and roll back. The same snapshots are also available on the [Backups](#backups) page.

- **Create Snapshot** -- Save the current configuration. Add an optional description such as "Before modpack update"
- **Timeline** -- Snapshots are listed newest first and grouped by date. Each entry shows its time, a **Scheduled** chip if a schedule created it, its description (or "No description"), and its file count
- **View diff** -- Compares a snapshot with the previous one
- **Restore** -- Rolls the configuration back to that snapshot
- **Delete** -- Click the trash button, then click **Confirm** within three seconds
- **Compare** -- Appears once there are two or more snapshots. In compare mode, select any two snapshots and click **View Diff**
- **Load More** -- Loads older snapshots when the list is long

The **Config Diff** dialog shows **Snapshot A** vs. **Snapshot B** with a file tree on the left, a **Unified** / **Split** view switch, and a summary of modified, added, and deleted files. In this tab it also offers **Restore to Snapshot A**.

The **Restore Configuration** dialog lists the changes that will be applied and keeps **Create safety snapshot before restoring (recommended)** checked by default. If the server is running, it warns that a restart may be required for the changes to take effect.

### Backups Tab

![Server Backups](../images/server-backups.png)

The **Backups** tab of a server has two sub-tabs:

- **Config Snapshots** (default) -- The snapshot summary card for this server (latest snapshot, file count, total snapshots, schedule status) with **View History**, **Create Snapshot**, and **View Diff** buttons. **Manage Schedules** opens the schedule panel described under [Config Snapshots](#config-snapshots)
- **World Backups** -- The platform-wide world backup view: **Push Backup**, backup status, backup schedules, and backup history, exactly as on the [Backups](#backups) page

### Access Tab

![Server Access](../images/server-access.png)

The **Access** tab controls which users can work with this server. Each row shows the user's avatar, name, email, and a permission badge:

| Permission | Meaning (as described in the grant dialog) |
|------------|--------------------------------------------|
| **Viewer** | Can view server status and logs |
| **Operator** | Can start, stop, and configure the server |
| **Owner** | Full control including managing other users |

- **Add User** opens the **Add User Access** dialog. Search by name or email (type at least 2 characters), choose a **Permission Level**, and click **Add User**
- The **⋮** menu on a row offers **Change to Owner**, **Change to Operator**, **Change to Viewer**, and **Remove Access**. The last Owner of a server cannot be demoted or removed
- Only platform admins and server Owners can manage access. Platform admins can see every server; other users see only the servers they have been granted

### Options Tab

The Options tab provides a comprehensive configuration editor for your server.

![Server Options](../images/server-options.png)

#### Hostnames / Domains

At the top of the Options tab, the **Hostnames / Domains** card shows all the hostnames configured for routing connections to this server:

- **System Hostnames (read-only)** -- Automatically generated hostnames (e.g., `botagent.local`, `botagent.192.168.xx.xx.nip.io`)
- **Custom Domains** -- User-defined custom domain names, each with a remove button. The server's playit.gg domain, if it has one, is listed here with a **playit** chip: removing it clears the server's playit.gg domain, and replacing it with exactly one new domain in the same save makes that domain the playit.gg domain
- **+ Add Domain** button to enter an additional custom hostname. Domains ending in `.local` or `.nip.io` are reserved for system hostnames
- A **Save Hostnames** button to store the list. Hostname changes only take effect after the server container is recreated: stop the server and start it again (**Restart** does not apply them), or run `docker compose up -d`

#### Settings Sections

Below the hostnames, the settings are grouped into cards. Each card shows its essential fields first; a **Show Advanced Settings (N)** toggle at the bottom of the card reveals its additional fields:

| Section | Essential fields |
|---------|------------------|
| **Gameplay** | Difficulty (Peaceful, Easy, Normal, Hard), Game Mode (Survival, Creative, Adventure, Spectator), Max Players, Enable PvP |
| **World** | MOTD (Message of the Day), World Name, Level Type (Default, Flat, Large Biomes, Amplified, Buffet), World Seed |
| **Security** | Online Mode (Mojang Auth), Enable Whitelist |
| **Performance & JVM** | Memory, Aikar's Flags, View Distance |
| **Auto-pause / Auto-stop** | Enable Auto-pause, Pause Timeout |
| **System** | Timezone, Resource Pack URL, Enable RCON |
| **Remote Access** | Enable WebSocket Console, Enable SSH Console |
| **Configuration Repositories** | Git repository URLs for `server.properties` and for the Paper, Pufferfish, and Purpur configs (applied at startup) |

Advanced fields include, for example, Hardcore, Allow Flight, and Spawn Protection in Gameplay; Simulation Distance, Initial Heap, Max Heap, and JVM -XX Options in Performance & JVM; Enable Auto-stop in Auto-pause / Auto-stop; and RCON Password, RCON Port, UID, and GID in System.

#### Save and Restart

When you modify settings:

1. A **sticky action bar** appears at the bottom of the page showing "N unsaved changes" (and, if needed, which fields require a restart)
2. Click **Save Changes (N)** to apply the changes
3. If the server is running and any changed setting requires a restart (e.g., memory, online mode, world settings), a **Restart Required** dialog appears with **Save Only**, **Save & Restart**, and **Cancel**
4. Click **Discard** to drop unsaved changes

!!! warning "Restart Required"
    Some settings (like memory allocation, online mode, and world seed) require a server restart to take effect. The UI clearly indicates which settings need a restart after being changed.

#### Danger Zone

At the bottom of the Options tab, the **Danger Zone** card contains **Reset World**, which permanently deletes the current world and generates a new one. The button is disabled while the server is running ("Stop the server first"), and the confirmation dialog requires you to type `RESET`. This action cannot be undone.

---

## Player Management

The Players page provides comprehensive management of players across all your servers.

![Player Management](../images/players.png)

### Server Selector

At the top of the page, a **Server** dropdown lets you select which server to manage. The selected server determines which data is displayed in the **Whitelist**, **Operators**, and **Ban List** tabs below. Two cards above it show the number of available and running servers.

### Tabs

The Player Management page is organized into four tabs:

#### Online Players

Lists the players currently connected, grouped by server, with a **Kick** action (optional reason). This tab covers all servers and does not depend on the Server dropdown. Use the refresh button to reload the list.

#### Whitelist

Manage which players are allowed to join your server:

- **Whitelist toggle** -- Enable or disable the whitelist (shown as an ON/OFF switch)
- **Player input field** -- Enter a Minecraft username to add to the whitelist
- **Add button** -- Add a single player
- **Bulk button** -- Switch to a multi-line input (`player1, player2, player3`) and add several players at once with **Add All**
- **Player list** -- Shows all whitelisted players with their Minecraft avatar and a remove button. A search box appears once the list has five or more players

!!! info "Offline Server Data"
    When a server is offline, the Players page reads data directly from the server's files (whitelist.json, ops.json, banned-players.json). An informational banner indicates: "Server is offline. Showing data from whitelist.json. Changes will apply on next server start."

#### Operators

Manage players with operator (admin) privileges:

- Add players as operators with configurable permission levels (1-4)
- **Level 1**: Can bypass spawn protection
- **Level 2**: Can use /clear, /gamemode, etc.
- **Level 3**: Can use /ban, /kick, /op, etc.
- **Level 4**: Can use /stop, full access

An information panel on the right explains each OP level in detail.

#### Ban List

Manage banned players:

- Ban players by username with an optional reason
- View all currently banned players
- Pardon (unban) players with a single click
- An information panel explains how bans work

---

## Worlds

The Worlds page lets you manage all Minecraft worlds stored in your platform.

![Worlds](../images/worlds.png)

### World List

The page header shows the **+ Create World** button and three cards: **Total worlds**, **Assigned worlds**, and **Free worlds**. Worlds are displayed as cards in a grid layout. Each world card shows:

- **World name** (e.g., `Wild-Deity`, `botagent`, `factory`)
- **Status badge** -- `Available` (green) for unassigned worlds, `Assigned` for worlds currently assigned to a server. A red **Assigned to N servers** chip appears when an older install has several servers on the same world
- **Size** -- Disk space used by the world (e.g., `610.2MB`, `20.5MB`), plus **Overworld** / **Nether** / **End** chips when the world has more than one dimension
- **Servers** -- The servers using the world, or "No servers". An assigned world also shows which server it is assigned to
- **Date** -- When the world was last modified
- **Action buttons**:
    - **Assign** (link icon) -- Assign an available world to a server
    - **Release** (unlink icon) -- Switch the server using the world back to its own default world (the world is kept in `worlds/`)
    - **Delete** (red trash can icon) -- Delete the world

Click the body of a card to open **World Details**, which shows the same panel as the server [World tab](#world-tab) (info cards, map, ore & block stats, and player locations).

### Filtering and Search

At the top of the list:

- **ALL** -- Show all worlds
- **AVAILABLE** -- Show only available (unassigned) worlds
- **ASSIGNED** -- Show only worlds currently assigned to a server

A **Search worlds...** box lets you filter worlds by name.

### Assignment Warnings

If an older install has two servers on the same world, or a server's `config.env` cannot be read, a warning alert at the top of the page lists each problem. Nothing is fixed automatically: assign another world to all but one of the servers. Until a server's `config.env` is fixed, assigning, releasing and deleting worlds are refused.

### Creating a New World

![Create World dialog](../images/world-create-dialog.png)

Click **+ Create World** in the page header to open the **Create New World** dialog:

1. Enter a **World Name** (letters, numbers, hyphens, and underscores)
2. Optionally specify a **Seed** (leave it empty for a random seed)
3. Click **Create**

To bring in an existing world instead, drop a `.zip` file on the **Upload world .zip (optional)** area (or click it to choose a file). The **Seed** field disappears and the button changes to **Import**. The **Server type** dropdown does not affect the result; it only changes the on-screen guidance for how to zip the world:

- VANILLA, FORGE, NEOFORGE, FABRIC, QUILT -- Zip the world folder (it must contain `level.dat`; the Nether and End are inside it). Some modpacks store them as `<world-name>_nether` and `<world-name>_the_end`; if so, zip all three folders together
- PAPER, SPIGOT, BUKKIT -- Zip `<world-name>`, `<world-name>_nether`, and `<world-name>_the_end` together; leaving one out loses that dimension

### Assigning a World to a Server

Click the **Assign** (link) icon on an available world card to open the **Assign World** dialog. Select a server in **Select Server**; stopped servers are listed under **Available Servers**. Running servers appear under **Running Servers (stop them first)** and cannot be selected. Click **Assign**. The server's `LEVEL` is set to the world and the card is marked `Assigned`.

A world can be used by one server only, and the server must be stopped. To switch a server back to its own default world, click the **Release** icon on the assigned world's card; the server must be stopped for this too.

### Deleting a World

Click the **red trash can icon** on a world card. A **Delete World** dialog appears requiring you to type the exact world name to prevent accidental deletion. This action is irreversible. A world that a server uses cannot be deleted: assign another world to that server first.

!!! warning "Data Loss"
    Deleting a world permanently removes all world data including terrain, player builds, and entities. Always create a backup before deleting a world.

---

## Backups

The Backups page manages world backups, automated backup schedules, and server configuration snapshots. A chip in the header shows whether backups are `Configured`.

![Backups](../images/backup.png)

The page has two tabs: **World Backups** (default) and **Config Snapshots**. The selected tab is kept in the URL (`/backups?tab=config-snapshots`).

### World Backups

#### Backup Status

The **Backup Status** card shows the current backup configuration:

- **Status** -- Whether the backup system is `Configured` (green checkmark) or `Not Configured`. When it is not configured, the card asks you to set `BACKUP_GITHUB_REPO` and `BACKUP_GITHUB_TOKEN`
- **Repository** -- The configured Git repository for backup storage (e.g., `smallmiro/minecraft-worlds-backup`)
- **Last Backup** -- When the last backup ran (e.g., "5 minutes ago"), or "No backups yet"

#### Push Backup

The **Push Backup** button in the page header triggers an immediate manual backup of all worlds to the configured Git repository. A dialog lets you enter an optional **Commit Message** (prefilled with `Backup <date>`), then click **Push**.

A push stops if a world that was in the last backup no longer exists, so a world deleted by mistake is not dropped from the backup. If you deleted it on purpose, check **Remove worlds I deleted on purpose from the backup** before clicking **Push** (the same as `mcctl backup push --allow-missing`).

#### Backup Schedules

The **Backup Schedules** card manages automated cron-based backup scheduling:

- Each schedule shows its **name**, a human-readable frequency (e.g., "Every hour"), and the cron expression
- A last-run chip (**OK** or **Failed**) -- hover for the time and message
- **Retention** badge -- indicates whether backup retention policies (maximum count or age) are configured
- **Toggle switch** -- Enable or disable individual schedules
- **Edit button** (pencil icon) -- Modify the schedule
- **Delete button** (trash icon) -- Remove the schedule
- **+ Add Schedule** button to create new automated backup schedules (name, frequency preset or custom cron expression, maximum backup count, and maximum age in days)

#### Backup History

The **Backup History** card (visible when the backup system is configured) lists past backups with the commit hash, date, message, and author. The restore button on a row opens **Restore Backup**, which warns that all worlds will be restored from the selected backup and that current world data will be overwritten. Stop all servers first: a restore is refused while any server is running ("Stop all servers before restoring").

### Config Snapshots

The **Config Snapshots** tab manages configuration snapshots for every server at once. It lists one card per server with:

- The latest snapshot ("Latest: 2h ago"), its file count, and the total number of snapshots (or "No snapshots yet")
- A schedule chip: **Schedule: Active**, **Schedule: Paused**, or **No schedule**
- **View History** (needs at least two snapshots), **Create Snapshot**, and **View Diff** (shown when the server has two or more snapshots; compares the latest two)

The header has two buttons:

- **Create Snapshot** -- Opens **Create Config Snapshot**. Choose the **Server**, optionally add a description (e.g., "Before modpack update"), and click **Create Snapshot**
- **Manage Schedules** -- Opens the **Config Snapshot Schedules** panel. Click **Add Schedule** and fill in **Server**, **Schedule Name**, **Cron Preset** (Every hour, Every 6 hours, Daily at midnight, Daily at 3 AM, Weekly, or Custom) or a **Cron Expression**, and **Retention Count** (the maximum number of scheduled snapshots kept per server). Existing schedules can be enabled or disabled with a switch, edited, or deleted

To work with a single server's snapshot timeline -- compare, restore, delete -- use the server's [Config History tab](#config-history-tab).

---

## Audit Log

The **Audit** page (`/audit-logs`) lists the management actions recorded by mcctl-api and the CLI. It has a **Live** / **Disconnected** indicator with a "new logs available" banner, four summary cards, filters, a table with expandable rows and a detail drawer, and CSV / JSON export (up to 5,000 rows).

![Audit Log](../images/audit-log.png)

In the **Actor** column, actions done in the web console show `console` (recorded as `api:console`); only Platform Settings changes and file operations record the signed-in user's name. CLI commands show `local`.

See the [Audit Log Web Console Guide](audit-log-ui.md) for the filters, the table, the detail drawer, and export.

---

## Routing

The Routing page shows how players reach your servers through mc-router. The header shows the router's container status and how many servers and hostnames are routed (for example "3 servers · 8 hostnames"). Administrators also see a **Restart mc-router** button there (see [Restarting mc-router](#restarting-mc-router)).

![Routing](../images/routing.png)

### Routing Table

The **Routing Table** panel has one row per server. A collapsed row shows:

- The server name with its type and Minecraft version
- The primary address with its type badge and a copy button, and `+N` for the server's other hostnames. The primary address is the first routed hostname in the order nip.io, mDNS, WAN, Custom
- The status (e.g. **Running**, **Sleeping · wakes on connect**) and an **N not routed** warning when mc-router does not know some of the server's hostnames
- **Wake** (or **Start**) for a stopped server, **Edit hostnames** (opens the server's [Options tab](#options-tab)), and **Open server**

Click a row (or its arrow) to list all of that server's hostnames, each with a copy button, its type, and a **Not routed** warning if needed. Several servers can be open at once; **Expand all** / **Collapse all** opens or closes every server. The search box matches server names and hostnames. When a hostname matches, its server opens and the matching hostname is highlighted.

### Routing Flow

The **Routing Flow** diagram draws the current routes: the hostname types with their counts (mDNS, nip.io, WAN, Custom), then mc-router with its status and port, then up to eight servers with their status (`+N more` stands for the rest).

### Live Router Log

The **Live Router Log** panel follows the mc-router log. Each line shows the time, a kind (**CONNECT**, **WAKE**, **ERROR**, or **INFO**), the hostname and target server for connections and wake-ups (the log text for other lines), and the player name when the log line has one. The panel keeps the last 500 lines, has an **Auto-scroll** switch and a **Clear** button, and shows the stream state (**Connecting**, **Live**, **Disconnected**, or **Ended**).

### mc-router Gateway

The **mc-router Gateway** card shows the router container's status and health, the listening **Port**, **Active routes** (routes whose server is running, as `x / y`), and the **Container** name, **Mode** (e.g., `Auto Discovery`), **Uptime**, and **Image**. When the router's auto-scale settings can be read, it also shows **Auto-scale up**, **Auto-scale down**, **Idle time**, and a preview of the **Asleep MOTD** that a sleeping server shows in the server list.

### Hostname Resolver

The **Hostname Resolver** card lists the host IPs used for nip.io hostnames (marking the primary one **Primary**), an example nip.io address with a copy button, and the **mDNS (Avahi)** status. Avahi must be running for `.local` hostnames to resolve on the local network.

### Restarting mc-router

**Restart mc-router** in the page header is shown to administrators only. It asks for confirmation first: players connected through mc-router are disconnected and new connections fail until the router is back up; running servers are not stopped. The button is disabled when the router container does not exist.

### External Access (playit.gg)

The **External Access (playit.gg)** card manages playit.gg tunnel configuration for making your servers accessible from the internet without port forwarding:

- **Start Agent** / **Stop Agent** buttons for managing the playit agent, and a **View Dashboard** link to the playit.gg tunnels page
- **Agent Status** -- Running or Stopped, with the agent uptime
- **Server Domains** table showing which servers have external domains configured (e.g., `possible-tracks.gl.joinmc.link`), each with a copy button
- A list of servers without external domains

If playit.gg is not set up, the card shows "Not configured". Set `PLAYIT_SECRET_KEY` (for example with `mcctl playit setup`) to enable it.

---

## Navigation

The top navigation bar is consistent across all pages and includes:

![User menu](../images/navigation-user-menu.png)

| Item | Description |
|------|-------------|
| **Minecraft Console** logo | Click to return to the Dashboard |
| **Dashboard** | Infrastructure overview |
| **Servers** | Server management |
| **Worlds** | World management |
| **Players** | Player management |
| **Audit** | Activity audit logs |
| **Backups** | Backup management |
| **Routing** | Network routing configuration |
| **User avatar** (top-right) | Opens the user menu |

The currently active page is highlighted in the navigation bar.

The user menu shows your name and email (with an **Admin** chip for administrators) and offers:

| Menu item | Description |
|-----------|-------------|
| **Users** | [User Management](#user-management-admin) -- administrators only |
| **Settings** | [Account Settings](#account-settings) |
| **Logout** | End the session and return to the sign-in page |

The console always uses its dark theme; there is no theme toggle.

---

## Account Settings

![Account Settings](../images/settings.png)

Open **Settings** from the user menu to manage your own account. The page has three cards:

- **Profile** -- Edit your **Name** and click **Save Changes**. The **Email** is read-only ("Email cannot be changed"), and the **Role** (Admin or User) is shown for reference
- **Account Information** -- Your **Account ID**, **Created** time, and **Last Updated** time
- **Change Password** -- Enter your **Current Password**, a **New Password** (at least 8 characters, different from the current one), and **Confirm New Password**, then click **Change Password**. Other signed-in sessions are not signed out

---

## Platform Settings (Admin)

Administrators see an additional **Platform Settings** section on the **Settings** page, above the account cards. It edits the platform `.env` file. Non-admin users only see their own account cards and cannot read or change platform configuration; the API enforces this independently of the UI.

![Platform Settings](../images/platform-settings.png)

- **Bento cards** -- Settings are grouped into cards: Network & Routing, Server Runtime, RCON, Backup, External Access and Console & Logging. Each field uses a typed control (text, switch, select, number, IP list) with field-level validation
- **Secrets are write-only** -- Secret fields (`RCON_PASSWORD`, `BACKUP_GITHUB_TOKEN`, `PLAYIT_SECRET_KEY`, `BETTER_AUTH_SECRET`) show **Configured** or **Not configured**. The input is never pre-filled; typing a value marks the field changed
- **Console sign-in settings** -- **Console & Logging** holds `BETTER_AUTH_SECRET` (the console session secret; changing it signs everyone out) and `BETTER_AUTH_BASE_URL` (the console's public URL; see [Login Fails](#login-fails))
- **Runtime (PM2)** -- A read-only card shows `AUTH_MODE` from `ecosystem.config.cjs`, plus `BETTER_AUTH_BASE_URL` / `BETTER_AUTH_SECRET` (configured only) while an older ecosystem file still injects them. While the ecosystem defines them they win over `.env` and cannot be changed here; run `mcctl upgrade` to move them to `.env`
- **Advanced Environment** -- Unknown keys as key/value rows (add, edit, remove). Servers receive one only if its name is listed in `servers/global.env`
- **Legacy / Unused** -- Legacy keys with warning styling ("Not read by any current code."). Nothing is removed unless you remove it explicitly
- **Read-only network identity** -- `MINECRAFT_NETWORK`, `MINECRAFT_SUBNET` and `COMPOSE_PROJECT_NAME` are displayed with CLI guidance only

Server-specific values stay in each server's **Options** tab. A server's `config.env` overrides the platform value for that server, and the UI notes this on server-runtime keys. See [Environment Variables](../configuration/environment.md#setting-classification) for the full classification.

### Saving and Applying Changes

![Unsaved changes bar](../images/platform-settings-save-bar.png)

A sticky bar with **Discard** and **Save Changes** appears when any field is changed, and a chip above the cards counts the unsaved fields. **Saving only writes `.env`; it never restarts anything.** After saving, a **Restart required** dialog lists what needs to be restarted, per scope:

![Restart required dialog](../images/platform-settings-restart.png)

| Scope | What to do |
|-------|------------|
| Servers | **Stop, then start** each server (Servers page, or `mcctl stop <name> && mcctl start <name>`). **Restart does not reload `.env`.** mc-router auto-scale wakes an existing container with its old environment, so a recreate through start is required |
| Router | `mcctl router start` (not `restart`) |
| playit | Stop, then start the playit agent on the Routing page, or `mcctl playit stop && mcctl playit start` |
| API | `mcctl console service restart --api`. Settings backed by mcctl-api show a "restart pending" chip until it restarts |
| Console | `mcctl console service restart --console` (this also restarts mcctl-api). Nobody is signed out unless the session secret changed |
| Next create | Applies to servers created after this change. Existing server hostnames are unchanged |

If the file changed since you loaded the page (for example via the CLI), saving returns a **409 conflict** and a dialog asks you to reload. Your edits are never overwritten automatically.

### CLI Equivalents

| Card | CLI |
|------|-----|
| Network & Routing | `mcctl init --reconfigure` |
| Backup | `mcctl backup init` |
| External Access | `mcctl playit setup` |
| Runtime (PM2) | `mcctl console init` |

---

## User Management (Admin)

![User Management](../images/admin-users.png)

Administrators see a **Users** item in the user menu that opens the **User Management** page (`/admin/users`). Other users who open this page are redirected to the Dashboard.

- Three cards summarize **Total users**, **Administrators**, and **Banned users**
- The user directory lists each account's **Email**, **Name**, **Role** (Admin or User), **Status** (Active or Banned), and **Created At**
- Click a row to open **User Details** with the same fields plus the **User ID**

The page is read-only. To add users, change roles, or reset passwords, use the CLI (see [CLI Commands](cli-commands.md)):

```bash
mcctl console user add user@example.com --role user --password "SecurePass123"
mcctl console user update user@example.com --role admin
mcctl console user reset-password user@example.com
```

---

## Best Practices

### Security

1. **Use Strong Passwords** -- Follow the password requirements during `mcctl console init`
2. **Limit Access** -- Use the Access tab to grant minimal permissions to each user
3. **Use HTTPS** -- Configure a reverse proxy with SSL for production deployments, and set `BETTER_AUTH_BASE_URL` to the proxy's URL (see [Login Fails](#login-fails))
4. **Review Audit Logs** -- Regularly check the Audit Log for unexpected activity

### Server Management

1. **Monitor the Dashboard** -- Check server health, player counts, and recent activity regularly
2. **Graceful Shutdowns** -- Always use the Stop button instead of force-killing containers
3. **Backup Before Changes** -- Push a backup before modifying world data, and create a config snapshot before changing server configuration
4. **Use Scheduled Backups** -- Configure automated backup schedules for peace of mind

### Performance

1. **Avoid Simultaneous Operations** -- Don't start/stop multiple servers at once
2. **Monitor Resource Usage** -- Use the resource stat cards on the server detail page to track CPU and memory
3. **Clean Up Unused Worlds** -- Delete worlds that are no longer needed to free disk space

---

## Usage Analytics

In production mode, the web console sends anonymous usage data to Google Analytics 4 (GA4) so we can see which screens are used. Development mode (`pnpm dev`) never sends anything.

**What is sent:**

- An anonymous `installId` (random UUID), one per installation, sent as the GA `user_id`. It is unrelated to your accounts or hostnames.
- The normalized page path, such as `/dashboard`, `/servers/:name`, or `/servers/:name/console`
- The mcctl console version (`mcctl_version`)

**What is not sent:**

- The console's hostname or IP address (the page URL is rewritten to `http://mcctl-console.invalid/...` before sending)
- Server names, world names, or query strings
- Accounts or email addresses

!!! note
    Your browser sends the request to Google, so Google receives the connecting IP address. According to Google's documentation, GA4 does not log or store IP addresses.

### The installId

The `installId` is stored as `installId` in `<root>/.mcctl.json`. It is created once and never changes:

- New installation: created by `mcctl init`
- Upgrade: `mcctl upgrade` adds it only if it is missing (an existing value is kept)
- Package-only update with `mcctl update`: created and saved on the console's first request

`mcctl console init` and `mcctl update` print this notice when analytics is on:

```
Console usage analytics is on (anonymous install ID and page paths, sent to Google Analytics). To turn it off, set "telemetry": false in <root>/.mcctl.json.
```

### Turning It Off

=== "Option 1: .mcctl.json"

    Add `"telemetry": false` to `<root>/.mcctl.json` and keep the existing fields. It takes effect from the next page load, and no restart is needed.

    ```json
    {
      "telemetry": false
    }
    ```

=== "Option 2: DO_NOT_TRACK"

    Set `DO_NOT_TRACK=1` in the mcctl-console `env` in PM2's `ecosystem.config.cjs`, then recreate the PM2 processes so they read the new `env`. A plain `mcctl console service restart` keeps the environment PM2 already has.

    ```bash
    mcctl console service restart --console --force
    ```

    `--force` kills the PM2 daemon, so other apps managed by PM2 stop as well (see [`mcctl console service restart`](cli-commands.md#mcctl-console-service-restart)). `mcctl console init --force` writes a new `ecosystem.config.cjs` without this setting.

---

## Troubleshooting

### Can't Access the Console

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

1. **Verify Credentials:** Sign in with the email shown in the **Email** column:
   ```bash
   mcctl console user list
   ```

2. **Reset Password:** The sign-in page has no self-service reset, so use the CLI with the account's email:
   ```bash
   mcctl console user reset-password <email>
   ```

3. **Check the Address You Sign In From:** The console accepts sign-ins from `localhost`, private LAN addresses (`10.x`, `172.16.x`-`172.31.x`, `192.168.x`), `.local` names, and the URL in `BETTER_AUTH_BASE_URL` (default `http://localhost:<console port>`). From any other address, such as a Tailscale `100.x` address, a domain name, or an HTTPS reverse proxy, sign-in fails until `BETTER_AUTH_BASE_URL` is set to that URL in the platform `.env` (or in [Platform Settings](#platform-settings-admin)). Then restart the console:
   ```bash
   mcctl console service restart --console
   ```
   On installs whose `ecosystem.config.cjs` still defines `BETTER_AUTH_BASE_URL`, run `mcctl upgrade` first; until then the ecosystem value is used. The console sets secure cookies only when this URL starts with `https://`.

### Server Status Not Updating

1. **Check API Health:**
   ```bash
   curl http://localhost:5001/health
   ```

2. **Verify Docker Socket:**
   Ensure Docker is running and the mcctl-api process has access to the Docker socket.

3. **Check Network:**
   Ensure mcctl-console can reach mcctl-api on port 5001.

### Commands Not Working

1. **Server Must Be Running** -- RCON commands only work when the server is in a `running` state
2. **RCON Must Be Enabled** -- Ensure RCON is enabled in the server configuration
3. **Check API Logs:**
   ```bash
   pm2 logs mcctl-api --lines 100
   ```

---

## Mobile Access

The web console uses a responsive Material UI layout that adapts to different screen sizes:

- **Phone** -- Simplified card layout with collapsible navigation
- **Tablet** -- Full dashboard with optimized touch controls
- **Desktop** -- Full feature set with side-by-side panels

!!! tip "Mobile Tips"
    - Use landscape mode for better command input in the console
    - The navigation collapses into a hamburger menu on small screens
    - Most dialogs are full-screen on mobile for easier interaction
