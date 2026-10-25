import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import { restartRouterService } from '../../src/infrastructure/compose-project.js';

vi.mock('node:child_process', () => ({ execSync: vi.fn() }));

describe('compose-project', () => {
  beforeEach(() => vi.clearAllMocks());

  it('restartRouterService uses the compose service name "router", not the container name (#825)', () => {
    restartRouterService('/srv/mc');
    expect(execSync).toHaveBeenCalledWith('docker compose restart router', expect.objectContaining({ cwd: '/srv/mc' }));
  });
});
