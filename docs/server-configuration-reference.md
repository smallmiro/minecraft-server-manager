# mcctl Server Configuration Reference

> **Version**: 1.14.0
> **Last Updated**: 2026-02-08
> **Purpose**: Complete reference for all server creation and configuration options in mcctl

This document provides an exhaustive reference for creating and configuring Minecraft servers using `mcctl`. It covers every environment variable, server type, Java version requirement, mod installation method, and performance tuning option available through the `itzg/minecraft-server` Docker image as managed by mcctl.

---

## Table of Contents

1. [Server Creation](#1-server-creation)
2. [Server Types](#2-server-types-complete-reference)
3. [All Environment Variables](#3-all-environment-variables)
4. [How mcctl Maps to Docker Environment](#4-how-mcctl-maps-to-docker-environment)
5. [Java Version Compatibility Matrix](#5-java-version-compatibility-matrix)
6. [Mod and Plugin Installation](#6-mod-and-plugin-installation)
7. [Performance Optimization](#7-performance-optimization)
8. [Common Configuration Recipes](#8-common-configuration-recipes)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Server Creation

### Via CLI: `mcctl create`

The `mcctl create` command supports both interactive and non-interactive modes.

**Synopsis:**

```bash
mcctl create [name] [options]
```

If `name` is omitted, mcctl enters interactive mode with prompts for all options.

**Options:**

| Flag | Short | Description |
|------|-------|-------------|
| `--type TYPE` | `-t` | Server type: `PAPER`, `VANILLA`, `FORGE`, `FABRIC`, `NEOFORGE`, `QUILT`, `SPIGOT`, `PURPUR` |
| `--version VERSION` | `-v` | Minecraft version (e.g., `1.21.1`, `1.20.4`, `LATEST`) |
| `--seed NUMBER` | `-s` | World seed for generation |
| `--world-url URL` | `-u` | Download world from a ZIP URL |
| `--world NAME` | `-w` | Use an existing world from the shared `worlds/` directory |
| `--no-start` | | Create the server without starting it |
| `--root PATH` | | Custom data directory (default: `~/minecraft-servers`) |
| `--sudo-password PWD` | | Sudo password for mDNS hostname registration |

**Examples:**

```bash
# Interactive mode (prompts for all options)
mcctl create

# Non-interactive with all options
mcctl create survival -t PAPER -v 1.21.1

# Forge modded server, don't auto-start
mcctl create modded -t FORGE -v 1.20.4 --no-start

# With specific seed
mcctl create creative -t VANILLA -v 1.21.1 --seed 12345

# Using an existing world
mcctl create myserver -t PAPER -v 1.21.1 --world my-existing-world

# Download world from URL
mcctl create imported -t PAPER -v 1.21.1 --world-url https://example.com/world.zip
```

### Interactive Mode Flow

When running `mcctl create` without a name, the interactive prompts are:

**Standard server types (PAPER, FORGE, FABRIC, etc.):**

1. **Server name** - alphanumeric, lowercase, hyphens allowed
2. **Server type** - select from available types (PAPER is default)
3. **Minecraft version** - type or select version
4. **World selection** - create new world, use existing, or download from URL
5. **World seed** (optional) - if creating new world
6. **Memory** - memory allocation (default: 4G)
7. **Confirmation** - review settings before creation

**MODRINTH modpack servers (v1.14.0+):**

1. **Server name** - alphanumeric, lowercase, hyphens allowed
2. **Server type** - select MODRINTH
3. **Modpack slug** - enter Modrinth modpack slug or URL (e.g., `cobblemon`, `adrenaserver`)
4. **Mod loader** - select from loaders dynamically fetched from Modrinth API. Only loaders supported by the modpack are shown (e.g., if the modpack only supports `fabric` and `quilt`, then `forge` and `neoforge` are excluded). Options: Auto-detect, Fabric, Forge, NeoForge, Quilt
5. **Modpack version** - specific version or leave empty for latest
6. **Memory** - memory allocation (default: 6G for modpacks)
7. **World selection** - create new world, use existing, or download from URL
8. **Confirmation** - review settings before creation

> **Note**: Minecraft version is skipped for modpack servers as it is determined by the modpack.

### Via REST API: `POST /api/servers`

```bash
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "survival",
    "type": "PAPER",
    "version": "1.21.1",
    "memory": "4G"
  }' \
  http://localhost:5001/api/servers
```

**Request body fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Server name |
| `type` | string | No | Server type (default: `PAPER`). Use `MODRINTH` for modpacks |
| `version` | string | No | Minecraft version (default: `LATEST`) |
| `memory` | string | No | Memory allocation (default: `4G`) |
| `modpack` | string | No | Modrinth modpack slug, ID, or URL (required for `MODRINTH` type) |
| `modpackVersion` | string | No | Specific modpack version ID (empty for latest) |
| `modLoader` | string | No | Mod loader override: `forge`, `fabric`, `neoforge`, `quilt` (empty for auto-detect) |
| `seed` | string | No | World seed |
| `worldUrl` | string | No | Download world from a ZIP URL |
| `worldName` | string | No | Use existing world from worlds/ |
| `autoStart` | boolean | No | Start server after creation (default: `true`) |
| `sudoPassword` | string | No | Sudo password for mDNS registration |

**Example: MODRINTH modpack server via REST API (v1.14.0+):**

```bash
curl -X POST -H "X-API-Key: mctk_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cobblemon",
    "type": "MODRINTH",
    "memory": "6G",
    "modpack": "cobblemon-modpack",
    "modLoader": "fabric"
  }' \
  http://localhost:5001/api/servers
```

### What Happens During Creation

1. Server directory created at `~/minecraft-servers/servers/<name>/`
2. `config.env` generated from template with specified options
3. `docker-compose.yml` generated with container name `mc-<name>`
4. Server registered in `servers/compose.yml` (Docker Compose include list)
5. mDNS hostname registered via avahi-daemon (if installed, requires sudo)
6. nip.io hostname configured: `<name>.<HOST_IP>.nip.io`
7. Server container started (unless `--no-start` flag used)

---

## 2. Server Types (Complete Reference)

Select the server type with the `TYPE` environment variable in `config.env`, or via the `-t` flag during `mcctl create`.

### Server Type Summary

| Type | Category | Plugins | Mods | Description |
|------|----------|---------|------|-------------|
| `VANILLA` | Official | No | No | Official Mojang server |
| `PAPER` | Plugin | Yes | No | High-performance Spigot fork (recommended) |
| `PURPUR` | Plugin | Yes | No | Paper fork with additional features |
| `PUFFERFISH` | Plugin | Yes | No | Performance-optimized Paper fork |
| `FOLIA` | Plugin | Yes | No | Multi-threaded Paper fork |
| `LEAF` | Plugin | Yes | No | Lightweight Paper fork |
| `SPIGOT` | Plugin | Yes | No | Original CraftBukkit fork |
| `BUKKIT` | Plugin | Yes | No | Original plugin API server |
| `FORGE` | Mod | No | Yes | Forge mod loader |
| `NEOFORGE` | Mod | No | Yes | Community Forge fork (1.20.1+) |
| `FABRIC` | Mod | No | Yes | Lightweight mod loader |
| `QUILT` | Mod | No | Yes | Fabric-compatible mod loader |
| `MOHIST` | Hybrid | Yes | Yes | Forge + Bukkit hybrid |
| `MAGMA_MAINTAINED` | Hybrid | Yes | Yes | Forge + Bukkit hybrid |
| `ARCLIGHT` | Hybrid | Yes | Yes | Multi-loader hybrid |
| `KETTING` | Hybrid | Yes | Yes | Forge + Bukkit hybrid |
| `AUTO_CURSEFORGE` | Modpack | Varies | Yes | CurseForge modpack installer |
| `MODRINTH` | Modpack | Varies | Yes | Modrinth modpack installer |
| `FTBA` | Modpack | Varies | Yes | Feed The Beast modpack installer |
| `CUSTOM` | Custom | Varies | Varies | Custom server JAR |

---

### VANILLA

Official Mojang Minecraft server. No mod or plugin support.

**Specific Variables:** None (uses defaults).

**Java Requirement:** Depends on Minecraft version (see [Java Version Matrix](#5-java-version-compatibility-matrix)).

```bash
mcctl create vanilla-srv -t VANILLA -v 1.21.1
```

```env
# config.env
TYPE=VANILLA
VERSION=1.21.1
```

---

### PAPER

High-performance Spigot fork. Supports plugins via the Bukkit/Spigot/Paper API. This is the **recommended default** for most use cases.

**Specific Variables:**

| Variable | Description |
|----------|-------------|
| `PAPER_BUILD` | Specific Paper build number |
| `PAPER_CHANNEL` | `experimental` for experimental builds |
| `PAPER_DOWNLOAD_URL` | Custom Paper download URL |

**Java Requirement:** Java 21 for 1.21+, Java 17 for 1.18-1.20.x.

```bash
mcctl create paper-srv -t PAPER -v 1.21.1
```

```env
# config.env
TYPE=PAPER
VERSION=1.21.1
```

---

### PURPUR

Paper fork with additional features and configuration options. Fully compatible with Paper plugins.

**Specific Variables:** Same as Paper.

**Java Requirement:** Same as Paper.

```bash
mcctl create purpur-srv -t PURPUR -v 1.21.1
```

```env
# config.env
TYPE=PURPUR
VERSION=1.21.1
```

---

### PUFFERFISH

Performance-optimized Paper fork focused on high player counts.

**Java Requirement:** Same as Paper.

```bash
mcctl create puffer-srv -t PUFFERFISH -v 1.21.1
```

```env
# config.env
TYPE=PUFFERFISH
VERSION=1.21.1
```

---

### FOLIA

Paper fork with multi-threaded region support. Not all plugins are compatible.

**Java Requirement:** Same as Paper.

```bash
mcctl create folia-srv -t FOLIA -v 1.21.1
```

```env
# config.env
TYPE=FOLIA
VERSION=1.21.1
```

---

### LEAF

Lightweight Paper fork.

**Java Requirement:** Same as Paper.

```bash
mcctl create leaf-srv -t LEAF -v 1.21.1
```

```env
# config.env
TYPE=LEAF
VERSION=1.21.1
```

---

### SPIGOT

Original CraftBukkit fork. Paper is recommended over Spigot for better performance.

**Java Requirement:** Same as Paper.

```bash
mcctl create spigot-srv -t SPIGOT -v 1.21.1
```

```env
# config.env
TYPE=SPIGOT
VERSION=1.21.1
```

> **Note**: Bukkit/Spigot auto-download can be unstable. Paper is recommended as a direct replacement.

---

### BUKKIT

Original Bukkit plugin API server. Paper is strongly recommended instead.

**Java Requirement:** Same as Paper.

```bash
mcctl create bukkit-srv -t BUKKIT -v 1.21.1
```

```env
# config.env
TYPE=BUKKIT
VERSION=1.21.1
```

---

### FORGE

The original mod loader for Minecraft. Supports a vast library of mods.

**Specific Variables:**

| Variable | Description |
|----------|-------------|
| `FORGE_VERSION` | Forge version (`latest` or specific version number) |
| `FORGE_INSTALLER` | Local installer path |
| `FORGE_INSTALLER_URL` | Installer download URL |
| `FORGE_FORCE_REINSTALL` | Force reinstall (`true`) |

**Java Requirement:**

| Forge / Minecraft Version | Required Java |
|---------------------------|---------------|
| Forge 1.20.5+ | Java 21 |
| Forge 1.18 - 1.20.4 | Java 17 |
| Forge 1.17.x | Java 16/17 |
| Forge 1.16.5 and below | Java 8 (required) |

```bash
mcctl create forge-srv -t FORGE -v 1.20.4
```

```env
# config.env
TYPE=FORGE
VERSION=1.20.4
FORGE_VERSION=latest
```

---

### NEOFORGE

Community fork of Forge. Available for Minecraft 1.20.1+. Increasingly popular for modern modpacks.

**Specific Variables:**

| Variable | Description |
|----------|-------------|
| `NEOFORGE_VERSION` | NeoForge version (`latest` or specific) |

**Java Requirement:** Java 17 for 1.20.x, Java 21 for 1.21+.

```bash
mcctl create neoforge-srv -t NEOFORGE -v 1.21.1
```

```env
# config.env
TYPE=NEOFORGE
VERSION=1.21.1
NEOFORGE_VERSION=latest
```

---

### FABRIC

Lightweight, modern mod loader. Fast updates and good performance. Most Fabric mods require the Fabric API mod.

**Specific Variables:**

| Variable | Description |
|----------|-------------|
| `FABRIC_LAUNCHER_VERSION` | Launcher version |
| `FABRIC_LOADER_VERSION` | Loader version |
| `FABRIC_LAUNCHER` | Custom launcher path |
| `FABRIC_LAUNCHER_URL` | Custom launcher URL |
| `FABRIC_FORCE_REINSTALL` | Force reinstall |

**Java Requirement:** Same as Vanilla for matching Minecraft version.

```bash
mcctl create fabric-srv -t FABRIC -v 1.21.1
```

```env
# config.env
TYPE=FABRIC
VERSION=1.21.1
MODRINTH_PROJECTS=fabric-api
```

> **Important**: Most Fabric mods require `fabric-api`. Always include it in `MODRINTH_PROJECTS`.

---

### QUILT

Fabric-compatible mod loader with additional features. Can run most Fabric mods.

**Specific Variables:**

| Variable | Description |
|----------|-------------|
| `QUILT_LOADER_VERSION` | Loader version |
| `QUILT_INSTALLER_VERSION` | Installer version |

**Java Requirement:** Same as Fabric.

```bash
mcctl create quilt-srv -t QUILT -v 1.21.1
```

```env
# config.env
TYPE=QUILT
VERSION=1.21.1
```

---

### MOHIST (Hybrid)

Hybrid server supporting both Forge mods and Bukkit plugins.

**Java Requirement:** Same as Forge for matching Minecraft version.

```bash
mcctl create mohist-srv -t MOHIST -v 1.20.1
```

```env
# config.env
TYPE=MOHIST
VERSION=1.20.1
```

---

### MAGMA_MAINTAINED (Hybrid)

Maintained fork of the Magma hybrid server. Supports Forge mods and Bukkit plugins.

**Specific Variables:**

| Variable | Description |
|----------|-------------|
| `FORGE_VERSION` | Forge version to use |

**Java Requirement:** Same as Forge.

```bash
mcctl create magma-srv -t MAGMA_MAINTAINED -v 1.20.1
```

```env
# config.env
TYPE=MAGMA_MAINTAINED
VERSION=1.20.1
FORGE_VERSION=47.2.0
```

---

### ARCLIGHT (Hybrid)

Hybrid server that supports multiple mod loaders (Forge, NeoForge, Fabric) alongside Bukkit plugins.

**Specific Variables:**

| Variable | Description |
|----------|-------------|
| `ARCLIGHT_TYPE` | Mod loader: `FORGE`, `NEOFORGE`, `FABRIC` |

**Java Requirement:** Depends on the underlying mod loader.

```env
# config.env
TYPE=ARCLIGHT
ARCLIGHT_TYPE=FORGE
VERSION=1.20.1
```

---

### KETTING (Hybrid)

Forge + Bukkit hybrid server.

**Java Requirement:** Same as Forge.

```env
# config.env
TYPE=KETTING
VERSION=1.20.1
```

---

### AUTO_CURSEFORGE (Modpack Platform)

Automatically installs modpacks from CurseForge. Requires a CurseForge API key.

**Specific Variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `CF_API_KEY` | Yes | CurseForge API key |
| `CF_PAGE_URL` | No | Modpack page URL |
| `CF_SLUG` | No | Modpack slug (alternative to URL) |
| `CF_FILE_ID` | No | Specific file/version ID |
| `CF_EXCLUDE_MODS` | No | Mods to exclude from the pack |
| `CF_FORCE_INCLUDE_MODS` | No | Force include specific mods |

```bash
mcctl create atm9 -t AUTO_CURSEFORGE -v 1.20.1
```

```env
# config.env
TYPE=AUTO_CURSEFORGE
CF_API_KEY=${CF_API_KEY}
CF_SLUG=all-the-mods-9
MEMORY=8G
```

---

### MODRINTH (Modpack Platform)

Installs modpacks from Modrinth. When creating via CLI interactive mode (v1.14.0+), the system queries the Modrinth API to dynamically detect which loaders the modpack supports, so only valid loader options are presented.

**Specific Variables:**

| Variable | Description |
|----------|-------------|
| `MODRINTH_MODPACK` | Modpack slug, ID, or URL |
| `MODRINTH_VERSION` | Specific version |
| `MODRINTH_LOADER` | Mod loader (`forge`, `fabric`, `neoforge`, `quilt`) |

> **Note** (v1.14.0+): `neoforge` is now supported as a `MODRINTH_LOADER` option. When creating a MODRINTH server interactively, the CLI fetches the modpack's version data from the Modrinth API and only shows loaders that the modpack actually supports.

```env
# config.env
TYPE=MODRINTH
MODRINTH_MODPACK=cobblemon-modpack
MODRINTH_LOADER=fabric
MEMORY=6G
```

```bash
# CLI interactive mode (v1.14.0+)
mcctl create
# 1. Enter server name
# 2. Select type: MODRINTH
# 3. Enter modpack slug: cobblemon-modpack
# 4. Select loader: (only loaders supported by the modpack are shown)
# 5. Enter version: (leave empty for latest)
# 6. Select memory: 6G (default for modpacks)
```

---

### FTBA (Feed The Beast)

Installs Feed The Beast modpacks.

**Specific Variables:**

| Variable | Description |
|----------|-------------|
| `FTB_MODPACK_ID` | FTB modpack ID |

```env
# config.env
TYPE=FTBA
FTB_MODPACK_ID=123
MEMORY=8G
```

---

### CUSTOM

Use a custom server JAR file from a URL or local path.

**Specific Variables:**

| Variable | Description |
|----------|-------------|
| `CUSTOM_SERVER` | URL or container path to the server JAR |

```env
# config.env
TYPE=CUSTOM
CUSTOM_SERVER=https://example.com/server.jar
```

Or using a local path:

```env
TYPE=CUSTOM
CUSTOM_SERVER=/data/custom-server.jar
```

---

## 3. All Environment Variables

All environment variables are set in the server's `config.env` file. They are passed as Docker container environment variables when the server starts.

### General Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `EULA` | - | **Required.** Set to `TRUE` to accept the Minecraft EULA |
| `TYPE` | `VANILLA` | Server type (see [Server Types](#2-server-types-complete-reference)) |
| `VERSION` | `LATEST` | Minecraft version (e.g., `1.21.1`, `1.20.4`) |
| `TZ` | `UTC` | Timezone (e.g., `America/New_York`, `Asia/Seoul`) |
| `UID` | `1000` | Container user ID |
| `GID` | `1000` | Container group ID |

### Server Properties

These variables map directly to entries in `server.properties`. Variable names use uppercase with `-` replaced by `_`. For example, `max-players` becomes `MAX_PLAYERS`.

| Variable | Default | Description |
|----------|---------|-------------|
| `MOTD` | - | Server message of the day (supports formatting codes, `\n` for multiline) |
| `DIFFICULTY` | `easy` | `peaceful`, `easy`, `normal`, `hard` |
| `MODE` | `survival` | `survival`, `creative`, `adventure`, `spectator` |
| `MAX_PLAYERS` | `20` | Maximum player count |
| `PVP` | `true` | Enable player vs player combat |
| `LEVEL` | `world` | World save folder name within the worlds directory |
| `SEED` | - | World generation seed (wrap negative numbers in quotes) |
| `VIEW_DISTANCE` | - | Server view distance in chunks |
| `SIMULATION_DISTANCE` | - | Simulation distance in chunks |
| `MAX_TICK_TIME` | - | Max tick time in ms (`-1` to disable watchdog, required for autopause) |
| `LEVEL_TYPE` | `default` | World type: `default`, `flat`, `largeBiomes`, `amplified` |
| `GENERATOR_SETTINGS` | - | JSON format generator settings (for flat worlds) |
| `GENERATE_STRUCTURES` | `true` | Generate structures (villages, temples, etc.) |
| `SPAWN_ANIMALS` | `true` | Spawn animals |
| `SPAWN_MONSTERS` | `true` | Spawn monsters |
| `SPAWN_NPCS` | `true` | Spawn NPCs (villagers) |
| `SPAWN_PROTECTION` | - | Spawn protection radius (0 to disable) |
| `ALLOW_FLIGHT` | - | Allow flight |
| `ALLOW_CHEATS` | - | Allow cheats (mcctl shortcut: `mcctl config <server> --cheats`) |
| `ENABLE_COMMAND_BLOCK` | - | Enable command blocks (mcctl shortcut: `mcctl config <server> --command-block`) |
| `OVERRIDE_SERVER_PROPERTIES` | `true` | Set to `false` to disable automatic server.properties management |
| `CUSTOM_SERVER_PROPERTIES` | - | Set multiple properties at once (multiline) |

**Custom Server Properties Example:**

```env
CUSTOM_SERVER_PROPERTIES=allow-flight=true
spawn-protection=0
enable-command-block=true
```

### Memory and JVM

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMORY` | `1G` | Set initial and max heap memory together |
| `INIT_MEMORY` | - | Initial heap size (overrides MEMORY for -Xms) |
| `MAX_MEMORY` | - | Maximum heap size (overrides MEMORY for -Xmx) |
| `JVM_OPTS` | - | General JVM options (space separated) |
| `JVM_XX_OPTS` | - | `-XX` JVM options only |
| `JVM_DD_OPTS` | - | System properties (`name=value`, comma separated) |

**Memory Format:**

- Absolute: `2G`, `2048M`, `4096m`, `512k`
- Percentage of container memory: `75%`

**Examples:**

```env
# Single value for both init and max
MEMORY=4G

# Separate init and max
INIT_MEMORY=2G
MAX_MEMORY=4G

# Percentage of container memory limit
MEMORY=75%
```

### JVM Optimization Flags

| Variable | Description |
|----------|-------------|
| `USE_AIKAR_FLAGS` | Aikar's recommended GC tuning flags for Paper/Spigot (G1GC, pause time optimization) |
| `USE_MEOWICE_FLAGS` | Updated version of Aikar flags |
| `USE_MEOWICE_GRAALVM_FLAGS` | GraalVM-specific optimization flags (use with `java21-graalvm` image) |
| `USE_FLARE_FLAGS` | Flare performance profiling support |
| `USE_SIMD_FLAGS` | SIMD (vector operation) optimization |

### JMX Remote Monitoring

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_JMX` | `false` | Enable JMX remote monitoring |
| `JMX_HOST` | - | JMX bind host |
| `JMX_PORT` | `7091` | JMX port |

### OpenJ9 Specific

| Variable | Description |
|----------|-------------|
| `TUNE_VIRTUALIZED` | Optimize for virtualized environments (`TRUE`) |
| `TUNE_NURSERY_SIZES` | Automatic nursery size tuning (`TRUE`) |

### Whitelist and Operators

| Variable | Description |
|----------|-------------|
| `ENABLE_WHITELIST` | Enable whitelist (`true`/`false`) |
| `WHITELIST` | Whitelisted players (comma or newline separated) |
| `WHITELIST_FILE` | Whitelist file path or URL |
| `ENFORCE_WHITELIST` | Enforce whitelist for existing connections |
| `OPS` | Operator players (comma or newline separated) |
| `OPS_FILE` | Operator file path or URL |

> **Tip**: Use `mcctl whitelist` and `mcctl op` commands for runtime player management instead of editing these variables directly.

### RCON

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_RCON` | `true` | Enable RCON (required for mcctl exec/console) |
| `RCON_PASSWORD` | - | RCON password (inherited from platform `.env` in mcctl) |
| `RCON_PASSWORD_FILE` | - | RCON password file path (for Docker Secrets) |
| `RCON_PORT` | `25575` | RCON port |

> **Important**: mcctl requires RCON to be enabled for `mcctl exec`, `mcctl rcon`, and all player management commands. The RCON password is inherited from the platform-level `.env` file.

### Mods and Plugins

#### Modrinth

| Variable | Default | Description |
|----------|---------|-------------|
| `MODRINTH_PROJECTS` | - | Modrinth project slugs (newline or comma separated) |
| `MODRINTH_DOWNLOAD_DEPENDENCIES` | `none` | Auto-download dependencies: `required`, `optional`, `none` |
| `MODRINTH_PROJECTS_DEFAULT_VERSION_TYPE` | `release` | Version type: `release`, `beta`, `alpha` |
| `VERSION_FROM_MODRINTH_PROJECTS` | `false` | Auto-set Minecraft version based on mod support |

#### CurseForge

| Variable | Description |
|----------|-------------|
| `CF_API_KEY` | CurseForge API key (**required** for CurseForge mods) |
| `CURSEFORGE_FILES` | CurseForge mod slugs, IDs, or URLs (newline or comma separated) |

#### Spiget (SpigotMC)

| Variable | Description |
|----------|-------------|
| `SPIGET_RESOURCES` | SpigotMC resource IDs (comma separated) |

#### Direct Download

| Variable | Description |
|----------|-------------|
| `MODS` | List of mod JAR URLs (comma or newline separated) |
| `PLUGINS` | List of plugin JAR URLs (comma or newline separated) |
| `MODS_FILE` | File path or URL containing list of mod URLs |
| `PLUGINS_FILE` | File path or URL containing list of plugin URLs |

#### Packwiz

| Variable | Description |
|----------|-------------|
| `PACKWIZ_URL` | URL to Packwiz `pack.toml` file |

#### Modpack Archives

| Variable | Description |
|----------|-------------|
| `MODPACK` | Modpack ZIP URL |
| `GENERIC_PACKS` | Multiple pack URLs (newline separated) |

#### Auto Cleanup

| Variable | Default | Description |
|----------|---------|-------------|
| `REMOVE_OLD_MODS` | `false` | Remove old mods before downloading new ones |
| `REMOVE_OLD_MODS_INCLUDE` | `*.jar` | Glob pattern for files to remove |
| `REMOVE_OLD_MODS_EXCLUDE` | - | Glob pattern for files to keep |

### World Management

| Variable | Description |
|----------|-------------|
| `WORLD` | World archive URL or path (ZIP, tar.gz) |
| `WORLD_INDEX` | Select level.dat when archive has multiple (default: 1) |
| `FORCE_WORLD_COPY` | `TRUE` to overwrite world on each server start |
| `LEVEL` | World save folder name (default: `world`) |
| `EXTRA_ARGS` | Additional server arguments (mcctl uses `--universe /worlds/` for shared storage) |

### Datapacks

| Variable | Description |
|----------|-------------|
| `DATAPACKS` | Datapack URLs (newline or comma separated) |
| `DATAPACKS_FILE` | File containing datapack URL list |
| `REMOVE_OLD_DATAPACKS` | Remove old datapacks before downloading |
| `REMOVE_OLD_DATAPACKS_DEPTH` | Directory depth for cleanup (default: 16) |
| `REMOVE_OLD_DATAPACKS_INCLUDE` | Glob pattern for datapacks to remove |
| `INITIAL_ENABLED_PACKS` | Initially enabled datapacks |
| `INITIAL_DISABLED_PACKS` | Initially disabled datapacks |

### VanillaTweaks

| Variable | Description |
|----------|-------------|
| `VANILLATWEAKS_SHARECODE` | VanillaTweaks share codes (comma separated) |
| `VANILLATWEAKS_FILE` | Path to VanillaTweaks JSON config file |

Supported types: `datapacks`, `resourcepacks`, `craftingtweaks`.

### Resource Pack and Icon

| Variable | Description |
|----------|-------------|
| `RESOURCE_PACK` | Resource pack download URL |
| `RESOURCE_PACK_SHA1` | Resource pack checksum |
| `RESOURCE_PACK_ENFORCE` | Enforce resource pack on clients (`TRUE`/`FALSE`) |
| `RESOURCE_PACK_PROMPT` | Resource pack prompt message |
| `ICON` | Server icon URL or container path (64x64 PNG) |

### Auto-Pause

Pauses the server process when no players are online. Recovery is instant.

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AUTOPAUSE` | `false` | Enable autopause |
| `AUTOPAUSE_TIMEOUT_EST` | `3600` | Seconds after last player leaves before pausing |
| `AUTOPAUSE_TIMEOUT_INIT` | `600` | Seconds after server start without connections before pausing |
| `AUTOPAUSE_TIMEOUT_KN` | `120` | Seconds after port connection attempt before pausing |
| `AUTOPAUSE_PERIOD` | `10` | Status check interval (seconds) |
| `AUTOPAUSE_KNOCK_INTERFACE` | `eth0` | Network interface to monitor |
| `DEBUG_AUTOPAUSE` | `false` | Enable debug output |

> **Important**: Set `MAX_TICK_TIME=-1` when using autopause to disable the watchdog timer.

### Auto-Stop

Completely stops the server container when no players are online. Recovery requires server restart.

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AUTOSTOP` | `false` | Enable autostop |
| `AUTOSTOP_TIMEOUT_EST` | `3600` | Seconds after last player leaves before stopping |
| `AUTOSTOP_TIMEOUT_INIT` | `1800` | Seconds after server start without connections before stopping |
| `AUTOSTOP_PERIOD` | `10` | Status check interval (seconds) |
| `DEBUG_AUTOSTOP` | `false` | Enable debug output |
| `USES_PROXY_PROTOCOL` | `false` | Set `true` when using HAProxy/Fly.io |

> **Note**: In mcctl, auto-scale is handled by `mc-router` (via Docker labels), which is separate from the container-level autopause/autostop. mc-router starts containers on client connect and stops them after idle timeout. The `ENABLE_AUTOPAUSE` and `ENABLE_AUTOSTOP` variables apply to the individual container process.

**Autopause vs Autostop Comparison:**

| Feature | Autopause | Autostop |
|---------|-----------|----------|
| Behavior | Pause JVM process | Stop container |
| Recovery Speed | Instant | Requires server restart |
| Resource Savings | Medium (memory retained) | High (all resources freed) |
| Use Case | Quick recovery needed | Maximum resource savings |

### Healthcheck

The Docker image includes a built-in healthcheck using `mc-health`.

| Variable | Default | Description |
|----------|---------|-------------|
| `DISABLE_HEALTHCHECK` | `false` | Disable the built-in healthcheck |
| `SERVER_HOST` | `localhost` | Monitoring target host |
| `SERVER_PORT` | `25565` | Monitoring target port |

**Recommended healthcheck settings by server type:**

| Server Type | `start_period` | `interval` | `retries` |
|-------------|---------------|-----------|----------|
| Vanilla / Paper | 1m | 5s | 20 |
| Forge / Fabric | 3m | 10s | 30 |
| Large Modpacks | 5m | 15s | 40 |

> **Note**: Healthcheck parameters are configured in `docker-compose.yml`, not in `config.env`. The mcctl template includes appropriate defaults.

### Networking and Proxy

| Variable | Description |
|----------|-------------|
| `SERVER_HOST` | Monitoring host (default: `localhost`) |
| `SERVER_PORT` | Monitoring port (default: `25565`) |
| `PROXY` | HTTP/HTTPS proxy URL |
| `PROXY_HOST` | Proxy host |
| `PROXY_PORT` | Proxy port |
| `PROXY_NON_PROXY_HOSTS` | Proxy exclusion hosts (pipe separated) |

### Auto RCON Commands

Execute RCON commands automatically on server events.

| Variable | Description |
|----------|-------------|
| `RCON_CMDS_STARTUP` | Commands to run on server startup (newline separated) |
| `RCON_CMDS_ON_CONNECT` | Commands to run when any player connects |
| `RCON_CMDS_ON_DISCONNECT` | Commands to run when any player disconnects |
| `RCON_CMDS_FIRST_CONNECT` | Commands to run when the first player connects |
| `RCON_CMDS_LAST_DISCONNECT` | Commands to run when the last player disconnects |

**Example:**

```env
RCON_CMDS_STARTUP=gamerule keepInventory true
gamerule doDaylightCycle false
difficulty hard

RCON_CMDS_ON_CONNECT=say Welcome to the server!

RCON_CMDS_LAST_DISCONNECT=say Server is now empty
```

### Variable Interpolation

Dynamically substitute environment variables in configuration files within the container.

| Variable | Default | Description |
|----------|---------|-------------|
| `REPLACE_ENV_IN_PLACE` | `true` | Interpolate `${CFG_*}` variables in files within `/data` |
| `REPLACE_ENV_DURING_SYNC` | `false` | Interpolate variables during sync |
| `REPLACE_ENV_VARIABLE_PREFIX` | `CFG_` | Prefix for interpolation variables |
| `REPLACE_ENV_SUFFIXES_EXCLUSIONS` | - | File extensions to exclude (e.g., `.json`) |
| `REPLACE_ENV_VARIABLES_EXCLUDES` | - | Specific variables to exclude |

### Extra Files and Sync

| Variable | Description |
|----------|-------------|
| `APPLY_EXTRA_FILES` | Copy/download configuration files (format: `source=destination`, newline separated) |
| `SYNC_SKIP_NEWER_IN_DESTINATION` | `false` - Skip files newer in destination during sync |

### Console and Control

| Variable | Default | Description |
|----------|---------|-------------|
| `CONSOLE` | - | Set `FALSE` for noconsole option |
| `GUI` | - | Set `FALSE` to disable GUI |
| `STOP_SERVER_ANNOUNCE_DELAY` | - | Seconds to wait before stopping after announcement |
| `STOP_DURATION` | `60` | Seconds to wait for graceful shutdown |
| `FORCE_REDOWNLOAD` | `false` | Force re-download of server files on each start |
| `SETUP_ONLY` | `false` | Run setup only, then exit (useful for pre-building) |
| `SKIP_CHOWN_DATA` | `false` | Skip `/data` ownership change |

### SSH Console

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_SSH` | `false` | Enable SSH console access |

SSH uses the RCON password for authentication. Map port 2222 in docker-compose.yml.

### WebSocket Console

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBSOCKET_CONSOLE` | `false` | Enable WebSocket console |
| `WEBSOCKET_ADDRESS` | `0.0.0.0:80` | WebSocket bind address |
| `WEBSOCKET_PASSWORD` | - | WebSocket access password |
| `WEBSOCKET_LOG_BUFFER_SIZE` | `50` | Log buffer size |
| `WEBSOCKET_ALLOWED_ORIGINS` | - | Allowed origins for CORS |
| `WEBSOCKET_DISABLE_ORIGIN_CHECK` | `false` | Disable origin checking |

### Console Pipe

| Variable | Description |
|----------|-------------|
| `CREATE_CONSOLE_IN_PIPE` | `true` to enable console pipe when RCON is disabled |

### User API Provider

| Variable | Default | Description |
|----------|---------|-------------|
| `USER_API_PROVIDER` | `playerdb` | Player lookup provider: `playerdb` or `mojang` |

### Debugging

| Variable | Description |
|----------|-------------|
| `DEBUG` | Verbose log output |
| `DEBUG_EXEC` | Show server start command |
| `DEBUG_MEMORY` | Memory allocation debugging |
| `DUMP_SERVER_PROPERTIES` | Output server.properties at startup |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `LOG_TIMESTAMP` | `false` | Add timestamps to log output |
| `GENERATE_LOG4J2_CONFIG` | `false` | Generate log4j2 configuration |
| `LOG_CONSOLE_FORMAT` | - | Custom log console format (e.g., `[%d{HH:mm:ss}] [%level]: %msg%n`) |
| `ROLLING_LOG_FILE_PATTERN` | - | Rolling log file pattern |
| `ROLLING_LOG_MAX_FILES` | `1000` | Maximum log file count |

### Placeholders

Placeholders can be used in configuration files within the container:

| Format | Description |
|--------|-------------|
| `%VAR%` | Environment variable value |
| `%env:VAR%` | Environment variable value (explicit) |
| `%date:FMT%` | Date format |

---

## 4. How mcctl Maps to Docker Environment

### The Configuration Flow

```
mcctl config <server> KEY VALUE
        |
        v
~/minecraft-servers/servers/<name>/config.env    <-- KEY=VALUE written here
        |
        v
docker-compose.yml (env_file: config.env)        <-- loaded on container start
        |
        v
Docker container environment variables            <-- available inside container
        |
        v
itzg/minecraft-server entrypoint                  <-- reads env vars, configures server
        |
        v
server.properties / JVM args / mod downloads      <-- final server configuration
```

### Template: config.env

The default `config.env` template used when creating a new server:

```env
# Server Type
TYPE=PAPER
# Options: VANILLA, PAPER, SPIGOT, FORGE, FABRIC, NEOFORGE, QUILT

# Minecraft Version
VERSION=1.20.4

# Resources
MEMORY=4G
# Recommended: VANILLA/PAPER: 2G, FORGE/FABRIC: 4G, Modpacks: 6G+

# Game Settings
GAMEMODE=survival
DIFFICULTY=normal
MAX_PLAYERS=20
VIEW_DISTANCE=10
PVP=true
SPAWN_PROTECTION=0

# World
LEVEL=world
EXTRA_ARGS=--universe /worlds/

# RCON (Password inherited from .env)
ENABLE_RCON=true

# Server MOTD
MOTD=Welcome! Your adventure begins here.

# Mods/Plugins (uncomment to use)
# MODRINTH_PROJECTS=fabric-api
#   lithium
# SPIGET_RESOURCES=1234,5678
MODRINTH_DOWNLOAD_DEPENDENCIES=required

# Advanced (uncomment to use)
# USE_AIKAR_FLAGS=true
# ICON=https://example.com/icon.png
# WHITELIST=player1,player2
# OPS=admin1,admin2
```

### Template: docker-compose.yml (per server)

Each server has its own `docker-compose.yml`:

```yaml
services:
  mc-<name>:
    image: itzg/minecraft-server:java21
    container_name: mc-<name>
    restart: "no"
    tty: true
    stdin_open: true
    env_file:
      - ../../.env          # Platform-wide variables (RCON_PASSWORD, HOST_IP)
      - config.env           # Server-specific variables
    environment:
      EULA: "TRUE"
    volumes:
      - ./data:/data
      - ./logs:/data/logs
      - ../../worlds:/worlds:rw       # Shared world storage
      - ../../shared/plugins:/plugins:ro   # Shared plugins
    networks:
      - minecraft-net
    labels:
      mc-router.host: "<name>.local,<name>.<HOST_IP>.nip.io"
      mc-router.auto-scale-up: "true"
      mc-router.auto-scale-down: "true"
      mc-router.auto-scale-asleep-motd: "Server is sleeping. Connect to wake up!"
```

### Template: Main docker-compose.yml

The platform-level `docker-compose.yml` defines mc-router and includes all server configurations:

```yaml
include:
  - servers/compose.yml

services:
  router:
    image: itzg/mc-router
    container_name: mc-router
    restart: unless-stopped
    environment:
      IN_DOCKER: "true"
      AUTO_SCALE_UP: "true"
      AUTO_SCALE_DOWN: "true"
      AUTO_SCALE_DOWN_AFTER: "1m"
      DOCKER_TIMEOUT: "120"
      API_BINDING: ":8080"
    ports:
      - "25565:25565"
      - "127.0.0.1:25580:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - minecraft-net

networks:
  minecraft-net:
    external: true
    name: ${MINECRAFT_NETWORK:-minecraft-net}
```

### Using mcctl config

The `mcctl config` command reads and writes to `config.env`:

```bash
# View all configuration
mcctl config myserver

# View specific key
mcctl config myserver MOTD

# Set a value
mcctl config myserver MOTD "Welcome to my server!"
mcctl config myserver MEMORY 8G
mcctl config myserver VIEW_DISTANCE 12

# Shortcut flags
mcctl config myserver --cheats        # Sets ALLOW_CHEATS=true
mcctl config myserver --no-cheats     # Sets ALLOW_CHEATS=false
mcctl config myserver --pvp           # Sets PVP=true
mcctl config myserver --no-pvp        # Sets PVP=false
mcctl config myserver --command-block # Sets ENABLE_COMMAND_BLOCK=true
```

> **Important**: After changing configuration, restart the server for changes to take effect: `mcctl stop <server> && mcctl start <server>`

---

## 5. Java Version Compatibility Matrix

### Docker Image Tags

| Image Tag | Java Version | Notes |
|-----------|-------------|-------|
| `latest`, `stable` | Java 25 | Latest Minecraft (default) |
| `java21` | Java 21 | Minecraft 1.20.5+ |
| `java17` | Java 17 | Minecraft 1.18 - 1.20.4 |
| `java11` | Java 11 | Legacy versions |
| `java8` | Java 8 | Forge 1.17 and below |
| `java21-graalvm` | Java 21 (GraalVM) | Performance variant |
| `java17-graalvm` | Java 17 (GraalVM) | Performance variant |

### Minecraft Version to Java Mapping

| Minecraft Version | Minimum Java | Recommended Image Tag |
|-------------------|-------------|----------------------|
| 1.21+ | Java 21 | `java21` or `latest` |
| 1.20.5 - 1.20.6 | Java 21 | `java21` |
| 1.18 - 1.20.4 | Java 17 | `java17` or `java21` |
| 1.17 | Java 16 | `java17` |
| 1.12 - 1.16.5 | Java 8 | `java8` or `java11` |
| 1.11 and below | Java 8 | `java8` |

### Forge-Specific Java Requirements

Forge has stricter Java version requirements:

| Forge / Minecraft Version | Required Java | Image Tag |
|---------------------------|---------------|-----------|
| Forge 1.20.5+ | Java 21 | `java21` |
| Forge 1.18 - 1.20.4 | Java 17 | `java17` |
| Forge 1.17.x | Java 16/17 | `java17` |
| Forge 1.16.5 and below | Java 8 | `java8` (required, higher versions fail) |

### Architecture Support

| Tag | amd64 | arm64 | armv7 |
|-----|-------|-------|-------|
| `java21` | Yes | Yes | No |
| `java17` | Yes | Yes | Yes |
| `java8` | Yes | Yes | No |

### GraalVM Variants

GraalVM images provide improved JIT compilation performance:

```env
# Use with GraalVM image tag (set in docker-compose.yml, not config.env)
# image: itzg/minecraft-server:java21-graalvm
USE_MEOWICE_GRAALVM_FLAGS=true
```

### Changing the Java Version in mcctl

The Java version is determined by the Docker image tag in the server's `docker-compose.yml`. To change it:

1. Stop the server: `mcctl stop <server>`
2. Edit `~/minecraft-servers/servers/<name>/docker-compose.yml`
3. Change the image tag: `image: itzg/minecraft-server:java17`
4. Start the server: `mcctl start <server>`

### Common Java Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `class file version 65.0` | Java 21 required | Use `java21` image tag |
| `Unsupported class file major version` | Java version too high | Use `java8` for Forge 1.16.5 and below |
| Mods fail to load | Java version mismatch | Check mod documentation for Java requirements |

---

## 6. Mod and Plugin Installation

### Overview

- **Mods** are used with Forge, NeoForge, Fabric, and Quilt servers. Clients must also install the mods.
- **Plugins** are used with Paper, Spigot, Bukkit, and Purpur servers. Server-side only.

### Via mcctl CLI

The `mcctl mod` commands manage mods through the `config.env` file.

```bash
# Search for mods on Modrinth
mcctl mod search <query>

# Add mods (Modrinth is the default source)
mcctl mod add <server> <mod1> [mod2] [mod3...]

# Add from CurseForge (requires CF_API_KEY in platform .env)
mcctl mod add <server> --curseforge <mod1> [mod2...]

# Add from Spiget (SpigotMC plugins)
mcctl mod add <server> --spiget <resource-id>

# Add from direct URL
mcctl mod add <server> --url <jar-url>

# List configured mods
mcctl mod list <server>

# Remove mods
mcctl mod remove <server> <mod1> [mod2...]

# Show available mod sources
mcctl mod sources
```

### Via Modrinth Environment Variables

Set `MODRINTH_PROJECTS` in `config.env`:

```env
# Simple list
MODRINTH_PROJECTS=fabric-api,lithium,sodium,iris

# Multiline format
MODRINTH_PROJECTS=fabric-api
lithium
sodium
iris

# With version pinning
MODRINTH_PROJECTS=fabric-api:release
lithium:beta
sodium:version_id

# Auto-download dependencies (recommended)
MODRINTH_DOWNLOAD_DEPENDENCIES=required
```

### Via CurseForge Environment Variables

Requires `CF_API_KEY` set in the platform `.env` file.

```env
CF_API_KEY=${CF_API_KEY}
CURSEFORGE_FILES=jei
journeymap
jade
```

Supported formats for `CURSEFORGE_FILES`:

- Slug: `jei`
- Project ID: `238222`
- Slug with file ID: `jei:4593548`
- Full URL: `https://www.curseforge.com/minecraft/mc-mods/jei`
- List file: `@/extras/cf-mods.txt`

### Via Spiget (SpigotMC Plugins)

For Paper/Spigot plugins from SpigotMC:

```env
# Resource IDs (from SpigotMC page URL)
SPIGET_RESOURCES=9089,34315
```

Find the resource ID from the SpigotMC URL: `https://www.spigotmc.org/resources/example-plugin.12345/` has ID `12345`.

### Via Direct URL

```env
# Single or multiple mod JARs
MODS=https://example.com/mod1.jar,https://example.com/mod2.jar

# Or multiline
MODS=https://example.com/mod1.jar
https://example.com/mod2.jar

# For plugins
PLUGINS=https://example.com/plugin1.jar

# From a file
MODS_FILE=/data/mods.txt
PLUGINS_FILE=https://example.com/plugins.txt
```

### Via Packwiz

Packwiz modpacks are managed through a `pack.toml` file:

```env
PACKWIZ_URL=https://example.com/pack.toml
```

### Auto Cleanup

Remove old mods before downloading new ones to prevent conflicts:

```env
REMOVE_OLD_MODS=TRUE
REMOVE_OLD_MODS_INCLUDE=*.jar
REMOVE_OLD_MODS_EXCLUDE=keep-this-mod.jar
```

### Mixed Sources

You can combine multiple mod sources:

```env
# Modrinth mods
MODRINTH_PROJECTS=fabric-api,lithium
MODRINTH_DOWNLOAD_DEPENDENCIES=required

# Direct URL mods
MODS=https://example.com/custom-mod.jar

# Additional mods from file
MODS_FILE=/data/extra-mods.txt

# Auto cleanup
REMOVE_OLD_MODS=TRUE
```

---

## 7. Performance Optimization

### Aikar Flags

The most widely recommended JVM optimization for Paper/Spigot servers:

```env
USE_AIKAR_FLAGS=true
```

Aikar flags configure the G1 garbage collector with settings optimized for Minecraft server workloads, including reduced GC pause times and improved heap management.

```bash
mcctl config myserver USE_AIKAR_FLAGS true
```

### MeowIce Flags

An updated version of Aikar flags with newer JVM optimizations:

```env
USE_MEOWICE_FLAGS=true
```

### GraalVM Flags

For servers using the GraalVM Docker image (`java21-graalvm`):

```env
USE_MEOWICE_GRAALVM_FLAGS=true
```

This requires the GraalVM image tag in `docker-compose.yml`:

```yaml
image: itzg/minecraft-server:java21-graalvm
```

### SIMD Optimization

Enable vector operation optimization:

```env
USE_SIMD_FLAGS=true
```

### Recommended Memory by Server Type and Player Count

| Scenario | Memory | Notes |
|----------|--------|-------|
| Vanilla / Paper (1-10 players) | 2G | Sufficient for small groups |
| Vanilla / Paper (10-30 players) | 4G | Add Aikar flags |
| Vanilla / Paper (30+ players) | 6-8G | Reduce view/simulation distance |
| Forge / Fabric (light mods) | 4G | |
| Forge / Fabric (heavy mods) | 6-8G | |
| Large modpacks (100+ mods) | 8-12G | |
| Modpack servers (ATM, etc.) | 8-16G | Check modpack documentation |

### View and Simulation Distance Tuning

Reducing these values significantly reduces server load:

| Player Count | View Distance | Simulation Distance |
|-------------|---------------|---------------------|
| 1-10 | 10-12 | 10 |
| 10-20 | 8-10 | 8 |
| 20-30 | 6-8 | 6 |
| 30+ | 4-6 | 4 |

```bash
mcctl config myserver VIEW_DISTANCE 10
mcctl config myserver SIMULATION_DISTANCE 8
```

### Complete Performance Configuration Examples

**Small Server (1-10 players):**

```env
MEMORY=2G
USE_AIKAR_FLAGS=true
```

**Medium Server (10-30 players):**

```env
MEMORY=4G
USE_AIKAR_FLAGS=true
VIEW_DISTANCE=10
SIMULATION_DISTANCE=8
```

**Large Server (30+ players):**

```env
INIT_MEMORY=4G
MAX_MEMORY=8G
USE_AIKAR_FLAGS=true
VIEW_DISTANCE=8
SIMULATION_DISTANCE=6
```

**Modpack Server:**

```env
MEMORY=8G
USE_AIKAR_FLAGS=true
JVM_XX_OPTS=-XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=40
```

**GraalVM High-Performance:**

```env
# Requires image: itzg/minecraft-server:java21-graalvm in docker-compose.yml
MEMORY=8G
USE_MEOWICE_GRAALVM_FLAGS=true
VIEW_DISTANCE=10
SIMULATION_DISTANCE=8
```

---

## 8. Common Configuration Recipes

### Basic Vanilla Server

```env
# config.env
TYPE=VANILLA
VERSION=1.21.1
MEMORY=2G
DIFFICULTY=normal
MODE=survival
MAX_PLAYERS=20
PVP=true
LEVEL=world
EXTRA_ARGS=--universe /worlds/
ENABLE_RCON=true
MOTD=A Vanilla Minecraft Server
```

```bash
mcctl create vanilla -t VANILLA -v 1.21.1
```

---

### Paper Server with Optimization

```env
# config.env
TYPE=PAPER
VERSION=1.21.1
MEMORY=4G
USE_AIKAR_FLAGS=true
DIFFICULTY=normal
MODE=survival
MAX_PLAYERS=30
PVP=true
VIEW_DISTANCE=10
SIMULATION_DISTANCE=8
LEVEL=world
EXTRA_ARGS=--universe /worlds/
ENABLE_RCON=true
MOTD=Optimized Paper Server

# Performance plugins from Modrinth
MODRINTH_PROJECTS=chunky
MODRINTH_DOWNLOAD_DEPENDENCIES=required

# Auto RCON commands
RCON_CMDS_STARTUP=gamerule keepInventory true
gamerule playersSleepingPercentage 50
```

```bash
mcctl create optimized -t PAPER -v 1.21.1
mcctl config optimized MEMORY 4G
mcctl config optimized USE_AIKAR_FLAGS true
```

---

### Forge Modded Server

```env
# config.env
TYPE=FORGE
VERSION=1.20.4
FORGE_VERSION=latest
MEMORY=6G
USE_AIKAR_FLAGS=true
DIFFICULTY=normal
MODE=survival
MAX_PLAYERS=20
VIEW_DISTANCE=10
LEVEL=world
EXTRA_ARGS=--universe /worlds/
ENABLE_RCON=true
MOTD=Forge Modded Server

# Mods from CurseForge
CF_API_KEY=${CF_API_KEY}
CURSEFORGE_FILES=jei
journeymap
jade
create

# Auto cleanup
REMOVE_OLD_MODS=TRUE
```

```bash
mcctl create forge-srv -t FORGE -v 1.20.4 --no-start
mcctl config forge-srv MEMORY 6G
mcctl mod add forge-srv --curseforge jei journeymap jade
mcctl start forge-srv
```

---

### Fabric Performance Server

```env
# config.env
TYPE=FABRIC
VERSION=1.21.1
MEMORY=4G
USE_AIKAR_FLAGS=true
DIFFICULTY=normal
MODE=survival
MAX_PLAYERS=30
VIEW_DISTANCE=12
SIMULATION_DISTANCE=10
LEVEL=world
EXTRA_ARGS=--universe /worlds/
ENABLE_RCON=true
MOTD=High-Performance Fabric Server

# Performance mods from Modrinth
MODRINTH_PROJECTS=fabric-api
lithium
starlight
krypton
ferritecore
c2me-fabric
MODRINTH_DOWNLOAD_DEPENDENCIES=required

# Auto cleanup
REMOVE_OLD_MODS=TRUE
```

```bash
mcctl create fabric-perf -t FABRIC -v 1.21.1
mcctl config fabric-perf MODRINTH_PROJECTS "fabric-api,lithium,starlight,krypton,ferritecore,c2me-fabric"
mcctl config fabric-perf MODRINTH_DOWNLOAD_DEPENDENCIES required
```

---

### NeoForge Modern Modpack

```env
# config.env
TYPE=NEOFORGE
VERSION=1.21.1
NEOFORGE_VERSION=latest
MEMORY=8G
USE_AIKAR_FLAGS=true
DIFFICULTY=normal
MODE=survival
MAX_PLAYERS=20
VIEW_DISTANCE=10
SIMULATION_DISTANCE=8
LEVEL=world
EXTRA_ARGS=--universe /worlds/
ENABLE_RCON=true
MOTD=NeoForge Modded Server

# Mods from Modrinth
MODRINTH_PROJECTS=jei
journeymap
jade
MODRINTH_DOWNLOAD_DEPENDENCIES=required
REMOVE_OLD_MODS=TRUE
```

```bash
mcctl create neoforge-srv -t NEOFORGE -v 1.21.1 --no-start
mcctl config neoforge-srv MEMORY 8G
mcctl start neoforge-srv
```

---

### Purpur Server with Custom Features

```env
# config.env
TYPE=PURPUR
VERSION=1.21.1
MEMORY=4G
USE_AIKAR_FLAGS=true
DIFFICULTY=hard
MODE=survival
MAX_PLAYERS=50
PVP=true
VIEW_DISTANCE=10
SIMULATION_DISTANCE=8
LEVEL=world
EXTRA_ARGS=--universe /worlds/
ENABLE_RCON=true
MOTD=Purpur Server with Custom Features

# Whitelist enabled
ENABLE_WHITELIST=true
WHITELIST=player1,player2,player3
OPS=admin1

# Custom server properties
CUSTOM_SERVER_PROPERTIES=allow-flight=true
spawn-protection=0
enable-command-block=true

# Plugins from Modrinth
MODRINTH_PROJECTS=luckperms
essentialsx
MODRINTH_DOWNLOAD_DEPENDENCIES=required

# Auto commands
RCON_CMDS_STARTUP=gamerule keepInventory true
gamerule doDaylightCycle true
whitelist on
```

```bash
mcctl create purpur-srv -t PURPUR -v 1.21.1
```

---

### Modpack from CurseForge (AUTO_CURSEFORGE)

```env
# config.env
TYPE=AUTO_CURSEFORGE
CF_API_KEY=${CF_API_KEY}
CF_SLUG=all-the-mods-9
MEMORY=10G
USE_AIKAR_FLAGS=true
DIFFICULTY=normal
MODE=survival
MAX_PLAYERS=10
VIEW_DISTANCE=8
SIMULATION_DISTANCE=6
LEVEL=world
EXTRA_ARGS=--universe /worlds/
ENABLE_RCON=true
MOTD=All The Mods 9 Server
```

> **Note**: The `CF_API_KEY` must be set in the platform-level `.env` file at `~/minecraft-servers/.env`. Get a key from [CurseForge for Studios](https://console.curseforge.com/).

```bash
mcctl create atm9 -t AUTO_CURSEFORGE -v 1.20.1 --no-start
mcctl config atm9 CF_SLUG all-the-mods-9
mcctl config atm9 MEMORY 10G
mcctl start atm9
```

---

### Modpack from Modrinth

```env
# config.env
TYPE=MODRINTH
MODRINTH_MODPACK=cobblemon-modpack
MODRINTH_LOADER=fabric
MEMORY=6G
USE_AIKAR_FLAGS=true
DIFFICULTY=normal
MODE=survival
MAX_PLAYERS=20
VIEW_DISTANCE=10
LEVEL=world
EXTRA_ARGS=--universe /worlds/
ENABLE_RCON=true
MOTD=Cobblemon Modpack Server
```

```bash
# Option 1: Interactive mode (v1.14.0+ recommended)
mcctl create
# Follow prompts: name, type=MODRINTH, slug=cobblemon-modpack, loader=fabric, version=latest

# Option 2: Non-interactive with manual config
mcctl create cobblemon -t MODRINTH --no-start
mcctl config cobblemon MODRINTH_MODPACK cobblemon-modpack
mcctl config cobblemon MODRINTH_LOADER fabric
mcctl config cobblemon MEMORY 6G
mcctl start cobblemon
```

---

## 9. Troubleshooting

### Common Environment Variable Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Missing `EULA=TRUE` | Server exits immediately | Set `EULA=TRUE` (handled by mcctl automatically) |
| `TYPE` misspelled | Server starts as Vanilla | Check type name exactly (case sensitive) |
| Quotes around values | Unexpected behavior | In `config.env`, do not wrap values in quotes |
| Spaces around `=` | Variable not read | `KEY=value` not `KEY = value` |
| Using `GAMEMODE` instead of `MODE` | Game mode not applied | Both work, but `MODE` is the standard |
| Forgetting `EXTRA_ARGS=--universe /worlds/` | Worlds stored in wrong directory | Ensure this is set for shared world storage |

### Java Version Mismatch

**Symptoms:**
- `class file version 65.0` error in logs
- `Unsupported class file major version` error
- Server crashes immediately after starting

**Diagnosis:**
```bash
mcctl logs <server>
# Look for "class file version" or "Unsupported" errors
```

**Fix:**
1. Check the [Java Version Matrix](#5-java-version-compatibility-matrix)
2. Edit the server's `docker-compose.yml` to use the correct image tag
3. For Forge 1.16.5 and below, you **must** use `java8`

### Memory Issues

**Symptoms:**
- Server crashes with OutOfMemoryError
- Server runs slowly, frequent garbage collection pauses
- "Not enough memory" at startup

**Diagnosis:**
```bash
mcctl logs <server>
# Look for "OutOfMemoryError" or GC-related messages

# Enable memory debugging
mcctl config <server> DEBUG_MEMORY true
mcctl stop <server> && mcctl start <server>
mcctl logs <server>
```

**Fix:**
```bash
# Increase memory allocation
mcctl config <server> MEMORY 6G

# Enable Aikar flags for better GC
mcctl config <server> USE_AIKAR_FLAGS true

# For separate init/max settings
mcctl config <server> INIT_MEMORY 4G
mcctl config <server> MAX_MEMORY 8G

# Restart to apply
mcctl stop <server> && mcctl start <server>
```

### Mod Compatibility Issues

**Symptoms:**
- Server crashes during mod loading
- Missing dependency errors
- Mod version mismatch warnings

**Diagnosis:**
```bash
mcctl logs <server>
# Look for mod-related errors

mcctl mod list <server>
# Review configured mods
```

**Fix:**
1. Verify all mods support the server's Minecraft version
2. Enable dependency auto-download:
   ```bash
   mcctl config <server> MODRINTH_DOWNLOAD_DEPENDENCIES required
   ```
3. For Fabric servers, ensure `fabric-api` is included
4. Check that the mod type matches the server type (Forge mods on Forge, Fabric mods on Fabric)
5. Remove incompatible mods:
   ```bash
   mcctl mod remove <server> <incompatible-mod>
   ```

### Server Won't Start

**Diagnosis Steps:**

```bash
# Check logs for errors
mcctl logs <server>

# Verify Docker is running
docker ps

# Check server configuration
mcctl config <server>

# Check server status
mcctl status <server>

# Check if port is in use
mcctl status
```

**Common Causes:**
- Docker not running
- Port conflict with another server
- Invalid configuration in `config.env`
- World data corruption
- Incompatible mods or plugins

### World Data in Wrong Location

Servers created with mcctl versions 1.6.8 through 1.6.11 may store worlds in the wrong directory.

**Symptoms:**
- World data in `servers/<name>/data/` instead of `worlds/`
- Server creates a new world on every restart
- World sharing between servers does not work

**Detection:**
```bash
# Check for affected servers
ls ~/minecraft-servers/servers/*/data/*/level.dat 2>/dev/null

# Or use mcctl migrate
mcctl migrate status
```

**Fix:**
```bash
# Automated migration (recommended)
mcctl migrate worlds --all

# Manual fix
mcctl stop <server>
echo 'EXTRA_ARGS=--universe /worlds/' >> ~/minecraft-servers/servers/<name>/config.env
mv ~/minecraft-servers/servers/<name>/data/<world> ~/minecraft-servers/worlds/<world>
mcctl start <server>
```

### RCON Connection Issues

**Symptoms:**
- `mcctl exec` or `mcctl rcon` fails
- "Connection refused" errors
- Player management commands fail

**Fix:**
1. Verify RCON is enabled:
   ```bash
   mcctl config <server> ENABLE_RCON
   # Should show: true
   ```
2. Verify the server is running:
   ```bash
   mcctl status <server>
   ```
3. Check that `RCON_PASSWORD` is set in `~/minecraft-servers/.env`

### Autopause / Autostop Issues

**Symptoms:**
- Server pauses unexpectedly
- Server does not wake up on client connect
- Watchdog timer kills paused server

**Fix:**
```bash
# Disable watchdog when using autopause
mcctl config <server> MAX_TICK_TIME -1

# Check network interface
mcctl config <server> AUTOPAUSE_KNOCK_INTERFACE eth0

# Enable debug logging
mcctl config <server> DEBUG_AUTOPAUSE true
mcctl stop <server> && mcctl start <server>
mcctl logs <server>
```

### CurseForge Mod Download Failures

**Symptoms:**
- "API key required" errors
- Mods fail to download from CurseForge
- 403 Forbidden errors

**Fix:**
1. Set `CF_API_KEY` in `~/minecraft-servers/.env`:
   ```env
   CF_API_KEY=your-curseforge-api-key
   ```
2. Get a key from [CurseForge for Studios](https://console.curseforge.com/)
3. Some mods are restricted from third-party downloads; use `CF_FORCE_INCLUDE_MODS` or download manually

### Modpack Startup Time

Large modpacks can take several minutes to start. The Docker healthcheck may time out.

**Fix:** Edit the server's `docker-compose.yml` to increase `start_period`:

```yaml
healthcheck:
  test: mc-health
  start_period: 5m    # Increase for large modpacks
  interval: 15s
  retries: 40
```

---

## Appendix: Quick Reference Tables

### mcctl config Shortcut Flags

| Flag | Equivalent | Description |
|------|-----------|-------------|
| `--cheats` | `ALLOW_CHEATS=true` | Enable cheats |
| `--no-cheats` | `ALLOW_CHEATS=false` | Disable cheats |
| `--pvp` | `PVP=true` | Enable PvP |
| `--no-pvp` | `PVP=false` | Disable PvP |
| `--command-block` | `ENABLE_COMMAND_BLOCK=true` | Enable command blocks |
| `--no-command-block` | `ENABLE_COMMAND_BLOCK=false` | Disable command blocks |

### Server Type Quick Decision Guide

| Need | Recommended Type |
|------|-----------------|
| General use, best performance | `PAPER` |
| Pure vanilla experience | `VANILLA` |
| Forge mods (1.20+) | `FORGE` or `NEOFORGE` |
| Lightweight/performance mods | `FABRIC` |
| Advanced Paper customization | `PURPUR` |
| Both mods and plugins | `MOHIST` or `ARCLIGHT` |
| CurseForge modpack | `AUTO_CURSEFORGE` |
| Modrinth modpack | `MODRINTH` |

### Environment Variable Categories at a Glance

| Category | Key Variables |
|----------|--------------|
| Server Identity | `TYPE`, `VERSION`, `MOTD`, `ICON` |
| Game Rules | `DIFFICULTY`, `MODE`, `PVP`, `MAX_PLAYERS` |
| World | `LEVEL`, `SEED`, `LEVEL_TYPE`, `WORLD` |
| Performance | `MEMORY`, `USE_AIKAR_FLAGS`, `VIEW_DISTANCE`, `SIMULATION_DISTANCE` |
| Security | `ENABLE_WHITELIST`, `WHITELIST`, `OPS`, `RCON_PASSWORD` |
| Mods | `MODRINTH_PROJECTS`, `CURSEFORGE_FILES`, `SPIGET_RESOURCES` |
| Resource Savings | `ENABLE_AUTOPAUSE`, `ENABLE_AUTOSTOP` |
| Debugging | `DEBUG`, `DEBUG_MEMORY`, `LOG_LEVEL` |
