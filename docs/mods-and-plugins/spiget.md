# Spiget (SpigotMC)

Download plugins from [SpigotMC](https://www.spigotmc.org/) using the [Spiget API](https://spiget.org/).

## Overview

| Feature | Value |
|---------|-------|
| Official Website | [https://www.spigotmc.org/](https://www.spigotmc.org/) |
| Spiget API | [https://spiget.org/](https://spiget.org/) |
| API Key Required | No |
| Supported Types | Plugins only |
| Server Types | Paper, Spigot, Bukkit |

!!! note "Spiget vs Spigot"
    The config key uses **SPIGET** (with an "E"), not "SPIGOT". Spiget is a third-party API that provides programmatic access to SpigotMC resources.

## Quick Start with mcctl

### Create Server and Add Plugins

```bash
# Create a Paper server
mcctl create survival --type PAPER --version 1.21.1

# Add SpigotMC plugins (using numeric resource IDs)
mcctl config survival SPIGET_RESOURCES "28140,34315,6245"

# Restart to apply changes
mcctl stop survival && mcctl start survival
```

## Finding Resource IDs

The resource ID is the numeric portion at the end of the SpigotMC resource URL.

### Examples

| Plugin | URL | Resource ID |
|--------|-----|-------------|
| LuckPerms | `https://www.spigotmc.org/resources/luckperms.28140/` | `28140` |
| Vault | `https://www.spigotmc.org/resources/vault.34315/` | `34315` |
| PlaceholderAPI | `https://www.spigotmc.org/resources/placeholderapi.6245/` | `6245` |
| WorldEdit | `https://www.spigotmc.org/resources/worldedit.13932/` | `13932` |
| CoreProtect | `https://www.spigotmc.org/resources/coreprotect.8631/` | `8631` |

### How to Find Resource ID

1. Go to [SpigotMC Resources](https://www.spigotmc.org/resources/)
2. Search for the plugin you want
3. Click on the plugin to open its page
4. Look at the URL: `https://www.spigotmc.org/resources/plugin-name.XXXXX/`
5. The number at the end (XXXXX) is the resource ID

## Configuration via mcctl

### Basic Setup

```bash
# Add plugins (comma-separated numeric IDs)
mcctl config myserver SPIGET_RESOURCES "28140,34315,6245"

# Restart to apply
mcctl stop myserver && mcctl start myserver
```

### View Current Configuration

```bash
# View all configuration
mcctl config myserver

# View Spiget resources
mcctl config myserver SPIGET_RESOURCES
```

## Configuration Reference

| Config Key | Description |
|------------|-------------|
| `SPIGET_RESOURCES` | Comma-separated list of SpigotMC resource IDs |

## File Handling

The Spiget API handles different file types automatically:

| File Type | Action |
|-----------|--------|
| `.jar` file | Moved directly to plugins directory |
| `.zip` file | Extracted into plugins directory |

## Limitations

!!! warning "Download Restrictions"
    Some plugins on SpigotMC restrict automated downloads through Spiget. These plugins require external download authentication that Spiget cannot provide.

    **Example restricted plugins:**

    - EssentialsX (ID: 9089)
    - Some premium plugins

    For these plugins, manually download and use the shared plugins directory.

### Manual Download Alternative

For restricted plugins, use the shared plugins directory:

```bash
# Download plugin manually and place in shared directory
# Location: ~/minecraft-servers/shared/plugins/

# The file will be automatically available to all servers
```

## Complete Examples

### Paper Server with Multiple Plugins

```bash
# Create server
mcctl create survival --type PAPER --version 1.21.1

# Configure plugins
mcctl config survival SPIGET_RESOURCES "28140,34315,6245"
mcctl config survival MEMORY "4G"

# Start server
mcctl start survival
```

### Combined with Modrinth Plugins

```bash
# Create server
mcctl create survival --type PAPER --version 1.21.1

# Spiget plugins (SpigotMC)
mcctl config survival SPIGET_RESOURCES "28140,34315"

# Modrinth plugins (additional)
mcctl config survival MODRINTH_PROJECTS "chunky,spark"

# Restart to apply
mcctl stop survival && mcctl start survival
```

### Combined with Manual Plugins

For plugins that restrict Spiget downloads:

1. Download the plugin manually from SpigotMC
2. Place the JAR file in `~/minecraft-servers/shared/plugins/`
3. The plugin will be available to all servers

```bash
# Create server (manual plugins are auto-mounted)
mcctl create survival --type PAPER --version 1.21.1

# Add Spiget plugins for ones that work
mcctl config survival SPIGET_RESOURCES "28140,34315"

# Manual plugins in shared/plugins/ are automatically available
mcctl start survival
```

## Popular SpigotMC Plugins

| Plugin | Resource ID | Description |
|--------|-------------|-------------|
| LuckPerms | 28140 | Permissions management |
| Vault | 34315 | Economy/permissions API |
| PlaceholderAPI | 6245 | Placeholder expansion |
| WorldEdit | 13932 | World editing tool |
| CoreProtect | 8631 | Block logging |
| Multiverse-Core | 390 | Multiple worlds |
| SkinsRestorer | 2124 | Skin management |
| DiscordSRV | 18494 | Discord integration |

!!! info "Plugin Compatibility"
    Always check plugin compatibility with your Minecraft version on the SpigotMC page before adding to your server.

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Plugin not downloading | Download restricted | Use manual download with shared directory |
| Wrong plugin version | Spiget selects latest | Check if latest supports your MC version |
| Plugin not loading | Missing dependencies | Check plugin requirements and add them |
| Resource not found | Invalid resource ID | Verify ID from SpigotMC URL |

### Check Current Configuration

```bash
# View all configuration
mcctl config myserver

# View Spiget resources
mcctl config myserver SPIGET_RESOURCES
```

### View Server Logs

```bash
# Check for plugin loading errors
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

### Check Spiget API

Verify a resource exists and is available:

```bash
curl "https://api.spiget.org/v2/resources/28140"
```

## Modrinth vs Spiget for Plugins

If a plugin is available on both Modrinth and SpigotMC, consider:

| Feature | Modrinth | Spiget (SpigotMC) |
|---------|----------|-------------------|
| ID Format | Slug (easy to remember) | Numeric (harder to remember) |
| Dependency Support | Yes | No |
| Download Restrictions | None | Some plugins restricted |
| Recommendation | **Preferred** | Use when not on Modrinth |

```bash
# Preferred: Use Modrinth when available
mcctl config myserver MODRINTH_PROJECTS "luckperms,chunky,spark"

# Alternative: Use Spiget for SpigotMC-only plugins
mcctl config myserver SPIGET_RESOURCES "390,2124"
```

## See Also

- [SpigotMC Resources](https://www.spigotmc.org/resources/)
- [Spiget API Documentation](https://spiget.org/)
- [Mods and Plugins Overview](index.md)
- [Modrinth Guide](modrinth.md)
- [Direct Download Guide](direct-download.md)
- [CLI Commands Reference](../cli/commands.md)
- [Official itzg Documentation](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/spiget/)
