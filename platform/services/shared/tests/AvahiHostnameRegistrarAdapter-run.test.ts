import { describe, it, expect } from 'vitest';
import { run } from '../src/infrastructure/adapters/AvahiHostnameRegistrarAdapter.js';

describe('AvahiHostnameRegistrarAdapter run()', () => {
  it('resolves the exit code when the child exits before reading stdin (no EPIPE crash)', async () => {
    // sudo -n exits at once when it refuses; stdin.end() then writes to a closed pipe.
    // A large input makes the write outlive the child every time.
    await expect(run('sh', ['-c', 'exit 3'], 'x'.repeat(4 * 1024 * 1024))).resolves.toBe(3);
  });

  it('kills a command that hangs past the timeout and resolves -1 (#672)', async () => {
    const started = Date.now();
    await expect(run('sleep', ['5'], undefined, { timeoutMs: 100 })).resolves.toBe(-1);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
