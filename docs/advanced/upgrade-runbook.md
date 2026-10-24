# Upgrade Runbook (every release)

The same procedure for every release: upgrade the whole system (CLI, API, Console, platform config, router, servers, maps) in a fixed order. It is version-independent; only the `NEW` variable changes. Read the release's [CHANGELOG](https://github.com/smallmiro/minecraft-server-manager/blob/main/CHANGELOG.md) and release notes first for release-specific notes.

!!! warning "Read first"
    - `mcctl update` upgrades packages only (CLI/API/Console/shared). **It does not run `mcctl upgrade`** (`.env`, `servers/_template`, root compose router). Run `mcctl upgrade` separately.
    - Run every command in a shell using **the same Node version PM2 uses** (step 0). If they differ, the native `better-sqlite3` module can hit an ABI mismatch and the Console returns 500.

## 0. Pre-flight

```bash
# Variables: current version / target version / platform root
export OLD=$(mcctl --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')   # for rollback
export NEW=2.29.1
export ROOT=~/minecraft-servers          # directory with docker-compose.yml, .env, .mcctl.json

# Check PM2's Node version, then switch the shell to the same one (e.g. 22)
pm2 jlist | python3 -c "import sys,json;[print(p['name'],p['pm2_env']['version'],p['pm2_env']['node_version']) for p in json.load(sys.stdin)]"
nvm use 22 && node --version

# If several mcctl installs exist, check which one runs
which -a mcctl && mcctl --version
npm view @minecraft-docker/mcctl version      # must equal $NEW (registry can lag 1-2 min after publish)
```

**Gate:** shell Node major equals PM2 Node major, and `npm view` returns `$NEW`.

## 1. Backup

```bash
cd $ROOT
S=pre-$NEW; B=$ROOT/backups-$S
mkdir -p $B                                   # keep it OUTSIDE servers/ (see warning below)
cp docker-compose.yml $B/docker-compose.yml
cp .env $B/.env
cp .mcctl.json $B/.mcctl.json
cp -r servers/_template $B/_template
mcctl status                                  # record current state
mcctl server-backup <server> -m "Before v$NEW"   # worlds/config, whichever you use
```

**Gate:** `$B` contains `docker-compose.yml`, `.env`, `.mcctl.json` and `_template`.

!!! danger "Never put backups inside `servers/`"
    `mcctl update` treats every directory under `servers/` as a server and checks/changes its image tag. A copy such as `servers/_template.pre-…` is mistaken for a server and modified, so a rollback would restore tampered values.

## 2. Update packages

```bash
mcctl update --check          # exits 1 when an update is available
mcctl update --yes            # CLI + api/console/shared, restarts PM2
hash -r && mcctl --version    # = $NEW
```

- If you see `Updated (restart manually)`, do step 4.
- If `mcctl update` retags a server's compose image, note the `⚠ <server>: A → B` output. Stopped servers pick it up on next start.

**Rollback point:** `npm install -g @minecraft-docker/mcctl@<previous>` then `mcctl console service restart --force`.

## 3. Migrate configuration

```bash
mcctl upgrade --dry-run       # preview only
```

Check the dry run for new `.env` variables, compose changes (`router.image`, `router.group_add`) and anything unexpected. Stop and report if something looks wrong.

```bash
mcctl upgrade                 # accept defaults for new .env vars, y to apply compose changes
mcctl upgrade --non-interactive   # apply defaults without prompting (automation)
```

- New `.env` variables are added (e.g. `DOCKER_GID`), `docker-compose.yml.bak-<timestamp>` is created, and `docker compose up -d router` runs automatically when the router changes.
- `servers/_template/*` is overwritten and `templateVersion` in `.mcctl.json` is updated.
- (v2.32.0+) If `servers/global.env` is missing, it is created and existing servers are repointed from `- ../../.env` to `- ../global.env`, so platform secrets stop reaching server containers. Containers keep the old environment until recreated: stop, then start each server in step 5. See [Environment Variables](../configuration/environment.md#setting-classification).
- (v2.33.0+) If `ecosystem.config.cjs` still defines `BETTER_AUTH_SECRET` / `BETTER_AUTH_BASE_URL`, they are moved into `.env` (the secret is kept, so sessions stay valid), the keys are removed from the ecosystem file, and `ecosystem.config.cjs.bak-<timestamp>` is written next to it. Step 4 (`mcctl console service restart --console`) applies it. `--dry-run` only shows it; a second run changes nothing (#699).
- If `.mcctl.json` has no `installId`, it is added once (an existing value is kept). The web console uses it for anonymous usage analytics; to opt out, set `"telemetry": false` in `.mcctl.json` (see [Usage Analytics](../console/web-console.md#usage-analytics)).
- **If the router image is the untagged `itzg/mc-router`, `mcctl upgrade` does not bump the image.** Pin `image:` in `docker-compose.yml` to the version named in the release notes, then run `docker compose config -q && docker compose up -d router`.

### 3-1. Upgrading to v3.0.0: the `scripts` folder is gone (#736) {#v300-scripts}

v3.0.0 removes every Bash script (#715). `mcctl` no longer reads `<root>/scripts`, and the `MCCTL_SCRIPTS` environment variable is ignored.

- `mcctl upgrade` prints the path of `<root>/scripts`, a warning that it is unused since v3.0.0 and may hold files you edited yourself, and a link to this table. In a terminal it asks `Remove <path>?` and deletes **only after you answer `y`** (default `N`). With `--non-interactive` or without a terminal (cron) it prints `rm -r <path>` as a hint and deletes nothing; `--dry-run` only says `Would ask before removing <path>.`. A symbolic link is unlinked, not followed. There is no option to skip the question. You can also delete the folder yourself; nothing else in the platform root depends on it.
- **Before you delete it, copy any script you edited** (for example `cp -r $ROOT/scripts ~/scripts-backup`). Deleting cannot be undone.
- If cron jobs, systemd units or your own scripts called `<root>/scripts/*.sh` directly, change them before you delete the folder. Use this table:

| Old script (`<root>/scripts/`) | v3.0.0 |
|---|---|
| `mcctl.sh start` / `stop` / `status` / `logs` | `mcctl start` / `mcctl stop` / `mcctl status` / `mcctl logs` |
| `mcctl.sh console` | `mcctl console <server>` (TCP RCON) |
| RCON commands (`rcon-cli` through the script) | `mcctl exec <server> <command...>` |
| `create-server.sh` | `mcctl create` |
| `delete-server.sh` | `mcctl delete` |
| `backup.sh push` / `status` / `history` / `restore` | `mcctl backup push` / `status` / `history` / `restore` |
| `lock.sh` | `mcctl world` (`list`, `assign`, `release`; see [World Assignment Rules](../cli/commands.md#world-assignment-rules)) |
| `player.sh lookup` / `uuid` | `mcctl player info <name> [--offline]` |
| `logs.sh` | `mcctl logs` |
| `init.sh` | `mcctl init` |
| `render-map.sh` | No CLI command. Use **Render map** in the web console, or the API (BlueMap) |

- Servers keep working. The first command that changes a server writes `servers/<name>/server.yaml` and rewrites `config.env` and the server's `compose.yml`; see [server.yaml](../configuration/server-yaml.md).

**Gate:** `ls $ROOT/scripts` reports no such folder (or you chose to keep it), and nothing in `crontab -l` or `systemctl list-timers` still names a `.sh` file from it.

## 4. Restart API / Console (if needed)

```bash
mcctl console service restart
# if the new build does not come up or you see an ABI error (NODE_MODULE_VERSION)
mcctl console service restart --force
cd $ROOT && npm rebuild better-sqlite3 && mcctl console service restart --force
```

### 4-1. Upgrading to v2.32.0 or later: check the console access mode (#633)

Do this once when upgrading from v2.31.0 or earlier to v2.32.0 or later, and only on hosts where `mcctl console init` was run.

Up to v2.31.0, `mcctl console init` wrote the chosen access mode to `AUTH_MODE` as is. mcctl-api does not recognise `internal`, `api-key-ip` or `open`, and falls back to `api-key` under `NODE_ENV=production` (`disabled` otherwise). From v2.32.0, `mcctl console init` writes a value mcctl-api recognises. `mcctl update` and `mcctl upgrade` do not rewrite `ecosystem.config.cjs`, so an existing install keeps the old value until you change it.

```bash
grep -nE "AUTH_MODE|AUTH_IP_WHITELIST" $ROOT/ecosystem.config.cjs
```

| Current `AUTH_MODE` | Change to | Effect |
|---|---|---|
| `api-key`, `ip-whitelist`, `disabled`, `basic`, `combined` | nothing to do | - |
| `internal` | `ip-whitelist` + `AUTH_IP_WHITELIST: '127.0.0.1,::1,::ffff:127.0.0.1'` | only clients on the host itself (the Console) can call the API |
| `api-key-ip` | `combined` (keep `AUTH_API_KEY` and `AUTH_IP_WHITELIST`) | the IP whitelist is now enforced; clients outside it get 403 |
| `open` | `disabled` | authentication is really off; development only |

```bash
cd $ROOT
cp ecosystem.config.cjs $B/ecosystem.config.cjs     # for rollback (step 8)
sed -i \
  -e "s/^\( *\)AUTH_MODE: 'internal',/\1AUTH_MODE: 'ip-whitelist',\n\1AUTH_IP_WHITELIST: '127.0.0.1,::1,::ffff:127.0.0.1',/" \
  -e "s/AUTH_MODE: 'api-key-ip',/AUTH_MODE: 'combined',/" \
  -e "s/AUTH_MODE: 'open',/AUTH_MODE: 'disabled',/" \
  ecosystem.config.cjs
grep -nE "AUTH_MODE|AUTH_IP_WHITELIST" ecosystem.config.cjs
mcctl console service restart --force               # plain restart keeps the old env
```

The `sed` leaves the other modes untouched. Instead of editing the file, you can re-run `mcctl console init --force`, which rewrites the whole file and asks every setup question again.

**Gate:** `AUTH_MODE` is one of `disabled`, `api-key`, `ip-whitelist`, `basic`, `combined`; API `/health` returns 200 and the Console can list servers (step 7-6).

### 4-2. Give mcctl-api time to finish an auto-backup (#734) {#pm2-kill-timeout}

Do this once on hosts where `mcctl console init` was run before this release and `BACKUP_AUTO_ON_STOP=true` is set.

A stop from the API or the Console runs the auto-backup in the background, and mcctl-api waits up to 2 minutes for it when it shuts down, so the backup can turn auto-save back on (`save-on`) on the servers it flushed. PM2 kills a process 1.6 seconds after asking it to stop unless the app sets `kill_timeout`. `mcctl console init` now writes `kill_timeout: 130000` for mcctl-api; `mcctl update` and `mcctl upgrade` do not rewrite `ecosystem.config.cjs`, and a plain PM2 restart keeps the old setting.

```bash
cd $ROOT
grep -n "kill_timeout" ecosystem.config.cjs || echo "missing: add it"
# add the line to the mcctl-api app, next to max_memory_restart:
#       kill_timeout: 130000,
mcctl console service restart --force               # re-registers the apps from the file
```

Instead of editing the file, you can re-run `mcctl console init --force`, which rewrites the whole file and asks every setup question again.

**Gate:** `pm2 describe mcctl-api` shows `kill timeout` 130000 (or `grep kill_timeout ecosystem.config.cjs` shows it before the restart).

## 5. Apply server images

Stopped servers get the new image on next start. Restart running servers at a quiet time with `mcctl stop <server> && mcctl start <server>` (worlds are preserved).

## 6. Re-render maps (BlueMap) — only if the release notes mention map changes

For worlds that have a map, run **Render map** again from the world detail page in the Console. The renderer regenerates the map config on every render, so `--force` is usually not needed.

## 7. Post-upgrade verification

Everything must pass. If anything fails, go to step 8 (rollback).

### 7-1. Versions

```bash
hash -r
mcctl --version                                   # = $NEW
pm2 jlist | python3 -c "import sys,json;[print(p['name'],p['pm2_env']['version'],p['pm2_env']['status'],p['pm2_env']['node_version'],'restarts=',p['pm2_env']['restart_time']) for p in json.load(sys.stdin)]"
# expect: mcctl-api / mcctl-console both $NEW, online, same Node as PM2, restarts not climbing
mcctl update --check                              # nothing left to update (incl. shared)
```

### 7-2. Config files

```bash
cd $ROOT
python3 -c "import json;c=json.load(open('.mcctl.json'));print('templateVersion =',c.get('templateVersion'),'| installId present =','installId' in c)"
diff <(grep -oE '^[A-Z_]+=' .env | sort) <(grep -oE '^[A-Z_]+=' $B/.env | sort)   # only added variables
docker compose config -q && echo "compose OK"
```

### 7-3. router

```bash
stat -c %g /var/run/docker.sock                   # socket GID
grep '^DOCKER_GID=' .env                          # must match
docker inspect mc-router --format '{{.Config.Image}} {{.HostConfig.GroupAdd}}'   # expected tag, GroupAdd has the GID
docker logs --tail 30 mc-router                   # no "permission denied", routing started
```

### 7-4. API / Console

```bash
curl -s -o /dev/null -w 'console %{http_code}\n' http://localhost:5000          # 200 or 3xx
curl -s -o /dev/null -w 'api %{http_code}\n'     http://localhost:5001/health   # 200
mcctl console service status                      # both online
pm2 logs mcctl-console --lines 30 --nostream      # no better-sqlite3 / NODE_MODULE_VERSION errors
```

### 7-5. Servers / auto-scale

```bash
mcctl status
# connect to a stopped server (<server>.<HOST_IP>.nip.io:25565) and confirm it starts
docker logs --tail 30 mc-router | grep -iE "error|denied|scale"
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
```

### 7-6. UI smoke test

In a browser (hard refresh) open `http://<host>:5000`: log in → server list → world detail (info/stats panels) → map panel (default view must be Overworld). Also check any screen the release notes call out.

### 7-7. Completion checklist

- [ ] `mcctl --version`, PM2 api/console = `$NEW`, online, matching Node
- [ ] `mcctl update --check` reports nothing left
- [ ] `.mcctl.json` `templateVersion` updated, `docker compose config -q` passes
- [ ] router image tag / `DOCKER_GID` / GroupAdd consistent, no errors in logs
- [ ] API `/health` 200, Console 200, PM2 restarts not increasing
- [ ] a stopped server starts on connect (auto-scale)
- [ ] UI smoke test passes
- [ ] (v2.31.0 or earlier → v2.32.0+) `AUTH_MODE` in `ecosystem.config.cjs` is a value mcctl-api recognises (step 4-1)
- [ ] once stable, delete `$B` (`backups-pre-$NEW`)

## 8. Rollback

```bash
cd $ROOT; B=$ROOT/backups-pre-$NEW
cp $B/docker-compose.yml docker-compose.yml
cp $B/.env .env
cp $B/.mcctl.json .mcctl.json
rm -rf servers/_template && cp -r $B/_template servers/_template
docker compose up -d router
[ -f $B/ecosystem.config.cjs ] && cp $B/ecosystem.config.cjs ecosystem.config.cjs   # if changed in step 4-1
[ -n "$(ls ecosystem.config.cjs.bak-* 2>/dev/null)" ] && echo "restore the latest ecosystem.config.cjs.bak-* if step 3 moved BETTER_AUTH_*"
# packages back to $OLD (in the PM2-Node shell)
npm install -g @minecraft-docker/mcctl@$OLD
npm install @minecraft-docker/mcctl-api@$OLD @minecraft-docker/mcctl-console@$OLD @minecraft-docker/shared@$OLD
mcctl console service restart --force
```

!!! note
    mc-router 1.46+ runs as non-root, so `group_add` (`DOCKER_GID`) is required. Do not remove it unless you are also reverting the router image to an older version.
