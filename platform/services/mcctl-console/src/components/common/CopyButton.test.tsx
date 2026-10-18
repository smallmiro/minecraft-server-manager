import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { CopyButton } from './CopyButton';

const setClipboard = (value: unknown) =>
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
const renderBtn = () =>
  render(
    <ThemeProvider>
      <CopyButton text="192.168.1.10:25565" />
    </ThemeProvider>
  );

afterEach(() => setClipboard(undefined));

describe('CopyButton', () => {
  it('copies via execCommand fallback on insecure context and shows Copied', async () => {
    setClipboard(undefined);
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec;
    renderBtn();
    fireEvent.click(screen.getByLabelText('Copy to clipboard'));
    await waitFor(() => expect(screen.getByLabelText('Copied')).toBeInTheDocument());
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('shows a visible failure state when copying fails', async () => {
    setClipboard(undefined);
    document.execCommand = vi.fn().mockReturnValue(false);
    renderBtn();
    fireEvent.click(screen.getByLabelText('Copy to clipboard'));
    await waitFor(() => expect(screen.getByLabelText('Copy failed')).toBeInTheDocument());
  });
});
