# Mods and Plugins

This guide covers installing mods and plugins for your Minecraft server using mcctl CLI.

## Overview

| Type | Description | Server Types |
|------|-------------|--------------|
| **Mods** | Modify game mechanics, require client installation | Forge, Fabric, Quilt |
| **Plugins** | Server-side only, no client changes needed | Paper, Spigot, Bukkit |

## Quick Start with mcctl

### Create Server with Mod Support

First, create a server with the appropriate type for mods or plugins:

```bash
# For mods (Forge/Fabric)
mcctl create modded --type FABRIC --version 1.21.1

# For plugins (Paper)
mcctl create survival --type PAPER --version 1.21.1
```

### Configure Mods/Plugins

Use `mcctl config` to set mod and plugin sources:

```bash
# Modrinth mods (Fabric example)
mcctl config modded MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# CurseForge mods (requires API key in .env)
mcctl config modded CURSEFORGE_FILES "jei,journeymap"

# SpigotMC plugins
mcctl config survival SPIGET_RESOURCES "28140,34315"

# Apply changes
mcctl stop modded && mcctl start modded
```

!!! tip "Restart Required"
    After changing mod/plugin configuration, restart the server to apply changes.

## Installation Sources

| Source | Best For | API Key Required | mcctl Config Key |
|--------|----------|------------------|------------------|
| [Modrinth](modrinth.md) | Modern mods/plugins | No | `MODRINTH_PROJECTS` |
| [CurseForge](curseforge.md) | Large mod library | Yes | `CURSEFORGE_FILES` |
| [Spiget](spiget.md) | SpigotMC plugins | No | `SPIGET_RESOURCES` |
| [Direct Download](direct-download.md) | Custom/private files | No | `MODS` / `PLUGINS` |
| [Modpacks](modpacks.md) | Pre-configured collections | Varies | Server TYPE |

## Quick Comparison

### Modrinth vs CurseForge

| Feature | Modrinth | CurseForge |
|---------|----------|------------|
| API Key | Not required | Required |
| Dependency Resolution | Automatic | Manual |
| Version Auto-detect | Yes | No |
| Mod Library Size | Growing | Largest |
| Plugin Support | Yes | Limited |

### Spiget vs Modrinth for Plugins

| Feature | Spiget | Modrinth |
|---------|--------|----------|
| Platform | SpigotMC resources | Modrinth projects |
| ID Format | Numeric resource ID | Slug or project ID |
| Dependency Support | No | Yes |
| Download Restrictions | Some plugins restricted | None |

## Configuration via mcctl

### Setting Mod Sources

```bash
# View current configuration
mcctl config myserver

# Add Modrinth mods
mcctl config myserver MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# Enable dependency download
mcctl config myserver MODRINTH_DOWNLOAD_DEPENDENCIES "required"

# Restart to apply
mcctl stop myserver && mcctl start myserver
```

### Setting Plugin Sources

```bash
# Modrinth plugins (Paper server)
mcctl config survival MODRINTH_PROJECTS "luckperms,chunky,spark"

# SpigotMC plugins (numeric IDs)
mcctl config survival SPIGET_RESOURCES "28140,34315,6245"

# Restart to apply
mcctl stop survival && mcctl start survival
```

### Using Shared Directories

mcctl init creates shared directories for mods and plugins:

```
~/minecraft-servers/
  shared/
    mods/       # Place mod JARs here (read-only mount)
    plugins/    # Place plugin JARs here (read-only mount)
```

Place your manually downloaded files in these directories. They are automatically mounted to all servers.

## Auto Cleanup

### Remove Old Mods

Configure automatic cleanup of old mods before applying new content:

```bash
mcctl config myserver REMOVE_OLD_MODS "TRUE"
```

### Exclude Specific Files

```bash
mcctl config myserver REMOVE_OLD_MODS_INCLUDE "*.jar"
mcctl config myserver REMOVE_OLD_MODS_EXCLUDE "keep-this-mod.jar"
```

## Hybrid Servers

For hybrid servers like Cardboard (Fabric with Bukkit plugins):

```bash
mcctl config myserver TYPE "FABRIC"
mcctl config myserver USES_PLUGINS "true"
```

## Environment Variable Processing

By default, environment variables in synced config files are processed. To disable:

```bash
mcctl config myserver REPLACE_ENV_DURING_SYNC "false"
```

## Advanced Configuration (Manual)

For complex configurations not supported by mcctl config, edit `config.env` directly:

```bash
# Edit server configuration file
nano ~/minecraft-servers/servers/myserver/config.env
```

Example `config.env`:

```bash
# Modrinth mods (multi-line format)
MODRINTH_PROJECTS=fabric-api
lithium
sodium
iris

# Dependency settings
MODRINTH_DOWNLOAD_DEPENDENCIES=required
```

## Next Steps

- [Modrinth Guide](modrinth.md) - Download from Modrinth
- [CurseForge Guide](curseforge.md) - Download from CurseForge
- [Spiget Guide](spiget.md) - Download SpigotMC plugins
- [Direct Download Guide](direct-download.md) - Download from URLs
- [Modpacks Guide](modpacks.md) - Install modpacks

## See Also

- [Server Types](../configuration/server-types.md)
- [CLI Commands Reference](../cli/commands.md)
- [Official itzg Documentation](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/)
