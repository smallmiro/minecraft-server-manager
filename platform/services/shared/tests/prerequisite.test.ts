import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';

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
    assert.strictEqual(satisfiesMinVersion('29.1.4', '24.0.0'), true);
  });

  test('should return true when minor version is higher', () => {
    assert.strictEqual(satisfiesMinVersion('2.40.3', '2.20.0'), true);
  });

  test('should return false when major version is lower', () => {
    assert.strictEqual(satisfiesMinVersion('23.0.0', '24.0.0'), false);
  });

  test('should return true when versions are exactly equal', () => {
    assert.strictEqual(satisfiesMinVersion('18.0.0', '18.0.0'), true);
  });

  test('should return false when minor version is lower', () => {
    assert.strictEqual(satisfiesMinVersion('2.19.9', '2.20.0'), false);
  });

  test('should return true when patch version is higher', () => {
    assert.strictEqual(satisfiesMinVersion('24.0.1', '24.0.0'), true);
  });

  test('should return false when patch version is lower', () => {
    assert.strictEqual(satisfiesMinVersion('24.0.0', '24.0.1'), false);
  });

  test('should handle two-part versions', () => {
    assert.strictEqual(satisfiesMinVersion('24.0', '24.0.0'), true);
    assert.strictEqual(satisfiesMinVersion('24.0.0', '24.0'), true);
  });
});

describe('checkPlatformPrerequisites', () => {
  test('should return 4 prerequisite results', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkPlatformPrerequisites();

    assert.strictEqual(report.results.length, 4);

    const names = report.results.map(r => r.name);
    assert.ok(names.includes('Node.js'), 'Should include Node.js');
    assert.ok(names.includes('Docker Engine'), 'Should include Docker Engine');
    assert.ok(names.includes('Docker Compose'), 'Should include Docker Compose');
    assert.ok(names.includes('avahi-daemon'), 'Should include avahi-daemon');
  });

  test('avahi should be optional', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkPlatformPrerequisites();

    const avahi = report.results.find(r => r.name === 'avahi-daemon');
    assert.ok(avahi, 'avahi-daemon should be in results');
    assert.strictEqual(avahi.optional, true);
  });

  test('Node.js, Docker, Docker Compose should not be optional', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkPlatformPrerequisites();

    for (const name of ['Node.js', 'Docker Engine', 'Docker Compose']) {
      const result = report.results.find(r => r.name === name);
      assert.ok(result, `${name} should be in results`);
      assert.strictEqual(result.optional, false, `${name} should not be optional`);
    }
  });

  test('Node.js should always be satisfied in test env', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkPlatformPrerequisites();

    const node = report.results.find(r => r.name === 'Node.js');
    assert.ok(node);
    assert.strictEqual(node.installed, true);
    assert.strictEqual(node.satisfied, true);
    assert.ok(node.version);
  });

  test('allSatisfied should reflect mandatory items only', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkPlatformPrerequisites();

    // allSatisfied = all non-optional items satisfied
    const mandatoryUnsatisfied = report.results.filter(r => !r.optional && !r.satisfied);
    assert.strictEqual(report.allSatisfied, mandatoryUnsatisfied.length === 0);
  });

  test('warnings should contain only unsatisfied optional items', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkPlatformPrerequisites();

    for (const w of report.warnings) {
      assert.strictEqual(w.optional, true, 'Warnings should only contain optional items');
      assert.strictEqual(w.satisfied, false, 'Warnings should only contain unsatisfied items');
    }
  });
});

describe('checkConsolePrerequisites', () => {
  test('should return 4 prerequisite results', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkConsolePrerequisites();

    assert.strictEqual(report.results.length, 4);

    const names = report.results.map(r => r.name);
    assert.ok(names.includes('Node.js'), 'Should include Node.js');
    assert.ok(names.includes('Docker Engine'), 'Should include Docker Engine');
    assert.ok(names.includes('Docker Compose'), 'Should include Docker Compose');
    assert.ok(names.includes('PM2'), 'Should include PM2');
  });

  test('all items should be mandatory (optional=false)', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkConsolePrerequisites();

    for (const result of report.results) {
      assert.strictEqual(result.optional, false, `${result.name} should not be optional`);
    }
  });

  test('each result should have required version string', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkConsolePrerequisites();

    for (const result of report.results) {
      assert.ok(result.required, `${result.name} should have required version`);
      assert.ok(result.required.startsWith('>= '), `${result.name} required should start with ">= "`);
    }
  });

  test('each result should have a hint', async () => {
    const mod = await import('../src/prerequisite/PrerequisiteChecker.js');
    const report = mod.checkConsolePrerequisites();

    for (const result of report.results) {
      assert.ok(result.hint, `${result.name} should have a hint`);
    }
  });
});

describe('getDockerVersion', () => {
  test('should return an object with installed boolean', async () => {
    const mod = await import('../src/docker/index.js');
    const result = mod.getDockerVersion();

    assert.ok(typeof result.installed === 'boolean');
    if (result.installed) {
      assert.ok(typeof result.version === 'string');
      assert.ok(result.version.length > 0);
    }
  });
});

describe('getDockerComposeVersion', () => {
  test('should return an object with installed boolean', async () => {
    const mod = await import('../src/docker/index.js');
    const result = mod.getDockerComposeVersion();

    assert.ok(typeof result.installed === 'boolean');
    if (result.installed) {
      assert.ok(typeof result.version === 'string');
      assert.ok(result.version.length > 0);
    }
  });
});
