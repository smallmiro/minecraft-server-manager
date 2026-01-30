# CurseForge

Download mods and plugins from [CurseForge](https://www.curseforge.com/minecraft) - the largest mod hosting platform.

## Overview

| Feature | Value |
|---------|-------|
| Official Website | [https://www.curseforge.com/minecraft](https://www.curseforge.com/minecraft) |
| API Key Required | **Yes** |
| API Console | [https://console.curseforge.com/](https://console.curseforge.com/) |
| Dependency Resolution | Manual (metadata only) |
| Mod Library Size | Largest |

## Quick Start with mcctl

### Step 1: Get API Key

1. Go to [CurseForge API Console](https://console.curseforge.com/)
2. Sign in and create an API key
3. Add the key to your platform `.env` file:

```bash
# Edit global environment file
nano ~/minecraft-servers/.env

# Add this line
CF_API_KEY=your_api_key_here
```

### Step 2: Create Server and Add Mods

```bash
# Create a Forge server
mcctl create modded --type FORGE --version 1.20.4

# Add CurseForge mods
mcctl config modded CURSEFORGE_FILES "jei,journeymap,jade"

# Restart to apply changes
mcctl stop modded && mcctl start modded
```

!!! warning "API Key Required"
    CurseForge requires an API key for all downloads. The key must be set in your `.env` file.

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

Add the API key to your platform's `.env` file:

```bash
# Edit .env file
nano ~/minecraft-servers/.env

# Add the API key
CF_API_KEY=your_api_key_here
```

!!! tip "Escaping $ in API Key"
    If your API key contains `$`, escape it with `$$` in the `.env` file.

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

## Configuration Reference

| Config Key | Description |
|------------|-------------|
| `CURSEFORGE_FILES` | Comma/space/newline separated list of mod references |

!!! note "API Key Location"
    The `CF_API_KEY` is set in the platform `.env` file, not in individual server `config.env` files.

## Complete Examples

### Forge Mod Server

```bash
# Create server
mcctl create modded --type FORGE --version 1.20.4

# Configure mods
mcctl config modded CURSEFORGE_FILES "jei,journeymap,jade,mouse-tweaks,appleskin"
mcctl config modded MEMORY "6G"

# Start server
mcctl start modded
```

### Mixed Sources (CurseForge + Modrinth)

```bash
# Create Fabric server
mcctl create mixed --type FABRIC --version 1.21.1

# CurseForge mods (requires API key)
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
- To remove all CurseForge mods:

```bash
# Clear all CurseForge mods
mcctl config myserver CURSEFORGE_FILES ""
mcctl stop myserver && mcctl start myserver
```

## Dependencies

!!! warning "Manual Dependency Management"
    CurseForge can detect missing dependencies but cannot automatically resolve them.

    You must manually add required dependencies to `CURSEFORGE_FILES`.

Example: If JEI requires Forge API, you need to add both:

```bash
mcctl config myserver CURSEFORGE_FILES "jei,forge-api"
```

## Advanced Configuration (Manual)

For complex configurations, edit `config.env` directly:

```bash
nano ~/minecraft-servers/servers/myserver/config.env
```

Example `config.env`:

```bash
# CurseForge mods (multi-line format)
CURSEFORGE_FILES=jei
journeymap
jade
mouse-tweaks
appleskin
storage-drawers
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

And mount the directory:

```bash
# This is automatically done by mcctl
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid or missing API key | Verify `CF_API_KEY` in `.env` |
| 403 Forbidden | API key lacks permissions | Regenerate API key from console |
| Mod not found | Wrong slug or ID | Verify from CurseForge URL |
| Version mismatch | Mod doesn't support server version | Use specific file ID for compatible version |
| Missing dependencies | Dependencies not resolved | Manually add required mods |

### Check API Key Configuration

```bash
# View .env file (don't share the output!)
cat ~/minecraft-servers/.env | grep CF_API_KEY
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
