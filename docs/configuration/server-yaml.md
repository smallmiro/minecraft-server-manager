# Server Definition (server.yaml)

Each server is defined by one file: `servers/<name>/server.yaml`. mcctl writes the files Docker Compose reads from it:

| File | Written from server.yaml |
|------|--------------------------|
| `servers/<name>/config.env` | yes (comments and untouched lines are kept) |
| `servers/<name>/docker-compose.yml` | yes (rendered from the bundled template) |
| `servers/compose.yml` | the `<name>/docker-compose.yml` include entry is added; other entries are kept |

Platform files (`.env`, the main `docker-compose.yml`, `.mcctl.json`) are not part of it.

## What the file holds

```yaml
specVersion: 1
name: survival
type: PAPER
version: "1.21.1"
memory: 4G
image: itzg/minecraft-server:java21
world:
  level: survival
  storage: universe        # worlds/<level>; "data" = servers/<name>/data/<level>
routing:
  customHostnames:
    - mc.example.com
  playitDomain: aa.example.com
  autoScale:
    up: true
    down: true
  asleepMotd: "§e§lServer is sleeping§r\n§7Connect to wake up!"   # optional
  loadingMotd: "§a§lServer is starting...§r\n§7Please wait!"       # optional
env:                       # every other config.env key, unchanged
  MODE: survival
  ENABLE_RCON: "true"
  MOTD: Welcome to survival! Your adventure begins here.
```

- `TYPE`, `VERSION`, `MEMORY`, `LEVEL` and `PLAYIT_DOMAIN` are fields of their own; they cannot appear in `env`.
- `EXTRA_ARGS` is written from `world.storage` (`--universe /worlds/` for `universe`) plus `env.EXTRA_ARGS`. It is always written, so a server no longer inherits it from `.env`.
- `image` is the server's container image; a new server gets the `itzg/minecraft-server` tag its `VERSION` needs (`java25` for `LATEST`). `mcctl update` changes it to the Java tag `VERSION` needs unless the tag is pinned; see [Java Versions and Image Tags](server-types.md#java-versions-and-image-tags).
- The mc-router hosts are `<name>.local`, `<name>.<ip>.nip.io` for each address in `HOST_IPS` (else `HOST_IP`, else the detected host address), the playit domain, then the custom hosts.
- `routing.autoScale` sets whether mc-router starts the server on connect (`up`) and stops it when idle (`down`). `asleepMotd` and `loadingMotd` set the MOTD shown while the server sleeps or starts; without them the template's MOTDs are used.
- Quote values YAML would read as numbers or booleans (`version: "1.21"`, `ENABLE_RCON: "true"`). mcctl reports the field otherwise.
- Unknown keys are errors. `env` keys must be shell variable names, and their values one line without control characters, not starting with a quote. `env.EXTRA_ARGS` must not contain `--universe` (set `world.storage` instead). Host names must be valid DNS names.

## Who writes it

Every mcctl command and Web Console action that changes a server goes through `server.yaml`: `mcctl create`, `mcctl config`, `whitelist`, `op`, `mod`, `playit domain`, `update`, `init --reconfigure`, world assignment, `migrate worlds`, and the console's settings, whitelist, mods and hostnames pages.

## Existing servers

A server created before this change has no `server.yaml`. It keeps working as before; it is imported the first time mcctl changes it. To import now and see the report:

```bash
mcctl migrate spec --all --dry-run   # what would be imported
mcctl migrate spec --all             # import and write the files
```

Add `--json` for a machine-readable report. The import keeps every `config.env` key. A `docker-compose.yml` `environment` entry moves into `env` (Compose gave it precedence over `config.env`; a clash is reported). A server whose world or image is set through `${...}` interpolation cannot be imported until the value is literal. An empty value such as `VERSION=` stays empty (`version: ""`), because it still overrides `servers/global.env`. mcctl writes a `$` in a `config.env` value inside single quotes (such a value must not end with `\`) and a `$` in the compose image or router labels as `$$`, so Docker Compose does not interpolate it. `mcctl upgrade` lists the servers that have no `server.yaml` yet.

## Hand edits

The first line of the generated files is a header with a hash, so mcctl can tell a hand edit:

- **config.env** edited: the edit is taken into `server.yaml` the next time mcctl changes the server.
- **docker-compose.yml** `image` or `mc-router.*` labels edited: taken into `server.yaml` the same way.
- **docker-compose.yml** edited elsewhere (ports, volumes, ...): the file is protected. Changes that do not affect it leave it alone; a change that would rewrite it fails with `compose_edited` and names the edited fields.
- **server.yaml** edited by hand: applied the next time mcctl changes the server, or with `mcctl migrate spec <name>`.
- **config.env and server.yaml both** edited: `edit_conflict`. Undo one edit, or re-render from `server.yaml` with `mcctl migrate spec <name> --force` (keeps `config.env.bak` / `docker-compose.yml.bak`).

`mcctl start` does not render files; it starts what is on disk.

Other errors a write can stop with:

- `storage_change`: the change would move the world between `worlds/` and the server's `data/` (`world.storage`); mcctl refuses it and points to `mcctl migrate worlds`.
- `invalid_spec`: a field is invalid; the message names each field.
- `unsupported_spec_version`: the file was written by a newer mcctl; upgrade mcctl.
- `locked`: another mcctl process is changing `servers/compose.yml` or deleting the server; retry when it is done.

## Container limits, stop time and logs {#container-memory-limit}

Compose settings of the container that are not in `server.yaml` fields:

- **Memory limit.** A new server, and a server whose `server.yaml` is written again, gets `mem_limit` = heap + max(2G, heap / 2). The heap is `MAX_MEMORY` if set in `env`, else `memory`. The JVM needs memory beyond the heap (metaspace, code cache, thread stacks, direct buffers), and a container killed for exceeding its limit stops mid-save. Examples: `512M` gives `2560m`, `2G` gives `4g`, `4G` gives `6g`, `6G` gives `9g`, `8G` gives `12g`. There is no limit when `memory` is missing or not a size with a unit (a percentage, a bare number), or when a value in `env` contains `-Xmx` or `-XX:MaxRAM` (`JVM_OPTS` in `servers/global.env` is not considered). On a host with swap enabled, the container may use as much swap as `mem_limit`.
- **Stop time.** `stop_grace_period: 90s` gives the server time to save the world: itzg waits up to `STOP_DURATION` (60 seconds by default) for it, and Docker's default of 10 seconds would kill it first. If you raise `STOP_DURATION` (or `STOP_SERVER_ANNOUNCE_DELAY`) above 90 seconds, raise `stop_grace_period` in the server's `docker-compose.yml` too. mc-router stops an idle server after the idle time set by `AUTO_SCALE_DOWN_AFTER`; the 60 seconds it waits for the stop itself is fixed in mc-router.
- **Log rotation.** Servers, mc-router and playit-agent use the `json-file` driver with `max-size: "50m"` and `max-file: "5"`: `docker logs` keeps at most 250 MB per container.

Changing `memory` also changes `mem_limit`. A `mem_limit` you edited by hand is a hand edit (see above), so mcctl refuses to rewrite the compose file over it unless you pass `--force` to [`mcctl migrate spec`](../cli/commands.md#mcctl-migrate-spec). Settings in a compose file apply only after the container is recreated: stop the server, then `mcctl start <name>` after `mcctl migrate spec <name>`.

## Creating a server

`mcctl create` and the Web Console write `server.yaml` and the files above, register `<name>.local` with avahi (a failure is a warning), and start the server unless `--no-start` is given. If anything fails before the server exists, nothing is left behind and the same create can be retried at once. If the server is created but does not start, it stays created: the CLI exits 1 with the cause, and the console says so; start it with `mcctl start <name>`.
