# Mods and Plugins

How to install and manage mods and plugins.

## Overview

- **Mods**: Used with Forge/Fabric/Quilt servers, client installation also required
- **Plugins**: Used with Paper/Spigot/Bukkit servers, server-side only

## Basic Installation Methods

### Volume Mounts

```yaml
volumes:
  - ./data:/data
  - ./mods:/mods:ro      # Mods (read-only)
  - ./plugins:/plugins:ro # Plugins (read-only)
  - ./config:/config      # Configuration files
```

### Download via Environment Variables

| Variable | Description |
|----------|-------------|
| `MODS` | List of mod URLs (comma/space separated) |
| `PLUGINS` | List of plugin URLs |
| `MODS_FILE` | File containing mod URL list |
| `PLUGINS_FILE` | File containing plugin URL list |

### Auto-removal

When items are removed from `MODS`, `PLUGINS`, or `MODRINTH_PROJECTS` lists, the corresponding files are automatically deleted from the server. This ensures clean mod/plugin management without manual cleanup.

!!! tip "No manual cleanup needed"
    Simply remove an entry from the environment variable list, and on the next server start the previously downloaded file will be removed automatically.

---

## Download from Modrinth

### MODRINTH_PROJECTS

Automatically download mods/plugins from Modrinth:

```yaml
environment:
  MODRINTH_PROJECTS: |
    fabric-api
    lithium
    sodium
    iris
```

### Specify Version and Prefix

Each project entry supports multiple formats:

| Format | Description | Example |
|--------|-------------|---------|
| `project` | Latest release | `fabric-api` |
| `project:version_id` | Specific version | `fabric-api:abcd1234` |
| `project:release_type` | Release type | `lithium:beta` |
| `prefix:project` | Loader/type prefix | `datapack:my-datapack` |

**Available Prefixes**:

| Prefix | Description |
|--------|-------------|
| `datapack` | Install as a datapack instead of mod |
| `fabric` | Force Fabric loader type |
| `forge` | Force Forge loader type |
| `paper` | Force Paper plugin type |

```yaml
environment:
  MODRINTH_PROJECTS: |
    fabric-api:version_id
    lithium:beta
    sodium:release
    datapack:terralith
    forge:jei
```

### Additional Options

| Variable | Default | Description |
|----------|---------|-------------|
| `MODRINTH_DOWNLOAD_DEPENDENCIES` | `none` | `required`, `optional` |
| `MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE` | `release` | `beta`, `alpha` |
| `VERSION_FROM_MODRINTH_PROJECTS` | `false` | Automatically determines the latest Minecraft version that **all** listed mods support |
| `MODRINTH_LOADER` | (auto) | Override loader type for Modrinth downloads (e.g., `fabric`, `forge`) |

!!! info "`VERSION_FROM_MODRINTH_PROJECTS`"
    When set to `true`, the server will automatically determine the latest Minecraft version that **all** listed Modrinth projects support. This is useful for keeping mod compatibility without manually tracking version support across mods.

!!! tip "`MODRINTH_LOADER`"
    Override the loader type sent to Modrinth API. Useful for custom server setups, for example when using **Sinytra Connector** with Forge to load Fabric mods:
    ```yaml
    environment:
      TYPE: "FORGE"
      MODRINTH_LOADER: "fabric"  # Download Fabric versions for use with Sinytra Connector
    ```

```yaml
environment:
  TYPE: "FABRIC"
  VERSION_FROM_MODRINTH_PROJECTS: "true"
  MODRINTH_DOWNLOAD_DEPENDENCIES: "required"
  MODRINTH_PROJECTS: |
    fabric-api
    lithium
```

### Modrinth Modpacks

Install modpacks from Modrinth using `MODRINTH_MODPACK`:

```yaml
environment:
  MODRINTH_MODPACK: "adrenaline"
```

#### Modpack Options

| Variable | Default | Description |
|----------|---------|-------------|
| `MODRINTH_MODPACK` | | Modpack project slug, ID, or URL |
| `MODRINTH_FORCE_INCLUDE_FILES` | | Force include specific files that would otherwise be excluded |
| `MODRINTH_DEFAULT_EXCLUDE_INCLUDES` | `false` | Disable the default exclude/include behavior |
| `MODRINTH_OVERRIDES_EXCLUSIONS` | | Exclude files from overrides using ant-style patterns (e.g., `*.txt,config/unwanted/**`) |
| `MODRINTH_FORCE_SYNCHRONIZE` | `false` | Force re-synchronization of modpack files on every start |

---

## Download from CurseForge

### Required Setup

CurseForge API key is required:

```yaml
environment:
  CF_API_KEY: "${CF_API_KEY}"
```

### CURSEFORGE_FILES

```yaml
environment:
  CF_API_KEY: "${CF_API_KEY}"
  CURSEFORGE_FILES: |
    jei
    journeymap
    jade
```

### Additional CurseForge Options

| Variable | Default | Description |
|----------|---------|-------------|
| `CF_API_KEY` | | **Required**. CurseForge API key |
| `CF_MOD_LOADER_VERSION` | (auto) | Override the mod loader version for CurseForge modpacks |

!!! tip "`CF_MOD_LOADER_VERSION`"
    Use this to pin a specific mod loader version when installing CurseForge modpacks. By default, the version specified in the modpack manifest is used.

### Supported Formats

- Project page URL: `https://www.curseforge.com/minecraft/mc-mods/jei`
- Slug: `jei`
- Project ID: `238222`
- Slug:FileID: `jei:4593548`
- List file: `@/extras/cf-mods.txt`

---

## Download from Spiget (SpigotMC)

Download Paper/Spigot plugins:

```yaml
environment:
  SPIGET_RESOURCES: "9089,34315"  # Resource IDs
```

Find the resource ID from the SpigotMC page URL:
`https://www.spigotmc.org/resources/example-plugin.12345/` → ID: `12345`

---

## Extra Files

Download additional configuration or resource files using `APPLY_EXTRA_FILES`:

| Variable | Description |
|----------|-------------|
| `APPLY_EXTRA_FILES` | Download extra files. Format: `destination<source_url` |

The format uses `<` to separate the destination path from the source URL:

```yaml
environment:
  APPLY_EXTRA_FILES: |
    config/extra.yml<https://example.com/extra.yml
    plugins/MyPlugin/config.yml<https://example.com/plugin-config.yml
```

!!! note
    Destination paths are relative to the server's `/data` directory. Files are downloaded on each server start, so they will be updated if the source changes.

---

## Packwiz Modpacks

Modpacks managed with Packwiz:

```yaml
environment:
  PACKWIZ_URL: "https://example.com/pack.toml"
```

---

## Mod/Plugin List Files

### File Format

`/data/mods.txt` or URL:

```text
# Comment
https://example.com/mod1.jar
https://example.com/mod2.jar

# Empty lines are ignored
modrinth:fabric-api
curseforge:jei
```

### Usage

```yaml
environment:
  MODS_FILE: "/data/mods.txt"
  # or
  PLUGINS_FILE: "https://example.com/plugins.txt"
```

---

## ZIP File Modpacks

```yaml
environment:
  MODPACK: "https://example.com/modpack.zip"
```

### Generic Pack

Support for multiple packs:

```yaml
environment:
  GENERIC_PACKS: |
    https://example.com/pack1.zip
    https://example.com/pack2.zip
```

---

## Auto Cleanup

### Remove Old Mods

```yaml
environment:
  REMOVE_OLD_MODS: "TRUE"
```

### Exclude Specific Mods

```yaml
environment:
  REMOVE_OLD_MODS: "TRUE"
  REMOVE_OLD_MODS_INCLUDE: "*.jar"
  REMOVE_OLD_MODS_EXCLUDE: "keep-this-mod.jar"
```

---

## Example Configurations

### Fabric + Modrinth Mods

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
        phosphor
        ferritecore
    volumes:
      - ./data:/data
```

### Paper + Plugins

```yaml
services:
  mc:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"
      SPIGET_RESOURCES: "9089"  # EssentialsX
      MODRINTH_PROJECTS: |
        luckperms
        vault
    volumes:
      - ./data:/data
```

### Forge + CurseForge Mods

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      VERSION: "1.20.1"
      CF_API_KEY: "${CF_API_KEY}"
      CURSEFORGE_FILES: |
        jei
        journeymap
        jade
    volumes:
      - ./data:/data
```

### Mixed Sources

```yaml
environment:
  MODRINTH_PROJECTS: "fabric-api,lithium"
  MODS: |
    https://example.com/custom-mod.jar
  MODS_FILE: "/data/extra-mods.txt"
```
