import { describe, test, expect, beforeEach } from 'vitest';

// We test satisfiesMinVersion as a pure function
// and checkPlatformPrerequisites / checkConsolePrerequisites via mocking

describe('satisfiesMinVersion', () => {
  // We import the function dynamically to allow mocking later
  let satisfiesMinVersion: (actual: string, required: string) => boolean;

  beforeEach(async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    satisfiesMinVersion = mod.satisfiesMinVersion;
  });

  test('should return true when major version is higher', () => {
    expect(satisfiesMinVersion('29.1.4', '24.0.0')).toBe(true);
  });

  test('should return true when minor version is higher', () => {
    expect(satisfiesMinVersion('2.40.3', '2.20.0')).toBe(true);
  });

  test('should return false when major version is lower', () => {
    expect(satisfiesMinVersion('23.0.0', '24.0.0')).toBe(false);
  });

  test('should return true when versions are exactly equal', () => {
    expect(satisfiesMinVersion('18.0.0', '18.0.0')).toBe(true);
  });

  test('should return false when minor version is lower', () => {
    expect(satisfiesMinVersion('2.19.9', '2.20.0')).toBe(false);
  });

  test('should return true when patch version is higher', () => {
    expect(satisfiesMinVersion('24.0.1', '24.0.0')).toBe(true);
  });

  test('should return false when patch version is lower', () => {
    expect(satisfiesMinVersion('24.0.0', '24.0.1')).toBe(false);
  });

  test('should handle two-part versions', () => {
    expect(satisfiesMinVersion('24.0', '24.0.0')).toBe(true);
    expect(satisfiesMinVersion('24.0.0', '24.0')).toBe(true);
  });
});

describe('checkPlatformPrerequisites', () => {
  test('should return 4 prerequisite results', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkPlatformPrerequisites();

    expect(report.results.length).toBe(4);

    const names = report.results.map(r => r.name);
    expect(names.includes('Node.js')).toBeTruthy();
    expect(names.includes('Docker Engine')).toBeTruthy();
    expect(names.includes('Docker Compose')).toBeTruthy();
    expect(names.includes('avahi-daemon')).toBeTruthy();
  });

  test('avahi should be optional', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkPlatformPrerequisites();

    const avahi = report.results.find(r => r.name === 'avahi-daemon');
    expect(avahi).toBeTruthy();
    expect(avahi!.optional).toBe(true);
  });

  test('Node.js, Docker, Docker Compose should not be optional', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkPlatformPrerequisites();

    for (const name of ['Node.js', 'Docker Engine', 'Docker Compose']) {
      const result = report.results.find(r => r.name === name);
      expect(result).toBeTruthy();
      expect(result!.optional).toBe(false);
    }
  });

  test('Node.js should always be satisfied in test env', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkPlatformPrerequisites();

    const node = report.results.find(r => r.name === 'Node.js');
    expect(node).toBeTruthy();
    expect(node!.installed).toBe(true);
    expect(node!.satisfied).toBe(true);
    expect(node!.version).toBeTruthy();
  });

  test('allSatisfied should reflect mandatory items only', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkPlatformPrerequisites();

    // allSatisfied = all non-optional items satisfied
    const mandatoryUnsatisfied = report.results.filter(r => !r.optional && !r.satisfied);
    expect(report.allSatisfied).toBe(mandatoryUnsatisfied.length === 0);
  });

  test('warnings should contain only unsatisfied optional items', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkPlatformPrerequisites();

    for (const w of report.warnings) {
      expect(w.optional).toBe(true);
      expect(w.satisfied).toBe(false);
    }
  });
});

describe('checkConsolePrerequisites', () => {
  test('should return 4 prerequisite results', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkConsolePrerequisites();

    expect(report.results.length).toBe(4);

    const names = report.results.map(r => r.name);
    expect(names.includes('Node.js')).toBeTruthy();
    expect(names.includes('Docker Engine')).toBeTruthy();
    expect(names.includes('Docker Compose')).toBeTruthy();
    expect(names.includes('PM2')).toBeTruthy();
  });

  test('all items should be mandatory (optional=false)', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkConsolePrerequisites();

    for (const result of report.results) {
      expect(result.optional).toBe(false);
    }
  });

  test('each result should have required version string', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkConsolePrerequisites();

    for (const result of report.results) {
      expect(result.required).toBeTruthy();
      expect(result.required.startsWith('>= ')).toBeTruthy();
    }
  });

  test('each result should have a hint', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkConsolePrerequisites();

    for (const result of report.results) {
      expect(result.hint).toBeTruthy();
    }
  });
});

describe('getDockerVersion', () => {
  test('should return an object with installed boolean', async () => {
    const mod = await import('../src/docker/index.js');
    const result = mod.getDockerVersion();

    expect(typeof result.installed === 'boolean').toBeTruthy();
    if (result.installed) {
      expect(typeof result.version === 'string').toBeTruthy();
      expect(result.version!.length > 0).toBeTruthy();
    }
  });
});

describe('getDockerComposeVersion', () => {
  test('should return an object with installed boolean', async () => {
    const mod = await import('../src/docker/index.js');
    const result = mod.getDockerComposeVersion();

    expect(typeof result.installed === 'boolean').toBeTruthy();
    if (result.installed) {
      expect(typeof result.version === 'string').toBeTruthy();
      expect(result.version!.length > 0).toBeTruthy();
    }
  });
});
