import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runCli, isCliBuild } from './helpers.js';

describe('CLI Player Commands', () => {
  beforeAll(async () => {
    const built = await isCliBuild();
    if (!built) {
      throw new Error('CLI not built. Run "pnpm build" in cli directory first.');
    }
  });

  describe('mcctl player --help', () => {
    it('should display player command help', async () => {
      const result = await runCli(['player', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('player');
    });
  });

  describe('mcctl whitelist --help', () => {
    it('should display whitelist command help', async () => {
      const result = await runCli(['whitelist', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('whitelist');
    });

    it('should show add/remove/list subcommands', async () => {
      const result = await runCli(['whitelist', '--help']);

      expect(result.stdout).toMatch(/add|remove|list/i);
    });
  });

  describe('mcctl ban --help', () => {
    it('should display ban command help', async () => {
      const result = await runCli(['ban', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ban');
    });
  });

  describe('mcctl op --help', () => {
    it('should display op command help', async () => {
      const result = await runCli(['op', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('op');
    });
  });

  describe('mcctl kick --help', () => {
    it('should display kick command help', async () => {
      const result = await runCli(['kick', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('kick');
    });
  });

  describe('mcctl msg --help', () => {
    it('should display msg command help', async () => {
      const result = await runCli(['msg', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('msg');
    });
  });

  describe('removed player subcommands (#730)', () => {
    let tmp: string;
    let marker: string;
    let env: NodeJS.ProcessEnv;

    beforeAll(() => {
      tmp = mkdtempSync(join(tmpdir(), 'mcctl-player-'));
      marker = join(tmp, 'docker-called');
      const bin = join(tmp, 'bin');
      mkdirSync(bin);
      writeFileSync(join(bin, 'docker'), `#!/bin/sh\ntouch "${marker}"\nexit 0\n`, { mode: 0o755 });
      env = { PATH: `${bin}:${process.env.PATH}` };
    });

    afterAll(() => rmSync(tmp, { recursive: true, force: true }));

    it.each(['lookup', 'uuid', 'LOOKUP', 'Lookup', 'UUID', 'Uuid'])(
      'mcctl player %s fails with a hint to player info and never touches docker',
      async (sub) => {
        const result = await runCli(['player', sub, 'Notch', '--root', tmp], { env });

        expect(result.exitCode).toBe(1);
        expect(result.stdout + result.stderr).toContain('mcctl player info <name>');
        expect(existsSync(marker)).toBe(false);
      }
    );

    it.each([
      ['Notch', 'b50ad385-829d-3141-a216-7e7d7539ba7f'],
      ['Steve', '5627dd98-e6be-3c21-b8a8-e92344183641'],
      ['Alex', '36532b5e-c442-3dbb-a24c-c7e55d0f979a'],
    ])('mcctl player info %s --offline prints the exact offline UUID on an empty root', async (name, uuid) => {
      const root = mkdtempSync(join(tmpdir(), 'mcctl-empty-'));
      try {
        const result = await runCli(['player', 'info', name, '--offline', '--json', '--root', root]);

        expect(result.exitCode).toBe(0);
        expect(JSON.parse(result.stdout.trim())).toMatchObject({
          name,
          uuid,
          uuidNoDashes: uuid.replace(/-/g, ''),
          source: 'offline',
        });
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('keeps the name as typed and hashes it case-sensitively', async () => {
      const root = mkdtempSync(join(tmpdir(), 'mcctl-empty-'));
      try {
        const result = await runCli(['player', 'info', 'nOtCh', '--offline', '--json', '--root', root]);
        const out = JSON.parse(result.stdout.trim());

        expect(out.name).toBe('nOtCh');
        expect(out.uuid).not.toBe('b50ad385-829d-3141-a216-7e7d7539ba7f');
        expect(out.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });
});
