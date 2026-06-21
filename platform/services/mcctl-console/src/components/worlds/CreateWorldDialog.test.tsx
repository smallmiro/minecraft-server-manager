import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { CreateWorldDialog } from './CreateWorldDialog';
import type { CreateWorldRequest } from '@/ports/api/IMcctlApiClient';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('CreateWorldDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // Basic rendering
  // ----------------------------------------------------------------

  it('renders when open is true', () => {
    renderWithTheme(<CreateWorldDialog {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Create New World')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    renderWithTheme(<CreateWorldDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders world name, seed, server-type select, and guidance alert', () => {
    renderWithTheme(<CreateWorldDialog {...defaultProps} />);

    expect(screen.getByLabelText(/world name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/seed/i)).toBeInTheDocument();
    // Server type select
    expect(screen.getByLabelText(/server type/i)).toBeInTheDocument();
    // Guidance alert (info role in MUI Alert)
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // Loader guidance
  // ----------------------------------------------------------------

  it('shows single-folder guidance for VANILLA by default', () => {
    renderWithTheme(<CreateWorldDialog {...defaultProps} />);
    expect(
      screen.getByText(/level\.dat/i)
    ).toBeInTheDocument();
    // Should NOT show split-folder language by default
    expect(
      screen.queryByText(/all three folders together/i)
    ).not.toBeInTheDocument();
  });

  it('shows split-folder guidance when PAPER is selected', async () => {
    renderWithTheme(<CreateWorldDialog {...defaultProps} />);

    const select = screen.getByLabelText(/server type/i);
    fireEvent.mouseDown(select);

    // Wait for the MUI dropdown to appear
    const paperOption = await screen.findByRole('option', { name: 'PAPER' });
    fireEvent.click(paperOption);

    await waitFor(() => {
      expect(screen.getByText(/all three folders together/i)).toBeInTheDocument();
    });
  });

  it('shows single-folder guidance with mod suffix for FORGE', async () => {
    renderWithTheme(<CreateWorldDialog {...defaultProps} />);

    const select = screen.getByLabelText(/server type/i);
    fireEvent.mouseDown(select);

    const forgeOption = await screen.findByRole('option', { name: 'FORGE' });
    fireEvent.click(forgeOption);

    await waitFor(() => {
      // Should show base single-folder text
      expect(screen.getByText(/level\.dat/i)).toBeInTheDocument();
      // AND mod split suffix
      expect(screen.getByText(/depending on your modpack/i)).toBeInTheDocument();
    });
  });

  it('shows split-folder guidance for SPIGOT', async () => {
    renderWithTheme(<CreateWorldDialog {...defaultProps} />);

    const select = screen.getByLabelText(/server type/i);
    fireEvent.mouseDown(select);

    const spigotOption = await screen.findByRole('option', { name: 'SPIGOT' });
    fireEvent.click(spigotOption);

    await waitFor(() => {
      expect(screen.getByText(/all three folders together/i)).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------------
  // Zip file selection
  // ----------------------------------------------------------------

  it('hides Seed field when a zip file is selected', async () => {
    renderWithTheme(<CreateWorldDialog {...defaultProps} />);

    // Seed should be visible initially
    expect(screen.getByLabelText(/seed/i)).toBeInTheDocument();

    // Simulate file selection via the hidden input
    const fileInput = screen.getByTestId('zip-file-input');
    const zipFile = new File(['zip content'], 'world.zip', { type: 'application/zip' });
    fireEvent.change(fileInput, { target: { files: [zipFile] } });

    await waitFor(() => {
      expect(screen.queryByLabelText(/seed/i)).not.toBeInTheDocument();
    });
  });

  it('shows selected zip filename in the drop-zone', async () => {
    renderWithTheme(<CreateWorldDialog {...defaultProps} />);

    const fileInput = screen.getByTestId('zip-file-input');
    const zipFile = new File(['content'], 'my-world.zip', { type: 'application/zip' });
    fireEvent.change(fileInput, { target: { files: [zipFile] } });

    await waitFor(() => {
      expect(screen.getByText('my-world.zip')).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------------
  // Submit behavior
  // ----------------------------------------------------------------

  it('calls onSubmit with data and zipFile as 2nd arg when a zip is selected', async () => {
    const onSubmit = vi.fn();
    renderWithTheme(<CreateWorldDialog {...defaultProps} onSubmit={onSubmit} />);

    // Set world name
    const nameInput = screen.getByLabelText(/world name/i);
    fireEvent.change(nameInput, { target: { value: 'test-world' } });

    // Select a zip
    const fileInput = screen.getByTestId('zip-file-input');
    const zipFile = new File(['content'], 'test.zip', { type: 'application/zip' });
    fireEvent.change(fileInput, { target: { files: [zipFile] } });

    // Submit
    const submitButton = screen.getByRole('button', { name: /import/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const [requestArg, zipArg] = onSubmit.mock.calls[0] as [CreateWorldRequest, File];
      expect(requestArg.name).toBe('test-world');
      expect(zipArg).toBe(zipFile);
    });
  });

  it('calls onSubmit with data and no 2nd arg when no zip is selected', async () => {
    const onSubmit = vi.fn();
    renderWithTheme(<CreateWorldDialog {...defaultProps} onSubmit={onSubmit} />);

    // Set world name and seed
    fireEvent.change(screen.getByLabelText(/world name/i), {
      target: { value: 'plain-world' },
    });
    fireEvent.change(screen.getByLabelText(/seed/i), {
      target: { value: '12345' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const [requestArg, zipArg] = onSubmit.mock.calls[0] as [CreateWorldRequest, File | undefined];
      expect(requestArg.name).toBe('plain-world');
      expect(requestArg.seed).toBe('12345');
      expect(zipArg).toBeUndefined();
    });
  });

  it('validates world name on submit', async () => {
    const onSubmit = vi.fn();
    renderWithTheme(<CreateWorldDialog {...defaultProps} onSubmit={onSubmit} />);

    // Leave name empty and submit
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText(/world name is required/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('validates world name format', async () => {
    const onSubmit = vi.fn();
    renderWithTheme(<CreateWorldDialog {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/world name/i), {
      target: { value: 'Invalid Name!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/only lowercase letters, numbers, and hyphens/i)
      ).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // Reset on close
  // ----------------------------------------------------------------

  it('resets form state when closed and reopened', async () => {
    const { rerender } = renderWithTheme(<CreateWorldDialog {...defaultProps} />);

    // Enter a name and select a zip
    fireEvent.change(screen.getByLabelText(/world name/i), {
      target: { value: 'some-world' },
    });
    const fileInput = screen.getByTestId('zip-file-input');
    fireEvent.change(fileInput, { target: { files: [new File([''], 'world.zip')] } });

    // Close the dialog
    rerender(
      <ThemeProvider>
        <CreateWorldDialog {...defaultProps} open={false} />
      </ThemeProvider>
    );

    // Reopen
    rerender(
      <ThemeProvider>
        <CreateWorldDialog {...defaultProps} open={true} />
      </ThemeProvider>
    );

    // Name should be cleared
    expect(screen.getByLabelText(/world name/i)).toHaveValue('');
    // Seed should be visible again (zip removed)
    expect(screen.getByLabelText(/seed/i)).toBeInTheDocument();
  });
});
