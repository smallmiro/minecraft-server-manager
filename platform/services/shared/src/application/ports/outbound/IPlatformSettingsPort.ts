import type { McctlConfig } from '../../../types/index.js';

/**
 * Platform Settings Port - Outbound Port (#665, ADR-0001)
 *
 * Read access to the platform settings (`.mcctl.json`), so use cases do not
 * resolve file paths themselves. `Config` (utils) satisfies it structurally.
 */
export interface IPlatformSettingsPort {
  /** The platform settings, or null when they are missing or unreadable. */
  load(): McctlConfig | null;
}
