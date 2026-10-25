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
| Shared plugins directory | `shared/plugins/`, mounted in every server | Manually downloaded plugins |
| Server data folder | `servers/<name>/data/mods/` | Local mod files for one server |

## Quick Start with mcctl

### Using Direct URLs

```bash
# Create a Fabric server
mcctl create modded -t FABRIC -v 1.21.1

# Add mods from direct URLs
mcctl config modded MODS "https://example.com/custom-mod.jar,https://github.com/user/repo/releases/download/v1.0/mod.jar"

# Restart to apply
mcctl stop modded && mcctl start modded
```

### Using Local Files

- Plugins: put JARs in `~/minecraft-servers/shared/plugins/`. Every server mounts it read-only at `/plugins`, and the image copies the JARs into the server's `plugins/` folder when the server starts.
- Mods: put JARs in the server's own `~/minecraft-servers/servers/<name>/data/mods/`. There is no shared mods folder.

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

### With mcctl mod

```bash
# Append a URL: to PLUGINS on plugin servers (Paper and its forks, Spigot, Bukkit), to MODS on the others
mcctl mod add myserver --url https://example.com/custom-mod.jar
```

### Supported Delimiters

URLs can be separated by:

- Commas: `url1,url2,url3`
- Spaces: `url1 url2 url3`
- Newlines: only in a file named by `MODS_FILE` or `PLUGINS_FILE` (see [Using File Lists](#using-file-lists))

## Configuration Reference

| Config Key | Description |
|------------|-------------|
| `MODS` | Comma- or space-separated mod URLs or container paths |
| `PLUGINS` | Comma- or space-separated plugin URLs or container paths |

## Shared Directories

### Directory Structure

`mcctl init` creates `shared/`. A server's `data/` folder is its `/data` in the container:

```
~/minecraft-servers/
  shared/
    plugins/    # Mounted read-only at /plugins in every server
    mods/       # Not mounted by servers
  servers/<name>/data/
    mods/       # This server's mods (/data/mods)
    plugins/    # This server's plugins (/data/plugins)
```

### Using Shared Directories

1. Place plugin JAR files in `shared/plugins/`
2. Restart the servers; the image copies the JARs into each server's `plugins/` folder
3. No configuration needed

```bash
# Example: Add a custom plugin
cp ~/downloads/custom-plugin.jar ~/minecraft-servers/shared/plugins/

# Available to all Paper/Spigot servers after their next start

# A mod for one server goes into that server's data folder
cp ~/downloads/custom-mod.jar ~/minecraft-servers/servers/modded/data/mods/
```

### Benefits

Benefits of `shared/plugins/`:

- **Shared across servers**: One file serves all servers
- **No configuration needed**: Just drop files in the directory
- **Read-only mount**: Server cannot modify source files
- **Easy updates**: Replace file, restart servers

## Complete Examples

### GitHub Releases Download

```bash
# Create server
mcctl create modded -t FABRIC -v 1.21.1

# Add mods from GitHub releases
mcctl config modded MODS "https://github.com/CaffeineMC/sodium-fabric/releases/download/mc1.21-0.6.0/sodium-fabric-0.6.0+mc1.21.jar"

# Restart to apply
mcctl stop modded && mcctl start modded
```

### Mixed Sources

```bash
# Create server
mcctl create modded -t FABRIC -v 1.21.1

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
2. Copy it to the server's `data/mods/` folder
3. Restart server

```bash
# Copy built mod to the server's mods folder
cp ~/my-mod/build/libs/my-mod-1.0.jar ~/minecraft-servers/servers/modded/data/mods/

# Restart server to load the mod
mcctl stop modded && mcctl start modded
```

### Server Network with Shared Plugins

All servers share the same plugins from `shared/plugins/`:

```bash
# Create multiple servers without starting them
mcctl create lobby -t PAPER -v 1.21.1 --no-start
mcctl create survival -t PAPER -v 1.21.1 --no-start
mcctl create creative -t PAPER -v 1.21.1 --no-start

# Place shared plugins
cp luckperms.jar ~/minecraft-servers/shared/plugins/
cp vault.jar ~/minecraft-servers/shared/plugins/

# The servers start with these plugins
mcctl start --all
```

## Advanced Configuration (Manual)

For advanced configurations, edit `config.env` directly. Each value stays on one line; for long lists, use a file list (below).

```bash
nano ~/minecraft-servers/servers/myserver/config.env
```

Example `config.env`:

```bash
# Direct mod URLs (one line, comma-separated)
MODS=https://example.com/mod1.jar,https://example.com/mod2.jar,https://github.com/user/repo/releases/download/v1.0/mod3.jar

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
| File not found | Wrong path | Check the file is in `shared/plugins/` or the server's `data/mods/` |
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
# List a server's mods
ls -la ~/minecraft-servers/servers/myserver/data/mods/

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
