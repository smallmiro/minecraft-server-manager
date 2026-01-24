# Direct Download

Download mods and plugins directly from URLs or mount local files.

## Overview

| Feature | Value |
|---------|-------|
| API Key Required | No |
| Supports | Any accessible URL or local file |
| Use Cases | Custom mods, private files, direct URLs |

## Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| `MODS` / `PLUGINS` | Direct URL list | Simple URL-based downloads |
| `MODS_FILE` / `PLUGINS_FILE` | File containing URLs | Organized URL lists |
| Volume Mounts | Local directories | Local or manually downloaded files |

## URL-Based Downloads

### MODS and PLUGINS Variables

Download mods or plugins directly from URLs:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"
      MODS: |
        https://example.com/custom-mod.jar
        https://github.com/user/repo/releases/download/v1.0/mod.jar
    volumes:
      - ./data:/data
```

### Supported Delimiters

URLs can be separated by:

- Commas: `url1,url2,url3`
- Spaces: `url1 url2 url3`
- Newlines (YAML multi-line)

### Example with Plugins

```yaml
environment:
  TYPE: "PAPER"
  PLUGINS: |
    https://example.com/plugin1.jar
    https://example.com/plugin2.jar
```

## File-Based Lists

### MODS_FILE and PLUGINS_FILE

Reference a file containing URLs:

```yaml
environment:
  MODS_FILE: "/data/mods.txt"
  PLUGINS_FILE: "/data/plugins.txt"
```

### File Format

Create `/data/mods.txt`:

```text
# Performance mods
https://example.com/lithium.jar
https://example.com/phosphor.jar

# Utility mods
https://example.com/mod-menu.jar

# Comments starting with # are ignored
# Blank lines are also ignored

# You can also use special prefixes
modrinth:fabric-api
curseforge:jei
```

### Remote File Lists

You can also reference remote file lists:

```yaml
environment:
  MODS_FILE: "https://example.com/server-mods.txt"
  PLUGINS_FILE: "https://gist.githubusercontent.com/user/id/raw/plugins.txt"
```

### Special Prefixes

File lists support special prefixes for different sources:

| Prefix | Description | Example |
|--------|-------------|---------|
| `modrinth:` | Modrinth project | `modrinth:fabric-api` |
| `curseforge:` | CurseForge project | `curseforge:jei` |
| (none) | Direct URL | `https://example.com/mod.jar` |

## Volume Mounts

### Read-Only Mounts

Mount local directories containing mods or plugins:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
    volumes:
      - ./data:/data
      - ./mods:/mods:ro      # Read-only
      - ./plugins:/plugins:ro
```

!!! tip "Read-Only Recommended"
    Use `:ro` (read-only) to prevent the server from modifying your source files.

### Mount Points

| Container Path | Syncs To | Purpose |
|----------------|----------|---------|
| `/mods` | `/data/mods` | Mod files (Forge, Fabric) |
| `/plugins` | `/data/plugins` | Plugin files (Paper, Spigot) |
| `/config` | `/data/config` | Configuration files |

### Customizing Sync Paths

Change source or destination paths:

```yaml
environment:
  COPY_MODS_SRC: "/custom-mods"
  COPY_MODS_DEST: "/data/mods"
  COPY_PLUGINS_SRC: "/custom-plugins"
  COPY_PLUGINS_DEST: "/data/plugins"
  COPY_CONFIG_DEST: "/data/config"
volumes:
  - ./my-mods:/custom-mods:ro
  - ./my-plugins:/custom-plugins:ro
```

## Container Path References

Reference files already in the container:

```yaml
environment:
  MODS: |
    /extras/custom-mod.jar
    https://example.com/other-mod.jar
volumes:
  - ./extras:/extras:ro
```

## Complete Examples

### GitHub Releases Download

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"
      MODS: |
        https://github.com/CaffeineMC/sodium-fabric/releases/download/mc1.20.4-0.5.8/sodium-fabric-0.5.8+mc1.20.4.jar
        https://github.com/CaffeineMC/lithium-fabric/releases/download/mc1.20.4-0.12.1/lithium-fabric-mc1.20.4-0.12.1.jar
    volumes:
      - ./data:/data
```

### Mixed Sources

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"

      # Direct URLs
      MODS: |
        https://example.com/custom-mod.jar

      # File-based list
      MODS_FILE: "/data/extra-mods.txt"

      # Modrinth mods
      MODRINTH_PROJECTS: |
        fabric-api
        sodium
    volumes:
      - ./data:/data
```

### Local Development Setup

For mod development with local builds:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"
      REMOVE_OLD_MODS: "TRUE"  # Clean on restart
    volumes:
      - ./data:/data
      - ../my-mod/build/libs:/mods:ro  # Mount build output
```

### Server Network with Shared Plugins

```yaml
services:
  lobby:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
    volumes:
      - ./lobby-data:/data
      - ./shared-plugins:/plugins:ro

  survival:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
    volumes:
      - ./survival-data:/data
      - ./shared-plugins:/plugins:ro
```

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `MODS` | Comma/space/newline separated mod URLs or container paths |
| `PLUGINS` | Comma/space/newline separated plugin URLs or container paths |
| `MODS_FILE` | Path or URL to file containing mod URLs |
| `PLUGINS_FILE` | Path or URL to file containing plugin URLs |
| `COPY_MODS_SRC` | Source directory for mods (default: `/mods`) |
| `COPY_MODS_DEST` | Destination directory for mods (default: `/data/mods`) |
| `COPY_PLUGINS_SRC` | Source directory for plugins (default: `/plugins`) |
| `COPY_PLUGINS_DEST` | Destination directory for plugins (default: `/data/plugins`) |

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Download failed | Invalid URL or network issue | Verify URL is accessible |
| File not found | Wrong container path | Check volume mount configuration |
| Permission denied | File permissions | Ensure files are readable |
| Mods not loading | Wrong server type | Verify TYPE matches mod loader |

### Debug Logging

Enable debug output to troubleshoot:

```yaml
environment:
  DEBUG: "true"
```

### Verify URL Access

Test URL accessibility:

```bash
curl -I "https://example.com/mod.jar"
```

## See Also

- [Mods and Plugins Overview](index.md)
- [Modrinth Guide](modrinth.md)
- [CurseForge Guide](curseforge.md)
- [Spiget Guide](spiget.md)
- [Official itzg Documentation](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/)
