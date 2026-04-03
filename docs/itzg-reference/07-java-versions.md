# Java Versions

A guide to Java requirements by Minecraft version and image tag selection.

## Supported Java Versions

| Image Tag | Java Version | Base OS | Architecture | Notes |
|-----------|--------------|---------|-------------|-------|
| `latest`, `stable` | Java 25 | Ubuntu | amd64, arm64 | Default; `stable` points to most recent release |
| `java25` | Java 25 | Ubuntu | amd64, arm64 | |
| `java25-alpine` | Java 25 | Alpine | amd64, arm64 | |
| `java25-jdk` | Java 25 | Ubuntu+JDK | amd64, arm64 | Full JDK included |
| `java21` | Java 21 | Ubuntu | amd64, arm64 | |
| `java21-jdk` | Java 21 | Ubuntu+JDK | amd64, arm64 | Full JDK included |
| `java21-alpine` | Java 21 | Alpine | amd64, arm64 | |
| `java17` | Java 17 | Ubuntu | amd64, arm64, armv7 | |
| `java16` | Java 16 | Ubuntu | amd64, arm64, armv7 | |
| `java11` | Java 11 | Ubuntu | amd64, arm64, armv7 | Legacy |
| `java8` | Java 8 | Ubuntu | amd64, arm64, armv7 | Forge 1.17 and below |

!!! info "The `stable` tag"
    The `stable` tag always points to the most recent **release** version of the image.
    Unlike `latest` which may include pre-release builds, `stable` provides a consistent,
    production-ready image.

### Deprecated Tags

!!! warning "Deprecated Tags"
    The following tags are **deprecated** and should not be used for new deployments:

    - `java23`, `java23-alpine`, `java23-jdk` -- Use `java25` instead
    - `java24`, `java24-graalvm` -- Use `java25` instead
    - `java17-alpine` -- Use `java17` or `java21-alpine` instead
    - `java25-graalvm`, `java21-graalvm`, `java17-graalvm` -- **All GraalVM tags are deprecated** (see below)

### Programmatic Access

The full list of supported image tags and their metadata is available as JSON:

```
https://raw.githubusercontent.com/itzg/docker-minecraft-server/refs/heads/master/images.json
```

## Java Requirements by Version

| Minecraft Version | Minimum Java | Recommended Java |
|-------------------|--------------|------------------|
| 1.21+ | Java 21 | Java 21 or 25 |
| 1.20.5 - 1.20.6 | Java 21 | Java 21 |
| 1.18 - 1.20.4 | Java 17 | Java 17/21 |
| 1.17 | Java 16 | Java 17 |
| 1.12 - 1.16.5 | Java 8 | Java 8/11 |
| 1.11 and below | Java 8 | Java 8 |

## How to Select Java Version

### Docker CLI

```bash
docker run -d -e EULA=TRUE itzg/minecraft-server:java21
```

### Docker Compose

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      VERSION: "1.20.4"
```

## Forge Server Java Versions

Forge requires specific Java versions:

| Forge/Minecraft Version | Required Java |
|------------------------|---------------|
| Forge 1.20.5+ | Java 21 |
| Forge 1.18 - 1.20.4 | Java 17 |
| Forge 1.17.x | Java 16/17 |
| **Forge 1.16.5 and below** | **Java 8 required** |

### Forge 1.16.5 Example

```yaml
services:
  mc:
    image: itzg/minecraft-server:java8
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      VERSION: "1.16.5"
```

### Forge 1.20.1 Example

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      VERSION: "1.20.1"
```

## Common Errors and Solutions

### "class file version 65.0" Error

Java 21 or higher is required:

```yaml
image: itzg/minecraft-server:java21
```

### "Unsupported class file major version" Error

Java version is too high. Use a lower version:

```yaml
# For Forge 1.16.5
image: itzg/minecraft-server:java8
```

### Mod Compatibility Issues

Some mods require specific Java versions. Check the mod documentation.

## Architecture-Specific Tags

Support for various CPU architectures:

| Tag | Java | Linux | Architecture |
|-----|------|-------|-------------|
| `latest`, `stable` | 25 | Ubuntu | amd64, arm64 |
| `java25` | 25 | Ubuntu | amd64, arm64 |
| `java25-alpine` | 25 | Alpine | amd64, arm64 |
| `java25-jdk` | 25 | Ubuntu+JDK | amd64, arm64 |
| `java21` | 21 | Ubuntu | amd64, arm64 |
| `java21-jdk` | 21 | Ubuntu+JDK | amd64, arm64 |
| `java21-alpine` | 21 | Alpine | amd64, arm64 |
| `java17` | 17 | Ubuntu | amd64, arm64, armv7 |
| `java16` | 16 | Ubuntu | amd64, arm64, armv7 |
| `java11` | 11 | Ubuntu | amd64, arm64, armv7 |
| `java8` | 8 | Ubuntu | amd64, arm64, armv7 |

### ARM Devices (Raspberry Pi, etc.)

```yaml
image: itzg/minecraft-server:java17
# java17 supports armv7 (Raspberry Pi 3/4 32-bit)
# java21+ supports arm64 only (Raspberry Pi 4/5 64-bit)
```

## GraalVM Variants (Deprecated)

!!! danger "All GraalVM Tags Are Deprecated"
    The GraalVM image variants (`java25-graalvm`, `java21-graalvm`, `java17-graalvm`)
    are **all deprecated** and will be removed in a future release.

    **Migration**: Switch to the standard OpenJDK-based tags (`java25`, `java21`, `java17`).

    Previously, GraalVM images were also incompatible with Auto-Pause (`ENABLE_AUTOPAUSE`).

## Version Selection Guide

```
Minecraft 1.21+ --> java21 or latest (Java 25)
Minecraft 1.18-1.20.4 --> java17 or java21
Forge 1.16.5 and below --> java8 (required)
Modpacks --> Check modpack requirements
```

!!! tip "When in doubt"
    Use `java21` for Minecraft 1.20.5+. The `latest`/`stable` tags now use Java 25,
    which works with all modern Minecraft versions.

## Examples: Version-Specific Configurations

### Latest Paper Server

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "LATEST"
```

### Legacy Forge Modpack

```yaml
services:
  mc:
    image: itzg/minecraft-server:java8
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      VERSION: "1.12.2"
      FORGE_VERSION: "14.23.5.2860"
```

### Fabric 1.20.4

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"
```
