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
| `LEAF` | Lightweight fork |

---

## Forge

Mod support server:

| Variable | Description |
|----------|-------------|
| `TYPE` | `FORGE` |
| `FORGE_VERSION` | Forge version (`latest` or version number) |
| `FORGE_INSTALLER` | Local installer path |
| `FORGE_INSTALLER_URL` | Installer download URL |
| `FORGE_FORCE_REINSTALL` | Force reinstall (`true`) |

```yaml
environment:
  EULA: "TRUE"
  TYPE: "FORGE"
  VERSION: "1.20.1"
  FORGE_VERSION: "latest"
```

### NeoForge

Community fork of Forge:

```yaml
environment:
  EULA: "TRUE"
  TYPE: "NEOFORGE"
  VERSION: "1.20.4"
  NEOFORGE_VERSION: "latest"
```

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
| `CF_API_KEY` | CurseForge API key (**required**) |
| `CF_PAGE_URL` | Modpack page URL |
| `CF_SLUG` | Modpack slug |
| `CF_FILE_ID` | Specific file ID |
| `CF_EXCLUDE_MODS` | Mods to exclude |
| `CF_FORCE_INCLUDE_MODS` | Force include mods |

```yaml
environment:
  EULA: "TRUE"
  TYPE: "AUTO_CURSEFORGE"
  CF_API_KEY: "${CF_API_KEY}"
  CF_SLUG: "all-the-mods-9"
```

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
