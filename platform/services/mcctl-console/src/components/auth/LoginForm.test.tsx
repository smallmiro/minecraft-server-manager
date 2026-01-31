import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { LoginForm } from './LoginForm';

// Mock auth client
vi.mock('@/lib/auth-client', () => ({
  signIn: {
    email: vi.fn(),
  },
}));

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('LoginForm', () => {
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render email and password fields', () => {
    renderWithTheme(<LoginForm onSuccess={mockOnSuccess} />);

    expect(screen.getByLabelText(/^email \*$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password \*$/i)).toBeInTheDocument();
  });

  it('should render login button', () => {
    renderWithTheme(<LoginForm onSuccess={mockOnSuccess} />);

    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should show validation error for empty email', async () => {
    renderWithTheme(<LoginForm onSuccess={mockOnSuccess} />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  it('should show validation error for invalid email format', async () => {
    renderWithTheme(<LoginForm onSuccess={mockOnSuccess} />);

    const emailInput = screen.getByLabelText(/^email \*$/i);
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument();
    });
  });

  it('should show validation error for empty password', async () => {
    renderWithTheme(<LoginForm onSuccess={mockOnSuccess} />);

    const emailInput = screen.getByLabelText(/^email \*$/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('should call signIn with valid credentials', async () => {
    const { signIn } = await import('@/lib/auth-client');
    (signIn.email as any).mockResolvedValue({ data: { user: { id: '1' } }, error: null });

    renderWithTheme(<LoginForm onSuccess={mockOnSuccess} />);

    const emailInput = screen.getByLabelText(/^email \*$/i);
    const passwordInput = screen.getByLabelText(/^password \*$/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(signIn.email).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('should show loading state during submission', async () => {
    const { signIn } = await import('@/lib/auth-client');
    (signIn.email as any).mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithTheme(<LoginForm onSuccess={mockOnSuccess} />);

    const emailInput = screen.getByLabelText(/^email \*$/i);
    const passwordInput = screen.getByLabelText(/^password \*$/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it('should show error message on authentication failure', async () => {
    const { signIn } = await import('@/lib/auth-client');
    (signIn.email as any).mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials' },
    });

    renderWithTheme(<LoginForm onSuccess={mockOnSuccess} />);

    const emailInput = screen.getByLabelText(/^email \*$/i);
    const passwordInput = screen.getByLabelText(/^password \*$/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong-password' } });

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('should call onSuccess after successful login', async () => {
    const { signIn } = await import('@/lib/auth-client');
    (signIn.email as any).mockResolvedValue({ data: { user: { id: '1' } }, error: null });

    renderWithTheme(<LoginForm onSuccess={mockOnSuccess} />);

    const emailInput = screen.getByLabelText(/^email \*$/i);
    const passwordInput = screen.getByLabelText(/^password \*$/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should toggle password visibility', () => {
    renderWithTheme(<LoginForm onSuccess={mockOnSuccess} />);

    const passwordInput = screen.getByLabelText(/^password \*$/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const toggleButton = screen.getByLabelText(/toggle password visibility/i);
    fireEvent.click(toggleButton);

    expect(passwordInput.type).toBe('text');

    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('password');
  });
});
