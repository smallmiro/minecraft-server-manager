import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyToClipboard } from './clipboard';

const setClipboard = (value: unknown) =>
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });

describe('copyToClipboard', () => {
  afterEach(() => {
    setClipboard(undefined);
    vi.restoreAllMocks();
  });

  it('uses navigator.clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    expect(await copyToClipboard('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to execCommand when navigator.clipboard is missing (insecure context)', async () => {
    setClipboard(undefined);
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec;
    expect(await copyToClipboard('hello')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back to execCommand when writeText rejects', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec;
    expect(await copyToClipboard('x')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('returns false when every strategy fails', async () => {
    setClipboard(undefined);
    document.execCommand = vi.fn().mockReturnValue(false);
    expect(await copyToClipboard('x')).toBe(false);
    document.execCommand = vi.fn(() => {
      throw new Error('nope');
    });
    expect(await copyToClipboard('x')).toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });
});
