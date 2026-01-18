# Backup Guide

Set up automatic world data backup to a private GitHub repository.

## Overview

The backup system provides:

- **Git-based backup** - Full version history of world data
- **GitHub integration** - Secure storage in a private repository
- **Interactive and CLI modes** - Flexible backup management
- **Restore capability** - Roll back to any previous backup

## Prerequisites

- GitHub account
- Private repository for backups
- Personal Access Token with `repo` scope

## Setup

### Step 1: Create a Private Repository

1. Go to [github.com/new](https://github.com/new)
2. Enter repository name (e.g., `minecraft-worlds-backup`)
3. Select **Private**
4. Click **Create repository**

### Step 2: Create a Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Give it a descriptive name (e.g., "Minecraft Backup")
4. Select scope: **repo** (Full control of private repositories)
5. Click **Generate token**
6. **Copy the token immediately** - it won't be shown again!

!!! warning "Token Security"
    - Never commit your token to version control
    - Store it only in the `.env` file
    - Regenerate if compromised

### Step 3: Configure Backup

Edit `~/minecraft-servers/.env`:

```bash
# GitHub Backup Configuration
BACKUP_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BACKUP_GITHUB_REPO=yourusername/minecraft-worlds-backup
BACKUP_GITHUB_BRANCH=main
BACKUP_AUTO_ON_STOP=true
```

| Variable | Description | Required |
|----------|-------------|----------|
| `BACKUP_GITHUB_TOKEN` | Personal Access Token | Yes |
| `BACKUP_GITHUB_REPO` | Repository as `username/repo` | Yes |
| `BACKUP_GITHUB_BRANCH` | Target branch | No (default: main) |
| `BACKUP_AUTO_ON_STOP` | Auto backup on server stop | No (default: false) |

### Step 4: Verify Configuration

```bash
mcctl backup status
```

Expected output:

```
Backup Configuration:

  Status: Configured
  Repository: yourusername/minecraft-worlds-backup
  Branch: main
  Auto backup: enabled
```

---

## Using Backups

### Manual Backup

#### Interactive Mode

```bash
mcctl backup push
```

You'll be prompted to enter a commit message.

#### CLI Mode

```bash
mcctl backup push -m "Before server upgrade"
mcctl backup push -m "Weekly backup"
```

### View Backup History

```bash
mcctl backup history
```

Output:

```
Backup History:

  abc1234  Before server upgrade    2024-01-15
  def5678  Weekly backup            2024-01-08
  ghi9012  Initial backup           2024-01-01
```

JSON output for scripting:

```bash
mcctl backup history --json
```

### Restore from Backup

#### Interactive Mode

```bash
mcctl backup restore
```

Shows a list of backups to choose from.

#### CLI Mode

```bash
mcctl backup restore abc1234
```

!!! danger "Data Overwrite Warning"
    Restore will overwrite all current world data. Consider backing up first:
    ```bash
    mcctl backup push -m "Backup before restore"
    mcctl backup restore abc1234
    ```

---

## Automatic Backups

### On Server Stop

Enable automatic backup when servers stop:

```bash
# .env
BACKUP_AUTO_ON_STOP=true
```

### Scheduled Backups (cron)

Create a cron job for scheduled backups:

```bash
# Edit crontab
crontab -e
```

Add:

```cron
# Daily backup at 4 AM
0 4 * * * /usr/local/bin/mcctl backup push -m "Scheduled daily backup"

# Weekly backup on Sunday at 3 AM
0 3 * * 0 /usr/local/bin/mcctl backup push -m "Scheduled weekly backup"
```

---

## What Gets Backed Up

The backup includes the entire `worlds/` directory:

```
worlds/
├── survival/
│   ├── level.dat
│   ├── region/
│   ├── DIM-1/       # Nether
│   ├── DIM1/        # End
│   └── ...
├── creative/
│   └── ...
└── modded/
    └── ...
```

### Excluded from Backup

- Server configuration files (servers/*)
- Docker compose files
- Plugins/mods (shared/*)
- Container data (logs, temp files)

!!! tip "Backup Server Config Separately"
    Consider backing up your configuration files separately:
    ```bash
    # Backup config
    cp -r ~/minecraft-servers/servers ./servers-backup
    cp ~/minecraft-servers/.env ./env-backup
    ```

---

## Repository Structure

After the first backup, your repository will contain:

```
minecraft-worlds-backup/
├── README.md           # Auto-generated
├── survival/
│   ├── level.dat
│   ├── region/
│   └── ...
├── creative/
│   └── ...
└── .backup-metadata    # Backup metadata
```

---

## Storage Considerations

### Repository Size

GitHub has the following limits for repositories:

| Limit | Value |
|-------|-------|
| Recommended max size | 1 GB |
| Hard limit | 5 GB |
| Individual file limit | 100 MB |

For larger worlds, consider:

- Using Git LFS for large files
- Compressing backups
- Using alternative storage (S3, Backblaze)

### Reducing Backup Size

```bash
# Check world sizes
du -sh ~/minecraft-servers/worlds/*

# Output:
# 256M  ~/minecraft-servers/worlds/survival
# 128M  ~/minecraft-servers/worlds/creative
```

---

## Troubleshooting

### Authentication Failed

```
Error: Authentication failed
```

1. Verify token has `repo` scope
2. Check token hasn't expired
3. Regenerate token if needed

### Repository Not Found

```
Error: Repository not found
```

1. Check repository name spelling
2. Verify repository is private (not public)
3. Ensure token has access to the repository

### Push Rejected

```
Error: Push rejected (non-fast-forward)
```

The remote has changes not in local. Options:

```bash
# Option 1: Force push (overwrites remote)
git -C ~/minecraft-servers/worlds push --force origin main

# Option 2: Pull and merge first
git -C ~/minecraft-servers/worlds pull origin main
mcctl backup push -m "Merged backup"
```

### Large File Error

```
Error: File exceeds 100MB limit
```

Use Git LFS for large files:

```bash
cd ~/minecraft-servers/worlds
git lfs install
git lfs track "*.dat"
git lfs track "*.mca"
git add .gitattributes
git commit -m "Enable Git LFS"
```

---

## Alternative Backup Strategies

### Local Backup

```bash
# Simple tar backup
tar -czvf backup-$(date +%Y%m%d).tar.gz ~/minecraft-servers/worlds/

# With rsync
rsync -av ~/minecraft-servers/worlds/ /backup/minecraft/worlds/
```

### Cloud Storage

```bash
# AWS S3
aws s3 sync ~/minecraft-servers/worlds/ s3://my-bucket/minecraft/

# Backblaze B2
b2 sync ~/minecraft-servers/worlds/ b2://my-bucket/minecraft/
```

### Docker Volume Backup

```bash
# Backup Docker volume
docker run --rm \
  -v minecraft-worlds:/data \
  -v $(pwd):/backup \
  alpine tar -czvf /backup/worlds.tar.gz /data
```

---

## Best Practices

1. **Regular backups** - Daily automatic + manual before changes
2. **Test restores** - Periodically verify backups work
3. **Multiple destinations** - GitHub + local/cloud backup
4. **Document changes** - Use meaningful commit messages
5. **Monitor size** - Watch repository growth

## See Also

- **[CLI Commands](../cli/commands.md)** - All backup commands
- **[Quick Start](../getting-started/quickstart.md)** - Basic setup
- **[GitHub Docs: Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)**
