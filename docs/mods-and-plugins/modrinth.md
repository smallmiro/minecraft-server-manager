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

## Quick Start with mcctl

### Create Server and Add Mods

```bash
# Create a Fabric server
mcctl create modded --type FABRIC --version 1.21.1

# Add Modrinth mods
mcctl config modded MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# Enable automatic dependency download
mcctl config modded MODRINTH_DOWNLOAD_DEPENDENCIES "required"

# Restart to apply changes
mcctl stop modded && mcctl start modded
```

### Add Plugins to Paper Server

```bash
# Create a Paper server
mcctl create survival --type PAPER --version 1.21.1

# Add Modrinth plugins
mcctl config survival MODRINTH_PROJECTS "luckperms,chunky,spark"

# Restart to apply changes
mcctl stop survival && mcctl start survival
```

## Finding Project Slug

The slug is the URL portion after `/mod/` or `/plugin/`.

Example: `https://modrinth.com/mod/fabric-api` -> slug is `fabric-api`

!!! tip "Project Slug"
    You can use either the project slug or the project ID from Modrinth.

## Project Entry Formats

Use different formats in the `MODRINTH_PROJECTS` value:

| Format | Description | Example |
|--------|-------------|---------|
| `project` | Latest release | `fabric-api` |
| `project:version` | Specific version ID or number | `fabric-api:0.92.0` |
| `project:release` | Latest release type | `fabric-api:release` |
| `project:beta` | Latest beta | `lithium:beta` |
| `project:alpha` | Latest alpha | `sodium:alpha` |
| `prefix:project` | Loader override | `fabric:sodium` |

### Version Specifiers

```bash
# Latest release
mcctl config myserver MODRINTH_PROJECTS "fabric-api"

# Specific version
mcctl config myserver MODRINTH_PROJECTS "fabric-api:0.92.0"

# Beta version
mcctl config myserver MODRINTH_PROJECTS "lithium:beta"

# Multiple mods with mixed versions
mcctl config myserver MODRINTH_PROJECTS "fabric-api,sodium:release,iris:beta"
```

### Loader Prefix

Override the auto-detected loader for specific projects:

```bash
# Force Fabric loader
mcctl config myserver MODRINTH_PROJECTS "fabric:fabric-api"

# Force Paper loader for plugins
mcctl config myserver MODRINTH_PROJECTS "paper:luckperms"

# Datapack
mcctl config myserver MODRINTH_PROJECTS "datapack:better-villages"
```

## Configuration Options

### Core Settings

```bash
# Add mods (comma-separated)
mcctl config myserver MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# Download dependencies automatically
mcctl config myserver MODRINTH_DOWNLOAD_DEPENDENCIES "required"

# Default version type for all mods
mcctl config myserver MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE "release"
```

### Dependency Options

| Value | Description |
|-------|-------------|
| `none` | No dependencies (default) |
| `required` | Download required dependencies only |
| `optional` | Download required and optional dependencies |

### Version Control

```bash
# Auto-detect Minecraft version from mods
mcctl config myserver VERSION_FROM_MODRINTH_PROJECTS "true"

# Override loader type
mcctl config myserver MODRINTH_LOADER "fabric"
```

## Configuration Reference

| Config Key | Default | Description |
|------------|---------|-------------|
| `MODRINTH_PROJECTS` | - | Comma or newline separated list of projects |
| `MODRINTH_DOWNLOAD_DEPENDENCIES` | `none` | `none`, `required`, or `optional` |
| `MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE` | `release` | Default: `release`, `beta`, `alpha` |
| `VERSION_FROM_MODRINTH_PROJECTS` | `false` | Auto-set Minecraft version |
| `MODRINTH_LOADER` | auto | Override loader type |

## Complete Examples

### Fabric Performance Server

```bash
# Create server
mcctl create performance --type FABRIC --version 1.21.1

# Configure mods
mcctl config performance MODRINTH_PROJECTS "fabric-api,lithium,phosphor,ferritecore,krypton,c2me-fabric"
mcctl config performance MODRINTH_DOWNLOAD_DEPENDENCIES "required"
mcctl config performance MEMORY "4G"

# Start server
mcctl start performance
```

### Paper Plugin Server

```bash
# Create server
mcctl create survival --type PAPER --version 1.21.1

# Configure plugins
mcctl config survival MODRINTH_PROJECTS "luckperms,vault,chunky,spark"
mcctl config survival MEMORY "4G"

# Start server
mcctl start survival
```

### Mixed Version Types

```bash
# Set default to beta
mcctl config myserver MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE "beta"

# Override individual mods
mcctl config myserver MODRINTH_PROJECTS "fabric-api,sodium:release,iris:alpha"
```

## Advanced Configuration (Manual)

For advanced multi-line configurations, edit `config.env` directly:

```bash
nano ~/minecraft-servers/servers/myserver/config.env
```

Example `config.env`:

```bash
# Modrinth mods (multi-line format)
MODRINTH_PROJECTS=fabric-api
lithium
phosphor
ferritecore
krypton
c2me-fabric

# Dependency settings
MODRINTH_DOWNLOAD_DEPENDENCIES=required

# Custom loader (for custom server types)
MODRINTH_LOADER=fabric
```

### Using Listing Files

For very large mod lists, use a listing file:

```bash
# Create mod list file
nano ~/minecraft-servers/servers/myserver/data/mods.txt
```

Content of `mods.txt`:

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

Then reference it in `config.env`:

```bash
MODRINTH_PROJECTS=@/data/mods.txt
```

## Auto-Removal

When you remove a project from `MODRINTH_PROJECTS`, the corresponding file is automatically removed from the server.

```bash
# Remove sodium from the list
mcctl config myserver MODRINTH_PROJECTS "fabric-api,lithium"

# Restart to apply (sodium will be removed)
mcctl stop myserver && mcctl start myserver
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Mod not found | Wrong slug or ID | Verify slug from Modrinth URL |
| Version mismatch | Mod doesn't support server version | Use `VERSION_FROM_MODRINTH_PROJECTS` or check compatibility |
| Missing dependencies | Dependencies not downloaded | Set `MODRINTH_DOWNLOAD_DEPENDENCIES: "required"` |
| Wrong loader | Auto-detection failed | Use loader prefix or `MODRINTH_LOADER` |

### Check Current Configuration

```bash
# View all configuration
mcctl config myserver

# View specific setting
mcctl config myserver MODRINTH_PROJECTS
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

## See Also

- [Modrinth Official Website](https://modrinth.com/)
- [Modrinth API Documentation](https://docs.modrinth.com/)
- [Mods and Plugins Overview](index.md)
- [CurseForge Guide](curseforge.md)
- [CLI Commands Reference](../cli/commands.md)
- [Official itzg Documentation](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/modrinth/)
