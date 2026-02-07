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

  describe('Server Category Toggle', () => {
    it('should render category toggle with Standard and Modpack options', () => {
      renderWithTheme(
        <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
      );

      // Category toggle should be present with aria-label
      const categoryToggle = screen.getByRole('group', { name: /server category/i });
      expect(categoryToggle).toBeInTheDocument();

      // Both category buttons should be present
      expect(screen.getByRole('button', { name: /standard server/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /modpack/i })).toBeInTheDocument();
    });

    it('should default to Standard category', () => {
      renderWithTheme(
        <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
      );

      const standardButton = screen.getByRole('button', { name: /standard server/i });
      expect(standardButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should switch to Modpack category when clicked', () => {
      renderWithTheme(
        <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
      );

      const modpackButton = screen.getByRole('button', { name: /modpack/i });
      fireEvent.click(modpackButton);

      expect(modpackButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should show standard server types when Standard category is selected', () => {
      renderWithTheme(
        <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
      );

      // Server Type field should be visible in Standard mode
      expect(screen.getByLabelText(/server type/i)).toBeInTheDocument();

      // Modpack Slug field should not be visible
      expect(screen.queryByLabelText(/modpack slug/i)).not.toBeInTheDocument();
    });

    it('should show modpack fields when Modpack category is selected', async () => {
      renderWithTheme(
        <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
      );

      const modpackButton = screen.getByRole('button', { name: /modpack/i });
      fireEvent.click(modpackButton);

      // Wait for Collapse animation
      await waitFor(() => {
        // Modpack fields should be visible
        expect(screen.getByLabelText(/modpack slug/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/mod loader/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/modpack version/i)).toBeInTheDocument();

        // Standard fields should not be visible
        expect(screen.queryByLabelText(/server type/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/minecraft version/i)).not.toBeInTheDocument();
      });
    });

    it('should show info alert about auto-detected version in Modpack mode', async () => {
      renderWithTheme(
        <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
      );

      const modpackButton = screen.getByRole('button', { name: /modpack/i });
      fireEvent.click(modpackButton);

      await waitFor(() => {
        expect(screen.getByText(/minecraft version is automatically determined by the modpack/i)).toBeInTheDocument();
      });
    });
  });

  describe('Memory Default Values', () => {
    it('should default to 4G memory for Standard servers', () => {
      renderWithTheme(
        <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
      );

      const memoryInput = screen.getByLabelText(/^memory$/i) as HTMLInputElement;
      expect(memoryInput.value).toBe('4G');
    });

    it('should change to 6G memory when switching to Modpack category', async () => {
      renderWithTheme(
        <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
      );

      const modpackButton = screen.getByRole('button', { name: /modpack/i });
      fireEvent.click(modpackButton);

      await waitFor(() => {
        const memoryInput = screen.getByLabelText(/^memory$/i) as HTMLInputElement;
        expect(memoryInput.value).toBe('6G');
      });
    });

    it('should preserve user-modified memory value when switching categories', async () => {
      renderWithTheme(
        <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
      );

      // User manually sets memory
      const memoryInput = screen.getByLabelText(/^memory$/i);
      fireEvent.change(memoryInput, { target: { value: '8G' } });

      // Switch to Modpack
      const modpackButton = screen.getByRole('button', { name: /modpack/i });
      fireEvent.click(modpackButton);

      // Memory should remain 8G (user-modified)
      await waitFor(() => {
        const memoryInputAfter = screen.getByLabelText(/^memory$/i) as HTMLInputElement;
        expect(memoryInputAfter.value).toBe('8G');
      });
    });
  });

  describe('Modpack Form Validation', () => {
    it('should require modpack slug when submitting in Modpack mode', async () => {
      const onSubmit = vi.fn();
      renderWithTheme(
        <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={onSubmit} />
      );

      const modpackButton = screen.getByRole('button', { name: /modpack/i });
      fireEvent.click(modpackButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/modpack slug/i)).toBeInTheDocument();
      });

      // Fill only server name
      const nameInput = screen.getByLabelText(/server name/i);
      fireEvent.change(nameInput, { target: { value: 'test-server' } });

      // Submit without modpack slug
      const createButton = screen.getByRole('button', { name: /create/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText(/modpack slug is required/i)).toBeInTheDocument();
      });
    });

    it('should submit successfully with valid modpack data', async () => {
      const onSubmit = vi.fn();
      renderWithTheme(
        <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={onSubmit} />
      );

      const modpackButton = screen.getByRole('button', { name: /modpack/i });
      fireEvent.click(modpackButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/modpack slug/i)).toBeInTheDocument();
      });

      // Fill modpack form
      const nameInput = screen.getByLabelText(/server name/i);
      fireEvent.change(nameInput, { target: { value: 'cobblemon-server' } });

      const slugInput = screen.getByLabelText(/modpack slug/i);
      fireEvent.change(slugInput, { target: { value: 'cobblemon' } });

      // Submit
      const createButton = screen.getByRole('button', { name: /create/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          name: 'cobblemon-server',
          type: 'MODRINTH',
          modpack: 'cobblemon',
          modpackVersion: '',
          modLoader: '',
          memory: '6G',
          autoStart: false,
          sudoPassword: '',
        });
      });
    });

    it('should include optional modpack fields when provided', async () => {
      const onSubmit = vi.fn();
      renderWithTheme(
        <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={onSubmit} />
      );

      const modpackButton = screen.getByRole('button', { name: /modpack/i });
      fireEvent.click(modpackButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/modpack slug/i)).toBeInTheDocument();
      });

      // Fill all modpack fields
      const nameInput = screen.getByLabelText(/server name/i);
      fireEvent.change(nameInput, { target: { value: 'test-server' } });

      const slugInput = screen.getByLabelText(/modpack slug/i);
      fireEvent.change(slugInput, { target: { value: 'adrenaserver' } });

      const versionInput = screen.getByLabelText(/modpack version/i);
      fireEvent.change(versionInput, { target: { value: '1.0.0' } });

      const loaderInput = screen.getByLabelText(/mod loader/i);
      fireEvent.mouseDown(loaderInput);
      const forgeOption = await screen.findByRole('option', { name: 'forge' });
      fireEvent.click(forgeOption);

      // Submit
      const createButton = screen.getByRole('button', { name: /create/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          name: 'test-server',
          type: 'MODRINTH',
          modpack: 'adrenaserver',
          modpackVersion: '1.0.0',
          modLoader: 'forge',
          memory: '6G',
          autoStart: false,
          sudoPassword: '',
        });
      });
    });
  });

  describe('Accessibility', () => {
    it('should move focus to first modpack field after category switch', async () => {
      renderWithTheme(
        <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
      );

      const modpackButton = screen.getByRole('button', { name: /modpack/i });
      fireEvent.click(modpackButton);

      // Wait for Collapse animation (300ms) + focus delay
      await waitFor(
        () => {
          const slugInput = screen.getByLabelText(/modpack slug/i);
          expect(slugInput).toHaveFocus();
        },
        { timeout: 1000 }
      );
    });

    it('should have aria-live region for category changes', () => {
      renderWithTheme(
        <CreateServerDialog open={true} onClose={vi.fn()} onSubmit={vi.fn()} />
      );

      // Check for aria-live region
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });
  });
});
