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
    The environment variable uses **SPIGET** (with an "E"), not "SPIGOT". Spiget is a third-party API that provides programmatic access to SpigotMC resources.

## Basic Usage

### SPIGET_RESOURCES

Download plugins using numeric resource IDs:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"
      SPIGET_RESOURCES: "28140,34315"
    volumes:
      - ./data:/data
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
| WorldGuard | `https://www.spigotmc.org/resources/worldguard.13932/` | `13932` |

### How to Find Resource ID

1. Go to [SpigotMC Resources](https://www.spigotmc.org/resources/)
2. Search for the plugin you want
3. Click on the plugin to open its page
4. Look at the URL: `https://www.spigotmc.org/resources/plugin-name.XXXXX/`
5. The number at the end (XXXXX) is the resource ID

## Environment Variables

| Variable | Description |
|----------|-------------|
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

    For these plugins, manually download the file and use volume mounts instead.

### Manual Download Alternative

For restricted plugins:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
    volumes:
      - ./data:/data
      - ./plugins:/plugins:ro  # Mount your manually downloaded plugins
```

Then place the manually downloaded JAR files in the `./plugins` directory.

## Complete Examples

### Paper Server with Multiple Plugins

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"
      MEMORY: "4G"
      SPIGET_RESOURCES: "28140,34315,6245"  # LuckPerms, Vault, PlaceholderAPI
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```

### Combined with Modrinth Plugins

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"

      # Spiget plugins
      SPIGET_RESOURCES: "28140,34315"  # LuckPerms, Vault

      # Modrinth plugins
      MODRINTH_PROJECTS: |
        chunky
        spark
    volumes:
      - ./data:/data
```

### Combined with Manual Plugins

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"

      # Spiget plugins (that allow automated download)
      SPIGET_RESOURCES: "28140,34315"
    volumes:
      - ./data:/data
      - ./plugins:/plugins:ro  # EssentialsX and other restricted plugins
```

## Popular SpigotMC Plugins

| Plugin | Resource ID | Description |
|--------|-------------|-------------|
| LuckPerms | 28140 | Permissions management |
| Vault | 34315 | Economy/permissions API |
| PlaceholderAPI | 6245 | Placeholder expansion |
| WorldEdit | 13932 | World editing tool |
| WorldGuard | 13932 | Region protection |
| CoreProtect | 8631 | Block logging |
| Multiverse-Core | 390 | Multiple worlds |
| SkinsRestorer | 2124 | Skin management |

!!! info "Plugin Compatibility"
    Always check plugin compatibility with your Minecraft version on the SpigotMC page before adding to your server.

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Plugin not downloading | Download restricted | Use manual download with volume mount |
| Wrong plugin version | Spiget selects latest | Check if latest supports your MC version |
| Plugin not loading | Missing dependencies | Check plugin requirements and add them |
| Resource not found | Invalid resource ID | Verify ID from SpigotMC URL |

### Debug Logging

Enable debug output to troubleshoot issues:

```yaml
environment:
  DEBUG: "true"
```

### Check Spiget API

Verify a resource exists and is available:

```bash
curl "https://api.spiget.org/v2/resources/28140"
```

## See Also

- [SpigotMC Resources](https://www.spigotmc.org/resources/)
- [Spiget API Documentation](https://spiget.org/)
- [Mods and Plugins Overview](index.md)
- [Modrinth Guide](modrinth.md)
- [Direct Download Guide](direct-download.md)
- [Official itzg Documentation](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/spiget/)
