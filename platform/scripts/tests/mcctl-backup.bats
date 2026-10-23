#!/usr/bin/env bats
# mcctl.sh backup paths call the TypeScript CLI (#732); backup.sh is gone.

load helpers

setup() {
    make_platform
    CALLS="$BATS_TEST_TMPDIR/calls"
    : > "$CALLS"
    fake_cmd fakenode 'echo "$*" >> "'"$CALLS"'"'
    unset MCCTL_NODE MCCTL_CLI
}

@test "backup.sh no longer exists" {
    [ ! -e "$SCRIPTS_DIR/backup.sh" ]
}

@test "backup: runs the calling CLI from MCCTL_NODE/MCCTL_CLI with the platform root" {
    export MCCTL_NODE="$BATS_TEST_TMPDIR/bin/fakenode" MCCTL_CLI=/opt/mcctl/dist/index.js
    run bash "$SCRIPTS_DIR/mcctl.sh" backup history --json
    [ "$status" -eq 0 ]
    [ "$(cat "$CALLS")" = "/opt/mcctl/dist/index.js backup history --json --root $PLATFORM" ]
}

@test "backup: falls back to mcctl on PATH" {
    fake_cmd mcctl 'echo "mcctl $*" >> "'"$CALLS"'"'
    run bash "$SCRIPTS_DIR/mcctl.sh" backup push -m "before upgrade"
    [ "$status" -eq 0 ]
    [ "$(cat "$CALLS")" = "mcctl backup push -m before upgrade --root $PLATFORM" ]
}

@test "backup: fails clearly without a CLI" {
    env PATH=/usr/bin:/bin sh -c 'command -v mcctl' > /dev/null && skip "mcctl is installed in /usr/bin or /bin"
    run env PATH=/usr/bin:/bin bash "$SCRIPTS_DIR/mcctl.sh" backup status
    [ "$status" -eq 1 ]
    [[ "$output" == *"mcctl not found"* ]] || return 1
}

stop_running_server() {
    add_server alpha
    fake_cmd docker 'echo "docker $*" >> "'"$CALLS"'"; [[ "$1" == inspect ]] && echo running; exit 0'
    export MCCTL_NODE="$BATS_TEST_TMPDIR/bin/fakenode" MCCTL_CLI=/opt/mcctl/dist/index.js
}

@test "stop: BACKUP_AUTO_ON_STOP runs 'backup push --auto' after docker stop" {
    stop_running_server
    printf 'BACKUP_AUTO_ON_STOP=true\nBACKUP_GITHUB_TOKEN=t\nBACKUP_GITHUB_REPO=o/r\n' > "$PLATFORM/.env"
    run bash "$SCRIPTS_DIR/mcctl.sh" stop alpha
    [ "$status" -eq 0 ]
    grep -q '^docker stop mc-alpha$' "$CALLS"
    [ "$(tail -n 1 "$CALLS")" = "/opt/mcctl/dist/index.js backup push --auto --root $PLATFORM" ]
}

@test "stop: no auto-backup when BACKUP_AUTO_ON_STOP is off" {
    stop_running_server
    run bash "$SCRIPTS_DIR/mcctl.sh" stop alpha
    [ "$status" -eq 0 ]
    ! grep -q 'backup' "$CALLS"
}

@test "stop: an auto-backup failure is not fatal" {
    stop_running_server
    printf 'BACKUP_AUTO_ON_STOP=true\nBACKUP_GITHUB_TOKEN=t\nBACKUP_GITHUB_REPO=o/r\n' > "$PLATFORM/.env"
    fake_cmd fakenode 'exit 1'
    run bash "$SCRIPTS_DIR/mcctl.sh" stop alpha
    [ "$status" -eq 0 ]
    [[ "$output" == *"Auto-backup failed"* ]] || return 1
}
