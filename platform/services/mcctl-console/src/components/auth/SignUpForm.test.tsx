import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { SignUpForm } from './SignUpForm';

// Mock auth client
vi.mock('@/lib/auth-client', () => ({
  signUp: {
    email: vi.fn(),
  },
}));

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('SignUpForm', () => {
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render name, email and password fields', () => {
    renderWithTheme(<SignUpForm onSuccess={mockOnSuccess} />);

    expect(screen.getByLabelText(/^name \*$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email \*$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password \*$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^confirm password \*$/i)).toBeInTheDocument();
  });

  it('should render sign up button', () => {
    renderWithTheme(<SignUpForm onSuccess={mockOnSuccess} />);

    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('should show validation error for empty name', async () => {
    renderWithTheme(<SignUpForm onSuccess={mockOnSuccess} />);

    const submitButton = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });

  it('should show validation error for empty email', async () => {
    renderWithTheme(<SignUpForm onSuccess={mockOnSuccess} />);

    const nameInput = screen.getByLabelText(/^name \*$/i);
    fireEvent.change(nameInput, { target: { value: 'Test User' } });

    const submitButton = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  it('should show validation error for invalid email format', async () => {
    renderWithTheme(<SignUpForm onSuccess={mockOnSuccess} />);

    const nameInput = screen.getByLabelText(/^name \*$/i);
    const emailInput = screen.getByLabelText(/^email \*$/i);

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const submitButton = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument();
    });
  });

  it('should show validation error for short password', async () => {
    renderWithTheme(<SignUpForm onSuccess={mockOnSuccess} />);

    const nameInput = screen.getByLabelText(/^name \*$/i);
    const emailInput = screen.getByLabelText(/^email \*$/i);
    const passwordInput = screen.getByLabelText(/^password \*$/i);

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '12345' } });

    const submitButton = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('should show validation error for mismatched passwords', async () => {
    renderWithTheme(<SignUpForm onSuccess={mockOnSuccess} />);

    const nameInput = screen.getByLabelText(/^name \*$/i);
    const emailInput = screen.getByLabelText(/^email \*$/i);
    const passwordInput = screen.getByLabelText(/^password \*$/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm password \*$/i);

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password456' } });

    const submitButton = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('should call signUp with valid data', async () => {
    const { signUp } = await import('@/lib/auth-client');
    (signUp.email as any).mockResolvedValue({ data: { user: { id: '1' } }, error: null });

    renderWithTheme(<SignUpForm onSuccess={mockOnSuccess} />);

    const nameInput = screen.getByLabelText(/^name \*$/i);
    const emailInput = screen.getByLabelText(/^email \*$/i);
    const passwordInput = screen.getByLabelText(/^password \*$/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm password \*$/i);

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(signUp.email).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });
    });
  });

  it('should show loading state during submission', async () => {
    const { signUp } = await import('@/lib/auth-client');
    (signUp.email as any).mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithTheme(<SignUpForm onSuccess={mockOnSuccess} />);

    const nameInput = screen.getByLabelText(/^name \*$/i);
    const emailInput = screen.getByLabelText(/^email \*$/i);
    const passwordInput = screen.getByLabelText(/^password \*$/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm password \*$/i);

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it('should show error message on registration failure', async () => {
    const { signUp } = await import('@/lib/auth-client');
    (signUp.email as any).mockResolvedValue({
      data: null,
      error: { message: 'Email already exists' },
    });

    renderWithTheme(<SignUpForm onSuccess={mockOnSuccess} />);

    const nameInput = screen.getByLabelText(/^name \*$/i);
    const emailInput = screen.getByLabelText(/^email \*$/i);
    const passwordInput = screen.getByLabelText(/^password \*$/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm password \*$/i);

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });

  it('should call onSuccess after successful signup', async () => {
    const { signUp } = await import('@/lib/auth-client');
    (signUp.email as any).mockResolvedValue({ data: { user: { id: '1' } }, error: null });

    renderWithTheme(<SignUpForm onSuccess={mockOnSuccess} />);

    const nameInput = screen.getByLabelText(/^name \*$/i);
    const emailInput = screen.getByLabelText(/^email \*$/i);
    const passwordInput = screen.getByLabelText(/^password \*$/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm password \*$/i);

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should toggle password visibility', () => {
    renderWithTheme(<SignUpForm onSuccess={mockOnSuccess} />);

    const passwordInput = screen.getByLabelText(/^password \*$/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const toggleButtons = screen.getAllByLabelText(/toggle password visibility/i);
    fireEvent.click(toggleButtons[0]);

    expect(passwordInput.type).toBe('text');

    fireEvent.click(toggleButtons[0]);
    expect(passwordInput.type).toBe('password');
  });
});
