# Modpacks

Install pre-configured modpack collections from various sources.

## Overview

| Platform | Environment Variable | API Key Required | Best For |
|----------|---------------------|------------------|----------|
| [Packwiz](#packwiz) | `PACKWIZ_URL` | No | Custom/self-hosted modpacks |
| [CurseForge](#curseforge-modpacks) | `CF_PAGE_URL`, `CF_SLUG` | Yes | Popular modpacks |
| [Modrinth](#modrinth-modpacks) | `MODRINTH_MODPACK` | No | Open-source modpacks |
| [FTB](#ftb-modpacks) | `FTB_MODPACK_ID` | No | Feed the Beast modpacks |
| [ZIP Archive](#zip-modpacks) | `MODPACK`, `GENERIC_PACKS` | No | Manual/custom archives |

---

## Packwiz

[Packwiz](https://packwiz.infra.link/) is a command-line tool for creating and managing modpacks with support for both CurseForge and Modrinth sources.

### Basic Usage

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      PACKWIZ_URL: "https://example.com/modpack/pack.toml"
    volumes:
      - ./data:/data
```

### Environment Variables

| Variable | Description |
|----------|-------------|
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

### Basic Usage

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "AUTO_CURSEFORGE"
      CF_API_KEY: "${CF_API_KEY}"
      CF_PAGE_URL: "https://www.curseforge.com/minecraft/modpacks/all-the-mods-8"
    volumes:
      - ./data:/data
```

### Modpack Specification Methods

| Method | Description | Example |
|--------|-------------|---------|
| `CF_PAGE_URL` | Full modpack page URL | `https://www.curseforge.com/minecraft/modpacks/all-the-mods-8` |
| `CF_SLUG` | Short identifier from URL | `all-the-mods-8` |
| `CF_FILE_ID` | Specific file ID for version pinning | `4567890` |
| `CF_FILENAME_MATCHER` | Substring to match filename | `server` |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `CF_API_KEY` | CurseForge API key (required) |
| `CF_API_KEY_FILE` | Path to file containing API key |
| `CF_PAGE_URL` | Full URL to modpack or specific file |
| `CF_SLUG` | Short identifier from URL path |
| `CF_FILE_ID` | Specific file ID for version pinning |
| `CF_FILENAME_MATCHER` | Substring for desired filename matching |

### Mod Filtering

| Variable | Description |
|----------|-------------|
| `CF_EXCLUDE_MODS` | Comma/space-delimited project slugs or IDs to exclude |
| `CF_FORCE_INCLUDE_MODS` | Force inclusion of mods incorrectly tagged as client-only |
| `CF_EXCLUDE_ALL_MODS` | Exclude all mods (for server-only setup) |
| `CF_EXCLUDE_INCLUDE_FILE` | Path to JSON configuration for complex exclusions |

### Advanced Options

| Variable | Default | Description |
|----------|---------|-------------|
| `CF_MOD_LOADER_VERSION` | auto | Override mod loader version |
| `CF_OVERRIDES_EXCLUSIONS` | - | Ant-style path patterns for excluding override files |
| `CF_PARALLEL_DOWNLOADS` | 4 | Number of concurrent mod downloads |
| `CF_FORCE_REINSTALL_MODLOADER` | false | Force reinstallation of mod loader |
| `CF_FORCE_SYNCHRONIZE` | false | Re-evaluate exclusions/inclusions |
| `CF_SET_LEVEL_FROM` | - | Set world data from `WORLD_FILE` or `OVERRIDES` |

### Manual Downloads

For mods that restrict automated downloads:

```yaml
environment:
  CF_DOWNLOADS_REPO: "/downloads"  # Default path
volumes:
  - ./manual-downloads:/downloads:ro
```

Place manually downloaded files in `./manual-downloads/`.

### Unpublished Modpacks

For unpublished or local modpacks:

```yaml
environment:
  TYPE: "AUTO_CURSEFORGE"
  CF_API_KEY: "${CF_API_KEY}"
  CF_MODPACK_ZIP: "/modpacks/my-modpack.zip"
volumes:
  - ./modpacks:/modpacks:ro
```

Or use manifest only:

```yaml
environment:
  CF_MODPACK_MANIFEST: "/modpacks/manifest.json"
```

### Complete Example

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "AUTO_CURSEFORGE"
      CF_API_KEY: "${CF_API_KEY}"
      CF_PAGE_URL: "https://www.curseforge.com/minecraft/modpacks/all-the-mods-8"
      MEMORY: "8G"
      CF_EXCLUDE_MODS: "optifine,journeymap"  # Exclude client-only mods
      CF_PARALLEL_DOWNLOADS: "6"
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```

---

## Modrinth Modpacks

Install modpacks from [Modrinth](https://modrinth.com/modpacks).

### Basic Usage

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "MODRINTH"
      MODRINTH_MODPACK: "cobblemon-modpack"
    volumes:
      - ./data:/data
```

### Modpack Specification Methods

| Method | Description | Example |
|--------|-------------|---------|
| Project slug | URL identifier | `cobblemon-modpack` |
| Project ID | Numeric ID | `1234567` |
| Page URL | Full modpack URL | `https://modrinth.com/modpack/cobblemon-modpack` |
| mrpack URL | Direct mrpack file URL | `https://example.com/pack.mrpack` |
| Local path | Container path | `/packs/custom.mrpack` |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MODRINTH_MODPACK` | - | Project slug, ID, URL, or path |
| `VERSION` | - | Set to `LATEST` or `SNAPSHOT` for auto-selection |
| `MODRINTH_MODPACK_VERSION_TYPE` | - | Narrow to `release`, `beta`, or `alpha` |
| `MODRINTH_VERSION` | - | Exact modpack version ID |
| `MODRINTH_LOADER` | auto | Specific loader: `forge`, `fabric`, `quilt` |

### File Management

| Variable | Description |
|----------|-------------|
| `MODRINTH_EXCLUDE_FILES` | Comma/newline list of partial filenames to exclude |
| `MODRINTH_FORCE_INCLUDE_FILES` | Force-include specific mods |
| `MODRINTH_IGNORE_MISSING_FILES` | Glob patterns for files to ignore |
| `MODRINTH_OVERRIDES_EXCLUSIONS` | Ant-style paths for override exclusions |
| `MODRINTH_FORCE_SYNCHRONIZE` | Set to `true` when iterating on mod compatibility |

### Complete Example

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "MODRINTH"
      MODRINTH_MODPACK: "cobblemon-modpack"
      MODRINTH_MODPACK_VERSION_TYPE: "release"
      MEMORY: "6G"
      MODRINTH_EXCLUDE_FILES: "optifine,shaders"
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```

---

## FTB Modpacks

Install modpacks from [Feed the Beast](https://www.feed-the-beast.com/modpacks).

### Basic Usage

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17-graalvm
    environment:
      EULA: "TRUE"
      TYPE: "FTBA"
      FTB_MODPACK_ID: "23"
    volumes:
      - ./data:/data
```

!!! info "FTBA vs FTB"
    Use `TYPE: "FTBA"` (with the "A" suffix). The "FTB" alias is deprecated and refers to CurseForge.

### Finding Modpack ID

The modpack ID is in the URL:

`https://www.feed-the-beast.com/modpacks/23-ftb-infinity-evolved-17` -> ID is `23`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `FTB_MODPACK_ID` | Numeric modpack ID (required) |
| `FTB_MODPACK_VERSION_ID` | Specific version ID (optional) |
| `FTB_FORCE_REINSTALL` | Set to `true` to force reinstallation |

### Upgrading

- **Auto-upgrade**: Without version pinning, restart container to get latest
- **Manual upgrade**: Update `FTB_MODPACK_VERSION_ID` and recreate container

### Complete Example

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17-graalvm
    environment:
      EULA: "TRUE"
      TYPE: "FTBA"
      FTB_MODPACK_ID: "23"
      MEMORY: "8G"
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```

---

## ZIP Modpacks

Install modpacks from ZIP archives.

### MODPACK Variable

For single modpack installation:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      MODPACK: "https://example.com/modpack.zip"
    volumes:
      - ./data:/data
```

### GENERIC_PACKS Variable

For multiple packs or additional content:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      GENERIC_PACKS: |
        https://example.com/base-pack.zip
        https://example.com/addon-pack.zip
    volumes:
      - ./data:/data
```

### Local ZIP Files

```yaml
environment:
  MODPACK: "/packs/custom-modpack.zip"
volumes:
  - ./packs:/packs:ro
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `MODPACK` | URL or container path to modpack ZIP |
| `GENERIC_PACKS` | Multiple pack URLs/paths (newline separated) |

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

### Debug Logging

```yaml
environment:
  DEBUG: "true"
```

## See Also

- [CurseForge Mods Guide](curseforge.md)
- [Modrinth Mods Guide](modrinth.md)
- [Mods and Plugins Overview](index.md)
- [Official itzg Documentation - Auto CurseForge](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/auto-curseforge/)
- [Official itzg Documentation - Modrinth Modpacks](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/modrinth-modpacks/)
- [Official itzg Documentation - FTB](https://docker-minecraft-server.readthedocs.io/en/latest/types-and-platforms/mod-platforms/ftb/)
- [Official itzg Documentation - Packwiz](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/packwiz/)
