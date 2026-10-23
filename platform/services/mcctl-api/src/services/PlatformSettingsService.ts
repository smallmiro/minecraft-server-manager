import { readFile } from 'fs/promises';
import { join } from 'path';
import {
  ENV_KEY_RE,
  parseEnvDocument,
  applyEnvChanges,
  serializeEnvValue,
  envRevision,
  atomicWriteFile,
} from '@minecraft-docker/shared/utils';
import { REGISTRY, SECRET_NAME_RE, isApiScoped } from './platform-settings/registry.js';
import type {
  PlatformSetting,
  PlatformRuntimeItem,
  PlatformSettingsResponse,
  PlatformSettingsUpdateRequest,
  PlatformSettingsUpdateResponse,
  RestartScope,
} from '../schemas/platform-settings.js';

export class PlatformNotInitializedError extends Error {
  constructor() {
    super('Platform not initialized (run mcctl init)');
  }
}

export class PlatformSettingsStaleError extends Error {
  constructor(public readonly currentRevision: string) {
    super('Settings were modified; reload and retry');
  }
}

export class PlatformSettingsValidationError extends Error {
  constructor(public readonly errors: Array<{ key: string; message: string }>) {
    super('Validation failed');
  }
}

/** Process-wide: one writer at a time. */
// ponytail: in-process mutex + hash check; file lock if CLI/API concurrent writes become real
let writeChain: Promise<unknown> = Promise.resolve();

/** Read `KEY: 'value'` from the generated ecosystem file by text parse (never require/eval). */
function probeEcosystem(text: string | undefined, key: string): string | undefined {
  if (!text) return undefined;
  const m = new RegExp(`^\\s*${key}\\s*:\\s*(?:'((?:[^'\\\\\\n]|\\\\.)*)'|"((?:[^"\\\\\\n]|\\\\.)*)")`, 'm').exec(text);
  const raw = m?.[1] ?? m?.[2];
  return raw?.replace(/\\(.)/g, '$1');
}

const MANAGED_MESSAGE = 'Managed by ecosystem.config.cjs. Run mcctl upgrade to move it into .env.';

/** Auth keys the ecosystem still defines: the console uses that value, so .env edits would be ignored (#699). */
function ecosystemManagedKeys(eco: string | undefined): Set<string> {
  const keys = new Set<string>();
  if (probeEcosystem(eco, 'BETTER_AUTH_SECRET')) keys.add('BETTER_AUTH_SECRET');
  if (probeEcosystem(eco, 'BETTER_AUTH_BASE_URL') !== undefined) keys.add('BETTER_AUTH_BASE_URL');
  return keys;
}

export class PlatformSettingsService {
  private readonly envPath: string;

  constructor(
    mcctlRoot: string,
    private readonly ecosystemPath: string,
    private readonly processEnv: Record<string, string | undefined> = process.env,
  ) {
    this.envPath = join(mcctlRoot, '.env');
  }

  private async readEnv(): Promise<string> {
    try {
      return await readFile(this.envPath, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new PlatformNotInitializedError();
      throw e;
    }
  }

  private async readEcosystem(): Promise<string | undefined> {
    try {
      return await readFile(this.ecosystemPath, 'utf8');
    } catch {
      return undefined;
    }
  }

  async get(): Promise<PlatformSettingsResponse> {
    const content = await this.readEnv();
    const eco = await this.readEcosystem();
    const { values } = parseEnvDocument(content);
    const settings: PlatformSetting[] = [];
    const managed = ecosystemManagedKeys(eco);

    const build = (key: string): PlatformSetting => {
      const reg = REGISTRY[key];
      const fileValue = values.get(key);
      const secret = reg ? !!reg.secret : SECRET_NAME_RE.test(key);
      const status = reg ? reg.status : 'unknown';
      const s: PlatformSetting = {
        key,
        label: reg?.label ?? key,
        description: reg?.description ?? 'Not recognized by mcctl. Loaded by mcctl-api at startup; Minecraft servers receive it only if its name is listed in servers/global.env.',
        group: reg?.group ?? 'Advanced Environment',
        type: secret ? 'secret' : (reg?.type ?? 'string'),
        status,
        source: status === 'supported' || status === 'readonly' ? 'platform-env' : status,
        editable: status === 'supported' || status === 'legacy' || status === 'unknown',
        secret,
        restartScope: reg ? reg.restartScope : 'servers',
      };
      if (managed.has(key)) {
        s.source = 'pm2-ecosystem';
        s.editable = false;
        s.description = 'Injected by ecosystem.config.cjs, which the console uses instead of this .env value. mcctl upgrade moves it into .env.';
      }
      if (reg?.choices) s.choices = reg.choices;
      if (secret) s.configured = !!fileValue;
      else if (fileValue !== undefined) s.value = fileValue;
      if (isApiScoped(key)) s.applied = (fileValue ?? undefined) === (this.processEnv[key] || undefined);
      if (status === 'shadowed') {
        const eff = probeEcosystem(eco, key);
        s.differsFromEnv = eff !== undefined && fileValue !== undefined && eff !== fileValue;
      }
      return s;
    };

    for (const [key, reg] of Object.entries(REGISTRY)) {
      if (reg.status === 'supported' || reg.status === 'readonly' || values.has(key)) settings.push(build(key));
    }
    for (const key of [...values.keys()].filter((k) => !REGISTRY[k]).sort()) settings.push(build(key));

    const runtime: PlatformRuntimeItem[] = [];
    // Older ecosystem files still inject these; while they do, the ecosystem value wins over .env (#699). Once removed, .env is used (#686).
    const baseUrl = probeEcosystem(eco, 'BETTER_AUTH_BASE_URL');
    if (baseUrl !== undefined) runtime.push({ key: 'BETTER_AUTH_BASE_URL', source: 'pm2-ecosystem', value: baseUrl });
    if (probeEcosystem(eco, 'BETTER_AUTH_SECRET')) runtime.push({ key: 'BETTER_AUTH_SECRET', source: 'pm2-ecosystem', configured: true });
    const authMode: PlatformRuntimeItem = { key: 'AUTH_MODE', source: 'pm2-ecosystem' };
    if (this.processEnv['AUTH_MODE'] !== undefined) authMode.value = this.processEnv['AUTH_MODE'];
    runtime.push(authMode);

    return { revision: envRevision(content), settings, runtime };
  }

  update(req: PlatformSettingsUpdateRequest): Promise<PlatformSettingsUpdateResponse> {
    const run = writeChain.then(() => this.doUpdate(req));
    writeChain = run.catch(() => undefined);
    return run;
  }

  private async doUpdate(req: PlatformSettingsUpdateRequest): Promise<PlatformSettingsUpdateResponse> {
    const content = await this.readEnv();
    const revision = envRevision(content);
    if (req.revision !== revision) throw new PlatformSettingsStaleError(revision);

    const { values } = parseEnvDocument(content);
    const managed = ecosystemManagedKeys(await this.readEcosystem());
    const errors: Array<{ key: string; message: string }> = [];
    const set: Record<string, string> = {};
    const scopes = new Set<RestartScope>();

    for (const [key, value] of Object.entries(req.set)) {
      const reg = REGISTRY[key];
      if (!ENV_KEY_RE.test(key)) { errors.push({ key, message: 'Invalid key name' }); continue; }
      if (managed.has(key)) { errors.push({ key, message: MANAGED_MESSAGE }); continue; }
      if (req.remove.includes(key)) { errors.push({ key, message: 'Key is in both set and remove' }); continue; }
      if (reg && (reg.status === 'readonly' || reg.status === 'shadowed')) { errors.push({ key, message: 'Setting is read-only' }); continue; }
      const secret = reg ? !!reg.secret : SECRET_NAME_RE.test(key);
      if (secret && value === '') continue; // blank secret = preserve
      const problem = reg?.validate?.(value);
      if (problem) { errors.push({ key, message: problem }); continue; }
      try {
        serializeEnvValue(value);
      } catch {
        errors.push({ key, message: 'Value contains unsupported characters (quote, CR, LF or NUL)' });
        continue;
      }
      if (values.get(key) !== value) {
        set[key] = value;
        scopes.add(reg ? reg.restartScope : 'servers');
      }
    }

    const remove: string[] = [];
    for (const key of req.remove) {
      const reg = REGISTRY[key];
      if (!ENV_KEY_RE.test(key)) { errors.push({ key, message: 'Invalid key name' }); continue; }
      if (managed.has(key)) { errors.push({ key, message: MANAGED_MESSAGE }); continue; }
      if (reg?.status === 'readonly') { errors.push({ key, message: 'Setting is read-only' }); continue; }
      if (reg?.required) { errors.push({ key, message: 'Setting is required and cannot be removed' }); continue; }
      if (values.has(key)) {
        remove.push(key);
        scopes.add(reg ? reg.restartScope : 'servers');
      }
    }
    if (errors.length) throw new PlatformSettingsValidationError(errors);

    let newRevision = revision;
    if (Object.keys(set).length || remove.length) {
      const next = applyEnvChanges(content, { set, remove });
      // Re-read right before writing: narrows the window against external writers (mcctl init, backup init, ...).
      const latest = envRevision(await this.readEnv());
      if (latest !== revision) throw new PlatformSettingsStaleError(latest);
      await atomicWriteFile(this.envPath, next, { mode: 0o600 });
      newRevision = envRevision(next);
    }

    scopes.delete('none');
    return { revision: newRevision, changedKeys: Object.keys(set), removedKeys: remove, restartScopes: [...scopes] };
  }
}
