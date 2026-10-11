import { log } from '@minecraft-docker/shared';
import type {
  IAuditLogPort,
  AuditLogQueryOptions,
  AuditLog,
  AuditLogData,
  AuditActionEnum,
} from '@minecraft-docker/shared';

const ABI_MISMATCH_HINT =
  'better-sqlite3 was built for a different Node.js version. ' +
  'Reinstall mcctl with the current Node.js: npm install -g @minecraft-docker/mcctl';

// Process-wide so a recreated Container still warns only once
let warned = false;

function warnOnce(error: unknown): void {
  if (warned) return;
  warned = true;
  const message = error instanceof Error ? error.message : String(error);
  const reason = message.includes('NODE_MODULE_VERSION') ? ABI_MISMATCH_HINT : message;
  log.warn(`Audit log unavailable: ${reason}`);
}

/**
 * Wraps an audit log repository so that recording an entry never fails the command.
 *
 * - The repository is created lazily (loading better-sqlite3 can throw).
 * - log() swallows errors and warns once per process (stderr).
 * - Query methods delegate as-is so `mcctl audit` still reports repository errors.
 */
export class BestEffortAuditLogAdapter implements IAuditLogPort {
  private repo?: IAuditLogPort;

  constructor(private readonly createRepository: () => IAuditLogPort) {}

  private get repository(): IAuditLogPort {
    return (this.repo ??= this.createRepository());
  }

  async log(entry: AuditLogData): Promise<void> {
    try {
      await this.repository.log(entry);
    } catch (error) {
      warnOnce(error);
    }
  }

  findAll(options?: AuditLogQueryOptions): Promise<AuditLog[]> {
    return this.query((r) => r.findAll(options));
  }

  findByTarget(targetType: string, targetName: string): Promise<AuditLog[]> {
    return this.query((r) => r.findByTarget(targetType, targetName));
  }

  findByAction(action: AuditActionEnum): Promise<AuditLog[]> {
    return this.query((r) => r.findByAction(action));
  }

  findByActor(actor: string): Promise<AuditLog[]> {
    return this.query((r) => r.findByActor(actor));
  }

  count(options?: AuditLogQueryOptions): Promise<number> {
    return this.query((r) => r.count(options));
  }

  deleteOlderThan(date: Date): Promise<number> {
    return this.query((r) => r.deleteOlderThan(date));
  }

  // Wrapped in an async fn so a lazy-creation throw becomes a rejection, not a sync throw
  private async query<T>(fn: (repo: IAuditLogPort) => Promise<T>): Promise<T> {
    return fn(this.repository);
  }
}
