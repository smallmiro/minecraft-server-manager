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
S=pre-$NEW
cp docker-compose.yml docker-compose.yml.$S
cp .env .env.$S
cp .mcctl.json .mcctl.json.$S
cp -r servers/_template servers/_template.$S
mcctl status                                  # record current state
mcctl server-backup <server> -m "Before v$NEW"   # worlds/config, whichever you use
```

**Gate:** all `*.pre-$NEW` files exist.

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
```

- New `.env` variables are added (e.g. `DOCKER_GID`), `docker-compose.yml.bak-<timestamp>` is created, and `docker compose up -d router` runs automatically when the router changes.
- `servers/_template/*` is overwritten and `templateVersion` in `.mcctl.json` is updated.
- **If the router image is the untagged `itzg/mc-router`, `mcctl upgrade` does not bump the image.** Pin `image:` in `docker-compose.yml` to the version named in the release notes, then run `docker compose config -q && docker compose up -d router`.

## 4. Restart API / Console (if needed)

```bash
mcctl console service restart
# if the new build does not come up or you see an ABI error (NODE_MODULE_VERSION)
mcctl console service restart --force
cd $ROOT && npm rebuild better-sqlite3 && mcctl console service restart --force
```

## 5. Apply server images

Stopped servers get the new image on next start. Restart running servers at a quiet time with `mcctl stop <server> && mcctl start <server>` (worlds are preserved).

## 6. Re-render maps (BlueMap) — only if the release notes mention map changes

For worlds that have a map, run **Render map** again from the world detail page in the Console. `render-map.sh` regenerates the map config on every render, so `--force` is usually not needed.

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
python3 -c "import json;print('templateVersion =',json.load(open('.mcctl.json')).get('templateVersion'))"
diff <(grep -oE '^[A-Z_]+=' .env | sort) <(grep -oE '^[A-Z_]+=' .env.pre-$NEW | sort)   # only added variables
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
- [ ] once stable, delete `*.pre-$NEW` and `servers/_template.pre-$NEW`

## 8. Rollback

```bash
cd $ROOT; S=pre-$NEW
cp docker-compose.yml.$S docker-compose.yml
cp .env.$S .env
cp .mcctl.json.$S .mcctl.json
rm -rf servers/_template && cp -r servers/_template.$S servers/_template
docker compose up -d router
# packages back to $OLD (in the PM2-Node shell)
npm install -g @minecraft-docker/mcctl@$OLD
npm install @minecraft-docker/mcctl-api@$OLD @minecraft-docker/mcctl-console@$OLD @minecraft-docker/shared@$OLD
mcctl console service restart --force
```

!!! note
    mc-router 1.46+ runs as non-root, so `group_add` (`DOCKER_GID`) is required. Do not remove it unless you are also reverting the router image to an older version.
