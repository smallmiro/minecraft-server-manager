import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { CreateServerDialog } from './CreateServerDialog';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('CreateServerDialog', () => {
  it('should render when open is true', () => {
    renderWithTheme(
      <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Create New Server')).toBeInTheDocument();
  });

  it('should not render when open is false', () => {
    renderWithTheme(
      <CreateServerDialog open={false} onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render all form fields', () => {
    renderWithTheme(
      <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    expect(screen.getByLabelText(/server name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/server type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/minecraft version/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^memory$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sudo password/i)).toBeInTheDocument();
  });

  it('should call onClose when cancel button is clicked', () => {
    const onClose = vi.fn();
    renderWithTheme(
      <CreateServerDialog open={true} onClose={onClose} onSubmit={vi.fn()} />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should render dialog content when open', () => {
    renderWithTheme(
      <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    // Verify dialog content is rendered
    expect(screen.getByText('Create New Server')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should call onSubmit with form data when create button is clicked', async () => {
    const onSubmit = vi.fn();
    renderWithTheme(
      <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={onSubmit} />
    );

    // Fill in the form
    const nameInput = screen.getByLabelText(/server name/i);
    fireEvent.change(nameInput, { target: { value: 'my-server' } });

    const typeInput = screen.getByLabelText(/server type/i);
    fireEvent.mouseDown(typeInput);
    const paperOption = await screen.findByRole('option', { name: 'PAPER' });
    fireEvent.click(paperOption);

    const versionInput = screen.getByLabelText(/minecraft version/i);
    fireEvent.change(versionInput, { target: { value: '1.21.1' } });

    const memoryInput = screen.getByLabelText(/memory/i);
    fireEvent.change(memoryInput, { target: { value: '4G' } });

    // Submit the form
    const createButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'my-server',
        type: 'PAPER',
        version: '1.21.1',
        memory: '4G',
        autoStart: false,
        sudoPassword: '',
      });
    });
  });

  it('should show error when name is empty', async () => {
    const onSubmit = vi.fn();
    renderWithTheme(
      <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={onSubmit} />
    );

    const createButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      // The onSubmit should not be called when validation fails
      expect(onSubmit).not.toHaveBeenCalled();
      // The error message should appear
      expect(screen.getByText(/server name is required/i)).toBeInTheDocument();
    });
  });

  it('should show error when name contains invalid characters', async () => {
    renderWithTheme(
      <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    const nameInput = screen.getByLabelText(/server name/i);
    fireEvent.change(nameInput, { target: { value: 'my_server!' } });

    const createButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/only lowercase letters, numbers, and hyphens/i)).toBeInTheDocument();
    });
  });

  it('should render server type options', async () => {
    renderWithTheme(
      <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    const typeInput = screen.getByLabelText(/server type/i);
    fireEvent.mouseDown(typeInput);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'PAPER' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'VANILLA' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'FABRIC' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'FORGE' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'NEOFORGE' })).toBeInTheDocument();
    });
  });

  it('should show progress UI when creating', () => {
    renderWithTheme(
      <CreateServerDialog
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        loading={true}
        status="creating"
        progress={25}
        message="Creating server configuration..."
      />
    );

    // Should show progress stepper
    expect(screen.getByText('Creating')).toBeInTheDocument();
    expect(screen.getByText('Creating server configuration...')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('should set autoStart checkbox', async () => {
    const onSubmit = vi.fn();
    renderWithTheme(
      <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={onSubmit} />
    );

    const nameInput = screen.getByLabelText(/server name/i);
    fireEvent.change(nameInput, { target: { value: 'test' } });

    const autoStartCheckbox = screen.getByLabelText(/auto-start after creation/i);
    fireEvent.click(autoStartCheckbox);

    const createButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          autoStart: true,
        })
      );
    });
  });

  it('should include sudoPassword in form submission when provided', async () => {
    const onSubmit = vi.fn();
    renderWithTheme(
      <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={onSubmit} />
    );

    const nameInput = screen.getByLabelText(/server name/i);
    fireEvent.change(nameInput, { target: { value: 'test-server' } });

    const passwordInput = screen.getByLabelText(/sudo password/i);
    fireEvent.change(passwordInput, { target: { value: 'test-pass' } });

    const createButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-server',
          sudoPassword: 'test-pass',
        })
      );
    });
  });

  it('should render sudo password field with helper text', () => {
    renderWithTheme(
      <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    expect(screen.getByLabelText(/sudo password/i)).toBeInTheDocument();
    expect(screen.getByText(/required for mdns hostname registration/i)).toBeInTheDocument();
  });

  it('should reset form when dialog is closed', async () => {
    const { rerender } = renderWithTheme(
      <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    // Fill in the form
    const nameInput = screen.getByLabelText(/server name/i);
    fireEvent.change(nameInput, { target: { value: 'test-server' } });

    // Close and reopen
    rerender(
      <ThemeProvider>
        <CreateServerDialog open={false} onClose={vi.fn()} onSubmit={vi.fn()} />
      </ThemeProvider>
    );

    rerender(
      <ThemeProvider>
        <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
      </ThemeProvider>
    );

    // Form should be reset
    const newNameInput = screen.getByLabelText(/server name/i) as HTMLInputElement;
    expect(newNameInput.value).toBe('');
  });
});
