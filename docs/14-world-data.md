# World Data

World management, datapacks, and VanillaTweaks configuration.

## Importing Worlds

### Download World from URL

```yaml
environment:
  WORLD: "https://example.com/world.zip"
```

### Supported Formats

- ZIP files (`.zip`)
- Compressed TAR files (`.tar.gz`, `.tgz`)
- Local directories

### Using Local World

```yaml
volumes:
  - ./my-world:/data/world
```

Or:

```yaml
environment:
  WORLD: "/worlds/my-world"
volumes:
  - ./worlds:/worlds:ro
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `WORLD` | World archive URL or path |
| `WORLD_INDEX` | Select when archive has multiple `level.dat` files (default: 1) |
| `FORCE_WORLD_COPY` | `TRUE` - Overwrite world on each server start |
| `LEVEL` | World save folder name (default: `world`) |

## Changing World Directory

```yaml
environment:
  EXTRA_ARGS: "--world-dir ./worlds/"
  # or
  EXTRA_ARGS: "--universe ./worlds/"
```

---

## Datapacks

### Single Datapack

```yaml
environment:
  DATAPACKS: "https://example.com/datapack.zip"
```

### Multiple Datapacks

```yaml
environment:
  DATAPACKS: |
    https://example.com/datapack1.zip
    https://example.com/datapack2.zip
    /data/local-datapack.zip
```

### Datapack List File

```yaml
environment:
  DATAPACKS_FILE: "/data/datapacks.txt"
```

`datapacks.txt`:
```text
https://example.com/datapack1.zip
https://example.com/datapack2.zip
```

### Removing Old Datapacks

```yaml
environment:
  REMOVE_OLD_DATAPACKS: "true"
  REMOVE_OLD_DATAPACKS_DEPTH: "16"
  REMOVE_OLD_DATAPACKS_INCLUDE: "*.zip"
```

---

## VanillaTweaks

Auto-install datapacks and resource packs from [VanillaTweaks](https://vanillatweaks.net/)

### Using Share Code

Share code generated from VanillaTweaks website:

```yaml
environment:
  VANILLATWEAKS_SHARECODE: "MGr52E,q2Ec6z"
```

### JSON Configuration File

```yaml
environment:
  VANILLATWEAKS_FILE: "/data/vanillatweaks.json"
```

`vanillatweaks.json`:
```json
{
  "type": "datapacks",
  "version": "1.20",
  "packs": {
    "survival": ["multiplayer sleep", "afk display"],
    "items": ["player head drops"]
  }
}
```

### Supported Types

- `datapacks` - Datapacks
- `resourcepacks` - Resource packs
- `craftingtweaks` - Crafting recipes

---

## World Generation Settings

### Basic Settings

```yaml
environment:
  LEVEL_TYPE: "default"    # default, flat, largeBiomes, amplified
  SEED: "12345"
  GENERATE_STRUCTURES: "true"
```

### Superflat World

```yaml
environment:
  LEVEL_TYPE: "flat"
  GENERATOR_SETTINGS: '{"layers":[{"block":"bedrock","height":1},{"block":"dirt","height":2},{"block":"grass_block","height":1}]}'
```

### Initial Datapack Settings

```yaml
environment:
  INITIAL_ENABLED_PACKS: "vanilla,file/my_datapack"
  INITIAL_DISABLED_PACKS: "file/disabled_pack"
```

---

## World Backup

### Manual Backup

```bash
# Save command to server
docker exec mc rcon-cli save-all
docker exec mc rcon-cli save-off

# Create backup
tar -czf world_backup_$(date +%Y%m%d).tar.gz ./data/world

# Re-enable saving
docker exec mc rcon-cli save-on
```

### Automatic Backup Script

```bash
#!/bin/bash
CONTAINER="mc"
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Save world
docker exec $CONTAINER rcon-cli save-all
sleep 5
docker exec $CONTAINER rcon-cli save-off

# Backup
tar -czf "$BACKUP_DIR/world_$DATE.tar.gz" ./data/world

# Re-enable saving
docker exec $CONTAINER rcon-cli save-on

# Delete old backups (7 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
```

---

## Example Configurations

### Custom World + Datapacks

```yaml
services:
  mc:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"

      # World settings
      WORLD: "https://example.com/custom-world.zip"
      LEVEL: "custom-world"

      # Datapacks
      DATAPACKS: |
        https://example.com/datapack1.zip
        https://example.com/datapack2.zip

      # VanillaTweaks
      VANILLATWEAKS_SHARECODE: "MGr52E"
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```

### New World Generation

```yaml
services:
  mc:
    image: itzg/minecraft-server
    environment:
      EULA: "TRUE"
      TYPE: "PAPER"
      VERSION: "1.20.4"

      # World generation settings
      LEVEL: "survival-world"
      SEED: "minecraft-seed-123"
      LEVEL_TYPE: "default"
      GENERATE_STRUCTURES: "true"
      DIFFICULTY: "normal"
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```
