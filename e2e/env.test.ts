import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTargets } from './env.ts';

test('throws with setup instructions when neither URL is set', () => {
  assert.throws(() => resolveTargets({}), /E2E_BASE_URL.*E2E_API_URL/s);
});

test('throws when only one URL is set', () => {
  assert.throws(() => resolveTargets({ E2E_BASE_URL: 'http://x:1' }), /E2E_API_URL/);
  assert.throws(() => resolveTargets({ E2E_API_URL: 'http://x:2' }), /E2E_BASE_URL/);
});

test('treats empty strings as unset', () => {
  assert.throws(() => resolveTargets({ E2E_BASE_URL: '', E2E_API_URL: '' }));
});

test('returns both URLs when set', () => {
  assert.deepEqual(resolveTargets({ E2E_BASE_URL: 'http://x:1', E2E_API_URL: 'http://x:2' }), {
    baseURL: 'http://x:1',
    apiURL: 'http://x:2',
  });
});
