import { describe, it } from 'node:test';
import * as assert from 'node:assert';

// Test that @clack/prompts can be imported
describe('@clack/prompts dependency', () => {
  it('should be importable', async () => {
    const clack = await import('@clack/prompts');
    assert.ok(clack, '@clack/prompts should be importable');
    assert.ok(typeof clack.text === 'function', 'text function should exist');
    assert.ok(typeof clack.select === 'function', 'select function should exist');
    assert.ok(typeof clack.confirm === 'function', 'confirm function should exist');
    assert.ok(typeof clack.spinner === 'function', 'spinner function should exist');
    assert.ok(typeof clack.intro === 'function', 'intro function should exist');
    assert.ok(typeof clack.outro === 'function', 'outro function should exist');
  });

  it('should have isCancel helper', async () => {
    const clack = await import('@clack/prompts');
    assert.ok(typeof clack.isCancel === 'function', 'isCancel function should exist');
  });
});

// Test that picocolors can be imported
describe('picocolors dependency', () => {
  it('should be importable', async () => {
    const pc = await import('picocolors');
    assert.ok(pc, 'picocolors should be importable');
    assert.ok(typeof pc.default.green === 'function', 'green function should exist');
    assert.ok(typeof pc.default.red === 'function', 'red function should exist');
    assert.ok(typeof pc.default.cyan === 'function', 'cyan function should exist');
    assert.ok(typeof pc.default.bold === 'function', 'bold function should exist');
  });
});
