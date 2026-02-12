import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { playitCommand } from '../../../src/commands/playit.js';
import * as promptsModule from '@clack/prompts';
import * as shared from '@minecraft-docker/shared';

// Mock @clack/prompts
vi.mock('@clack/prompts');

// Mock shared module
vi.mock('@minecraft-docker/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@minecraft-docker/shared')>();
  return {
    ...actual,
    getPlayitAgentStatus: vi.fn(),
    startPlayitAgent: vi.fn(),
    stopPlayitAgent: vi.fn(),
    getServerPlayitDomain: vi.fn(),
    getConfiguredServers: vi.fn(() => []),
  };
});

describe('mcctl playit subcommand', () => {
  const testRoot = join(process.cwd(), 'platform', 'services', 'cli', 'tests', '.tmp-playit-cmd');

  beforeEach(() => {
    vi.clearAllMocks();

    // Clean up and create fresh test directory
    if (existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true });
    }
    mkdirSync(testRoot, { recursive: true });

    // Mock isCancel to return false by default
    vi.mocked(promptsModule.isCancel).mockReturnValue(false);
  });

  afterEach(() => {
    // Cleanup test directory
    if (existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true });
    }
  });

  /**
   * Helper to create initialized platform structure
   */
  function createInitializedPlatform(playitEnabled = false, secretKey?: string) {
    // Create docker-compose.yml (required for isInitialized() check)
    const composePath = join(testRoot, 'docker-compose.yml');
    writeFileSync(composePath, 'version: "3.9"\n', 'utf-8');

    // Create .mcctl.json
    const configPath = join(testRoot, '.mcctl.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        version: '1.0',
        initialized: new Date().toISOString(),
        dataDir: testRoot,
        defaultType: 'PAPER',
        defaultVersion: 'LATEST',
        autoStart: false,
        avahiEnabled: false,
        playitEnabled,
      }),
      'utf-8'
    );

    // Create .env if secretKey provided
    if (secretKey) {
      const envPath = join(testRoot, '.env');
      writeFileSync(envPath, `PLAYIT_SECRET_KEY=${secretKey}\n`, 'utf-8');
    }
  }

  describe('playit start', () => {
    it('should start playit-agent container when enabled and key configured', async () => {
      // Setup: playit enabled, key configured, agent stopped
      createInitializedPlatform(true, 'test-key-123');

      vi.mocked(shared.getPlayitAgentStatus).mockResolvedValueOnce({
        enabled: true,
        agentRunning: false,
        secretKeyConfigured: true,
        containerStatus: 'exited',
      });

      vi.mocked(shared.startPlayitAgent).mockResolvedValueOnce({ success: true });

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'start',
      });

      expect(exitCode).toBe(0);
      expect(shared.startPlayitAgent).toHaveBeenCalled();
    });

    it('should fail when SECRET_KEY is not configured', async () => {
      createInitializedPlatform(true); // No secret key

      vi.mocked(shared.getPlayitAgentStatus).mockResolvedValueOnce({
        enabled: false,
        agentRunning: false,
        secretKeyConfigured: false,
        containerStatus: 'not_found',
      });

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'start',
      });

      expect(exitCode).toBe(1);
      expect(shared.startPlayitAgent).not.toHaveBeenCalled();
    });

    it('should fail when playit is not enabled', async () => {
      createInitializedPlatform(false); // playit disabled

      vi.mocked(shared.getPlayitAgentStatus).mockResolvedValueOnce({
        enabled: false,
        agentRunning: false,
        secretKeyConfigured: false,
        containerStatus: 'not_found',
      });

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'start',
      });

      expect(exitCode).toBe(1);
      expect(shared.startPlayitAgent).not.toHaveBeenCalled();
    });

    it('should start when key is configured but container never created (first start)', async () => {
      // This is the chicken-and-egg scenario: container doesn't exist yet
      // because it has never been started, but start should still work
      createInitializedPlatform(true, 'test-key-123');

      vi.mocked(shared.getPlayitAgentStatus).mockResolvedValueOnce({
        enabled: true, // Should be true based on config, not container existence
        agentRunning: false,
        secretKeyConfigured: true,
        containerStatus: 'not_found', // Container never created
      });

      vi.mocked(shared.startPlayitAgent).mockResolvedValueOnce({ success: true });

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'start',
      });

      expect(exitCode).toBe(0);
      expect(shared.startPlayitAgent).toHaveBeenCalled();
    });
  });

  describe('playit stop', () => {
    it('should stop playit-agent container', async () => {
      createInitializedPlatform(true, 'test-key');

      vi.mocked(shared.getPlayitAgentStatus).mockResolvedValueOnce({
        enabled: true,
        agentRunning: true,
        secretKeyConfigured: true,
        containerStatus: 'running',
      });

      vi.mocked(shared.stopPlayitAgent).mockResolvedValueOnce(true);

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'stop',
      });

      expect(exitCode).toBe(0);
      expect(shared.stopPlayitAgent).toHaveBeenCalled();
    });

    it('should succeed even if already stopped', async () => {
      createInitializedPlatform(true, 'test-key');

      vi.mocked(shared.getPlayitAgentStatus).mockResolvedValueOnce({
        enabled: true,
        agentRunning: false,
        secretKeyConfigured: true,
        containerStatus: 'exited',
      });

      vi.mocked(shared.stopPlayitAgent).mockResolvedValueOnce(true);

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'stop',
      });

      expect(exitCode).toBe(0);
    });
  });

  describe('playit status', () => {
    it('should show agent running status with configured key', async () => {
      createInitializedPlatform(true, 'test-key');

      vi.mocked(shared.getPlayitAgentStatus).mockResolvedValueOnce({
        enabled: true,
        agentRunning: true,
        secretKeyConfigured: true,
        containerStatus: 'running',
        uptime: '2h 15m',
      });

      vi.mocked(shared.getConfiguredServers).mockReturnValueOnce(['survival', 'creative']);
      vi.mocked(shared.getServerPlayitDomain)
        .mockReturnValueOnce('aa.example.com')
        .mockReturnValueOnce(null);

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'status',
      });

      expect(exitCode).toBe(0);
    });

    it('should show agent stopped status', async () => {
      createInitializedPlatform(true, 'test-key');

      vi.mocked(shared.getPlayitAgentStatus).mockResolvedValueOnce({
        enabled: true,
        agentRunning: false,
        secretKeyConfigured: true,
        containerStatus: 'exited',
      });

      vi.mocked(shared.getConfiguredServers).mockReturnValueOnce([]);

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'status',
      });

      expect(exitCode).toBe(0);
    });

    it('should show not configured status', async () => {
      createInitializedPlatform(false); // Not enabled

      vi.mocked(shared.getPlayitAgentStatus).mockResolvedValueOnce({
        enabled: false,
        agentRunning: false,
        secretKeyConfigured: false,
        containerStatus: 'not_found',
      });

      vi.mocked(shared.getConfiguredServers).mockReturnValueOnce([]);

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'status',
      });

      expect(exitCode).toBe(0);
    });

    it('should output JSON when --json flag is provided', async () => {
      createInitializedPlatform(true, 'test-key');

      vi.mocked(shared.getPlayitAgentStatus).mockResolvedValueOnce({
        enabled: true,
        agentRunning: true,
        secretKeyConfigured: true,
        containerStatus: 'running',
        uptime: '1h 30m',
      });

      vi.mocked(shared.getConfiguredServers).mockReturnValueOnce(['survival']);
      vi.mocked(shared.getServerPlayitDomain).mockReturnValueOnce('test.example.com');

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'status',
        json: true,
      });

      expect(exitCode).toBe(0);
    });
  });

  describe('playit setup', () => {
    it('should prompt for new SECRET_KEY and update .env', async () => {
      createInitializedPlatform(true, 'old-key');

      vi.mocked(shared.getPlayitAgentStatus).mockResolvedValueOnce({
        enabled: true,
        agentRunning: false,
        secretKeyConfigured: true,
        containerStatus: 'exited',
      });

      vi.mocked(promptsModule.password).mockResolvedValueOnce('new-secret-key-456');

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'setup',
      });

      expect(exitCode).toBe(0);
      expect(promptsModule.password).toHaveBeenCalled();

      const envPath = join(testRoot, '.env');
      const envContent = readFileSync(envPath, 'utf-8');
      expect(envContent).toContain('PLAYIT_SECRET_KEY=new-secret-key-456');
    });

    it('should create .env if it does not exist', async () => {
      createInitializedPlatform(false); // No secret key

      vi.mocked(shared.getPlayitAgentStatus).mockResolvedValueOnce({
        enabled: false,
        agentRunning: false,
        secretKeyConfigured: false,
        containerStatus: 'not_found',
      });

      vi.mocked(promptsModule.password).mockResolvedValueOnce('brand-new-key-789');

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'setup',
      });

      expect(exitCode).toBe(0);

      const envPath = join(testRoot, '.env');
      expect(existsSync(envPath)).toBe(true);

      const envContent = readFileSync(envPath, 'utf-8');
      expect(envContent).toContain('PLAYIT_SECRET_KEY=brand-new-key-789');
    });

    it('should add playit service to docker-compose.yml if missing', async () => {
      createInitializedPlatform(false);

      vi.mocked(shared.getPlayitAgentStatus).mockResolvedValueOnce({
        enabled: false,
        agentRunning: false,
        secretKeyConfigured: false,
        containerStatus: 'not_found',
      });

      vi.mocked(promptsModule.password).mockResolvedValueOnce('new-key-for-compose');

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'setup',
      });

      expect(exitCode).toBe(0);

      // Verify playit service was added to docker-compose.yml
      const composePath = join(testRoot, 'docker-compose.yml');
      const composeContent = readFileSync(composePath, 'utf-8');
      expect(composeContent).toContain('playit-agent');
      expect(composeContent).toContain('playit-cloud/playit-agent');
      expect(composeContent).toContain('PLAYIT_SECRET_KEY');
      expect(composeContent).toContain('profiles:');
    });

    it('should not duplicate playit service if already exists in docker-compose.yml', async () => {
      createInitializedPlatform(true, 'existing-key');

      // Add playit service to docker-compose.yml manually
      const composePath = join(testRoot, 'docker-compose.yml');
      const existingContent = readFileSync(composePath, 'utf-8');
      writeFileSync(composePath, existingContent + '\n  playit:\n    image: ghcr.io/playit-cloud/playit-agent:0.16\n', 'utf-8');

      vi.mocked(shared.getPlayitAgentStatus).mockResolvedValueOnce({
        enabled: true,
        agentRunning: false,
        secretKeyConfigured: true,
        containerStatus: 'exited',
      });

      vi.mocked(promptsModule.password).mockResolvedValueOnce('updated-key');

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'setup',
      });

      expect(exitCode).toBe(0);

      // Verify playit service appears only once
      const composeContent = readFileSync(composePath, 'utf-8');
      const matches = composeContent.match(/playit-cloud\/playit-agent/g);
      expect(matches?.length).toBe(1);
    });

    it('should handle user cancellation gracefully', async () => {
      createInitializedPlatform(true, 'test-key');

      vi.mocked(shared.getPlayitAgentStatus).mockResolvedValueOnce({
        enabled: true,
        agentRunning: false,
        secretKeyConfigured: true,
        containerStatus: 'exited',
      });

      // Create a cancel symbol
      const cancelSymbol = Symbol('cancel');
      vi.mocked(promptsModule.password).mockResolvedValueOnce(cancelSymbol as any);
      vi.mocked(promptsModule.isCancel).mockImplementation((value) => value === cancelSymbol);

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'setup',
      });

      expect(exitCode).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should return error for unknown subcommand', async () => {
      createInitializedPlatform(false);

      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'invalid' as any,
      });

      expect(exitCode).toBe(1);
    });

    it('should return error when platform is not initialized', async () => {
      // Don't create .mcctl.json
      const exitCode = await playitCommand({
        root: testRoot,
        subCommand: 'status',
      });

      expect(exitCode).toBe(1);
    });
  });
});
