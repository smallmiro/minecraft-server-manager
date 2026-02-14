import { describe, it, expect } from 'vitest';
import { generateBanner, CREEPER_ART, type BannerOptions } from '../../../src/lib/banner.js';

describe('banner', () => {
  describe('CREEPER_ART', () => {
    it('should be an 8x8 square array', () => {
      expect(CREEPER_ART).toHaveLength(8);
      for (const row of CREEPER_ART) {
        expect(row).toHaveLength(8);
      }
    });

    it('should contain only valid emoji characters', () => {
      const validChars = ['🟩', '⬛'];
      for (const row of CREEPER_ART) {
        for (const char of row) {
          expect(validChars).toContain(char);
        }
      }
    });
  });

  describe('generateBanner', () => {
    it('should include version information', () => {
      const options: BannerOptions = {
        version: '2.2.0',
        gitHash: 'abc1234',
      };

      const banner = generateBanner(options);

      expect(banner).toContain('mcctl');
      expect(banner).toContain('v2.2.0');
      expect(banner).toContain('abc1234');
    });

    it('should include description', () => {
      const options: BannerOptions = {
        version: '2.2.0',
      };

      const banner = generateBanner(options);

      expect(banner).toContain('Docker Minecraft Server');
      expect(banner).toContain('Controller CLI');
    });

    it('should include documentation URL', () => {
      const options: BannerOptions = {
        version: '2.2.0',
      };

      const banner = generateBanner(options);

      expect(banner).toContain('minecraft-server-manager.readthedocs.io');
    });

    it('should include update info when provided', () => {
      const options: BannerOptions = {
        version: '2.2.0',
        updateInfo: {
          currentVersion: '2.2.0',
          latestVersion: '2.3.0',
          updateCommand: 'npm install -g @minecraft-docker/mcctl',
        },
      };

      const banner = generateBanner(options);

      expect(banner).toContain('Update available');
      expect(banner).toContain('2.2.0');
      expect(banner).toContain('2.3.0');
      expect(banner).toContain('npm install -g @minecraft-docker/mcctl');
    });

    it('should not include update section when no update available', () => {
      const options: BannerOptions = {
        version: '2.2.0',
        updateInfo: null,
      };

      const banner = generateBanner(options);

      expect(banner).not.toContain('Update available');
    });

    it('should include creeper ASCII art', () => {
      const options: BannerOptions = {
        version: '2.2.0',
      };

      const banner = generateBanner(options);

      expect(banner).toContain('🟩');
      expect(banner).toContain('⬛');
    });

    it('should handle missing git hash gracefully', () => {
      const options: BannerOptions = {
        version: '2.2.0',
        gitHash: undefined,
      };

      const banner = generateBanner(options);

      expect(banner).toContain('v2.2.0');
      expect(banner).not.toContain('undefined');
    });
  });
});
