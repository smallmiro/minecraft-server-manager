# CurseForge

Download mods and plugins from [CurseForge](https://www.curseforge.com/minecraft) - the largest mod hosting platform.

## Overview

| Feature | Value |
|---------|-------|
| Official Website | [https://www.curseforge.com/minecraft](https://www.curseforge.com/minecraft) |
| API Key Required | **Yes** |
| API Console | [https://console.curseforge.com/](https://console.curseforge.com/) |
| Dependency Resolution | Manual (metadata only) |
| Mod Library Size | Largest |

## Getting API Key

!!! warning "API Key Required"
    CurseForge requires an API key for all downloads. You must obtain one before using CurseForge features.

### Step 1: Create CurseForge Account

1. Go to [CurseForge](https://www.curseforge.com/)
2. Click "Sign In" or "Register"
3. Complete the registration process

### Step 2: Access API Console

1. Go to [https://console.curseforge.com/](https://console.curseforge.com/)
2. Sign in with your CurseForge account
3. Accept the API Terms of Service

### Step 3: Generate API Key

1. Click "Create API Key" or navigate to API Keys section
2. Give your key a descriptive name (e.g., "Minecraft Docker Server")
3. Copy the generated API key immediately

!!! danger "Security"
    - Store your API key securely
    - Never commit API keys to version control
    - Use environment variables or Docker secrets

### Step 4: Configure API Key

=== "Environment Variable"

    ```yaml
    environment:
      CF_API_KEY: "${CF_API_KEY}"
    ```

    Set in your shell or `.env` file:
    ```bash
    export CF_API_KEY=your_api_key_here
    ```

=== "Docker Secrets"

    ```yaml
    services:
      mc:
        secrets:
          - cf_api_key
        environment:
          CF_API_KEY_FILE: /run/secrets/cf_api_key

    secrets:
      cf_api_key:
        file: ./cf_api_key.txt
    ```

=== ".env File"

    ```bash
    # .env
    CF_API_KEY=your_api_key_here
    ```

    ```yaml
    # docker-compose.yml
    environment:
      CF_API_KEY: "${CF_API_KEY}"
    ```

!!! tip "Escaping $ in Docker Compose"
    If your API key contains `$`, escape it with `$$`:
    ```yaml
    CF_API_KEY: "abc$$def$$ghi"
    ```

## Basic Usage

### CURSEFORGE_FILES

Download mods/plugins using various reference formats:

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

## Supported Reference Formats

| Format | Description | Example |
|--------|-------------|---------|
| Project URL | Full URL to mod page | `https://www.curseforge.com/minecraft/mc-mods/jei` |
| File URL | URL with specific file | `https://www.curseforge.com/minecraft/mc-mods/jei/files/4593548` |
| Slug | Short identifier from URL | `jei` |
| Project ID | Numeric project identifier | `238222` |
| Slug:FileID | Slug with specific file | `jei:4593548` |
| ID:FileID | Project ID with file ID | `238222:4593548` |
| Slug@Version | Slug with version string | `jei@10.2.1.1005` |
| @ListingFile | Path to listing file | `@/extras/cf-mods.txt` |

!!! tip "Finding Project IDs"
    1. Go to the mod page on CurseForge
    2. Scroll down to the "About Project" section
    3. Find "Project ID" (e.g., 238222 for JEI)

### Reference Format Examples

```yaml
environment:
  CF_API_KEY: "${CF_API_KEY}"
  CURSEFORGE_FILES: |
    # URL formats
    https://www.curseforge.com/minecraft/mc-mods/jei
    https://www.curseforge.com/minecraft/mc-mods/jei/files/4593548

    # Slug (auto-selects newest compatible version)
    journeymap

    # Project ID
    238222

    # Specific file ID
    jei:4593548
    238222:4593548

    # Specific version string
    jei@10.2.1.1005
```

## Using Listing Files

### File Format

Create a listing file at `/extras/cf-mods.txt`:

```text
# Core mods
jei
journeymap

# Utility mods
jade
mouse-tweaks

# Specific versions
create:5678901
```

### Reference Listing File

```yaml
environment:
  CF_API_KEY: "${CF_API_KEY}"
  CURSEFORGE_FILES: "@/extras/cf-mods.txt"
volumes:
  - ./extras:/extras:ro
```

!!! note "Listing File Requirements"
    - Must be in a mounted directory
    - Comments start with `#`
    - Blank lines are ignored

## Auto-Removal and Upgrades

- Files are automatically **upgraded** when newer versions are available
- **Removed** references are automatically cleaned up
- Set `CURSEFORGE_FILES` to empty string to remove all managed files

## Dependencies

!!! warning "Manual Dependency Management"
    CurseForge can detect missing dependencies but cannot automatically resolve them. The metadata provides only mod IDs, not specific file versions needed.

    You must manually add required dependencies to `CURSEFORGE_FILES`.

## Complete Examples

### Forge Mod Server

```yaml
services:
  mc:
    image: itzg/minecraft-server:java17
    environment:
      EULA: "TRUE"
      TYPE: "FORGE"
      VERSION: "1.20.1"
      MEMORY: "6G"
      CF_API_KEY: "${CF_API_KEY}"
      CURSEFORGE_FILES: |
        jei
        journeymap
        jade
        mouse-tweaks
        appleskin
        storage-drawers
        refined-storage
    volumes:
      - ./data:/data
    ports:
      - "25565:25565"
```

### Mixed Sources (CurseForge + Modrinth)

```yaml
services:
  mc:
    image: itzg/minecraft-server:java21
    environment:
      EULA: "TRUE"
      TYPE: "FABRIC"
      VERSION: "1.20.4"

      # CurseForge mods
      CF_API_KEY: "${CF_API_KEY}"
      CURSEFORGE_FILES: |
        jei
        journeymap

      # Modrinth mods
      MODRINTH_PROJECTS: |
        fabric-api
        sodium
        lithium
    volumes:
      - ./data:/data
```

### Pinned Versions

For reproducible builds, pin specific file versions:

```yaml
environment:
  CF_API_KEY: "${CF_API_KEY}"
  CURSEFORGE_FILES: |
    jei:4593548
    journeymap:4596105
    jade:4587399
```

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `CF_API_KEY` | CurseForge API key (required) |
| `CF_API_KEY_FILE` | Path to file containing API key |
| `CURSEFORGE_FILES` | Comma/space/newline separated list of mod references |

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid or missing API key | Verify `CF_API_KEY` is set correctly |
| 403 Forbidden | API key lacks permissions | Regenerate API key from console |
| Mod not found | Wrong slug or ID | Verify from CurseForge URL |
| Version mismatch | Mod doesn't support server version | Use specific file ID for compatible version |
| Missing dependencies | Dependencies not resolved | Manually add required mods |

### Debug Logging

Enable debug output to troubleshoot issues:

```yaml
environment:
  DEBUG: "true"
```

### Verify API Key

Test your API key with curl:

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://api.curseforge.com/v1/mods/238222"
```

## See Also

- [CurseForge Official Website](https://www.curseforge.com/minecraft)
- [CurseForge API Console](https://console.curseforge.com/)
- [Mods and Plugins Overview](index.md)
- [Modrinth Guide](modrinth.md)
- [Modpacks Guide](modpacks.md)
- [Official itzg Documentation](https://docker-minecraft-server.readthedocs.io/en/latest/mods-and-plugins/curseforge-files/)
