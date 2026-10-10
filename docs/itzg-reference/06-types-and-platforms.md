# Server Types and Platforms

Various Minecraft server types and modpack platform configurations.

## Server Type Overview

Select server type with the `TYPE` environment variable:

```yaml
environment:
  TYPE: "PAPER"  # Specify server type
```

## Vanilla

Official Mojang server:

```yaml
environment:
  EULA: "TRUE"
  TYPE: "VANILLA"  # Default, can be omitted
  VERSION: "1.20.4"
```

---

## Paper

High-performance Spigot fork with plugin support:

| Variable | Description |
|----------|-------------|
| `TYPE` | `PAPER` |
| `PAPER_BUILD` | Specific build number |
| `PAPER_CHANNEL` | `experimental` - Experimental builds |
| `PAPER_DOWNLOAD_URL` | Custom download URL |

```yaml
environment:
  EULA: "TRUE"
  TYPE: "PAPER"
  VERSION: "1.20.4"
```

### Paper-based Alternative Servers

| Type | Description |
|------|-------------|
| `PURPUR` | Paper fork with additional features |
| `PUFFERFISH` | Performance optimized fork |
| `FOLIA` | Multi-threaded support |
| `LEAF` | Performance optimized lightweight fork |

#### Leaf

Performance-optimized Paper fork focused on lightweight server operation:

| Variable | Description |
|----------|-------------|
| `TYPE` | `LEAF` |
| `LEAF_BUILD` | Specific build number |

```yaml
environment:
  EULA: "TRUE"
  TYPE: "LEAF"
  VERSION: "1.21.1"
```

#### Folia

Multi-threaded Paper fork for large-scale servers:

| Variable | Description |
|----------|-------------|
| `TYPE` | `FOLIA` |
| `FOLIA_CHANNEL` | `experimental` or `default` |
| `FOLIA_DOWNLOAD_URL` | Custom download URL |

```yaml
environment:
  EULA: "TRUE"
  TYPE: "FOLIA"
  VERSION: "1.20.4"
  FOLIA_CHANNEL: "experimental"
```

### Configuration Repositories

Automatically download optimized configuration files from Git repositories:

| Variable | Server Type | Description |
|----------|-------------|-------------|
| `PAPER_CONFIG_REPO` | PAPER | Paper optimized config repository URL |
| `PUFFERFISH_CONFIG_REPO` | PUFFERFISH | Pufferfish config repository URL |
| `PURPUR_CONFIG_REPO` | PURPUR | Purpur config repository URL |
| `SERVER_PROPERTIES_REPO_URL` | ALL | Base server.properties repository (Smart Mode / Direct Mode) |

```yaml
environment:
  EULA: "TRUE"
  TYPE: "PAPER"
  PAPER_CONFIG_REPO: "https://github.com/example/paper-configs.git"
```

---

## Forge

Mod support server:

| Variable | Description |
|----------|-------------|
| `TYPE` | `FORGE` |
| `FORGE_VERSION` | Forge version (`latest` or version number) |
| `FORGE_INSTALLER` | Local installer path |
| `FORGE_INSTALLER_URL` | Installer download URL (also used for Cleanroom server) |
| `FORGE_FORCE_REINSTALL` | Force reinstall (`true`) |

```yaml
environment:
  EULA: "TRUE"
  TYPE: "FORGE"
  VERSION: "1.20.1"
  FORGE_VERSION: "latest"
```

> **Tip**: [Cleanroom](https://github.com/CleanroomMC/Cleanroom) is an alternative Forge-compatible server that can be installed by providing a custom installer URL via `FORGE_INSTALLER_URL`.

### NeoForge

Community fork of Forge:

| Variable | Description |
|----------|-------------|
| `TYPE` | `NEOFORGE` |
| `NEOFORGE_VERSION` | `latest`, `beta`, or specific version number |

```yaml
environment:
  EULA: "TRUE"
  TYPE: "NEOFORGE"
  VERSION: "1.20.4"
  NEOFORGE_VERSION: "latest"  # also supports "beta"
```

- `NEOFORGE_VERSION` can be a specific version, `latest`, or `beta`. By default the latest non-beta NeoForge version available for the requested Minecraft version is used.
- Specific version example: `-e TYPE=NEOFORGE -e VERSION=1.20.1 -e NEOFORGE_VERSION=47.1.79`

> **Note (year-based versions)**: Image release 2026.4.2 added "neoforge: support year-based versions" (per the release notes). The official docs do not describe the year-based scheme in detail; with Minecraft's new version numbering (e.g., `VERSION: "26.1"`), use `VERSION` as documented for new-numbering versions and verify the resolved NeoForge version in the container logs.

---

## Fabric

Lightweight mod loader:

| Variable | Description |
|----------|-------------|
| `TYPE` | `FABRIC` |
| `FABRIC_LAUNCHER_VERSION` | Launcher version |
| `FABRIC_LOADER_VERSION` | Loader version |
| `FABRIC_LAUNCHER` | Custom launcher path |
| `FABRIC_LAUNCHER_URL` | Custom launcher URL |
| `FABRIC_META_BASE_URL` | Custom Fabric meta API base URL (for mirrors) |
| `FABRIC_FORCE_REINSTALL` | Force reinstall |

```yaml
environment:
  EULA: "TRUE"
  TYPE: "FABRIC"
  VERSION: "1.20.4"
```

### Installing Fabric API

Most mods require Fabric API:

```yaml
environment:
  MODRINTH_PROJECTS: "fabric-api"
```

---

## Quilt

Fabric-compatible mod loader:

| Variable | Description |
|----------|-------------|
| `TYPE` | `QUILT` |
| `QUILT_LOADER_VERSION` | Loader version |
| `QUILT_INSTALLER_VERSION` | Installer version |

```yaml
environment:
  EULA: "TRUE"
  TYPE: "QUILT"
  VERSION: "1.20.4"
```

---

## Bukkit / Spigot

Plugin support servers (Paper recommended):

```yaml
environment:
  EULA: "TRUE"
  TYPE: "SPIGOT"  # or BUKKIT
  VERSION: "1.20.4"
```

> **Note**: Bukkit/Spigot auto-download can be unstable. Paper is recommended.

---

## Hybrid Servers

Support both mods and plugins:

### Mohist

```yaml
environment:
  EULA: "TRUE"
  TYPE: "MOHIST"
  VERSION: "1.20.1"
```

### Magma Maintained

```yaml
environment:
  EULA: "TRUE"
  TYPE: "MAGMA_MAINTAINED"
  VERSION: "1.20.1"
  FORGE_VERSION: "47.2.0"
```

### Arclight

```yaml
environment:
  EULA: "TRUE"
  TYPE: "ARCLIGHT"
  ARCLIGHT_TYPE: "FORGE"  # FORGE, NEOFORGE, FABRIC
  VERSION: "1.20.1"
```

### Ketting

```yaml
environment:
  EULA: "TRUE"
  TYPE: "KETTING"
  VERSION: "1.20.1"
```

---

## Modpack Platforms

### Auto CurseForge

Automatic CurseForge modpack installation:

| Variable | Description |
|----------|-------------|
| `TYPE` / `MODPACK_PLATFORM` | `AUTO_CURSEFORGE` |
| `CF_API_KEY` | CurseForge API key. Built into the image on Java 17+ (since 2026.7.1); you may still supply your own. **Required** on `java8` and other pre-Java 17 tags |
| `CF_API_KEY_FILE` | Path to a file in the container containing the API key (e.g., Docker secret) |
| `CF_FILENAME_MATCHER` | Substring, or regex surrounded by `/`, to select a modpack file by filename |
| `CF_IGNORE_MISSING_FILES` | Comma/newline-delimited list or glob of files to ignore when detecting missing files (avoids reinstall) |
| `CF_PARALLEL_DOWNLOADS` | Parallel mod downloads (default `4`) |
| `CF_OVERRIDES_SKIP_EXISTING` | Skip overrides files that already exist in `/data` (default `false`; world data is always skipped) |
| `CF_FORCE_REINSTALL_MODLOADER` | Force reinstall of the modpack's mod loader (default `false`) |
| `REMOVE_OLD_CONFIGS` | Clear old configs before modpack install (see [Mods and Plugins](08-mods-and-plugins.md)) |
| `CF_PAGE_URL` | Modpack page URL |
| `CF_SLUG` | Modpack slug |
| `CF_FILE_ID` | Specific file ID |
| `CF_EXCLUDE_MODS` | Mods to exclude |
| `CF_FORCE_INCLUDE_MODS` | Force include mods |

```yaml
environment:
  EULA: "TRUE"
  TYPE: "AUTO_CURSEFORGE"
  CF_API_KEY: "${CF_API_KEY}"  # optional on Java 17+ images (built-in key); required on java8
  CF_SLUG: "all-the-mods-9"
```

> **Note**: Since 2026.7.1 the image includes a CurseForge API key on Java 17 and newer. The `java8` image (and other pre-Java 17 tags) does not; set `CF_API_KEY` yourself or install the pack on a Java 17+ image first.

### Modrinth Modpacks

| Variable | Description |
|----------|-------------|
| `TYPE` / `MODPACK_PLATFORM` | `MODRINTH` |
| `MODRINTH_MODPACK` | Modpack slug/ID/URL |
| `MODRINTH_VERSION` | Specific version |
| `MODRINTH_LOADER` | Mod loader (`forge`, `fabric`, `quilt`) |

```yaml
environment:
  EULA: "TRUE"
  TYPE: "MODRINTH"
  MODRINTH_MODPACK: "cobblemon-modpack"
```

### FTB (Feed The Beast)

```yaml
environment:
  EULA: "TRUE"
  TYPE: "FTBA"
  FTB_MODPACK_ID: "123"
```

---

## Custom Server

Custom server JAR:

```yaml
environment:
  EULA: "TRUE"
  TYPE: "CUSTOM"
  CUSTOM_SERVER: "/data/custom-server.jar"
  # or
  CUSTOM_SERVER: "https://example.com/server.jar"
```

---

## Server Type Summary

| Type | Purpose | Plugins | Mods |
|------|---------|---------|------|
| `VANILLA` | Official server | X | X |
| `PAPER` | High performance | O | X |
| `FORGE` | Mod server | X | O |
| `FABRIC` | Lightweight mods | X | O |
| `QUILT` | Fabric compatible | X | O |
| `MOHIST` | Hybrid | O | O |
| `AUTO_CURSEFORGE` | CurseForge modpacks | - | O |
| `MODRINTH` | Modrinth modpacks | - | O |
