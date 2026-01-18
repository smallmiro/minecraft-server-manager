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

### Specify Version

```yaml
environment:
  MODRINTH_PROJECTS: |
    fabric-api:version_id
    lithium:beta
    sodium:release
```

### Additional Options

| Variable | Default | Description |
|----------|---------|-------------|
| `MODRINTH_DOWNLOAD_DEPENDENCIES` | `none` | `required`, `optional` |
| `MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE` | `release` | `beta`, `alpha` |
| `VERSION_FROM_MODRINTH_PROJECTS` | `false` | Auto-set version based on mod support |

```yaml
environment:
  TYPE: "FABRIC"
  VERSION_FROM_MODRINTH_PROJECTS: "true"
  MODRINTH_DOWNLOAD_DEPENDENCIES: "required"
  MODRINTH_PROJECTS: |
    fabric-api
    lithium
```

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
