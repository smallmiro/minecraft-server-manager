# CurseForge

Download mods and plugins from [CurseForge](https://www.curseforge.com/minecraft) - the largest mod hosting platform.

## Overview

| Feature | Value |
|---------|-------|
| Official Website | [https://www.curseforge.com/minecraft](https://www.curseforge.com/minecraft) |
| API Key Required | **No** (built in for Java 17+ images; set `CF_API_KEY` only for java8/pre-17 tags or your own key) |
| API Console | [https://console.curseforge.com/](https://console.curseforge.com/) |
| Dependency Resolution | Manual (metadata only) |
| Mod Library Size | Largest |

## Quick Start with mcctl

### Step 1: Get API Key

Skip this step on Java 17+ images, which include a key; new mcctl servers use `java25`. You need your own key only for `java8` and other pre-Java 17 tags, or to use your own.

1. Go to [CurseForge API Console](https://console.curseforge.com/)
2. Sign in and create an API key
3. Set the key on the server in Step 2, or for every server as in [Step 4: Configure API Key](#step-4-configure-api-key)

### Step 2: Create Server and Add Mods

```bash
# Create a Forge server
mcctl create modded -t FORGE -v 1.20.4

# Only with your own key (java8 and other pre-Java 17 tags, or your own key)
mcctl config modded CF_API_KEY '<your-api-key>'

# Add CurseForge mods
mcctl config modded CURSEFORGE_FILES "jei,journeymap,jade"

# Restart to apply changes
mcctl stop modded && mcctl start modded
```

!!! note "API Key Optional"
    Java 17+ images include a built-in CF_API_KEY; set it only for java8/pre-17 tags or to use your own key. Set it per server with `mcctl config`; a key only in the platform `.env` does not reach servers.

## Getting API Key

### Step 1: Create CurseForge Account

1. Go to [CurseForge](https://www.curseforge.com/)
2. Click "Sign In" or "Register"
3. Complete the registration process

### Step 2: Access API Console

1. Go to [https://console.curseforge.com/](https://console.curseforge.com/)
2. Sign in with your CurseForge account
3. Accept the API Terms of Service

### Step 3: Generate API Key

1. Click "Create API Key" or navigate to API Keys section
2. Give your key a descriptive name (e.g., "Minecraft Docker Server")
3. Copy the generated API key immediately

!!! danger "Security"
    - Store your API key securely
    - Never commit API keys to version control
    - Add `.env` to your `.gitignore` file

### Step 4: Configure API Key

Set the key for one server:

```bash
mcctl config myserver CF_API_KEY '<your-api-key>'
```

Or for every server: add a `CF_API_KEY` line to `~/minecraft-servers/servers/global.env`, put the value in `~/minecraft-servers/.env` in single quotes, then stop and start the servers:

```bash
# servers/global.env
CF_API_KEY

# .env
CF_API_KEY='your_api_key_here'
```

A key only in `.env` does not reach servers: they receive only the `.env` keys named in `servers/global.env`.

!!! tip "Keys that contain `$`"
    `mcctl config` writes the value in single quotes for you, and single quotes in `.env` keep it literal too. Do not escape `$` as `$$`: inside single quotes it stays `$$`.

## Supported Reference Formats

| Format | Description | Example |
|--------|-------------|---------|
| Project URL | Full URL to mod page | `https://www.curseforge.com/minecraft/mc-mods/jei` |
| File URL | URL with specific file | `https://www.curseforge.com/minecraft/mc-mods/jei/files/4593548` |
| Slug | Short identifier from URL | `jei` |
| Project ID | Numeric project identifier | `238222` |
| Slug:FileID | Slug with specific file | `jei:4593548` |
| ID:FileID | Project ID with file ID | `238222:4593548` |
| Slug@Version | Slug with version string | `jei@10.2.1.1005` |

!!! tip "Finding Project IDs"
    1. Go to the mod page on CurseForge
    2. Scroll down to the "About Project" section
    3. Find "Project ID" (e.g., 238222 for JEI)

## Configuration via mcctl

### Basic Setup

```bash
# Add mods (comma-separated)
mcctl config myserver CURSEFORGE_FILES "jei,journeymap,jade"

# Restart to apply
mcctl stop myserver && mcctl start myserver
```

### Specific Versions

```bash
# Pin to specific file ID
mcctl config myserver CURSEFORGE_FILES "jei:4593548,journeymap:4596105"

# Pin by version string
mcctl config myserver CURSEFORGE_FILES "jei@10.2.1.1005"
```

### Mixed References

```bash
# Different reference formats together
mcctl config myserver CURSEFORGE_FILES "jei,journeymap:4596105,238222"
```

### With mcctl mod

```bash
# Add references to CURSEFORGE_FILES (mcctl does not check them)
mcctl mod add myserver --curseforge jei journeymap jade

# Remove one again
mcctl mod remove myserver jade
```

## Configuration Reference

| Config Key | Description |
|------------|-------------|
| `CURSEFORGE_FILES` | Comma- or space-separated list of mod references |

!!! note "API Key Location"
    Set `CF_API_KEY` per server with `mcctl config`, or add its name to `servers/global.env` to pass the `.env` value to every server. A key only in `.env` does not reach servers.

## Complete Examples

### Forge Mod Server

```bash
# Create server without starting it
mcctl create modded -t FORGE -v 1.20.4 --no-start

# Configure mods
mcctl config modded CURSEFORGE_FILES "jei,journeymap,jade,mouse-tweaks,appleskin"
mcctl config modded MEMORY "6G"

# Start server
mcctl start modded
```

### Mixed Sources (CurseForge + Modrinth)

```bash
# Create Fabric server
mcctl create mixed -t FABRIC -v 1.21.1

# CurseForge mods (CF_API_KEY optional on Java 17+ images)
mcctl config mixed CURSEFORGE_FILES "jei,journeymap"

# Modrinth mods (no API key needed)
mcctl config mixed MODRINTH_PROJECTS "fabric-api,sodium,lithium"

# Restart to apply
mcctl stop mixed && mcctl start mixed
```

### Pinned Versions for Reproducibility

```bash
# Pin specific file versions for consistent builds
mcctl config myserver CURSEFORGE_FILES "jei:4593548,journeymap:4596105,jade:4587399"
```

## Auto-Removal and Upgrades

- Files are automatically **upgraded** when newer versions are available
- **Removed** references are automatically cleaned up
- To remove CurseForge mods, remove their references:

```bash
# Remove references as they are written in CURSEFORGE_FILES
mcctl mod remove myserver jei journeymap
mcctl stop myserver && mcctl start myserver
```

To drop the whole list, delete `CURSEFORGE_FILES` under `env:` in `servers/myserver/server.yaml`, run `mcctl migrate spec myserver`, then stop and start the server.

## Dependencies

!!! warning "Manual Dependency Management"
    CurseForge can detect missing dependencies but cannot automatically resolve them.

    You must manually add required dependencies to `CURSEFORGE_FILES`.

Example: If JEI requires Forge API, you need to add both:

```bash
mcctl config myserver CURSEFORGE_FILES "jei,forge-api"
```

## Advanced Configuration (Manual)

For complex configurations, edit `config.env` directly. Each value stays on one line; for long lists, use a listing file (below).

```bash
nano ~/minecraft-servers/servers/myserver/config.env
```

Example `config.env`:

```bash
# CurseForge mods (one line, comma-separated)
CURSEFORGE_FILES=jei,journeymap,jade,mouse-tweaks,appleskin,storage-drawers
```

### Using Listing Files

For very large mod lists:

```bash
# Create mod list file
nano ~/minecraft-servers/servers/myserver/data/cf-mods.txt
```

Content of `cf-mods.txt`:

```text
# Core mods
jei
journeymap

# Utility mods
jade
mouse-tweaks

# Specific versions
create:5678901
```

Then reference it in `config.env`:

```bash
CURSEFORGE_FILES=@/data/cf-mods.txt
```

`/data` in the container is the server's `servers/myserver/data/` folder.

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid or missing API key | Check `CF_API_KEY` for the server (`mcctl config <server> CF_API_KEY`, or `servers/global.env` and `.env`) |
| 403 Forbidden | API key lacks permissions | Regenerate API key from console |
| Mod not found | Wrong slug or ID | Verify from CurseForge URL |
| Version mismatch | Mod doesn't support server version | Use specific file ID for compatible version |
| Missing dependencies | Dependencies not resolved | Manually add required mods |

### Check API Key Configuration

```bash
# Key set for one server (don't share the output!)
mcctl config myserver CF_API_KEY

# Key passed to every server
grep CF_API_KEY ~/minecraft-servers/servers/global.env ~/minecraft-servers/.env
```

### Check Current Configuration

```bash
# View all configuration
mcctl config myserver

# View specific setting
mcctl config myserver CURSEFORGE_FILES
```

### View Server Logs

```bash
# Check for mod loading errors
mcctl logs myserver

# Follow logs in real-time
mcctl logs myserver -f
```

### Debug Mode

Enable debug output to troubleshoot issues:

```bash
mcctl config myserver DEBUG "true"
mcctl stop myserver && mcctl start myserver
mcctl logs myserver
```

### Verify API Key

Test your API key with curl:

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://api.curseforge.com/v1/mods/238222"
```

## See Also

- [CurseForge Official Website](https://www.curseforge.com/minecraft)
- [CurseForge API Console](https://console.curseforge.com/)
- [Mods and Plugins Overview](index.md)
- [Modrinth Guide](modrinth.md)
- [Modpacks Guide](modpacks.md)
- [CLI Commands Reference](../cli/commands.md)
- [Official itzg Documentation](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/curseforge-files/)
