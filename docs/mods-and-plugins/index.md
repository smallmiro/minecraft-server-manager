# Mods and Plugins

This guide covers installing mods and plugins for your Minecraft server using various sources.

## Overview

| Type | Description | Server Types |
|------|-------------|--------------|
| **Mods** | Modify game mechanics, require client installation | Forge, Fabric, Quilt |
| **Plugins** | Server-side only, no client changes needed | Paper, Spigot, Bukkit |

## Installation Sources

| Source | Best For | API Key Required |
|--------|----------|------------------|
| [Modrinth](modrinth.md) | Modern mods/plugins, open platform | No |
| [CurseForge](curseforge.md) | Large mod library, modpacks | Yes |
| [Spiget](spiget.md) | SpigotMC plugins | No |
| [Direct Download](direct-download.md) | Custom/private files | No |
| [Modpacks](modpacks.md) | Pre-configured mod collections | Varies |

## Quick Comparison

### Modrinth vs CurseForge

| Feature | Modrinth | CurseForge |
|---------|----------|------------|
| API Key | Not required | Required |
| Dependency Resolution | Automatic | Manual |
| Version Auto-detect | Yes (`VERSION_FROM_MODRINTH_PROJECTS`) | No |
| Mod Library Size | Growing | Largest |
| Plugin Support | Yes | Limited |

### Spiget vs Modrinth for Plugins

| Feature | Spiget | Modrinth |
|---------|--------|----------|
| Platform | SpigotMC resources | Modrinth projects |
| ID Format | Numeric resource ID | Slug or project ID |
| Dependency Support | No | Yes (with `MODRINTH_DOWNLOAD_DEPENDENCIES`) |
| Download Restrictions | Some plugins restricted | None |

## Basic Installation Methods

### Volume Mounts

Mount local directories for mods and plugins:

```yaml
services:
  mc:
    image: itzg/minecraft-server
    volumes:
      - ./data:/data
      - ./mods:/mods:ro      # Read-only mods
      - ./plugins:/plugins:ro # Read-only plugins
      - ./config:/config      # Config files
```

!!! info "Mount Points"
    - `/mods` syncs to `/data/mods` (Forge, Fabric)
    - `/plugins` syncs to `/data/plugins` (Paper, Spigot)
    - `/config` syncs to `/data/config`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `MODS` | Comma/space/newline separated mod URLs |
| `PLUGINS` | Comma/space/newline separated plugin URLs |
| `MODS_FILE` | Path or URL to file containing mod URLs |
| `PLUGINS_FILE` | Path or URL to file containing plugin URLs |

### Customizing Sync Paths

| Variable | Default | Description |
|----------|---------|-------------|
| `COPY_MODS_SRC` | `/mods` | Source directory for mods |
| `COPY_MODS_DEST` | `/data/mods` | Destination directory for mods |
| `COPY_PLUGINS_SRC` | `/plugins` | Source directory for plugins |
| `COPY_PLUGINS_DEST` | `/data/plugins` | Destination directory for plugins |
| `COPY_CONFIG_DEST` | `/data/config` | Destination directory for config |

## Auto Cleanup

### Remove Old Mods

Automatically remove old mods/plugins before applying new content:

```yaml
environment:
  REMOVE_OLD_MODS: "TRUE"
```

### Exclude Specific Files

```yaml
environment:
  REMOVE_OLD_MODS: "TRUE"
  REMOVE_OLD_MODS_INCLUDE: "*.jar"
  REMOVE_OLD_MODS_EXCLUDE: "keep-this-mod.jar"
```

## Hybrid Servers

For hybrid servers like Cardboard (Fabric with Bukkit plugins):

```yaml
environment:
  TYPE: FABRIC
  USES_PLUGINS: "true"  # Enable plugin support on Fabric
```

## Environment Variable Processing

By default, environment variables in synced config files are processed. To disable:

```yaml
environment:
  REPLACE_ENV_DURING_SYNC: "false"
```

## Next Steps

- [Modrinth Guide](modrinth.md) - Download from Modrinth
- [CurseForge Guide](curseforge.md) - Download from CurseForge
- [Spiget Guide](spiget.md) - Download SpigotMC plugins
- [Direct Download Guide](direct-download.md) - Download from URLs
- [Modpacks Guide](modpacks.md) - Install modpacks

## See Also

- [Server Types](../configuration/server-types.md)
- [Environment Variables](../configuration/environment.md)
- [Official itzg Documentation](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/)
