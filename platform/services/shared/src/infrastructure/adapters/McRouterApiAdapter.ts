import type { IMcRouterApiPort, McRouterRoute } from '../../application/ports/outbound/IMcRouterApiPort.js';

export interface McRouterApiAdapterOptions {
  /** Management API base URL. Default `http://127.0.0.1:25580`. */
  baseUrl?: string;
  /** Request timeout in ms. Default 2000. */
  timeoutMs?: number;
  /** fetch implementation (tests). Default the global fetch. */
  fetch?: typeof fetch;
}

/**
 * mc-router management API over HTTP (#768).
 *
 * `GET /routes` (server/api_server.go, v1.47.1) returns
 * `{ "<server address>": { "backend": "...", "scalingTarget": "..." } }`.
 */
export class McRouterApiAdapter implements IMcRouterApiPort {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch | undefined;

  constructor(options: McRouterApiAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'http://127.0.0.1:25580').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.fetchFn = options.fetch;
  }

  async listRoutes(): Promise<Map<string, McRouterRoute> | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const fetchFn = this.fetchFn ?? globalThis.fetch;
      const res = await fetchFn(`${this.baseUrl}/routes`, { method: 'GET', signal: controller.signal });
      if (res.status !== 200) return null;
      const body: unknown = JSON.parse(await res.text());
      if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;

      const routes = new Map<string, McRouterRoute>();
      for (const [address, entry] of Object.entries(body as Record<string, unknown>)) {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
        const { backend, scalingTarget } = entry as Record<string, unknown>;
        const route: McRouterRoute = { backend: typeof backend === 'string' ? backend : '' };
        if (typeof scalingTarget === 'string' && scalingTarget) route.scalingTarget = scalingTarget;
        routes.set(address, route);
      }
      return routes;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
