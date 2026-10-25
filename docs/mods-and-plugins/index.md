# Mods and Plugins

This guide covers installing mods and plugins for your Minecraft server using mcctl CLI.

## Overview

| Type | Description | Server Types |
|------|-------------|--------------|
| **Mods** | Modify game mechanics, require client installation | Forge, NeoForge, Fabric, Quilt |
| **Plugins** | Server-side only, no client changes needed | Paper, Purpur, Spigot, Bukkit, Leaf, Folia, Pufferfish |

## Quick Start with mcctl

### Create Server with Mod Support

First, create a server with the appropriate type for mods or plugins:

```bash
# For mods (Forge/Fabric)
mcctl create modded -t FABRIC -v 1.21.1

# For plugins (Paper)
mcctl create survival -t PAPER -v 1.21.1
```

### Configure Mods/Plugins

Use `mcctl config` to set mod and plugin sources:

```bash
# Modrinth mods (Fabric example)
mcctl config modded MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# CurseForge mods (CF_API_KEY optional on Java 17+ images)
mcctl config modded CURSEFORGE_FILES "jei,journeymap"

# SpigotMC plugins
mcctl config survival SPIGET_RESOURCES "28140,34315"

# Apply changes
mcctl stop modded && mcctl start modded
```

!!! tip "Restart Required"
    After changing mod/plugin configuration, restart the server to apply changes.

### With mcctl mod

`mcctl mod` writes the same keys for you:

```bash
# Search Modrinth
mcctl mod search sodium

# Add Modrinth projects (mcctl checks the slugs on Modrinth)
mcctl mod add modded fabric-api lithium

# Other sources
mcctl mod add modded --curseforge jei journeymap
mcctl mod add survival --spiget 28140
mcctl mod add modded --url https://example.com/custom-mod.jar

# List and remove
mcctl mod list modded
mcctl mod remove modded lithium
```

`--curseforge` writes `CURSEFORGE_FILES`, `--spiget` writes `SPIGET_RESOURCES`, and `--url` writes `PLUGINS` on the plugin servers and `MODS` on the others. For server types not in the [Overview](#overview) table, including modpack types, `mcctl mod add` asks for `--force`. Restart the server afterwards.

## Installation Sources

| Source | Best For | API Key Required | mcctl Config Key |
|--------|----------|------------------|------------------|
| [Modrinth](modrinth.md) | Modern mods/plugins | No | `MODRINTH_PROJECTS` |
| [CurseForge](curseforge.md) | Large mod library | No (built in for Java 17+ images) | `CURSEFORGE_FILES` |
| [Spiget](spiget.md) | SpigotMC plugins | No | `SPIGET_RESOURCES` |
| [Direct Download](direct-download.md) | Custom/private files | No | `MODS` / `PLUGINS` |
| [Modpacks](modpacks.md) | Pre-configured collections | Varies | Server TYPE |

## Quick Comparison

### Modrinth vs CurseForge

| Feature | Modrinth | CurseForge |
|---------|----------|------------|
| API Key | Not required | Optional (built in for Java 17+ images) |
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

`mcctl init` creates `shared/plugins/`, which every server mounts read-only at `/plugins`. The image copies those jars into the server's `plugins/` folder when it starts.

```
~/minecraft-servers/
  shared/
    plugins/                 # Plugin JARs for all servers (read-only mount)
  servers/<name>/data/
    mods/                    # Mod JARs for one server
```

Put manually downloaded plugins in `shared/plugins/`. Put mod JARs in the server's own `servers/<name>/data/mods/`, or list their download URLs in `MODS` (see [Direct Download](direct-download.md)).

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

By default, environment variables are not processed in files copied by the sync. To enable it:

```bash
mcctl config myserver REPLACE_ENV_DURING_SYNC "true"
```

## Advanced Configuration (Manual)

For complex configurations not supported by mcctl config, edit `config.env` directly:

```bash
# Edit server configuration file
nano ~/minecraft-servers/servers/myserver/config.env
```

Example `config.env`:

```bash
# Modrinth mods (one line, comma-separated)
MODRINTH_PROJECTS=fabric-api,lithium,sodium,iris

# Dependency settings
MODRINTH_DOWNLOAD_DEPENDENCIES=required
```

Each value must stay on one line; for long lists use a listing file (see [Using Listing Files](modrinth.md#using-listing-files)). mcctl takes a hand edit into `server.yaml` the next time it changes the server.

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
