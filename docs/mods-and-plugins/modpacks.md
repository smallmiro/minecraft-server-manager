# Modpacks

Install pre-configured modpack collections from various sources.

## Overview

| Platform | Config Key | API Key Required | Best For |
|----------|-----------|------------------|----------|
| [Packwiz](#packwiz) | `PACKWIZ_URL` | No | Custom/self-hosted modpacks |
| [CurseForge](#curseforge-modpacks) | `CF_PAGE_URL`, `CF_SLUG` | Yes | Popular modpacks |
| [Modrinth](#modrinth-modpacks) | `MODRINTH_MODPACK` | No | Open-source modpacks |
| [FTB](#ftb-modpacks) | `FTB_MODPACK_ID` | No | Feed the Beast modpacks |
| [ZIP Archive](#zip-modpacks) | `MODPACK`, `GENERIC_PACKS` | No | Manual/custom archives |

!!! note "Modpacks and Server Types"
    When installing modpacks, the server TYPE is often set automatically based on the modpack platform. For example, CurseForge modpacks use `TYPE=AUTO_CURSEFORGE` and Modrinth modpacks use `TYPE=MODRINTH`.

---

## Packwiz

[Packwiz](https://packwiz.infra.link/) is a command-line tool for creating and managing modpacks with support for both CurseForge and Modrinth sources.

### Quick Start with mcctl

```bash
# Create a Fabric server with Packwiz modpack
mcctl create modded --type FABRIC --version 1.21.1

# Set Packwiz modpack URL
mcctl config modded PACKWIZ_URL "https://example.com/modpack/pack.toml"

# Restart to apply
mcctl stop modded && mcctl start modded
```

### Configuration Reference

| Config Key | Description |
|------------|-------------|
| `PACKWIZ_URL` | URL to the `pack.toml` modpack definition file |

### Key Features

- **Processing Order**: Packwiz definitions are processed before other mod definitions (`MODPACK`, `MODS`, etc.), allowing for additional customization
- **Server-Side Only**: Pre-configured to download only server-compatible mods
- **Multiple Sources**: Supports both CurseForge and Modrinth mod sources

### Client-Side Mods

If client-side mods cause issues, ensure they are marked as `"client"` rather than `"both"` in the `pack.toml` side setting.

### Learn More

- [Packwiz Official Documentation](https://packwiz.infra.link/tutorials/getting-started/)

---

## CurseForge Modpacks

Install modpacks from [CurseForge](https://www.curseforge.com/minecraft/modpacks) with automatic upgrade support.

### Prerequisites

!!! warning "API Key Required"
    CurseForge requires an API key. See [CurseForge Guide](curseforge.md#getting-api-key) for setup instructions.

### Quick Start with mcctl

```bash
# Create server (TYPE is set automatically for CurseForge modpacks)
mcctl create modded

# Set server type for CurseForge modpack
mcctl config modded TYPE "AUTO_CURSEFORGE"

# Set modpack by page URL
mcctl config modded CF_PAGE_URL "https://www.curseforge.com/minecraft/modpacks/all-the-mods-8"

# Or by slug (shorter)
mcctl config modded CF_SLUG "all-the-mods-8"

# Set memory (modpacks typically need more)
mcctl config modded MEMORY "8G"

# Restart to apply
mcctl stop modded && mcctl start modded
```

### Modpack Specification Methods

| Method | Description | Example |
|--------|-------------|---------|
| `CF_PAGE_URL` | Full modpack page URL | `https://www.curseforge.com/minecraft/modpacks/all-the-mods-8` |
| `CF_SLUG` | Short identifier from URL | `all-the-mods-8` |
| `CF_FILE_ID` | Specific file ID for version pinning | `4567890` |
| `CF_FILENAME_MATCHER` | Substring to match filename | `server` |

### Configuration Reference

| Config Key | Description |
|------------|-------------|
| `CF_API_KEY` | CurseForge API key (required, set in `.env`) |
| `CF_PAGE_URL` | Full URL to modpack or specific file |
| `CF_SLUG` | Short identifier from URL path |
| `CF_FILE_ID` | Specific file ID for version pinning |
| `CF_FILENAME_MATCHER` | Substring for desired filename matching |

### Mod Filtering

```bash
# Exclude specific mods
mcctl config modded CF_EXCLUDE_MODS "optifine,journeymap"

# Force include mods incorrectly tagged as client-only
mcctl config modded CF_FORCE_INCLUDE_MODS "some-mod"

# Parallel download count
mcctl config modded CF_PARALLEL_DOWNLOADS "6"
```

| Config Key | Description |
|------------|-------------|
| `CF_EXCLUDE_MODS` | Comma/space-delimited project slugs or IDs to exclude |
| `CF_FORCE_INCLUDE_MODS` | Force inclusion of mods incorrectly tagged as client-only |
| `CF_EXCLUDE_ALL_MODS` | Exclude all mods (for server-only setup) |
| `CF_PARALLEL_DOWNLOADS` | Number of concurrent mod downloads (default: 4) |

### Complete Example

```bash
# Create and configure CurseForge modpack server
mcctl create atm8

# Configure modpack
mcctl config atm8 TYPE "AUTO_CURSEFORGE"
mcctl config atm8 CF_PAGE_URL "https://www.curseforge.com/minecraft/modpacks/all-the-mods-8"
mcctl config atm8 MEMORY "8G"
mcctl config atm8 CF_EXCLUDE_MODS "optifine,journeymap"
mcctl config atm8 CF_PARALLEL_DOWNLOADS "6"

# Start server
mcctl start atm8
```

---

## Modrinth Modpacks

Install modpacks from [Modrinth](https://modrinth.com/modpacks).

### Quick Start with mcctl

```bash
# Create server
mcctl create modded

# Set server type for Modrinth modpack
mcctl config modded TYPE "MODRINTH"

# Set modpack by slug
mcctl config modded MODRINTH_MODPACK "cobblemon-modpack"

# Set memory
mcctl config modded MEMORY "6G"

# Restart to apply
mcctl stop modded && mcctl start modded
```

### Modpack Specification Methods

| Method | Description | Example |
|--------|-------------|---------|
| Project slug | URL identifier | `cobblemon-modpack` |
| Project ID | Numeric ID | `1234567` |
| Page URL | Full modpack URL | `https://modrinth.com/modpack/cobblemon-modpack` |
| mrpack URL | Direct mrpack file URL | `https://example.com/pack.mrpack` |
| Local path | Container path | `/packs/custom.mrpack` |

### Configuration Reference

| Config Key | Default | Description |
|------------|---------|-------------|
| `MODRINTH_MODPACK` | - | Project slug, ID, URL, or path |
| `VERSION` | - | Set to `LATEST` or `SNAPSHOT` for auto-selection |
| `MODRINTH_MODPACK_VERSION_TYPE` | - | Narrow to `release`, `beta`, or `alpha` |
| `MODRINTH_VERSION` | - | Exact modpack version ID |
| `MODRINTH_LOADER` | auto | Specific loader: `forge`, `fabric`, `quilt` |

### File Management

```bash
# Exclude specific files
mcctl config modded MODRINTH_EXCLUDE_FILES "optifine,shaders"

# Force include specific mods
mcctl config modded MODRINTH_FORCE_INCLUDE_FILES "some-server-mod"

# Force synchronize (when iterating on mod compatibility)
mcctl config modded MODRINTH_FORCE_SYNCHRONIZE "true"
```

### Complete Example

```bash
# Create and configure Modrinth modpack server
mcctl create cobblemon

# Configure modpack
mcctl config cobblemon TYPE "MODRINTH"
mcctl config cobblemon MODRINTH_MODPACK "cobblemon-modpack"
mcctl config cobblemon MODRINTH_MODPACK_VERSION_TYPE "release"
mcctl config cobblemon MEMORY "6G"
mcctl config cobblemon MODRINTH_EXCLUDE_FILES "optifine,shaders"

# Start server
mcctl start cobblemon
```

---

## FTB Modpacks

Install modpacks from [Feed the Beast](https://www.feed-the-beast.com/modpacks).

### Quick Start with mcctl

```bash
# Create server
mcctl create ftb

# Set server type (use FTBA, not FTB)
mcctl config ftb TYPE "FTBA"

# Set modpack ID (from URL)
mcctl config ftb FTB_MODPACK_ID "23"

# Set memory (FTB packs are large)
mcctl config ftb MEMORY "8G"

# Restart to apply
mcctl stop ftb && mcctl start ftb
```

!!! info "FTBA vs FTB"
    Use `TYPE: "FTBA"` (with the "A" suffix). The "FTB" alias is deprecated and refers to CurseForge.

### Finding Modpack ID

The modpack ID is in the URL:

`https://www.feed-the-beast.com/modpacks/23-ftb-infinity-evolved-17` -> ID is `23`

### Configuration Reference

| Config Key | Description |
|------------|-------------|
| `FTB_MODPACK_ID` | Numeric modpack ID (required) |
| `FTB_MODPACK_VERSION_ID` | Specific version ID (optional) |
| `FTB_FORCE_REINSTALL` | Set to `true` to force reinstallation |

### Upgrading

- **Auto-upgrade**: Without version pinning, restart container to get latest
- **Manual upgrade**: Update `FTB_MODPACK_VERSION_ID` and recreate container

### Complete Example

```bash
# Create and configure FTB modpack server
mcctl create infinity

# Configure modpack
mcctl config infinity TYPE "FTBA"
mcctl config infinity FTB_MODPACK_ID "23"
mcctl config infinity MEMORY "8G"

# Start server
mcctl start infinity
```

---

## ZIP Modpacks

Install modpacks from ZIP archives.

### Quick Start with mcctl

```bash
# Create server with appropriate type
mcctl create modded --type FORGE

# Set modpack URL
mcctl config modded MODPACK "https://example.com/modpack.zip"

# Restart to apply
mcctl stop modded && mcctl start modded
```

### Multiple Packs

For multiple packs or additional content:

```bash
# Set multiple packs (comma-separated)
mcctl config modded GENERIC_PACKS "https://example.com/base-pack.zip,https://example.com/addon-pack.zip"
```

### Configuration Reference

| Config Key | Description |
|------------|-------------|
| `MODPACK` | URL or container path to modpack ZIP |
| `GENERIC_PACKS` | Multiple pack URLs/paths (comma/newline separated) |

---

## Comparison Table

| Feature | Packwiz | CurseForge | Modrinth | FTB | ZIP |
|---------|---------|------------|----------|-----|-----|
| API Key | No | Yes | No | No | No |
| Auto-upgrade | Yes | Yes | Yes | Yes | No |
| Version Control | pack.toml | CF_FILE_ID | MODRINTH_VERSION | FTB_MODPACK_VERSION_ID | Manual |
| Custom Mods | Yes | Limited | Limited | No | Yes |
| Dependency Resolution | Yes | Partial | Yes | Yes | No |
| Multi-source Support | Yes | No | No | No | N/A |

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Modpack not loading | Wrong TYPE | Set appropriate TYPE (AUTO_CURSEFORGE, MODRINTH, FTBA) |
| Missing mods | Client-only exclusion | Use CF_FORCE_INCLUDE_MODS or MODRINTH_FORCE_INCLUDE_FILES |
| Out of memory | Insufficient allocation | Increase MEMORY value (8G+ recommended for large packs) |
| Version mismatch | Incompatible versions | Pin specific version with version ID variables |

### Check Current Configuration

```bash
# View all configuration
mcctl config myserver

# View specific settings
mcctl config myserver TYPE
mcctl config myserver CF_PAGE_URL
mcctl config myserver MODRINTH_MODPACK
```

### View Server Logs

```bash
# Check for modpack loading errors
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

## Advanced Configuration (Manual)

For complex configurations, edit `config.env` directly:

```bash
nano ~/minecraft-servers/servers/myserver/config.env
```

Example `config.env` for CurseForge modpack:

```bash
TYPE=AUTO_CURSEFORGE
CF_PAGE_URL=https://www.curseforge.com/minecraft/modpacks/all-the-mods-8
MEMORY=8G
CF_EXCLUDE_MODS=optifine,journeymap
CF_PARALLEL_DOWNLOADS=6
```

Example `config.env` for Modrinth modpack:

```bash
TYPE=MODRINTH
MODRINTH_MODPACK=cobblemon-modpack
MODRINTH_MODPACK_VERSION_TYPE=release
MEMORY=6G
```

## See Also

- [CurseForge Mods Guide](curseforge.md)
- [Modrinth Mods Guide](modrinth.md)
- [Mods and Plugins Overview](index.md)
- [CLI Commands Reference](../cli/commands.md)
- [Official itzg Documentation - Auto CurseForge](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/auto-curseforge/)
- [Official itzg Documentation - Modrinth Modpacks](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/modrinth-modpacks/)
- [Official itzg Documentation - FTB](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/ftb/)
- [Official itzg Documentation - Packwiz](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/packwiz/)
