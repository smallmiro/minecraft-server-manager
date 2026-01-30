# Direct Download

Download mods and plugins directly from URLs or use local files.

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
| Shared Directories | Local directories | Local or manually downloaded files |

## Quick Start with mcctl

### Using Direct URLs

```bash
# Create a Fabric server
mcctl create modded --type FABRIC --version 1.21.1

# Add mods from direct URLs
mcctl config modded MODS "https://example.com/custom-mod.jar,https://github.com/user/repo/releases/download/v1.0/mod.jar"

# Restart to apply
mcctl stop modded && mcctl start modded
```

### Using Shared Directories

mcctl creates shared directories for mods and plugins:

```
~/minecraft-servers/
  shared/
    mods/       # Place mod JARs here
    plugins/    # Place plugin JARs here
```

Simply place your files in these directories and they are automatically available to all servers.

## Configuration via mcctl

### MODS Variable

For Forge/Fabric servers, download mods from URLs:

```bash
# Single mod
mcctl config myserver MODS "https://example.com/custom-mod.jar"

# Multiple mods (comma-separated)
mcctl config myserver MODS "https://example.com/mod1.jar,https://example.com/mod2.jar"

# Restart to apply
mcctl stop myserver && mcctl start myserver
```

### PLUGINS Variable

For Paper/Spigot servers, download plugins from URLs:

```bash
# Single plugin
mcctl config myserver PLUGINS "https://example.com/custom-plugin.jar"

# Multiple plugins
mcctl config myserver PLUGINS "https://example.com/plugin1.jar,https://example.com/plugin2.jar"

# Restart to apply
mcctl stop myserver && mcctl start myserver
```

### Supported Delimiters

URLs can be separated by:

- Commas: `url1,url2,url3`
- Spaces: `url1 url2 url3`
- Newlines (in config.env multi-line format)

## Configuration Reference

| Config Key | Description |
|------------|-------------|
| `MODS` | Comma/space/newline separated mod URLs or container paths |
| `PLUGINS` | Comma/space/newline separated plugin URLs or container paths |

## Shared Directories

### Directory Structure

mcctl init creates these shared directories:

```
~/minecraft-servers/
  shared/
    mods/       # Shared mod files (Forge, Fabric)
    plugins/    # Shared plugin files (Paper, Spigot)
```

### Using Shared Directories

1. Place JAR files in the appropriate directory
2. Files are automatically mounted to all servers (read-only)
3. No configuration needed

```bash
# Example: Add a custom mod
cp ~/downloads/custom-mod.jar ~/minecraft-servers/shared/mods/

# The mod is automatically available to all Forge/Fabric servers
```

### Benefits

- **Shared across servers**: One file serves all servers
- **No configuration needed**: Just drop files in the directory
- **Read-only mount**: Server cannot modify source files
- **Easy updates**: Replace file, restart servers

## Complete Examples

### GitHub Releases Download

```bash
# Create server
mcctl create modded --type FABRIC --version 1.21.1

# Add mods from GitHub releases
mcctl config modded MODS "https://github.com/CaffeineMC/sodium-fabric/releases/download/mc1.21-0.6.0/sodium-fabric-0.6.0+mc1.21.jar"

# Restart to apply
mcctl stop modded && mcctl start modded
```

### Mixed Sources

```bash
# Create server
mcctl create modded --type FABRIC --version 1.21.1

# Direct URLs for custom mods
mcctl config modded MODS "https://example.com/custom-mod.jar"

# Modrinth for popular mods
mcctl config modded MODRINTH_PROJECTS "fabric-api,lithium,sodium"

# Restart to apply
mcctl stop modded && mcctl start modded
```

### Local Development Setup

For mod development with local builds:

1. Build your mod
2. Copy to shared directory
3. Restart server

```bash
# Copy built mod to shared directory
cp ~/my-mod/build/libs/my-mod-1.0.jar ~/minecraft-servers/shared/mods/

# Restart server to load the mod
mcctl stop modded && mcctl start modded
```

### Server Network with Shared Plugins

All servers share the same plugins from `shared/plugins/`:

```bash
# Create multiple servers
mcctl create lobby --type PAPER --version 1.21.1
mcctl create survival --type PAPER --version 1.21.1
mcctl create creative --type PAPER --version 1.21.1

# Place shared plugins
cp luckperms.jar ~/minecraft-servers/shared/plugins/
cp vault.jar ~/minecraft-servers/shared/plugins/

# All servers now have these plugins
mcctl start --all
```

## Advanced Configuration (Manual)

For advanced configurations, edit `config.env` directly:

```bash
nano ~/minecraft-servers/servers/myserver/config.env
```

Example `config.env`:

```bash
# Direct mod URLs (multi-line format)
MODS=https://example.com/mod1.jar
https://example.com/mod2.jar
https://github.com/user/repo/releases/download/v1.0/mod3.jar

# Auto-cleanup settings
REMOVE_OLD_MODS=TRUE
```

### Using File Lists

For very large mod lists:

```bash
# Create mod list file
nano ~/minecraft-servers/servers/myserver/data/mods.txt
```

Content of `mods.txt`:

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

Then set MODS_FILE in `config.env`:

```bash
MODS_FILE=/data/mods.txt
```

### Sync Path Customization

Customize where mods/plugins are synced:

```bash
# In config.env
COPY_MODS_SRC=/custom-mods
COPY_MODS_DEST=/data/mods
COPY_PLUGINS_SRC=/custom-plugins
COPY_PLUGINS_DEST=/data/plugins
```

## Auto Cleanup

### Remove Old Mods

Configure automatic cleanup before applying new content:

```bash
mcctl config myserver REMOVE_OLD_MODS "TRUE"
```

### Exclude Specific Files

```bash
mcctl config myserver REMOVE_OLD_MODS_INCLUDE "*.jar"
mcctl config myserver REMOVE_OLD_MODS_EXCLUDE "keep-this-mod.jar"
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Download failed | Invalid URL or network issue | Verify URL is accessible |
| File not found | Wrong path | Check shared directory location |
| Permission denied | File permissions | Ensure files are readable |
| Mods not loading | Wrong server type | Verify TYPE matches mod loader |

### Check Current Configuration

```bash
# View all configuration
mcctl config myserver

# View MODS setting
mcctl config myserver MODS
```

### View Server Logs

```bash
# Check for mod/plugin loading errors
mcctl logs myserver

# Follow logs in real-time
mcctl logs myserver -f
```

### Debug Mode

Enable debug output to troubleshoot:

```bash
mcctl config myserver DEBUG "true"
mcctl stop myserver && mcctl start myserver
mcctl logs myserver
```

### Verify URL Access

Test URL accessibility:

```bash
curl -I "https://example.com/mod.jar"
```

### Check Shared Directory

```bash
# List shared mods
ls -la ~/minecraft-servers/shared/mods/

# List shared plugins
ls -la ~/minecraft-servers/shared/plugins/
```

## See Also

- [Mods and Plugins Overview](index.md)
- [Modrinth Guide](modrinth.md)
- [CurseForge Guide](curseforge.md)
- [Spiget Guide](spiget.md)
- [CLI Commands Reference](../cli/commands.md)
- [Official itzg Documentation](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/)
