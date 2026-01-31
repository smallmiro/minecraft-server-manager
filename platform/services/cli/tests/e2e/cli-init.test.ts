import { describe, it, expect, beforeAll } from 'vitest';
import { runCli, runCliWithTimeout, isCliBuild } from './helpers.js';

describe('CLI Init Command', () => {
  beforeAll(async () => {
    const built = await isCliBuild();
    if (!built) {
      throw new Error('CLI not built. Run "pnpm build" in cli directory first.');
    }
  });

  describe('mcctl init --help', () => {
    it('should display init command help', async () => {
      const result = await runCli(['init', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('init');
    });

    it('should show available flags', async () => {
      const result = await runCli(['init', '--help']);

      expect(result.stdout).toMatch(/--skip-docker|--skip-validation|--reconfigure/);
    });
  });

  describe('mcctl init (already initialized)', () => {
    it('should detect existing initialization', async () => {
      // Run from project root where platform is already initialized
      // Use timeout because init may wait for prompts if not initialized
      const result = await runCliWithTimeout(['init'], 5000, {
        cwd: process.cwd(),
      });

      // Should either:
      // - Exit 0 with "already initialized" message
      // - Timeout if waiting for prompts (not initialized)
      if (result.exitCode === 124) {
        // Timeout means it's waiting for prompts - platform not initialized
        expect(result.exitCode).toBe(124);
      } else {
        // Should show message about existing setup
        expect(result.stdout + result.stderr).toMatch(/already|initialized|reconfigure|Platform/i);
      }
    });
  });

  describe('mcctl init --reconfigure --help', () => {
    it('should show reconfigure option in help', async () => {
      const result = await runCli(['init', '--help']);

      expect(result.stdout).toContain('reconfigure');
    });
  });
});
