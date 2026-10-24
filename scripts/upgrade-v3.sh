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
RESULTS=""
WARNINGS=""
RC=0
CUR_OLD=""
CUR_NOW=""
UPDATE_ACTION=""
ECO_BAK=""
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

log() { printf '%s\n' "$*" >>"$LOG"; }
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
add_warning() {
  WARNINGS="${WARNINGS}  - $*"$'\n'
  warn "$*"
}
step() {
  printf '\n%s== Step %s: %s ==%s\n' "$BOLD" "$1" "$2" "$RST"
  log ""
  log "== Step $1: $2 =="
}
# record <step> <label> <status> [detail]
record() {
  RESULTS="${RESULTS}  [$3] Step $1 $2${4:+ - $4}"$'\n'
}

# ---------------------------------------------------------------- helpers

# Run a command with stdin closed; show and log its output; return its status.
run() {
  local rc
  set +e
  "$@" </dev/null 3<&- 2>&1 | tee -a "$LOG"
  rc=${PIPESTATUS[0]}
  set -e
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

# pm2_apps: "<name> <status> <node version>" per PM2 app
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
      a.forEach((p) => { const e = p.pm2_env || {}; console.log(p.name + " " + (e.status || "?") + " " + (e.node_version || "?")); });
    });' || true
}

finish() {
  say ""
  printf '%s== Step 9: Summary ==%s\n' "$BOLD" "$RST"
  log "== Step 9: Summary =="
  say "$RESULTS"
  if [ -n "$WARNINGS" ]; then
    say "Warnings:"
    say "$WARNINGS"
  fi
  if [ "$DRY" = 1 ]; then
    say "Dry run: nothing was changed."
  else
    say "Still to do by hand:"
    say "  - Restart running servers so they pick up new images and settings:"
    say "      mcctl stop <server> && mcctl start <server>"
    say "  - If cron jobs, timers or your own scripts called <root>/scripts/*.sh, switch them to mcctl:"
    say "      $DOCS_URL"
  fi
  say "Rollback (the old version was ${CUR_OLD:-unknown}):"
  say "  npm install -g $PKG@${CUR_OLD:-<previous>} && mcctl console service restart --force"
  if [ -n "$BACKUP_DIR" ]; then
    say "  config backup: $BACKUP_DIR (copy files back as in the runbook, step 8)"
  fi
  say "Log: $LOG"
  exit "$RC"
}

stop_with() {
  err "$1"
  RC=1
  finish
}

# ---------------------------------------------------------------- steps

step0_precheck() {
  step 0 "Pre-flight checks (read only)"
  local f hits u t gitv major_shell n units
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
    add_warning "several mcctl installs found (the first one runs):"
    say "$(printf '%s\n' "$u" | sed 's/^/      /')"
  fi
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
      say "PM2 apps (name status node):"
      say "$(printf '%s\n' "$t" | sed 's/^/      /')"
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
    add_warning "cron/timers call scripts/*.sh or 'player lookup|uuid' (removed in v3; see $DOCS_URL):"
    say "$(printf '%s\n' "$hits" | sed 's/^/      /')"
  fi

  if [ "$(uname -s)" = Darwin ]; then
    say "macOS note: 'mcctl console <server>' uses TCP RCON to the container IP, which Docker Desktop may not expose. Use 'mcctl exec <server> <command>' instead."
  fi

  decide_update
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
  cp -RpL "$ROOT/$rel" "$BACKUP_DIR/$rel" || return 1
  log "  copied $rel"
}

step2_update() {
  step 2 "Update packages"
  if [ "$UPDATE_ACTION" = skip ]; then
    record 2 "Update" skipped "CLI $CUR_OLD (already v3 or --skip-update)"
    say "Skipped."
    return 0
  fi
  if [ "$DRY" = 1 ]; then
    say "[dry-run] would run: mcctl update --yes, then check that mcctl --version is 3.x"
    record 2 "Update" skipped "dry-run"
    return 0
  fi
  if ! confirm "Run 'mcctl update --yes' (CLI, API and console packages; restarts PM2 apps)?" y; then
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

step5_ecosystem() {
  step 5 "PM2 ecosystem file (access mode, kill_timeout) and restart"
  local e=$ROOT/ecosystem.config.cjs changed="" hits state def
  if [ ! -f "$e" ]; then
    say "No ecosystem.config.cjs: the web console is not set up here."
    record 5 "ecosystem" skipped "no ecosystem.config.cjs"
    return 0
  fi

  # 5a: old AUTH_MODE values (runbook 4-1), only when coming from before 2.32.0
  if ver_lt "$CUR_OLD" "2.32.0"; then
    hits=$(grep -nE "AUTH_MODE:[[:space:]]*['\"](internal|api-key-ip|open)['\"]" "$e" || true)
    if [ -n "$hits" ]; then
      say "AUTH_MODE has a value mcctl-api does not recognise (it falls back to api-key):"
      say "$(printf '%s\n' "$hits" | sed 's/^/      /')"
      say "  internal    -> ip-whitelist + AUTH_IP_WHITELIST '127.0.0.1,::1,::ffff:127.0.0.1' (only the host itself can call the API)"
      say "  api-key-ip  -> combined (the IP whitelist is then enforced)"
      say "  open        -> disabled (authentication really off)"
      if [ "$DRY" = 1 ]; then
        say "[dry-run] would ask whether to rewrite these."
      elif confirm "Rewrite AUTH_MODE as above (a .bak is written first)?" n; then
        backup_ecosystem_once
        state=0
        grep -q 'AUTH_IP_WHITELIST' "$e" && state=1
        # shellcheck disable=SC2016 # awk program, not shell
        if awk_replace "$e" -v q="'" -v haswl="$state" '
            { line = $0; add = ""
              if (line ~ ("AUTH_MODE:[ \t]*[" q "\"]internal[" q "\"]")) {
                sub(/internal/, "ip-whitelist", line)
                if (!haswl) { match(line, /^[ \t]*/); add = substr(line, 1, RLENGTH) "AUTH_IP_WHITELIST: " q "127.0.0.1,::1,::ffff:127.0.0.1" q "," }
              } else if (line ~ ("AUTH_MODE:[ \t]*[" q "\"]api-key-ip[" q "\"]")) sub(/api-key-ip/, "combined", line)
              else if (line ~ ("AUTH_MODE:[ \t]*[" q "\"]open[" q "\"]")) sub(/open/, "disabled", line)
              print line
              if (add != "") print add }'; then
          say "AUTH_MODE rewritten."
          changed=1
        else
          add_warning "could not rewrite AUTH_MODE in $e"
        fi
      fi
    fi
  fi

  # 5b: kill_timeout for mcctl-api (runbook 4-2)
  state=$(awk -v q="'" '
    $0 ~ ("name:[ \t]*[" q "\"]") { api = ($0 ~ ("name:[ \t]*[" q "\"]mcctl-api[" q "\"]")); if (api) found = 1 }
    api && /kill_timeout/ { has = 1 }
    END { if (!found) print "none"; else if (has) print "has"; else print "missing" }' "$e")
  case "$state" in
    has) say "mcctl-api already has kill_timeout." ;;
    none) say "No mcctl-api app in $e: kill_timeout not needed." ;;
    missing)
      def=n
      [ "$(env_get BACKUP_AUTO_ON_STOP)" = true ] && def=y
      say "mcctl-api has no kill_timeout: PM2 would kill it after 1.6 s, cutting an auto-backup short."
      if [ "$DRY" = 1 ]; then
        say "[dry-run] would add 'kill_timeout: $KILL_TIMEOUT_MS,' after the name line of mcctl-api (default answer: $def)."
      elif confirm "Add 'kill_timeout: $KILL_TIMEOUT_MS,' to the mcctl-api app (a .bak is written first)?" "$def"; then
        backup_ecosystem_once
        # shellcheck disable=SC2016 # awk program, not shell
        if awk_replace "$e" -v q="'" '
            { print }
            !done && $0 ~ ("name:[ \t]*[" q "\"]mcctl-api[" q "\"]") {
              match($0, /^[ \t]*/)
              print substr($0, 1, RLENGTH) "kill_timeout: 130000,"
              done = 1 }'; then
          say "kill_timeout added."
          changed=1
        else
          add_warning "could not add kill_timeout to $e"
        fi
      fi
      ;;
  esac

  # 5c: restart so the new ecosystem file, env and console auth key move apply
  if [ "$DRY" = 1 ]; then
    say "[dry-run] would run: mcctl console service restart --force"
    record 5 "ecosystem" skipped "dry-run"
    return 0
  fi
  if confirm "Restart mcctl-api and the console now (mcctl console service restart --force)?" y; then
    if run mcctl console service restart --force; then
      record 5 "ecosystem" ok "restarted${changed:+ (file edited)}"
    else
      add_warning "mcctl console service restart --force failed"
      record 5 "ecosystem" failed "restart failed"
    fi
  else
    record 5 "ecosystem" skipped "not restarted${changed:+ (file edited: restart to apply)}"
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
  local out
  if [ "$DRY" = 1 ] && [ "$(major_of "$CUR_NOW")" -lt 3 ]; then
    say "[dry-run] after the update: mcctl world list (duplicate assignments are highlighted)"
    record 7 "Worlds" skipped "dry-run (CLI is not v3 yet)"
    return 0
  fi
  out=$(capture mcctl world list)
  say "$out"
  out=$(printf '%s\n' "$out" | grep -iE 'duplicate|warn|conflict|more than one|used by [2-9]' || true)
  if [ -n "$out" ]; then
    add_warning "world list shows warnings (one world used by several servers?):"
    say "$(printf '%s\n' "$out" | sed 's/^/      /')"
    record 7 "Worlds" ok "warnings shown"
  else
    record 7 "Worlds" ok "no warnings"
  fi
}

step8_verify() {
  step 8 "Verification"
  local bad=0 v out port apps line
  if [ "$DRY" = 1 ]; then
    say "[dry-run] would run: mcctl --version, docker compose config -q, PM2 status, API /health"
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
            *" online "*) say "PM2 $line (ok)" ;;
            *)
              say "PM2 $line (not online)"
              bad=1
              ;;
          esac
          ;;
      esac
    done <<EOF
$apps
EOF
  else
    say "PM2: no apps to check"
  fi
  # CLI-only installs have no API to probe
  if [ ! -f "$ROOT/ecosystem.config.cjs" ]; then
    say "API: not set up here (no ecosystem.config.cjs)"
  else
    port=${API_PORT:-$(env_get API_PORT)}
    port=${port:-5001}
    if out=$(capture curl -fsS --max-time 5 "http://127.0.0.1:$port/health") && [ -n "$out" ]; then
      say "API /health on :$port: $out"
    else
      say "API /health on :$port: no answer (is mcctl-api running?)"
      bad=1
    fi
  fi
  if [ "$bad" = 0 ]; then
    record 8 "Verify" ok
  else
    RC=1
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
  step1_backup
  step2_update
  step3_upgrade
  step4_scripts
  step5_ecosystem
  step6_spec
  step7_worlds
  step8_verify
  finish
}

main "$@"
