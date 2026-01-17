# Java Versions

A guide to Java requirements by Minecraft version and image tag selection.

## Supported Java Versions

| Image Tag | Java Version | Usage |
|-----------|--------------|-------|
| `latest`, `stable` | Java 25 | Latest Minecraft (default) |
| `java21` | Java 21 | Minecraft 1.20.5+ |
| `java17` | Java 17 | Minecraft 1.18+ |
| `java11` | Java 11 | Legacy |
| `java8` | Java 8 | Forge 1.17 and below |

## Java Requirements by Version

| Minecraft Version | Minimum Java | Recommended Java |
|-------------------|--------------|------------------|
| 1.21+ | Java 21 | Java 21 |
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

| Tag | Architecture |
|-----|-------------|
| `java21` | amd64, arm64 |
| `java17` | amd64, arm64, armv7 |
| `java8` | amd64, arm64 |

### ARM Devices (Raspberry Pi, etc.)

```yaml
image: itzg/minecraft-server:java17
# or arm64 only
image: itzg/minecraft-server:java17-graalvm
```

## GraalVM Variants

GraalVM images for performance improvement:

```yaml
image: itzg/minecraft-server:java21-graalvm
```

Use with GraalVM optimization flags:

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21-graalvm
    environment:
      EULA: "TRUE"
      USE_MEOWICE_GRAALVM_FLAGS: "true"
```

## Version Selection Guide

```
Minecraft 1.21+ → java21 or latest
Minecraft 1.18-1.20.4 → java17 or java21
Forge 1.16.5 and below → java8 (required)
Modpacks → Check modpack requirements
Latest features → java21-graalvm
```

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
