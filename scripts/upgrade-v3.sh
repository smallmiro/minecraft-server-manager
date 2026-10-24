#!/usr/bin/env bash
# upgrade-v3.sh - upgrade a v2.x platform to v3.0.0 step by step (#787)
#
#   curl -fsSL https://raw.githubusercontent.com/smallmiro/minecraft-server-manager/main/scripts/upgrade-v3.sh | bash -s -- --dry-run
#   curl -fsSL https://raw.githubusercontent.com/smallmiro/minecraft-server-manager/main/scripts/upgrade-v3.sh | bash
#
# Safe to pipe into bash:
#   - every function is defined first and main runs on the last line, so a
#     download cut short runs nothing;
#   - questions are read from the terminal (fd 3, opened from /dev/tty), never
#     from stdin, which carries the script text;
#   - every command runs with stdin from /dev/null, so none can eat the script.
#
# Portable to Linux and macOS (bash 3.2): no associative arrays, mapfile,
# ${var,,}, sed -i, grep -P or readlink -f. Files are edited with awk into a
# temporary file and renamed.
#
# Test hook: MCCTL_UPGRADE_TTY overrides /dev/tty. A readable file supplies the
# answers (one per line); a path that cannot be opened means "no terminal".

set -euo pipefail

DOCS_URL="https://minecraft-server-manager.readthedocs.io/en/latest/advanced/upgrade-runbook/#v300-scripts"
PKG="@minecraft-docker/mcctl"
KILL_TIMEOUT_MS=130000
# --console restarts mcctl-api and the console without asking which (#794)
RESTART_CMD="mcctl console service restart --console --force"
ESC=$(printf '\033')

ROOT=""
YES=0
DRY=0
SKIP_UPDATE=0
REMOVE_SCRIPTS=0

INTERACTIVE=0
LOG=""
LOG_DIR=""
BACKUP_DIR=""
SCRIPTS_BACKED=0
BACKED=""
RESULTS=""
WARNINGS=""
RC=0
STOPPED=0
PAST_PREFLIGHT=0
CUR_OLD=""
CUR_NOW=""
MCCTL_INSTALLS=""
UPDATE_ACTION=""
ECO_BAK=""
NEED_RESTART=0
IMAGE_UNDO=""
RECREATE_TODO=""
TS=""
BOLD=""
YEL=""
RED=""
RST=""

usage() {
  cat <<'EOF'
Usage: upgrade-v3.sh [options]

Upgrade a v2.x Minecraft platform to v3.0.0, one step at a time.

Options:
  --root <dir>      platform root (default: $MCCTL_ROOT, else ~/minecraft-servers)
  --yes             do not ask; use each question's default answer
  --dry-run         check and show the plan; change nothing
  --skip-update     do not run `mcctl update` (CLI already updated or built locally)
  --remove-scripts  delete <root>/scripts after it was backed up (no question)
  --help            show this help

Through curl:  curl -fsSL <url> | bash -s -- --dry-run

Without a terminal and without --yes, steps that change something are skipped.
EOF
}

# ---------------------------------------------------------------- output

init_output() {
  if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    BOLD=$(printf '\033[1m')
    YEL=$(printf '\033[33m')
    RED=$(printf '\033[31m')
    RST=$(printf '\033[0m')
  fi
}

# strip_esc: drop escape sequences (colours, spinners) on the way to the log
strip_esc() { LC_ALL=C sed "s/$ESC\[[0-9;?]*[A-Za-z]//g" | LC_ALL=C tr -d '\033'; }
log() {
  case "$*" in
    *"$ESC"*) printf '%s\n' "$*" | strip_esc >>"$LOG" ;;
    *) printf '%s\n' "$*" >>"$LOG" ;;
  esac
}
say() {
  printf '%s\n' "$*"
  log "$*"
}
warn() {
  printf '%s! %s%s\n' "$YEL" "$*" "$RST"
  log "! $*"
}
err() {
  printf '%sx %s%s\n' "$RED" "$*" "$RST"
  log "x $*"
}
# add_warning <message> [detail lines]: details are shown indented, here and in the summary
add_warning() {
  local d=""
  if [ -n "${2:-}" ]; then d=$(printf '%s\n' "$2" | sed 's/^/      /'); fi
  WARNINGS="${WARNINGS}  - $1"$'\n'"${d:+$d$'\n'}"
  warn "$1"
  if [ -n "$d" ]; then say "$d"; fi
}
step() {
  printf '\n%s== Step %s: %s ==%s\n' "$BOLD" "$1" "$2" "$RST"
  log ""
  log "== Step $1: $2 =="
}
# record <step> <label> <status> [detail]
record() {
  RESULTS="${RESULTS}  [$3] Step $1 $2${4:+ - $4}"$'\n'
  if [ "$3" = failed ]; then RC=1; fi
}

# ---------------------------------------------------------------- helpers

# Run a command with stdin closed; show its output as is and log it without
# escape sequences; return its status.
run() {
  local rc
  set +e
  "$@" </dev/null 3<&- 2>&1 | tee "$LOG.part"
  rc=${PIPESTATUS[0]}
  set -e
  strip_esc <"$LOG.part" >>"$LOG"
  rm -f "$LOG.part"
  return "$rc"
}

# Run a command and print its output without logging (for values).
capture() {
  "$@" </dev/null 3<&- 2>/dev/null || true
}

open_tty() {
  local path=${MCCTL_UPGRADE_TTY:-/dev/tty}
  if (exec 3<"$path") 2>/dev/null; then
    exec 3<"$path"
    INTERACTIVE=1
  fi
}

can_change() {
  [ "$YES" = 1 ] || [ "$INTERACTIVE" = 1 ]
}

# confirm <question> <y|n default>; returns 0 for yes
confirm() {
  local q=$1 def=$2 hint ans=""
  if [ "$def" = y ]; then hint='[Y/n]'; else hint='[y/N]'; fi
  if [ "$YES" = 1 ]; then
    say "? $q $hint -> $def (--yes)"
    [ "$def" = y ]
    return
  fi
  if [ "$INTERACTIVE" != 1 ]; then
    say "- $q: skipped (no terminal; run in a terminal or add --yes)"
    return 1
  fi
  printf '%s? %s %s%s ' "$BOLD" "$q" "$hint" "$RST"
  read -r ans <&3 || ans=""
  ans=$(printf '%s' "$ans" | tr '[:upper:]' '[:lower:]')
  log "? $q $hint -> ${ans:-$def}"
  case "$ans" in
    y | yes) return 0 ;;
    n | no) return 1 ;;
    *) [ "$def" = y ] ;;
  esac
}

# env_get <KEY> [file]: last value of KEY in a .env style file, quotes stripped
env_get() {
  local f=${2:-$ROOT/.env}
  [ -f "$f" ] || return 0
  awk -v k="$1" -v q="'" '
    { line = $0; sub(/^[ \t]*(export[ \t]+)?/, "", line)
      if (index(line, k "=") == 1) v = substr(line, length(k) + 2) }
    END {
      if (substr(v, 1, 1) == "\"") { v = substr(v, 2); sub(/".*$/, "", v) }
      else if (substr(v, 1, 1) == q) { v = substr(v, 2); sub(q ".*$", "", v) }
      else sub(/[ \t]+#.*$/, "", v)
      print v }' "$f"
}

cur_version() {
  capture mcctl --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true
}

# ver_lt a b: a < b for x.y.z
ver_lt() {
  local a1 a2 a3 b1 b2 b3
  IFS=. read -r a1 a2 a3 <<<"$1"
  IFS=. read -r b1 b2 b3 <<<"$2"
  [ $((a1 * 1000000 + a2 * 1000 + a3)) -lt $((b1 * 1000000 + b2 * 1000 + b3)) ]
}

major_of() { printf '%s' "${1%%.*}"; }

# awk_replace <file> <awk args...>: awk output replaces the file (tmp + mv)
awk_replace() {
  local f=$1 t
  shift
  t=$(mktemp "$f.tmp.XXXXXX") || return 1
  if cp -p "$f" "$t" && awk "$@" "$f" >"$t" && mv "$t" "$f"; then
    return 0
  fi
  rm -f "$t"
  return 1
}

backup_ecosystem_once() {
  if [ -z "$ECO_BAK" ]; then
    ECO_BAK="$ROOT/ecosystem.config.cjs.bak-$TS"
    cp -p "$ROOT/ecosystem.config.cjs" "$ECO_BAK"
    say "  backup: $ECO_BAK"
  fi
}

# pm2_apps: "<name> <status> <node version> <kill_timeout or ->" per PM2 app
pm2_apps() {
  command -v pm2 >/dev/null 2>&1 || return 0
  command -v node >/dev/null 2>&1 || return 0
  capture pm2 jlist | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const i = s.search(/^\[(\{|\])/m);
      if (i < 0) return;
      let a;
      try { a = JSON.parse(s.slice(i)); } catch (e) { return; }
      a.forEach((p) => { const e = p.pm2_env || {}; console.log(p.name + " " + (e.status || "?") + " " + (e.node_version || "?") + " " + (e.kill_timeout !== undefined ? e.kill_timeout : "-")); });
    });' || true
}

finish() {
  local others
  say ""
  printf '%s== Step 9: Summary ==%s\n' "$BOLD" "$RST"
  log "== Step 9: Summary =="
  say "$RESULTS"
  if [ -n "$WARNINGS" ]; then
    say "Warnings:"
    say "$WARNINGS"
  fi
  if [ "$STOPPED" = 1 ]; then
    say "The upgrade did not finish. Fix the cause above and run this script again."
  elif [ "$DRY" = 1 ]; then
    say "Dry run: nothing was changed."
  else
    say "Still to do by hand:"
    if [ "$NEED_RESTART" = 1 ]; then
      say "  - Restart mcctl-api and the console so PM2 reads ecosystem.config.cjs again:"
      say "      $RESTART_CMD"
    fi
    if [ -n "$RECREATE_TODO" ]; then
      say "  - Stopped servers keep their old image: until their containers are recreated, auto-scale wakes them on the old image. When you are ready, run in $ROOT:"
      say "$(printf '%s' "$RECREATE_TODO")"
    fi
    others=$(other_installs)
    if [ -n "$others" ]; then
      say "  - Other mcctl installs on PATH are not $CUR_NOW (another shell, cron or PATH order runs them); update each:"
      say "$others"
    fi
    say "  - Restart running servers so they pick up new images and settings:"
    say "      mcctl stop <server> && mcctl start <server>"
    say "  - If cron jobs, timers or your own scripts called <root>/scripts/*.sh, switch them to mcctl:"
    say "      $DOCS_URL"
  fi
  # a dry run or a stop in pre-flight changed nothing, so there is nothing to undo
  if [ "$DRY" = 0 ] && [ "$PAST_PREFLIGHT" = 1 ]; then rollback_hint; fi
  say "Log: $LOG"
  exit "$RC"
}

# The same order as runbook step 8: files, CLI, api/console/shared, restart
rollback_hint() {
  local old=${CUR_OLD:-<previous>} svc=$ROOT pkgs="" p
  say "Rollback (the old version was ${CUR_OLD:-unknown}; runbook step 8):"
  if [ -n "$BACKED" ]; then
    say "  Copy these back from $BACKUP_DIR to the same paths under $ROOT, then run 'docker compose up -d router':"
    say "$(printf '%s' "$BACKED" | sed 's/^/      /')"
  elif [ -n "$ECO_BAK" ]; then
    # no backup folder (step 1 declined): only the copy step 5 made before editing
    say "  Copy $ECO_BAK back to $ROOT/ecosystem.config.cjs"
  fi
  say "  npm install -g $PKG@$old"
  # where mcctl update installs them: .services/ when it exists, else the root
  if [ -d "$ROOT/.services" ]; then svc=$ROOT/.services; fi
  for p in mcctl-api mcctl-console shared; do
    if [ -d "$svc/node_modules/@minecraft-docker/$p" ]; then pkgs="$pkgs @minecraft-docker/$p@$old"; fi
  done
  if [ -n "$pkgs" ]; then
    say "  cd $svc && npm install$pkgs"
    say "  $RESTART_CMD"
  fi
  if [ -n "$IMAGE_UNDO" ]; then
    say "  A recreated server that fails on its new image goes back to the old one with"
    say "  (this moves the tag for every server using it, until the next pull):"
    say "$(printf '%s' "$IMAGE_UNDO")"
  fi
}

# other_installs: an update command for each mcctl after the first on PATH
# whose version is not CUR_NOW
other_installs() {
  local f v
  printf '%s\n' "$MCCTL_INSTALLS" | sed 1d | while IFS= read -r f; do
    [ -n "$f" ] || continue
    v=$(capture "$f" --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true)
    if [ "$v" != "$CUR_NOW" ]; then
      printf '      npm install -g --prefix %s %s@%s   # %s is %s\n' "$(prefix_of "$f")" "$PKG" "$CUR_NOW" "$f" "${v:-unknown}"
    fi
  done
}

# prefix_of <bin path>: the npm prefix of <prefix>/bin/<command>
prefix_of() { (cd "$(dirname "$1")/.." 2>/dev/null && pwd -P); }

# 'mcctl update' runs 'npm install -g', which installs into npm's global
# prefix. If the first mcctl on PATH lives elsewhere, the update lands in
# another install and this one stays old.
# check_npm_prefix [PM2 Node major]
check_npm_prefix() {
  local first np interp hint
  first=$(printf '%s\n' "$MCCTL_INSTALLS" | head -n 1)
  np=$(capture npm prefix -g | tail -n 1)
  if [ -z "$np" ] || [ ! -d "$np" ]; then return 0; fi
  np=$(cd "$np" && pwd -P)
  if [ "$(prefix_of "$first")" = "$np" ]; then return 0; fi
  if [ -f "$ROOT/ecosystem.config.cjs" ] && command -v node >/dev/null 2>&1; then
    interp=$(state_get "$(eco_state "$ROOT/ecosystem.config.cjs")" interp)
  fi
  case "${interp:-}" in
    /*) hint="export PATH=\"$(dirname "$interp"):\$PATH\"" ;;
    *) hint="nvm use ${1:-<the Node major PM2 runs>}" ;;
  esac
  stop_with "the first mcctl on PATH ($first) is not under npm's global prefix ($np): 'mcctl update' would update another install and leave this one at $CUR_OLD. Nothing was changed. Put the bin directory of PM2's Node first on PATH ($hint), check that 'command -v mcctl' is under 'npm prefix -g', then run this script again. If you update the CLI yourself, use --skip-update."
}

stop_with() {
  err "$1"
  RC=1
  STOPPED=1
  finish
}

# ---------------------------------------------------------------- steps

step0_precheck() {
  step 0 "Pre-flight checks (read only)"
  local f hits u t gitv major_shell pm2_major="" n units
  if [ ! -f "$ROOT/docker-compose.yml" ] && [ ! -f "$ROOT/.env" ]; then
    stop_with "$ROOT is not a platform root (no docker-compose.yml and no .env). Check --root."
  fi
  for f in docker-compose.yml .env .mcctl.json; do
    if [ ! -f "$ROOT/$f" ]; then
      add_warning "$ROOT/$f is missing (is --root the platform root?)"
    fi
  done

  # The same directory twice on PATH is one install, not several
  u=$(type -ap mcctl 2>/dev/null | awk '!seen[$0]++' || true)
  n=$(printf '%s' "$u" | grep -c . || true)
  if [ "$n" -eq 0 ]; then
    stop_with "mcctl is not installed or not on PATH"
  elif [ "$n" -gt 1 ]; then
    add_warning "several mcctl installs found (the first one runs):" "$u"
  fi
  MCCTL_INSTALLS=$u
  CUR_OLD=$(cur_version)
  CUR_NOW=$CUR_OLD
  if [ -z "$CUR_OLD" ]; then
    stop_with "cannot read the version from 'mcctl --version'"
  fi
  say "mcctl version: $CUR_OLD   root: $ROOT"

  if command -v pm2 >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
    major_shell=$(capture node -p 'process.versions.node.split(".")[0]')
    t=$(pm2_apps)
    if [ -n "$t" ]; then
      say "PM2 apps (name status node kill_timeout):"
      say "$(printf '%s\n' "$t" | sed 's/^/      /')"
      pm2_major=$(printf '%s\n' "$t" | awk '$3 != "?" { split($3, a, "."); print a[1]; exit }')
      n=$(printf '%s\n' "$t" | awk -v m="$major_shell" '$3 != "?" { split($3, a, "."); if (a[1] != m) { print $3; exit } }')
      if [ -n "$n" ]; then
        add_warning "PM2 runs Node $n but this shell has Node $(capture node --version): switch with 'nvm use <major>' before continuing (native better-sqlite3 ABI)"
      fi
    else
      say "PM2: no apps listed"
    fi
  else
    say "PM2 or node not found: skipped the Node version comparison"
  fi

  if [ -n "$(env_get BACKUP_GITHUB_REPO)" ]; then
    gitv=$(capture git --version | grep -oE '[0-9]+\.[0-9]+' | head -n 1 || true)
    if [ -z "$gitv" ]; then
      add_warning "git not found, but BACKUP_GITHUB_REPO is set (backups need git 2.31 or later)"
    elif ver_lt "$gitv.0" "2.31.0"; then
      add_warning "git $gitv is older than 2.31, which v3 backups need"
    fi
  fi

  hits=$(capture crontab -l | grep -v '^[[:space:]]*#' | grep -E "$CRON_RE" || true)
  for f in /etc/crontab /etc/cron.d/*; do
    if [ -f "$f" ] && [ -r "$f" ]; then
      t=$(grep -v '^[[:space:]]*#' "$f" 2>/dev/null | grep -E "$CRON_RE" || true)
      if [ -n "$t" ]; then hits="${hits}${hits:+$'\n'}$f: $t"; fi
    fi
  done
  if command -v systemctl >/dev/null 2>&1; then
    t=$(capture systemctl --user list-timers --all --no-pager)
    hits="${hits}${hits:+$'\n'}$(printf '%s\n' "$t" | grep -E "$CRON_RE" || true)"
    units=$(printf '%s\n' "$t" | grep -oE '[A-Za-z0-9@_.-]+\.service' | sort -u || true)
    while IFS= read -r u; do
      [ -n "$u" ] || continue
      t=$(capture systemctl --user cat "$u" | grep -E "$CRON_RE" || true)
      if [ -n "$t" ]; then hits="${hits}${hits:+$'\n'}$u: $t"; fi
    done <<EOF
$units
EOF
  fi
  hits=$(printf '%s\n' "$hits" | grep -v '^$' || true)
  if [ -n "$hits" ]; then
    add_warning "cron/timers call scripts/*.sh or 'player lookup|uuid' (removed in v3; see $DOCS_URL):" "$hits"
  fi

  if [ "$(uname -s)" = Darwin ]; then
    say "macOS note: 'mcctl console <server>' uses TCP RCON to the container IP, which Docker Desktop may not expose. Use 'mcctl exec <server> <command>' instead."
  fi

  decide_update
  if [ "$UPDATE_ACTION" = run ]; then check_npm_prefix "$pm2_major"; fi
  if [ -n "$WARNINGS" ]; then
    record 0 "Pre-flight" ok "with warnings"
  else
    record 0 "Pre-flight" ok
  fi
}

CRON_RE='scripts/[A-Za-z0-9_./-]*\.sh|player[[:space:]]+(lookup|uuid)'

decide_update() {
  local latest
  if [ "$(major_of "$CUR_OLD")" -ge 3 ]; then
    UPDATE_ACTION=skip
    say "mcctl $CUR_OLD is already v3: the update step will be skipped."
  elif [ "$SKIP_UPDATE" = 1 ]; then
    UPDATE_ACTION=skip
    add_warning "--skip-update: CLI stays at $CUR_OLD (the steps below assume a v3 build)"
  else
    latest=$(capture npm view "$PKG" version | tail -n 1 || true)
    if [ -z "$latest" ]; then
      stop_with "could not read the npm latest version of $PKG (network?). If the CLI is already updated, use --skip-update."
    fi
    if [ "$(major_of "$latest")" != 3 ]; then
      stop_with "v3.0.0 is not published yet (npm latest is $latest). Nothing was changed. Try again later, or use --skip-update with a v3 build."
    fi
    UPDATE_ACTION=run
    say "npm latest is $latest (installed $CUR_OLD)."
  fi
}

step1_backup() {
  step 1 "Backup"
  local rel d name
  if [ "$DRY" = 1 ]; then
    say "[dry-run] would copy docker-compose.yml, .env, .mcctl.json, ecosystem.config.cjs, servers/_template, servers/compose.yml, each server's config.env and docker-compose.yml, and scripts/ to $ROOT/backups/upgrade-v3-<timestamp>/"
    record 1 "Backup" skipped "dry-run"
    return 0
  fi
  if ! confirm "Back up your configuration to $ROOT/backups/upgrade-v3-$TS/ ?" y; then
    record 1 "Backup" skipped "not chosen"
    return 0
  fi
  BACKUP_DIR="$ROOT/backups/upgrade-v3-$TS"
  if ! mkdir -p "$BACKUP_DIR"; then
    stop_with "cannot create $BACKUP_DIR"
  fi
  cat "$LOG" >>"$BACKUP_DIR/upgrade.log"
  rm -rf "$LOG_DIR"
  LOG_DIR=$BACKUP_DIR
  LOG=$BACKUP_DIR/upgrade.log

  for rel in docker-compose.yml .env .mcctl.json ecosystem.config.cjs servers/_template servers/compose.yml; do
    copy_into "$rel" || stop_with "backup of $rel failed"
  done
  for d in "$ROOT"/servers/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    [ "$name" = _template ] && continue
    for rel in config.env docker-compose.yml; do
      copy_into "servers/$name/$rel" || stop_with "backup of servers/$name/$rel failed"
    done
  done
  if [ -e "$ROOT/scripts" ] || [ -L "$ROOT/scripts" ]; then
    copy_into scripts || stop_with "backup of scripts failed"
    SCRIPTS_BACKED=1
  fi
  say "  backup folder: $BACKUP_DIR"

  if [ -n "$(env_get BACKUP_GITHUB_REPO)" ]; then
    if confirm "Also push worlds to your git backup (mcctl backup push)?" n; then
      if run mcctl backup push -m "Before v3.0.0"; then
        say "  worlds pushed"
      else
        add_warning "mcctl backup push failed; the config backup above is still complete"
      fi
    fi
  fi
  record 1 "Backup" ok "$BACKUP_DIR"
}

# copy_into <path relative to root>: copy to the backup folder, same layout
copy_into() {
  local rel=$1
  if [ ! -e "$ROOT/$rel" ] && [ ! -L "$ROOT/$rel" ]; then
    log "  (absent) $rel"
    return 0
  fi
  mkdir -p "$BACKUP_DIR/$(dirname "$rel")" || return 1
  if [ -L "$ROOT/$rel" ] && [ ! -e "$ROOT/$rel" ]; then
    # dangling link: keep the link itself
    cp -RP "$ROOT/$rel" "$BACKUP_DIR/$rel" || return 1
    log "  copied dangling link $rel"
  else
    cp -RpL "$ROOT/$rel" "$BACKUP_DIR/$rel" || return 1
    log "  copied $rel"
  fi
  BACKED="${BACKED}$rel"$'\n'
}

step2_update() {
  step 2 "Update packages"
  if [ "$UPDATE_ACTION" = skip ]; then
    record 2 "Update" skipped "CLI $CUR_OLD (already v3 or --skip-update)"
    say "Skipped."
    return 0
  fi
  if [ "$DRY" = 1 ]; then
    say "[dry-run] would run: mcctl update --yes (also pulls server images), then check that mcctl --version is 3.x"
    record 2 "Update" skipped "dry-run"
    return 0
  fi
  if ! confirm "Run 'mcctl update --yes' (CLI, API and console packages, pulls server images; restarts PM2 apps)?" y; then
    record 2 "Update" skipped "not run"
    stop_with "the update was not run, so the next steps (which need the v3 CLI) were not started. Re-run in a terminal or with --yes."
  fi
  if ! run mcctl update --yes; then
    record 2 "Update" failed "mcctl update exited with an error"
    stop_with "mcctl update failed; nothing after it was run. Fix the error above (a Node version mismatch is common) and re-run."
  fi
  hash -r
  CUR_NOW=$(cur_version)
  if [ "$(major_of "${CUR_NOW:-0}")" != 3 ]; then
    record 2 "Update" failed "version is ${CUR_NOW:-unknown}, not 3.x"
    stop_with "after the update 'mcctl --version' says ${CUR_NOW:-nothing}, not 3.x. Check 'type -ap mcctl' for a second install, then re-run."
  fi
  say "mcctl is now $CUR_NOW"
  record 2 "Update" ok "$CUR_OLD -> $CUR_NOW"
}

step3_upgrade() {
  step 3 "Migrate configuration (mcctl upgrade)"
  if [ "$DRY" = 1 ] && [ "$(major_of "$CUR_NOW")" -lt 3 ]; then
    say "(This is the plan of the v2 CLI installed now. The v3 plan appears after the update.)"
  fi
  say "Preview (mcctl upgrade --dry-run):"
  if ! run mcctl upgrade --dry-run; then
    record 3 "Upgrade" failed "mcctl upgrade --dry-run failed"
    stop_with "mcctl upgrade --dry-run failed; configuration was not migrated."
  fi
  if [ "$DRY" = 1 ]; then
    say "[dry-run] would run: mcctl upgrade --non-interactive"
    record 3 "Upgrade" skipped "dry-run"
    return 0
  fi
  if ! confirm "Apply with 'mcctl upgrade --non-interactive'?" y; then
    record 3 "Upgrade" skipped "not chosen"
    return 0
  fi
  if ! run mcctl upgrade --non-interactive; then
    record 3 "Upgrade" failed "mcctl upgrade exited with an error"
    stop_with "mcctl upgrade failed; later steps were not run. Restore from the backup if the files changed."
  fi
  record 3 "Upgrade" ok
}

step4_scripts() {
  step 4 "<root>/scripts"
  local s=$ROOT/scripts
  if [ ! -e "$s" ] && [ ! -L "$s" ]; then
    say "No $s folder."
    record 4 "scripts" skipped "no folder"
    return 0
  fi
  say "$s is not used since v3.0.0 and may hold scripts you edited."
  if [ "$DRY" = 1 ]; then
    say "[dry-run] would keep it, or remove it after a backup if you answer y (or pass --remove-scripts)."
    record 4 "scripts" skipped "dry-run"
    return 0
  fi
  if [ "$SCRIPTS_BACKED" != 1 ]; then
    say "Kept: no backup of it was made in this run (accept step 1 or copy it yourself first)."
    record 4 "scripts" skipped "kept (not backed up)"
    return 0
  fi
  say "A copy is in $BACKUP_DIR/scripts"
  if [ "$REMOVE_SCRIPTS" = 1 ]; then
    if ! can_change; then
      say "- --remove-scripts: skipped (no terminal; add --yes)"
      record 4 "scripts" skipped "no terminal"
      return 0
    fi
  elif ! confirm "Remove $s?" n; then
    record 4 "scripts" skipped "kept"
    return 0
  fi
  if [ -L "$s" ]; then
    rm -f "$s"
  else
    rm -r "$s"
  fi
  say "Removed $s"
  record 4 "scripts" ok "removed (backup kept)"
}

# eco_state <file>: key=value lines about the mcctl-api app, read by requiring the file
eco_state() {
  capture node -e '
    const path = require("path");
    let c;
    try { c = require(path.resolve(process.argv[1])); } catch (e) { process.exit(3); }
    const apps = (c && Array.isArray(c.apps)) ? c.apps : [];
    const a = apps.find((x) => x && x.name === "mcctl-api");
    const env = (a && a.env) || {};
    console.log("api=" + (a ? 1 : 0));
    console.log("kill=" + (a && a.kill_timeout !== undefined ? a.kill_timeout : ""));
    console.log("auth=" + (env.AUTH_MODE !== undefined ? env.AUTH_MODE : ""));
    console.log("wl=" + (env.AUTH_IP_WHITELIST !== undefined ? env.AUTH_IP_WHITELIST : ""));
    console.log("interp=" + (a && a.interpreter !== undefined ? a.interpreter : ""));
    console.log("others=" + apps.filter((x) => x !== a).map((x) => JSON.stringify(x)).join(";"));
  ' "$1"
}

# state_get <state> <key>
state_get() { printf '%s\n' "$1" | sed -n "s/^$2=//p" | head -n 1; }

# eco_apply <label> <expected "key=value"...> -- <awk args...>
# Edits the ecosystem file with awk, reloads it with node and checks the result;
# on any mismatch puts the previous content back.
eco_apply() {
  local label=$1 expect=$2 e=$ROOT/ecosystem.config.cjs pre before after kv
  shift 2
  before=$(eco_state "$e")
  pre=$(mktemp "$e.pre.XXXXXX") || return 1
  cp -p "$e" "$pre"
  backup_ecosystem_once
  if awk_replace "$e" "$@"; then
    after=$(eco_state "$e") || after=""
    if [ -n "$after" ] && [ "$(state_get "$after" others)" = "$(state_get "$before" others)" ]; then
      for kv in $expect; do
        printf '%s\n' "$after" | grep -qxF "$kv" || { after=""; break; }
      done
      if [ -n "$after" ]; then
        rm -f "$pre"
        return 0
      fi
    fi
  fi
  cp -p "$pre" "$e"
  rm -f "$pre"
  add_warning "$label: the edited ecosystem.config.cjs did not load with the expected values; the original was put back"
  return 1
}

step5_ecosystem() {
  step 5 "PM2 ecosystem file (access mode, kill_timeout) and restart"
  local e=$ROOT/ecosystem.config.cjs state auth newauth def edit=1 failed=0 changed=""
  local name_re="^[[:space:]]*name:[[:space:]]*['\"]mcctl-api['\"],[[:space:]]*\$"
  if [ ! -f "$e" ]; then
    say "No ecosystem.config.cjs: the web console is not set up here."
    record 5 "ecosystem" skipped "no ecosystem.config.cjs"
    return 0
  fi
  if ! command -v node >/dev/null 2>&1; then
    add_warning "node not found: ecosystem.config.cjs was not checked"
    record 5 "ecosystem" skipped "no node"
    return 0
  fi
  if ! state=$(eco_state "$e") || [ -z "$state" ]; then
    add_warning "cannot load ecosystem.config.cjs with node: skipped this step (check the file, then see runbook 4-1 and 4-2)"
    record 5 "ecosystem" skipped "file cannot be loaded"
    return 0
  fi
  if [ -L "$e" ]; then
    say "ecosystem.config.cjs is a symbolic link: not edited. Make the changes of runbook 4-1 and 4-2 in the real file yourself."
    edit=0
  fi

  # 5a: old AUTH_MODE values (runbook 4-1), only when coming from before 2.32.0
  auth=$(state_get "$state" auth)
  if [ "$edit" = 1 ] && ver_lt "$CUR_OLD" "2.32.0"; then
    case "$auth" in
      internal) newauth=ip-whitelist ;;
      api-key-ip) newauth=combined ;;
      open) newauth=disabled ;;
      *) newauth="" ;;
    esac
    if [ -n "$newauth" ]; then
      say "mcctl-api has AUTH_MODE '$auth', which it does not recognise (it falls back to api-key)."
      say "  internal    -> ip-whitelist + AUTH_IP_WHITELIST '127.0.0.1,::1,::ffff:127.0.0.1' (only the host itself can call the API)"
      say "  api-key-ip  -> combined (the IP whitelist is then enforced)"
      say "  open        -> disabled (authentication really off)"
      if [ "$DRY" = 1 ]; then
        say "[dry-run] would ask whether to change '$auth' to '$newauth'."
      elif confirm "Change AUTH_MODE '$auth' to '$newauth' (a .bak is written first)?" n; then
        local expect="auth=$newauth"
        [ "$auth" = internal ] && [ -z "$(state_get "$state" wl)" ] && expect="$expect wl=127.0.0.1,::1,::ffff:127.0.0.1"
        # shellcheck disable=SC2016 # awk program, not shell
        if eco_apply "AUTH_MODE" "$expect" -v q="'" -v new="$newauth" -v addwl="$([ "$auth" = internal ] && [ -z "$(state_get "$state" wl)" ] && echo 1 || echo 0)" '
            !done && $0 ~ ("^[ \t]*AUTH_MODE:[ \t]*[" q "\"][a-z-]*[" q "\"]") {
              match($0, ("AUTH_MODE:[ \t]*[" q "\"][a-z-]*[" q "\"]"))
              head = substr($0, 1, RSTART - 1); rest = substr($0, RSTART + RLENGTH)
              line = head "AUTH_MODE: " q new q
              if (addwl && rest !~ /^[ \t]*,/) line = line ","
              print line rest
              if (addwl) { match($0, /^[ \t]*/); print substr($0, 1, RLENGTH) "AUTH_IP_WHITELIST: " q "127.0.0.1,::1,::ffff:127.0.0.1" q "," }
              done = 1; next }
            { print }'; then
          say "AUTH_MODE changed."
          changed=1
        else
          failed=1
        fi
      fi
    fi
  fi

  # 5b: kill_timeout for mcctl-api (runbook 4-2)
  if [ "$edit" = 1 ] && [ "$failed" = 0 ] && [ "$(state_get "$state" api)" = 1 ] && [ -z "$(state_get "$state" kill)" ]; then
    def=n
    if [ "$(env_get BACKUP_AUTO_ON_STOP)" = true ]; then def=y; fi
    say "mcctl-api has no kill_timeout: PM2 would kill it after 1.6 s, cutting an auto-backup short."
    if ! grep -Eq "$name_re" "$e"; then
      add_warning "cannot add kill_timeout automatically (the name line of mcctl-api is not 'name: \"mcctl-api\",' on its own line): add 'kill_timeout: $KILL_TIMEOUT_MS,' to the mcctl-api app by hand"
    elif [ "$DRY" = 1 ]; then
      say "[dry-run] would add 'kill_timeout: $KILL_TIMEOUT_MS,' after the name line of mcctl-api (default answer: $def)."
    elif confirm "Add 'kill_timeout: $KILL_TIMEOUT_MS,' to the mcctl-api app (a .bak is written first)?" "$def"; then
      # shellcheck disable=SC2016 # awk program, not shell
      if eco_apply "kill_timeout" "kill=$KILL_TIMEOUT_MS" -v q="'" '
          { print }
          !done && $0 ~ ("^[ \t]*name:[ \t]*[" q "\"]mcctl-api[" q "\"],[ \t]*$") {
            match($0, /^[ \t]*/)
            print substr($0, 1, RLENGTH) "kill_timeout: 130000,"
            done = 1 }'; then
        say "kill_timeout added."
        changed=1
      else
        failed=1
      fi
    fi
  elif [ "$(state_get "$state" api)" != 1 ]; then
    say "No mcctl-api app in $e: kill_timeout not needed."
  elif [ -n "$(state_get "$state" kill)" ]; then
    say "mcctl-api already has kill_timeout."
  fi

  # 5c: restart so the new ecosystem file, env and console auth key move apply
  if [ "$failed" = 1 ]; then
    record 5 "ecosystem" failed "edit did not verify; file restored, no restart"
    return 0
  fi
  if [ "$DRY" = 1 ]; then
    say "[dry-run] would run: $RESTART_CMD"
    record 5 "ecosystem" skipped "dry-run"
    return 0
  fi
  if confirm "Restart mcctl-api and the console now ($RESTART_CMD)?" y; then
    # shellcheck disable=SC2086 # RESTART_CMD is split into words on purpose
    if run $RESTART_CMD; then
      record 5 "ecosystem" ok "restarted${changed:+ (file edited)}"
    else
      add_warning "$RESTART_CMD failed"
      record 5 "ecosystem" failed "restart failed"
      NEED_RESTART=1
    fi
  else
    record 5 "ecosystem" skipped "not restarted${changed:+ (file edited: restart to apply)}"
    if [ -n "$changed" ]; then NEED_RESTART=1; fi
  fi
}

step6_spec() {
  step 6 "ServerSpec (server.yaml)"
  if [ "$DRY" = 1 ] && [ "$(major_of "$CUR_NOW")" -lt 3 ]; then
    say "[dry-run] after the update: mcctl migrate spec --all --dry-run, then optionally mcctl migrate spec --all"
    record 6 "ServerSpec" skipped "dry-run (CLI is not v3 yet)"
    return 0
  fi
  say "Preview (mcctl migrate spec --all --dry-run):"
  if ! run mcctl migrate spec --all --dry-run; then
    add_warning "mcctl migrate spec --all --dry-run failed"
    record 6 "ServerSpec" failed "preview failed"
    return 0
  fi
  if [ "$DRY" = 1 ]; then
    say "[dry-run] would ask whether to run: mcctl migrate spec --all (default: no)"
    record 6 "ServerSpec" skipped "dry-run"
    return 0
  fi
  if ! confirm "Import all servers now with 'mcctl migrate spec --all'?" n; then
    record 6 "ServerSpec" skipped "not chosen (servers import on their first change)"
    return 0
  fi
  if run mcctl migrate spec --all; then
    record 6 "ServerSpec" ok
  else
    add_warning "mcctl migrate spec --all failed"
    record 6 "ServerSpec" failed
  fi
}

step7_worlds() {
  step 7 "World assignment check"
  local out rc
  if [ "$DRY" = 1 ] && [ "$(major_of "$CUR_NOW")" -lt 3 ]; then
    say "[dry-run] after the update: mcctl world list (duplicate assignments are highlighted)"
    record 7 "Worlds" skipped "dry-run (CLI is not v3 yet)"
    return 0
  fi
  # mcctl prints these warnings on stderr, so read both
  set +e
  out=$(mcctl world list </dev/null 3<&- 2>&1)
  rc=$?
  set -e
  say "$out"
  if [ "$rc" -ne 0 ]; then
    add_warning "mcctl world list failed (exit $rc): the world assignment was not checked"
    record 7 "Worlds" warn "world list failed"
    return 0
  fi
  out=$(printf '%s\n' "$out" | grep -iE 'duplicate|warn|conflict|more than one|used by [2-9]|is assigned to|Cannot read the world assignment' || true)
  if [ -n "$out" ]; then
    add_warning "world list shows warnings (one world used by several servers?):" "$out"
    record 7 "Worlds" warn "warnings shown"
  else
    record 7 "Worlds" ok "no warnings"
  fi
}

# image_current <container>: true when the container already runs the local
# image its compose service names (run in the root); a lookup that fails
# counts as not current, so the server stays a candidate
image_current() {
  local ref want
  ref=$(capture docker compose config --images "$1" | head -n 1)
  [ -n "$ref" ] || return 1
  want=$(capture docker image inspect -f '{{.Id}}' "$ref")
  [ -n "$want" ] && [ "$want" = "$(capture docker inspect --format '{{.Image}}' "$1")" ]
}

# mc-router starts a stopped server with 'docker start', which keeps the image
# the container was created from; recreating it picks up the pulled image.
step7b_images() {
  step 7b "Stopped servers and new images"
  local d name st stopped="" current="" running="" s old failed="" made="" started=""
  if ! command -v docker >/dev/null 2>&1; then
    say "docker not found: skipped"
    record 7b "Server images" skipped "no docker"
    return 0
  fi
  for d in "$ROOT"/servers/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    [ "$name" = _template ] && continue
    st=$(capture docker inspect --format '{{.State.Status}}' "mc-$name")
    case "$st" in
      exited | created)
        if image_current "mc-$name"; then current="$current $name"; else stopped="$stopped $name"; fi
        ;;
      running | restarting | paused) running="$running $name" ;;
    esac
  done
  if [ -n "$running" ]; then
    say "Running:$running (restart each at a quiet time: mcctl stop <server> && mcctl start <server>)"
  fi
  if [ -n "$current" ]; then
    say "Up to date:$current (stopped, already on the image their service names)"
  fi
  if [ "$DRY" = 1 ] && [ "$UPDATE_ACTION" = run ]; then
    say "(Compared before the update: the images it pulls can add servers to recreate.)"
  fi
  if [ -z "$stopped" ]; then
    if [ -n "$current" ]; then
      record 7b "Server images" ok "up to date:$current"
    else
      say "No stopped server containers."
      record 7b "Server images" skipped "no stopped servers"
    fi
    return 0
  fi
  say "Stopped:$stopped"
  say "An auto-scale start reuses the old container and its image. Recreating the container (it stays stopped; worlds and config are kept) makes the next start use the image the update pulled, so a broken new image shows at once."
  if [ "$DRY" = 1 ]; then
    say "[dry-run] would ask (default: no), then run for each: docker compose up --no-start --no-deps mc-<server>"
    record 7b "Server images" skipped "dry-run"
    return 0
  fi
  if ! confirm "Recreate the stopped server containers with the new images?" n; then
    for s in $stopped; do
      RECREATE_TODO="${RECREATE_TODO}      docker compose up --no-start --no-deps mc-$s"$'\n'
    done
    record 7b "Server images" skipped "not chosen (commands in the summary)"
    return 0
  fi
  for s in $stopped; do
    # auto-scale may have started it while the question waited; compose would
    # stop a running server to recreate it, so look again right before
    st=$(capture docker inspect --format '{{.State.Status}}' "mc-$s")
    case "$st" in
      exited | created) ;;
      *)
        say "$s: started meanwhile, skipped (restart it later to pick up the new image)"
        started="$started $s"
        continue
        ;;
    esac
    old=$(capture docker inspect --format '{{.Image}}' "mc-$s")
    if run docker compose up --no-start --no-deps "mc-$s"; then
      made="$made $s"
      if [ -n "$old" ] && [ "$(capture docker inspect --format '{{.Image}}' "mc-$s")" != "$old" ]; then
        # the reference after recreating: step 2 may have moved the tag (java21 -> java25)
        IMAGE_UNDO="${IMAGE_UNDO}      docker tag $old $(capture docker inspect --format '{{.Config.Image}}' "mc-$s") && docker compose up --no-start --no-deps mc-$s"$'\n'
      fi
    else
      failed="$failed $s"
      RECREATE_TODO="${RECREATE_TODO}      docker compose up --no-start --no-deps mc-$s"$'\n'
    fi
  done
  if [ -n "$failed" ]; then
    add_warning "recreating failed for:$failed (see the docker output above)"
    record 7b "Server images" failed "failed for:$failed"
  else
    record 7b "Server images" ok "recreated:${made:- none}${started:+; started meanwhile, skipped:$started}"
  fi
}

step8_verify() {
  step 8 "Verification"
  local bad=0 v out port apps line tries want have
  if [ "$DRY" = 1 ]; then
    say "[dry-run] would run: mcctl --version, docker compose config -q, PM2 status and kill_timeout, API /health"
    record 8 "Verify" skipped "dry-run"
    return 0
  fi
  v=$(cur_version)
  if [ "$(major_of "${v:-0}")" = 3 ]; then say "mcctl --version: $v (ok)"; else
    say "mcctl --version: ${v:-unknown} (expected 3.x)"
    # --skip-update is used with local builds that may still report 2.x
    if [ "$SKIP_UPDATE" != 1 ]; then bad=1; fi
  fi
  if [ -f "$ROOT/docker-compose.yml" ]; then
    if run docker compose config -q; then say "docker compose config: ok"; else
      say "docker compose config: FAILED"
      bad=1
    fi
  fi
  apps=$(pm2_apps)
  if [ -n "$apps" ]; then
    while IFS= read -r line; do
      case "$line" in
        mcctl-*)
          case "$line" in
            *" online "*) say "PM2 ${line% *} (ok)" ;;
            *)
              say "PM2 ${line% *} (not online)"
              bad=1
              ;;
          esac
          ;;
      esac
    done <<EOF
$apps
EOF
    # PM2 keeps the kill_timeout it registered; the file counts only after a restart
    if [ -f "$ROOT/ecosystem.config.cjs" ]; then
      want=$(state_get "$(eco_state "$ROOT/ecosystem.config.cjs")" kill)
      have=$(printf '%s\n' "$apps" | awk '$1 == "mcctl-api" { print $4; exit }')
      if [ -n "$want" ] && [ -n "$have" ]; then
        if [ "$have" = "$want" ]; then say "PM2 mcctl-api kill_timeout: $have (ok)"; else
          say "PM2 mcctl-api kill_timeout: $have, but ecosystem.config.cjs has $want (restart with: $RESTART_CMD)"
          NEED_RESTART=1
          bad=1
        fi
      fi
    fi
  else
    say "PM2: no apps to check"
  fi
  # CLI-only installs have no API to probe
  if [ ! -f "$ROOT/ecosystem.config.cjs" ]; then
    say "API: not set up here (no ecosystem.config.cjs)"
  else
    port=${API_PORT:-$(env_get API_PORT)}
    port=${port:-5001}
    tries=0
    out=""
    while [ "$tries" -lt 5 ]; do
      tries=$((tries + 1))
      if out=$(capture curl -fsS --max-time 5 "http://127.0.0.1:$port/health") && [ -n "$out" ]; then break; fi
      out=""
      [ "$tries" -lt 5 ] && sleep "${MCCTL_UPGRADE_HEALTH_WAIT:-2}"
    done
    if [ -n "$out" ]; then
      say "API /health on :$port: $out"
    else
      say "API /health on :$port: no answer after $tries tries (is mcctl-api running?)"
      bad=1
    fi
  fi
  if [ "$bad" = 0 ]; then
    record 8 "Verify" ok
  else
    record 8 "Verify" failed "see above"
  fi
}

# ---------------------------------------------------------------- main

main() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --root)
        [ $# -ge 2 ] || {
          echo "error: --root needs a directory" >&2
          exit 2
        }
        ROOT=$2
        shift 2
        ;;
      --root=*)
        ROOT=${1#--root=}
        shift
        ;;
      --yes | -y)
        YES=1
        shift
        ;;
      --dry-run)
        DRY=1
        shift
        ;;
      --skip-update)
        SKIP_UPDATE=1
        shift
        ;;
      --remove-scripts)
        REMOVE_SCRIPTS=1
        shift
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        echo "error: unknown option: $1" >&2
        usage >&2
        exit 2
        ;;
    esac
  done

  ROOT=${ROOT:-${MCCTL_ROOT:-$HOME/minecraft-servers}}
  if [ ! -d "$ROOT" ]; then
    echo "error: platform root not found: $ROOT (use --root <dir>)" >&2
    exit 1
  fi
  ROOT=$(cd "$ROOT" && pwd)
  cd "$ROOT"
  export MCCTL_ROOT="$ROOT"

  LOG_DIR=$(mktemp -d "${TMPDIR:-/tmp}/mcctl-upgrade-v3.XXXXXX")
  LOG=$LOG_DIR/upgrade.log
  : >"$LOG"
  TS=$(date +%Y%m%d-%H%M%S)
  init_output
  open_tty

  printf '%sMinecraft platform upgrade to v3.0.0%s\n' "$BOLD" "$RST"
  log "Minecraft platform upgrade to v3.0.0 ($TS)"
  say "root: $ROOT"
  if [ "$DRY" = 1 ]; then
    say "mode: dry-run (nothing will be changed)"
  elif [ "$YES" = 1 ]; then
    say "mode: --yes (default answers)"
  elif [ "$INTERACTIVE" = 1 ]; then
    say "mode: interactive"
  else
    say "mode: no terminal and no --yes: steps that change something are skipped"
  fi

  step0_precheck
  PAST_PREFLIGHT=1
  step1_backup
  step2_update
  step3_upgrade
  step4_scripts
  step5_ecosystem
  step6_spec
  step7_worlds
  step7b_images
  step8_verify
  finish
}

# shellcheck disable=SC2317 # exit is the guard against a truncated download
{ main "$@"; exit $?; }
