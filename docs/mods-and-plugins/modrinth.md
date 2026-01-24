# Modrinth

Download mods and plugins from [Modrinth](https://modrinth.com/) - an open-source mod hosting platform.

## Overview

| Feature | Value |
|---------|-------|
| Official Website | [https://modrinth.com/](https://modrinth.com/) |
| API Key Required | No |
| Dependency Resolution | Automatic (optional) |
| Version Auto-detect | Yes |
| Supported Types | Mods, Plugins, Datapacks |

## Basic Usage

### MODRINTH_PROJECTS

Download mods/plugins using project slugs or IDs:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"
      MODRINTH_PROJECTS: |
        fabric-api
        lithium
        sodium
        iris
    volumes:
      - ./data:/data
```

!!! tip "Finding Project Slug"
    The slug is the URL portion after `/mod/` or `/plugin/`.

    Example: `https://modrinth.com/mod/fabric-api` -> slug is `fabric-api`

## Project Entry Formats

| Format | Description | Example |
|--------|-------------|---------|
| `project` | Latest release | `fabric-api` |
| `project:version` | Specific version ID or number | `fabric-api:0.92.0` |
| `project:release` | Latest release type | `fabric-api:release` |
| `project:beta` | Latest beta | `lithium:beta` |
| `project:alpha` | Latest alpha | `sodium:alpha` |
| `prefix:project` | Loader override | `fabric:sodium` |
| `@file` | Listing file path | `@/data/mods.txt` |

### Version Specifiers

```yaml
environment:
  MODRINTH_PROJECTS: |
    fabric-api                    # Latest release
    fabric-api:release            # Explicit latest release
    fabric-api:beta               # Latest beta
    fabric-api:alpha              # Latest alpha
    fabric-api:0.92.0             # Specific version number
    fabric-api:ABC123xyz          # Specific version ID
```

### Loader Prefix

Override the auto-detected loader for specific projects:

```yaml
environment:
  MODRINTH_PROJECTS: |
    fabric:fabric-api             # Force Fabric loader
    forge:jei                     # Force Forge loader
    paper:luckperms               # Force Paper loader
    datapack:better-villages      # Datapack
```

## Environment Variables

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MODRINTH_PROJECTS` | - | Comma or newline separated list of projects |
| `MODRINTH_DOWNLOAD_DEPENDENCIES` | `none` | `none`, `required`, or `optional` |
| `MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE` | `release` | Default version type: `release`, `beta`, `alpha` |

### Version Control

| Variable | Default | Description |
|----------|---------|-------------|
| `VERSION_FROM_MODRINTH_PROJECTS` | `false` | Auto-set Minecraft version based on mod compatibility |
| `MODRINTH_LOADER` | auto | Override loader type for lookups |

## Dependency Management

### Automatic Dependencies

Download required dependencies automatically:

```yaml
environment:
  TYPE: FABRIC
  MODRINTH_DOWNLOAD_DEPENDENCIES: "required"
  MODRINTH_PROJECTS: |
    sodium
    lithium
```

### Dependency Options

| Value | Description |
|-------|-------------|
| `none` | No dependencies (default) |
| `required` | Download required dependencies only |
| `optional` | Download required and optional dependencies |

## Auto Version Detection

Let Modrinth determine the Minecraft version based on mod compatibility:

```yaml
environment:
  TYPE: FABRIC
  VERSION_FROM_MODRINTH_PROJECTS: "true"
  MODRINTH_PROJECTS: |
    fabric-api
    sodium
```

!!! warning "Version Compatibility"
    When using `VERSION_FROM_MODRINTH_PROJECTS`, ensure all listed mods support the same Minecraft version.

## Using Listing Files

### File Format

Create a listing file at `/data/mods.txt`:

```text
# Performance mods
fabric-api
lithium
sodium

# Utility mods
iris:beta
modmenu

# Specific versions
fabric-api:0.92.0
```

### Reference Listing File

```yaml
environment:
  MODRINTH_PROJECTS: "@/data/mods.txt"
```

!!! note "Listing File Requirements"
    - Must be in a mounted directory
    - Comments start with `#`
    - Blank lines are ignored

## Auto-Removal

When you remove a project from `MODRINTH_PROJECTS`, the corresponding file is automatically removed from the server.

## Complete Examples

### Fabric Performance Server

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"
      MEMORY: "4G"
      MODRINTH_DOWNLOAD_DEPENDENCIES: "required"
      MODRINTH_PROJECTS: |
        fabric-api
        lithium
        phosphor
        ferritecore
        krypton
        c2me-fabric
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```

### Paper Plugin Server

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"
      MEMORY: "4G"
      MODRINTH_PROJECTS: |
        luckperms
        vault
        chunky
        spark
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```

### Mixed Version Types

```yaml
environment:
  MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE: "beta"
  MODRINTH_PROJECTS: |
    fabric-api                # Uses beta (default)
    sodium:release            # Override to release
    iris:alpha                # Override to alpha
```

### Custom Loader Override

For servers with custom loaders:

```yaml
environment:
  TYPE: "CUSTOM"
  MODRINTH_LOADER: "fabric"
  MODRINTH_PROJECTS: |
    fabric-api
    lithium
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Mod not found | Wrong slug or ID | Verify slug from Modrinth URL |
| Version mismatch | Mod doesn't support server version | Check mod compatibility or use `VERSION_FROM_MODRINTH_PROJECTS` |
| Missing dependencies | Dependencies not downloaded | Set `MODRINTH_DOWNLOAD_DEPENDENCIES: "required"` |
| Wrong loader | Auto-detection failed | Use loader prefix or `MODRINTH_LOADER` |

### Debug Logging

Enable debug output to troubleshoot issues:

```yaml
environment:
  DEBUG: "true"
```

## See Also

- [Modrinth Official Website](https://modrinth.com/)
- [Modrinth API Documentation](https://docs.modrinth.com/)
- [Mods and Plugins Overview](index.md)
- [CurseForge Guide](curseforge.md)
- [Official itzg Documentation](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/modrinth/)
