# Secure Bento Platform Settings Design

**Date:** 2026-10-18 (Opus review revision: 2026-10-18)
**Status:** Approved design, revised by Opus pre-implementation review. Ready for implementation.
**Scope:** Management Console platform settings for `<MCCTL_ROOT>/.env` (installed: `/home/smallmiro/minecraft-servers/.env`), plus read-only visibility of settings whose effective runtime source is `ecosystem.config.cjs`.
**Branch:** `feature/683-platform-settings`

## Mandatory Opus Review Before Implementation

> **Status: DONE (2026-10-18).** Opus re-inspected the current code, the installed runtime layout (`.env`, `ecosystem.config.cjs`, `.mcctl.json`, `.mcctl-admin.yml`, `docker-compose.yml`, `servers/*/docker-compose.yml`) and every consumer of each key. The results are recorded in **Opus Review Result** below. Where the original design and the review disagree, **Opus Review Result and Implementation Checklist win**. The original sections below have been edited in place to match.

## Orca Development and Codex Clarification Protocol

Development will be performed in Orca. If Opus needs to clarify Codex's intent, assumptions, or analysis while reviewing or implementing this issue, it must ask the Codex session shown on the right side of the same Orca workspace directly instead of guessing.

Required procedure:

1. Use Orca's terminal list/read capabilities to identify and inspect the right-side Codex session before sending input.
2. Send one focused question directly to that Codex terminal and wait for the turn to start and return to an idle state.
3. Read and incorporate the answer into the Opus review, issue-body revision, or implementation decision.
4. After the answer has been captured, send `/clear` to that right-side Codex session so the temporary clarification context does not remain in the session.
5. Do not run `/clear` before the answer has been read and recorded where needed.

Reference command pattern, using the version-matched Orca CLI and the terminal handle returned by `terminal list`:

```text
orca-ide terminal list --worktree active --json
orca-ide terminal read --terminal <right-codex-handle> --json
orca-ide terminal send --terminal <right-codex-handle> --text "<focused question>" --enter --wait-submit 10 --json
orca-ide terminal wait --terminal <right-codex-handle> --for tui-idle --timeout-ms 300000 --json
orca-ide terminal read --terminal <right-codex-handle> --json
orca-ide terminal send --terminal <right-codex-handle> --text "/clear" --enter --wait-submit 10 --json
```

The executable name can differ by environment. Resolve it from `ORCA_CLI_COMMAND` first, then use `orca-dev` for an Orca development checkout, `orca-ide` on Linux outside an Orca-managed terminal, or `orca` in a standard Orca-managed terminal. Do not assume that bare `orca` is the correct Linux executable.

(The Opus review did not need a Codex clarification.)

## Purpose

Administrators need one trustworthy Settings screen for platform-wide configuration. Today the Console Settings page only manages the signed-in account. Network, backup, playit.gg, RCON, logging and Console runtime configuration are spread across `.env`, `ecosystem.config.cjs`, CLI setup commands and documentation. Some keys still present in `.env` are obsolete or are not read by the running services.

The new screen must show every global setting without implying that obsolete values are active. Supported settings use typed controls in Bento cards. Legacy, shadowed and unknown keys stay reachable through an explicitly warned advanced editor.

Server-specific `servers/<name>/config.env` values stay in each server's existing Options tab and are not duplicated here. Because every server's compose file loads `env_file: [../../.env, config.env]`, a server's `config.env` overrides the platform value for that server. The UI says so on server-runtime keys.

## Users and Authorization

- Administrators can view and modify platform settings.
- Non-admin users keep their existing profile, account-information and password controls. They cannot read platform configuration metadata or submit platform changes.
- The Next.js BFF route (`requireAdmin`) and the mcctl-api route both enforce the administrator role. The backend does not trust UI visibility as authorization.
- **Correction:** the API check is strict. `request.headers['x-role'] === 'admin'` is required for both GET and PUT, and a missing header returns `403`. Do not copy the lenient `role && role !== 'admin'` check from `routes/audit-logs.ts`, which lets a request with no header through.

## Settings Classification (corrected)

Every key in `.env` gets exactly one status. Status is decided by actual consumers, not by template presence.

### Supported, editable (`source: platform-env`)

| Group | Key | Type / validation | Secret | Actual consumer | Apply (restart scope) |
|---|---|---|---|---|---|
| Network & Routing | `HOST_IP` | IPv4 | no | `create-server.sh` (grep the file at run time) | `next-create`: used by the next `mcctl create`. Existing servers' `mc-router.host` labels do not change. |
| Network & Routing | `HOST_IPS` | comma-separated IPv4 list | no | `create-server.sh` | `next-create` (same caveat) |
| Network & Routing | `DOCKER_GID` | integer 0–65535 | no | compose `router.group_add` | `router`: `mcctl router start` (compose `up -d` recreates). `mcctl router restart` does **not** apply it. |
| Server runtime | `TZ` | IANA tz name | no | every MC server container via `env_file` | `servers`: stop, then start each server |
| Server runtime | `EXTRA_ARGS` | free text, single line | no | every MC server container via `env_file` (itzg) | `servers` |
| RCON | `RCON_PASSWORD` | non-empty, single line | **yes** | every MC server container via `env_file` | `servers` |
| RCON | `RCON_PORT` | port 1–65535 | no | every MC server container via `env_file`; CLI `rcon` | `servers` |
| Backup | `BACKUP_GITHUB_TOKEN` | single line | **yes** | `backup.sh` (sources `.env` on every run); mcctl-api `routes/backup.ts` (`process.env`) | `api` (the CLI picks it up immediately) |
| Backup | `BACKUP_GITHUB_REPO` | `owner/repo` | no | same | `api` |
| Backup | `BACKUP_GITHUB_BRANCH` | git ref name | no | same | `api` |
| Backup | `BACKUP_AUTO_ON_STOP` | boolean | no | `mcctl.sh` stop path | `none` (next `mcctl stop`) |
| External Access | `PLAYIT_SECRET_KEY` | single line | **yes** | compose `playit` service (`SECRET_KEY`) | `playit`: stop, then start playit. Existing Console playit controls and `mcctl playit start` use compose `up` and recreate the container. |
| Console & Logging | `LOG_LEVEL` | enum `fatal\|error\|warn\|info\|debug\|trace\|silent` | no | **mcctl-api only.** It loads `<cwd>/.env` via dotenv, and PM2 sets `cwd` to MCCTL_ROOT. mcctl-console never reads this `.env`, because the Next standalone server `chdir`s into its own directory. | `api` |

### Supported, read-only in MVP (`source: platform-env`, `editable: false`)

| Key | Why read-only | Shown guidance |
|---|---|---|
| `MINECRAFT_NETWORK` | Changing it while the network exists breaks compose and requires recreating the network with all containers down | `mcctl down`, edit `.env`, then `mcctl up` |
| `MINECRAFT_SUBNET` | Same | Same |
| `COMPOSE_PROJECT_NAME` | Changing it orphans the existing containers and networks | CLI only, with a warning |

### Runtime-managed, read-only (`source: pm2-ecosystem`)

These values are injected by `ecosystem.config.cjs`, which `mcctl console init` generates and overwrites. The UI shows them in a read-only **Runtime (PM2)** card:

- `BETTER_AUTH_BASE_URL` (console). The effective value is shown; it is not a secret.
- `BETTER_AUTH_SECRET` (console). The card shows `configured: true` and whether the shadowed `.env` copy differs. It never shows the value.
- `AUTH_MODE` (api). Read from mcctl-api's own `process.env`.
- Change path: re-run `mcctl console init`. Already-saved `.env` changes are not lost.

### Shadowed (`source: shadowed`): present in `.env` but overridden

- `BETTER_AUTH_SECRET` and `BETTER_AUTH_BASE_URL` in `.env` are **not applied**. PM2 `env` wins, and the console never loads this `.env`. On the installed host both values **differ** from the ecosystem values. They are listed in the Legacy / Unused card with the label "Overridden by ecosystem.config.cjs; not applied" and a "differs" flag. Removing them is an explicit admin action.

### Legacy (`source: legacy`): present in `.env`/templates but not read by any current code

Confirmed: `API_ACCESS_MODE`, `BETTER_AUTH_TRUSTED_ORIGINS`, `BETTER_AUTH_URL`, `MCCTL_API_IMAGE`, `MCCTL_CONSOLE_IMAGE`, `MCCTL_CONSOLE_PORT`, `MCCTL_CORS_ORIGIN`, `MCCTL_JWT_EXPIRY`, `MCCTL_JWT_SECRET` (secret), `NEXTAUTH_SECRET` (secret), `NEXTAUTH_URL`.

**Added by the review:** `DEFAULT_MEMORY` and `DEFAULT_VERSION`. No create path reads them: not `create-server.sh`, not `CreateServerUseCase`, not mcctl-api. `mcctl init` only displays `DEFAULT_MEMORY`, and uses `DEFAULT_VERSION` once as a seed when `.mcctl.json` is missing.

### Unknown (`source: unknown`)

Any syntactically valid key not in the registry. **Correction:** these keys are not inert. Every key in `.env` is passed to **every Minecraft server container** through `env_file` and is loaded into mcctl-api's `process.env` at startup. The UI copy says exactly that: "Not recognized by mcctl. Passed to all Minecraft server containers and loaded by mcctl-api at startup; effect unknown."

### Secret classification for non-registry keys

Legacy and unknown keys are masked as secrets when their name matches `/(SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|(^|_)KEY$)/i`, for example `MCCTL_SUDO_PASSWORD` or `API_KEY`. Their values are never returned.

## Effective Source and Drift

Source labels: `platform-env`, `pm2-ecosystem`, `shadowed`, `legacy`, `unknown`. **`generated-config` is dropped**: no supported key lives in `.mcctl.json`. The existing Routing page handles `playitEnabled`.

- **Pending restart (api scope):** for keys whose consumer is mcctl-api (`LOG_LEVEL`, `BACKUP_GITHUB_*`), the API compares the file value with its own `process.env[key]` and returns `applied: boolean`. For secrets it compares without returning either value. This gives a truthful "restart pending" chip at no extra cost.
- **Shadowed drift:** for `BETTER_AUTH_SECRET` and `BETTER_AUTH_BASE_URL`, the API reads `ecosystem.config.cjs` **read-only, by text parsing of the generated `KEY: 'value'` format, never `require`/eval**, and returns the effective non-secret URL plus `differsFromEnv: boolean`.
- Saving a typed setting writes only `.env`. Nothing is written to a location the running service ignores.

## PM2-managed values: decision (recorded)

**Decision: neither a dedicated ecosystem write adapter nor a migration in this issue. PM2-managed values are read-only in MVP. The single-source migration (ecosystem reads `.env`) is a follow-up issue.**

Reasons:
1. `ecosystem.config.cjs` is generated JavaScript built from string templates (`cli/src/commands/console/init.ts` `generateEcosystemConfig`), and `mcctl console init` overwrites it. A write adapter would edit code, and the next `init` would silently revert it.
2. Editing it would not take effect anyway. `pm2.restart(name)` in `Pm2ServiceManagerAdapter` keeps PM2's stored env, so a new ecosystem env is only applied by restarting from the config with `--update-env` or by delete-and-start.
3. The only PM2-managed keys an admin would plausibly edit are `BETTER_AUTH_SECRET`, `BETTER_AUTH_BASE_URL` and `AUTH_*`. Rotating `BETTER_AUTH_SECRET` from the console it secures logs out every session, including the caller's. `AUTH_API_KEY` must match `MCCTL_API_KEY` in both apps; on the host they currently match, together with `.mcctl-admin.yml`. Doing either from the UI is a footgun with no MVP value.
4. Without ecosystem writes, the **only file written is `.env`**. That removes the whole multi-source staged-write and rollback machinery from the design.

## API Design (revised)

### `GET /api/platform-settings`

`Cache-Control: no-store`, strict admin. Returns:

```ts
{
  revision: string;               // sha256 of the .env bytes
  settings: Array<{
    key: string; label: string; description: string; group: string;
    type: 'string'|'secret'|'boolean'|'enum'|'integer'|'port'|'ipv4'|'ipv4-list'|'tz'|'repo';
    status: 'supported'|'readonly'|'shadowed'|'legacy'|'unknown';
    source: 'platform-env'|'shadowed'|'legacy'|'unknown';
    editable: boolean;
    secret: boolean;
    value?: string;               // non-secret only
    configured?: boolean;         // secret only
    choices?: string[];
    restartScope: 'none'|'next-create'|'router'|'servers'|'playit'|'api';
    applied?: boolean;            // api-scope keys only
    differsFromEnv?: boolean;     // shadowed keys only
  }>;
  runtime: Array<{ key: string; source: 'pm2-ecosystem'; value?: string; configured?: boolean }>;
}
```

### `PUT /api/platform-settings`

Body: `{ revision: string; set: Record<string,string>; remove: string[] }`. A single `set` map covers typed, advanced and legacy edits.

- `403` for non-admin, including a missing `X-Role`.
- `409 { currentRevision }` when the revision is stale. Nothing is written.
- `400 { errors: [{ key, message }] }`. All changes are validated before any write. Read-only keys in `set` or `remove`, invalid key names, raw `\r`/`\n`/NUL, invalid enum, IP, port or repo values, and a single quote in a value that needs quoting are all rejected.
- An omitted secret, or a secret sent as `""`, means "preserve". A secret is cleared only through `remove`.
- Write path: parse, apply, serialize, then (under an in-process mutex) re-read the file and compare the hash. Then write a temp file in the same directory, `fsync`, `chmod 0600` and `rename`.
- Duplicate keys: the last occurrence is effective, which matches dotenv, bash and compose. `set` rewrites every occurrence.
- Untouched lines (comments, blanks, ordering, existing quoting such as the current double-quoted `EXTRA_ARGS`) stay byte-identical.
- **Value serialization (new, security-critical).** `backup.sh` runs `set -a; source .env`, so `.env` must stay a valid **bash** file as well as valid compose and dotenv. Write `KEY=value` bare only when the value matches `^[A-Za-z0-9_./:,@%+=-]*$`. Otherwise write `KEY='value'`, single-quoted and therefore literal in bash, compose v2 and dotenv, and reject values that contain `'`. Without this rule, a value like `$(…)` or `a b` saved from the UI would execute as shell when `backup.sh` runs. `create-server.sh` reads values with `cut -d= -f2 | tr -d "'\""`, so `HOST_IP` and `HOST_IPS` must stay bare. Their validators already ensure that.
- `200 { revision, changedKeys, removedKeys, restartScopes }`.
- Secret values never appear in responses, logs or audit records.

### Apply behavior

Saving and restarting stay separate. **There are no new restart endpoints.** The review found that the only existing restart route is `POST /api/servers/:name/restart`, and it runs `docker compose restart`, which **does not reload `env_file`**. The restart-required dialog therefore shows correct guidance per scope:

| Scope | Guidance shown |
|---|---|
| `servers` | "Stop, then start each server. Restart does not reload .env." Link to the Servers page. CLI: `mcctl stop <name> && mcctl start <name>`. Note: mc-router auto-scale wakes an existing container with its old env, so a recreate through `mcctl start` is required. |
| `router` | `mcctl router start` (not `restart`) |
| `playit` | Link to the Routing page playit controls, or `mcctl playit stop && mcctl playit start` |
| `api` | `mcctl console service restart --api`. The API restarts itself from the CLI, never inside the save request. |
| `next-create` | "Applies to servers created after this change. Existing server hostnames are unchanged." |

## Backend Structure (revised, reuse first)

- **shared (`platform/services/shared/src/utils/env-file.ts`, new):** pure functions `parseEnvDocument`, `applyEnvChanges`, `serializeEnvValue` (the quoting rule), `envRevision` (sha256), plus `writeFileAtomic(path, content, mode)`. Re-export them from `utils/index.ts`. The existing `Config.loadEnv/updateEnv` and the private parsers in `ConfigService`, `ServerRepository` and `PlayerRepository` are not refactored in this issue (Tidy First, YAGNI).
- **shared `AuditActionEnum`:** add `PLATFORM_SETTINGS_UPDATE = 'platform.settings.update'`.
- **mcctl-api:** `services/platform-settings/registry.ts` (metadata, validators, scopes), `services/PlatformSettingsService.ts` (read, classify, mask, revision, write), `schemas/platform-settings.ts` (TypeBox), `routes/platform-settings.ts`, registered in `app.ts`. This follows the existing `ConfigService` pattern of a service class with injected root paths. There is no new port or interface: one implementation, one consumer.
- **Audit:** `writeAuditLog({ action: 'platform.settings.update', actor: 'api:<x-user>', targetType: 'platform', targetName: '.env', details: { changedKeys, removedKeys, restartScopes }, status })`. Failures (400, 409, I/O) are recorded too. Details never contain values.
- The registry lives in mcctl-api only. The console renders whatever metadata the API returns.

## Console/BFF Structure

- `app/api/platform-settings/route.ts` (GET, PUT) follows the `app/api/backup/restore/route.ts` pattern: `requireAdmin(await headers())`, `createMcctlApiClient(getUserContext(session))`, then mapping of `AuthError` and `McctlApiError`. It passes `409` and `400` bodies through and sets `Cache-Control: no-store`. **There is no generic proxy; this route is required.**
- `adapters/McctlApiAdapter.ts`: add `getPlatformSettings()` and `updatePlatformSettings()`.
- `hooks/usePlatformSettings.ts`: React Query query and mutation. The query is only enabled when `session.user.role === 'admin'`.
- `types/platform-settings.ts`: the console's own copy of the response and request types. The console must not import the shared root index. It may only import `@minecraft-docker/shared/utils`, and it does not need anything from shared for this feature.
- `types/audit-log.ts`: add a label and color for `platform.settings.update`.

## Bento UI

The existing `/settings` route (`app/(main)/settings/page.tsx`, which already uses `PageHero` and `BentoGrid`/`BentoPanel`) stays the single Settings destination.

- Compact `PageHero` with dirty and restart-pending chips.
- Admin-only platform section, built from API metadata by **one generic `SettingField` renderer** (text, password, switch, select, number, IP list) inside a generic group card. There are no eight bespoke card components. Groups: Network & Routing, Server Runtime, RCON, Backup, External Access, Console & Logging, Runtime (PM2, read-only), Advanced Environment (unknown keys: key/value add, edit, remove), and Legacy / Unused (legacy and shadowed keys, warning styling, remove).
- The existing Profile, Account Info and Password panels stay below for all users.
- Secret fields show "Configured" or "Not configured". The input is never pre-filled, and typing marks the field dirty.
- A sticky save bar (Discard / Save Changes) appears when anything is dirty. Validation is field-level, and the server is authoritative.
- A `409` opens a reload dialog and never overwrites automatically.
- After save, the restart-required dialog groups scopes with the guidance above.
- The advanced editor uses structured key/value rows, not a raw textarea.

## Error Handling and Recovery

- Parse and I/O errors name the source (`.env`) without returning file contents.
- Validation failures map to keys.
- A failed atomic write leaves the previous file intact. With a single file there are no multi-source staged writes or rollback.
- A missing `.env` returns `404` with the message "Platform not initialized (run mcctl init)".
- UI errors stay visible until dismissed or a retry succeeds.

## Security Requirements

- Secrets are write-only through the API and UI. Legacy and unknown keys use the name heuristic above.
- Request bodies containing secrets are not logged. Do not add body logging to this route.
- Audit entries never contain values.
- `.env` ends with mode `0600` after a successful write. The installed file is currently `0664`, so the first save tightens it. All consumers (compose CLI, bash scripts, mcctl-api) run as the same host user, so this is safe.
- If `.env` is a symlink, resolve it with `realpath` before writing so the link is not replaced.
- No arbitrary filesystem paths and no shell execution. The path is always `<platformPath>/.env`.
- Advanced keys must match `^[A-Za-z_][A-Za-z0-9_]*$`. Values cannot contain raw CR, LF or NUL, and the quoting rule applies.
- Both the API and BFF send `Cache-Control: no-store`.

## Testing Strategy

TDD (Red, Green, Refactor) in every slice.

- **shared env-file:** preserve comments, blanks, ordering, quoted values and values containing `=`. Duplicate keys (last wins, `set` rewrites all). Serialization: a bare-safe value stays bare; spaces and `$()` are single-quoted; `'`, CR, LF and NUL are rejected. Round-trip: `bash -c 'set -a; source f; printf %s "$K"'` returns the literal value. Atomic write gives mode `0600` and leaves the original intact on failure. Revision hash.
- **mcctl-api service:** classification of every key in the installed `.env` key set (supported, readonly, shadowed, legacy, unknown). Masking: plaintext never appears in `JSON.stringify(response)`. Blank secret preserves the value. Validators. Stale revision returns `409` and leaves the file unchanged. Read-only keys are rejected. `applied` flag. Ecosystem probe parses without eval and never returns secret values.
- **mcctl-api route:** `403` without `X-Role` and with `X-Role: user`, for GET and PUT. `200` for admin, with a no-store header. Audit on success and failure, without values. `400`/`409`/`404`/`500` mapping.
- **console:** BFF returns `401` and `403` and passes `409` through. The settings page as a non-admin shows account panels only, and the platform query is not fired. As an admin: groups render, a secret shows only its configured state, dirty bar, `409` dialog, restart dialog scopes.
- **e2e (`e2e/tests/platform-settings.spec.ts`):** admin updates a non-secret key and sees the persisted value. Admin rotates `BACKUP_GITHUB_TOKEN`, and neither the old nor the new plaintext appears in GET. A stale revision returns `409`. The test restores the original `.env` in teardown. Non-admin denial is covered by BFF and API tests. A non-admin e2e case is optional: there is no non-admin fixture today.

## Documentation

- `docs/configuration/environment.md` and `.ko.md`: classification table (supported, read-only, PM2-managed, shadowed, legacy, unknown) with consumer and apply scope. Note that every `.env` key reaches all server containers.
- `docs/console/web-console.md` and `.ko.md`: Settings workflow, restart guidance ("Stop then Start; Restart does not reload .env").
- Fix `PLAYIT_SECRET` to `PLAYIT_SECRET_KEY` (`web-console.md:822`, `web-console.ko.md:822`).
- Fix `BACKUP_REPO_URL` to `BACKUP_GITHUB_REPO` plus `BACKUP_GITHUB_TOKEN` (`web-console.md:674`, `web-console.ko.md:674`).
- List the CLI equivalents: `mcctl backup init`, `mcctl playit setup`, `mcctl init --reconfigure`, `mcctl console init`.

## Acceptance Criteria

See **Implementation Checklist** (authoritative).

## Out of Scope

- Moving server-specific Options into the global Settings page
- Showing stored secret plaintext
- Arbitrary file editing or shell command execution
- Automatic removal of legacy keys without an explicit administrator action
- Restarting services implicitly as a side effect of saving
- **(review)** Writing `ecosystem.config.cjs` or any PM2-managed value
- **(review)** New restart endpoints for router, api or console
- **(review)** Editing `MINECRAFT_NETWORK`, `MINECRAFT_SUBNET` or `COMPOSE_PROJECT_NAME` from the UI
- **(review)** Refactoring existing env parsers (`Config.updateEnv`, `ConfigService`, repositories)

---

## Opus Review Result

### Decisions
1. **PM2 values stay read-only.** There is no ecosystem write adapter. The single-source migration is a follow-up. The only file written is `.env`, so the multi-source rollback is removed. See "PM2-managed values: decision".
2. **No new restart endpoints.** The restart dialog gives correct per-scope guidance, because the existing server "Restart" (`docker compose restart`) does not reload `.env`.
3. **Network identity keys are read-only** (`MINECRAFT_NETWORK`, `MINECRAFT_SUBNET`, `COMPOSE_PROJECT_NAME`).
4. **Strict API admin check** (`x-role === 'admin'`, missing header returns `403`) for GET and PUT.
5. **Bash-safe serialization** is mandatory, because `backup.sh` `source`s `.env`.
6. **Reuse:** pure env helpers go in shared `utils/env-file.ts`. Service, registry and route follow the mcctl-api `ConfigService` and `backup/restore` patterns. The UI is one generic field renderer on the existing Bento settings page.

### Corrections to the original analysis
- `DEFAULT_MEMORY` and `DEFAULT_VERSION` are **legacy**. No create path reads them.
- `BETTER_AUTH_SECRET` and `BETTER_AUTH_BASE_URL` in `.env` are **shadowed, not supported**. The PM2 ecosystem values win, and on the installed host both differ from `.env`.
- `LOG_LEVEL` is consumed **only by mcctl-api**, through dotenv with cwd set to MCCTL_ROOT. The console never reads this `.env`, because the standalone server `chdir`s.
- `EXTRA_ARGS`, `TZ`, `RCON_PASSWORD` and `RCON_PORT` are consumed by **server containers via `env_file`**, not by compose or the CLI. A per-server `config.env` overrides them.
- `BACKUP_GITHUB_*` in mcctl-api is read from `process.env`, so applying it needs an API restart. The CLI `backup.sh` re-reads the file on every run.
- "Unknown" keys are **not inert**. They reach every server container and mcctl-api `process.env`.
- Unknown and legacy keys can be secrets (`MCCTL_SUDO_PASSWORD`, `MCCTL_JWT_SECRET`, `NEXTAUTH_SECRET`), so they are masked by name heuristic.
- `generated-config` source dropped: no supported key lives in `.mcctl.json`.
- The existing API role check pattern (`routes/audit-logs.ts`) is lenient. Do not copy it.
- `docker compose restart` and `mcctl router restart` do not apply `.env` changes. Recreating through `up -d` (`mcctl start`, `mcctl router start`, playit start) does.
- The installed `.env` is mode `0664`. The first save tightens it to `0600`, which is safe because all consumers run as the same user.

### Risks
- **Shell injection through `.env`** if serialization is wrong (`backup.sh` `source`). Mitigated by the quoting rule and the bash round-trip test.
- **Stale env after save:** mc-router auto-scale restarts existing containers with their old env. The dialog states that a recreate is needed.
- **External writers** (`mcctl init`, `backup init`, `playit setup`, `upgrade` append) bypass the revision. The re-read and hash check just before `rename` narrows the window to milliseconds. `// ponytail: in-process mutex + hash check; file lock if CLI/API concurrent writes become real`.
- **Existing secret exposure (not introduced here):** every platform secret in `.env` (`BACKUP_GITHUB_TOKEN`, `PLAYIT_SECRET_KEY`, and the stale `BETTER_AUTH_SECRET`) is injected into every Minecraft server container through `env_file`. This is a follow-up issue.

### Follow-up issues (to file separately)
1. Server compose `env_file: ../../.env` leaks platform secrets into every MC container. Pass only the needed keys.
2. Single-source PM2 config: `ecosystem.config.cjs` reads `BETTER_AUTH_BASE_URL` and others from `.env`, which would make them editable here.
3. Template cleanup: remove the legacy keys from `templates/.env.example`, `platform/.env.example` and `cli/templates/.env.example`. Sync the `WORLD_*` keys into `templates/.env.example`.
4. `Config.updateEnv` (CLI) is non-atomic and does not quote values. Reuse the new `env-file` serializer.
5. Make the `DELETE /api/audit-logs` admin check strict.

### Slice plan (dependency order)

```
S1 core (shared) ──► S2 backend (mcctl-api) ──► S3 frontend (mcctl-console) ──► S4 e2e (devops)
                                         └──────────────────────────────────► S5 docs (technical-writer, parallel with S3/S4)
```
S3 may start its UI in a separate worktree against the API contract in this issue once S2's schema file is committed.

### Files to Modify

**S1 – core-agent (`platform/services/shared`)**
- `src/utils/env-file.ts` (new): parse, apply, serialize, revision, atomic write
- `src/utils/index.ts`: re-export
- `src/domain/value-objects/AuditAction.ts`: `PLATFORM_SETTINGS_UPDATE = 'platform.settings.update'`
- `tests/env-file.test.ts` (new; shared tests are flat under `tests/`)

**S2 – backend-agent (`platform/services/mcctl-api`)**
- `src/services/platform-settings/registry.ts` (new)
- `src/services/PlatformSettingsService.ts` (new; includes the read-only ecosystem probe)
- `src/schemas/platform-settings.ts` (new, TypeBox)
- `src/routes/platform-settings.ts` (new, GET/PUT, strict admin, no-store, audit)
- `src/app.ts`: register the route
- `tests/platform-settings-service.test.ts`, `tests/platform-settings-routes.test.ts` (new)

**S3 – frontend-agent (`platform/services/mcctl-console`)**
- `src/app/api/platform-settings/route.ts` (new BFF, plus test)
- `src/adapters/McctlApiAdapter.ts`: `getPlatformSettings` and `updatePlatformSettings`
- `src/types/platform-settings.ts` (new)
- `src/hooks/usePlatformSettings.ts` (new)
- `src/components/settings/platform/` (new): `PlatformSettingsSection.tsx`, `SettingsGroupCard.tsx`, `SettingField.tsx`, `AdvancedEnvCard.tsx`, `LegacyEnvCard.tsx`, `RuntimeInfoCard.tsx`, `SaveBar.tsx`, `RestartRequiredDialog.tsx`, `index.ts`, plus tests
- `src/components/settings/index.ts`: export
- `src/app/(main)/settings/page.tsx` and `page.test.tsx`: admin section above account panels
- `src/types/audit-log.ts`: label and color for `platform.settings.update`

**S4 – devops-agent (`e2e`)**
- `e2e/tests/platform-settings.spec.ts` (new; restores `.env` in teardown)

**S5 – technical-writer (`docs`)**
- `docs/configuration/environment.md`, `docs/configuration/environment.ko.md`
- `docs/console/web-console.md`, `docs/console/web-console.ko.md` (Settings section, lines 674 and 822)
- `docs/superpowers/specs/2026-10-18-platform-settings-design.md`: sync with this issue body

### Branch Strategy
- `feature/683-platform-settings` (already created from `develop`). One PR to `develop`. Commits per slice. Tidy First: structural and behavioral changes go in separate commits. Commit format: `feat(<pkg>): ... (#683)`.

---

## Implementation Checklist

Tracked in GitHub issue #683 (slices S1 shared, S2 mcctl-api, S3 mcctl-console, S4 e2e, S5 docs). The issue body is authoritative for the checklist.
