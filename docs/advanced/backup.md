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
- git 2.31 or newer on the host (`git --version`); older git is refused with a clear error

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
mcctl backup restore abc1234          # asks for confirmation
mcctl backup restore abc1234 --force  # no prompt (scripts)
```

Restore rules:

- **Stop every server first.** Restore is refused while any server is running, and when Docker cannot be queried.
- The result is exactly the backup commit: files added after that commit are removed, not mixed in.
- `worlds/.locks` is never touched.
- Server-internal worlds (`servers/<name>/data/<LEVEL>`) are restored only for servers in the commit. A server whose current `LEVEL` differs from the world in the commit is refused (`restore_conflict`).
- The data that was replaced is kept in `~/minecraft-servers/backups/restore-previous/<timestamp>/`. The three newest are kept; older ones are deleted after a successful restore.

!!! warning "Auto-scale during restore"
    mc-router can start a server when a player connects. Restore checks for running servers twice, but a server that starts between the last check and the end of the restore is not prevented. Stop `mc-router` (or make sure no one connects) before restoring.

!!! danger "Data Overwrite Warning"
    Restore replaces the current world data. Consider backing up first:
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

`mcctl stop <server>`, and a stop from the web console or the API, back up after the server has stopped, like `mcctl backup push --auto`: no prompt, and a wait of up to 10 minutes when another backup is running. A failed backup is a warning (CLI) or a log entry (API); it never fails the stop. The API runs it in the background, so the stop request returns first; when mcctl-api shuts down it waits up to 2 minutes for a running backup. Installs set up with `mcctl console init` before this release need `kill_timeout` in `ecosystem.config.cjs` for that wait ([Upgrade runbook, step 4-2](upgrade-runbook.md#pm2-kill-timeout)). `mcctl stop --all` does not back up.

### Scheduled Backups

Use `mcctl backup schedule add` (or the web console) for scheduled backups with a retention policy. A plain cron job also works:

```cron
# Daily backup at 4 AM (--auto: no prompt, waits for a running backup)
0 4 * * * /usr/local/bin/mcctl backup push --auto
```

---

## What Gets Backed Up

- The whole `worlds/` directory, except `worlds/.locks`
- Server-internal worlds: `servers/<name>/data/<LEVEL>` (with `<LEVEL>_nether` and `<LEVEL>_the_end` when present) for servers whose world is not in `worlds/`

Running servers are flushed before the copy: `save-off`, `save-all flush`, copy, then `save-on`. `save-on` is sent even when the backup fails. If a running server does not answer RCON, the backup fails instead of copying a world that is being written.

When nothing changed since the last backup, the backup succeeds with "No changes to backup".

### Excluded from Backup

- Server configuration files (`servers/*/config.env`, compose files)
- Plugins/mods (shared/*)
- Container data (logs, temp files)

!!! tip "Backup Server Config Separately"
    Use mcctl to backup server configurations:
    ```bash
    mcctl server-backup myserver
    mcctl server-backup myserver --list
    mcctl server-restore myserver
    ```

### Deleted Worlds

If a world that is in the last backup is missing, the backup stops instead of recording the deletion (a missing mount would otherwise delete every world from the backup). If you deleted the world on purpose, consent once:

```bash
mcctl backup push --allow-missing
```

In the web console, check **Remove worlds I deleted on purpose** in the push dialog. Scheduled backups never pass this flag; their failure message names the command. Deleting a whole `servers/<name>/` directory counts as intentional.

---

## Repository Structure

```text
minecraft-worlds-backup/
├── README.md                 # Auto-generated
├── worlds/
│   ├── survival/
│   └── creative/
└── servers/
    └── myserver/
        ├── world/            # server-internal world
        └── world_nether/
```

The local working copy is `~/minecraft-servers/backups/worlds`. Do not edit it by hand.

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

### Another Backup Is Running

```
Error: Another backup operation is running (push, pid 1234 on host, since ...)
```

Push, restore and retention pruning share one lock, `~/minecraft-servers/backups/.backup.lock`. If no backup is running (for example after a crash on another host), check that the listed process is gone and delete the file.

### Worlds Missing From the Source

See [Deleted Worlds](#deleted-worlds): use `mcctl backup push --allow-missing` only when the deletion was intended.

### Stop the Running Servers

Restore is refused while servers run. Stop them (`mcctl stop <server>`) and retry.

### A Restore Did Not Finish

```
Error: A restore did not finish; recover manually from .../backups/restore-previous/<timestamp>
```

A restore failed and could not be fully rolled back. Every later push and restore is blocked until you recover:

1. Open `backups/restore-previous/<timestamp>/INCOMPLETE`. It lists each target (`live`) and where its previous data was kept (`previous`).
2. For each target, move the `previous` path back to `live` if `live` is missing or wrong. Data that the restore had already moved in is under `.new/`.
3. Delete the `INCOMPLETE` file.

### Unsupported Layout

`unsupported_layout` means one of:

- A world contains a symbolic link (symlinks are not backed up or restored).
- `worlds/`, `servers/<name>/` and `backups/` are on different filesystems (restore moves directories and needs them on one filesystem).

### Old `worlds.bak.<timestamp>` Directories

Earlier versions left `worlds.bak.<timestamp>` copies next to `worlds/` on every restore. They are no longer created. Delete them by hand when you no longer need them:

```bash
ls -d ~/minecraft-servers/worlds.bak.*
rm -rf ~/minecraft-servers/worlds.bak.<timestamp>
```

### Large File Error

```
Error: File exceeds 100MB limit
```

Use Git LFS for large files:

```bash
cd ~/minecraft-servers/backups/worlds
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
