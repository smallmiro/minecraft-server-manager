import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignUpPage from './page';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
}));

vi.mock('@/components/auth', () => ({
  SignUpForm: ({ onSuccess }: { onSuccess: () => void }) => (
    <button onClick={onSuccess}>Complete signup</button>
  ),
}));

describe('SignUpPage', () => {
  beforeEach(() => navigation.push.mockReset());

  it('renders one heading, one centered Bento panel, and the login link', () => {
    render(<SignUpPage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByTestId('auth-panel')).toHaveLength(1);
    expect(screen.getByTestId('auth-shell')).toContainElement(screen.getByTestId('auth-panel'));
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('keeps the signup success redirect', () => {
    render(<SignUpPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Complete signup' }));
    expect(navigation.push).toHaveBeenCalledWith('/dashboard');
  });
});
