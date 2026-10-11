import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTelemetryNotice, TELEMETRY_NOTICE } from '../../../src/lib/telemetry-notice.js';

describe('getTelemetryNotice', () => {
  let root: string;
  const write = (cfg: object) => writeFileSync(join(root, '.mcctl.json'), JSON.stringify(cfg));

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcctl-notice-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('returns the exact notice with the real root path when enabled', () => {
    write({ version: '1' });
    expect(getTelemetryNotice(root, {})).toBe(
      `Console usage analytics is on (anonymous install ID and page paths, sent to Google Analytics). To turn it off, set "telemetry": false in ${root}/.mcctl.json.`
    );
    expect(TELEMETRY_NOTICE).toContain('<root>');
  });

  it('returns null when telemetry is false', () => {
    write({ telemetry: false });
    expect(getTelemetryNotice(root, {})).toBeNull();
  });

  it('returns null with DO_NOT_TRACK=1', () => {
    write({ version: '1' });
    expect(getTelemetryNotice(root, { DO_NOT_TRACK: '1' })).toBeNull();
  });

  it('returns null when there is no config', () => {
    expect(getTelemetryNotice(root, {})).toBeNull();
  });
});
