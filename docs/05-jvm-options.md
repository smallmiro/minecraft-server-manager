# JVM Options

Java Virtual Machine memory and performance optimization settings.

## Memory Settings

### Basic Memory Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMORY` | `1G` | Set initial/max heap memory together |
| `INIT_MEMORY` | - | Initial heap size (separate setting) |
| `MAX_MEMORY` | - | Maximum heap size (separate setting) |

### Format

- Absolute value: `<size>[g|G|m|M|k|K]`
  - Examples: `2G`, `2048M`, `2048m`
- Percentage: `<size>%`
  - Example: `75%` (75% of container memory)

### Examples

```yaml
# Single value
environment:
  MEMORY: "4G"

# Separate initial/max
environment:
  INIT_MEMORY: "2G"
  MAX_MEMORY: "4G"

# Percentage of container memory
environment:
  MEMORY: "75%"
```

## Passing JVM Options

| Variable | Purpose |
|----------|---------|
| `JVM_OPTS` | General JVM options (space separated) |
| `JVM_XX_OPTS` | `-XX` options only |
| `JVM_DD_OPTS` | System properties (`name=value` comma separated) |

### Examples

```yaml
environment:
  JVM_OPTS: "-Dfoo=bar -Xms512M"
  JVM_XX_OPTS: "-XX:+UseG1GC -XX:MaxGCPauseMillis=200"
  JVM_DD_OPTS: "foo=bar,baz=qux"
```

## Optimization Flags

### Aikar Flags

Recommended GC tuning flags for Paper/Spigot servers:

```yaml
environment:
  USE_AIKAR_FLAGS: "true"
```

Applied options include:
- G1GC garbage collector
- GC pause time optimization
- Improved heap memory management

### MeowIce Flags

Updated version of Aikar flags:

```yaml
environment:
  USE_MEOWICE_FLAGS: "true"
```

### GraalVM Optimization

When using GraalVM JVM:

```yaml
environment:
  USE_MEOWICE_GRAALVM_FLAGS: "true"
```

### Flare Profiling

Performance profiling support:

```yaml
environment:
  USE_FLARE_FLAGS: "true"
```

### SIMD Optimization

Vector operation optimization:

```yaml
environment:
  USE_SIMD_FLAGS: "true"
```

## JMX Remote Monitoring

Remote profiling through JMX (Java Management Extensions):

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_JMX` | `false` | Enable JMX |
| `JMX_HOST` | - | JMX bind host |
| `JMX_PORT` | `7091` | JMX port |

```yaml
services:
  mc:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      ENABLE_JMX: "true"
      JMX_HOST: "0.0.0.0"
      JMX_PORT: "7091"
    ports:
      - "25565:25565"
      - "7091:7091"
```

## OpenJ9 Specific Options

When using IBM OpenJ9 JVM:

| Variable | Description |
|----------|-------------|
| `TUNE_VIRTUALIZED` | Virtualized environment optimization (`TRUE`) |
| `TUNE_NURSERY_SIZES` | Automatic nursery size setting (`TRUE`) |

```yaml
environment:
  TUNE_VIRTUALIZED: "TRUE"
  TUNE_NURSERY_SIZES: "TRUE"
```

## Memory Debugging

Diagnose memory allocation issues:

```yaml
environment:
  DEBUG_MEMORY: "true"
```

## Recommended Configuration Examples

### Small Server (1-10 players)

```yaml
environment:
  MEMORY: "2G"
  USE_AIKAR_FLAGS: "true"
```

### Medium Server (10-30 players)

```yaml
environment:
  MEMORY: "4G"
  USE_AIKAR_FLAGS: "true"
  VIEW_DISTANCE: "10"
```

### Large Server (30+ players)

```yaml
environment:
  INIT_MEMORY: "4G"
  MAX_MEMORY: "8G"
  USE_AIKAR_FLAGS: "true"
  VIEW_DISTANCE: "8"
  SIMULATION_DISTANCE: "6"
```

### Modpack Server

```yaml
environment:
  MEMORY: "6G"
  USE_AIKAR_FLAGS: "true"
  JVM_XX_OPTS: "-XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=40"
```
