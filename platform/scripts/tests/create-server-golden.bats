#!/usr/bin/env bats
# Golden outputs of create-server.sh (#675, ADR-0003 §5): the config.env,
# server docker-compose.yml and servers/compose.yml the script writes for each
# option combination the CLI and API pass, with the bundled template.
# They are the parity oracle for the TypeScript provision that replaces the
# script (platform/services/shared/tests/provision-golden.test.ts).
#
# Regenerate: GOLDEN_UPDATE=1 bats platform/scripts/tests/create-server-golden.bats
#
# Fake docker/ip/hostname on PATH; sudo always fails, so /etc/avahi/hosts is
# never written.

bats_require_minimum_version 1.5.0
load helpers

GOLDEN="$REPO_DIR/platform/services/shared/tests/fixtures/create-server-golden"

setup() {
    require_gnu_sed
    use_fake_docker
    fake_cmd ip 'exit 0'
    fake_cmd hostname 'exit 0'
    fake_cmd sudo 'exit 1'
    make_platform
    mkdir -p "$PLATFORM/worlds/shared"
    printf 'HOST_IPS=192.168.1.10,100.64.0.5\n' > "$PLATFORM/.env"
    export MCCTL_TEMPLATES="$REPO_DIR/platform/services/cli/templates"
}

# golden <case> <server> [create-server.sh options...]
golden() {
    local case="$1" server="$2"
    shift 2
    run bash "$SCRIPTS_DIR/create-server.sh" "$server" --no-start "$@"
    [ "$status" -eq 0 ] || { echo "$output"; return 1; }
    local dir="$GOLDEN/$case"
    if [ -n "${GOLDEN_UPDATE:-}" ]; then
        mkdir -p "$dir"
        cp "$PLATFORM/servers/$server/config.env" "$PLATFORM/servers/$server/docker-compose.yml" "$dir/"
        cp "$PLATFORM/servers/compose.yml" "$dir/compose.yml"
    fi
    diff -u "$dir/config.env" "$PLATFORM/servers/$server/config.env"
    diff -u "$dir/docker-compose.yml" "$PLATFORM/servers/$server/docker-compose.yml"
    diff -u "$dir/compose.yml" "$PLATFORM/servers/compose.yml"
}

@test "golden: paper" { golden paper alpha -t PAPER -v 1.21.1 -m 2G; }
@test "golden: latest" { golden latest beta -t PAPER -v LATEST -m 4G; }
@test "golden: seed" { golden seed gamma -t PAPER -v 1.21.1 -m 4G -s 12345; }
@test "golden: text-seed" { golden text-seed delta -t PAPER -v 1.21.1 -m 4G --seed 'a text seed & more'; }
@test "golden: world-url" { golden world-url eps -t PAPER -v 1.21.1 -m 4G -u https://example.com/world.zip; }
@test "golden: world" { golden world zeta -t PAPER -v 1.21.1 -m 4G -w shared; }
@test "golden: world-missing" { golden world-missing ghost -t PAPER -v 1.21.1 -m 4G -w nowhere; }
@test "golden: modrinth" {
    golden modrinth eta -t MODRINTH -m 6G --modpack cobblemon --modpack-version 1.5.2 --mod-loader fabric --exclude-files a.jar,b.jar
}
@test "golden: curseforge" {
    golden curseforge theta -t AUTO_CURSEFORGE -v 1.20.1 -m 6G --modpack atm9 --modpack-version 0.2.5 --mod-loader forge --exclude-files x.jar
}
@test "golden: whitelist" { golden whitelist iota -t PAPER -v 1.21.1 -m 4G --whitelist steve,alex; }
@test "golden: enable-whitelist" { golden enable-whitelist kappa -t PAPER -v 1.21.1 -m 4G --enable-whitelist; }
@test "golden: no-whitelist" { golden no-whitelist lambda -t PAPER -v 1.21.1 -m 4G --whitelist a --no-whitelist; }
@test "golden: playit" { golden playit mu -t PAPER -v 1.21.1 -m 4G --playit-domain aa.example.com; }
@test "golden: fabric" { golden fabric omega -t FABRIC -v 1.21.4 -m 4G; }
@test "golden: no-host-ip" {
    : > "$PLATFORM/.env"
    golden no-host-ip nu -t PAPER -v 1.21.1 -m 4G
}
