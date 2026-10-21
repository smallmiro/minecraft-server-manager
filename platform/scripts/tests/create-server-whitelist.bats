#!/usr/bin/env bats
# create-server.sh whitelist options (#679).
# Whitelist is off by default. ENABLE_WHITELIST=TRUE / WHITELIST=... are
# written to config.env only when enabled, and at most once:
# - (no option)          -> disabled
# - --whitelist a,b      -> enabled + players
# - --enable-whitelist   -> enabled, no players
# - --no-whitelist       -> disabled (wins over --whitelist, any order)
# All three templates are checked: templates/, platform/servers/ and the
# npm-bundled platform/services/cli/templates/ (what mcctl actually uses),
# plus a legacy template that still has ENABLE_WHITELIST=TRUE.
#
# Runs the real script in a temp platform dir with fake docker/ip/hostname/sudo
# on PATH. HOST_IP resolves to empty, so avahi registration is skipped and no
# system file (/etc/avahi/hosts) is read or written.

load helpers

setup() {
    require_gnu_sed
    use_fake_docker
    fake_cmd ip 'exit 0'
    fake_cmd hostname 'exit 0'
    # sudo must never be reached (logged + fails).
    fake_cmd sudo 'echo "$*" >> "$BATS_TEST_TMPDIR/sudo.log"; exit 1'
    make_platform
    : > "$PLATFORM/docker-compose.yml"
    cp -r "$REPO_DIR/platform/servers/_template" "$PLATFORM/servers/_template"
}

teardown() {
    [ ! -f "$BATS_TEST_TMPDIR/sudo.log" ]
}

# create <templates-dir|""> <server> [options...]
# Empty templates-dir -> script uses $PLATFORM/servers/_template.
create() {
    local templates="$1" name="$2"
    shift 2
    MCCTL_TEMPLATES="$templates" \
        bash "$SCRIPTS_DIR/create-server.sh" "$name" --no-start "$@" > "$BATS_TEST_TMPDIR/$name.out" 2>&1
}

count() {
    grep -c "$1" "$PLATFORM/servers/$2/config.env" || true
}

# run_cases <templates-dir|""> : every option combination against one template.
run_cases() {
    local t="$1"

    create "$t" def
    [ "$(count '^ENABLE_WHITELIST=' def)" = 0 ]
    [ "$(count '^WHITELIST=' def)" = 0 ]

    create "$t" wl --whitelist a,b
    [ "$(count '^ENABLE_WHITELIST=TRUE$' wl)" = 1 ]
    [ "$(count '^WHITELIST=a,b$' wl)" = 1 ]
    [ "$(count '^ENABLE_WHITELIST=' wl)" = 1 ]

    create "$t" en --enable-whitelist
    [ "$(count '^ENABLE_WHITELIST=TRUE$' en)" = 1 ]
    [ "$(count '^WHITELIST=' en)" = 0 ]

    create "$t" no --no-whitelist
    [ "$(count '^ENABLE_WHITELIST=' no)" = 0 ]

    create "$t" nowl --no-whitelist --whitelist a
    [ "$(count '^ENABLE_WHITELIST=' nowl)" = 0 ]
    [ "$(count '^WHITELIST=' nowl)" = 0 ]

    create "$t" wlno --whitelist a --no-whitelist
    [ "$(count '^ENABLE_WHITELIST=' wlno)" = 0 ]
}

@test "whitelist: templates/" {
    run_cases "$REPO_DIR/templates"
}

@test "whitelist: platform/servers/ (script default template)" {
    run_cases ""
}

@test "whitelist: cli/templates/" {
    run_cases "$REPO_DIR/platform/services/cli/templates"
}

# Legacy deployed template (pre-#679 installs keep ENABLE_WHITELIST=TRUE in
# <MCCTL_ROOT>/servers/_template, which the Web Console path copies): the
# script must still apply the requested state exactly once.
@test "whitelist: legacy template with ENABLE_WHITELIST=TRUE" {
    LEGACY="$BATS_TEST_TMPDIR/legacy-templates"
    mkdir -p "$LEGACY/servers"
    cp -r "$REPO_DIR/templates/servers/_template" "$LEGACY/servers/_template"
    printf '\nENABLE_WHITELIST=TRUE\n' >> "$LEGACY/servers/_template/config.env"
    run_cases "$LEGACY"
}
