import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './page';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
}));

vi.mock('@/components/auth', () => ({
  LoginForm: ({ onSuccess }: { onSuccess: () => void }) => (
    <button onClick={onSuccess}>Complete login</button>
  ),
}));

describe('LoginPage', () => {
  beforeEach(() => navigation.push.mockReset());

  it('renders one heading, one centered Bento panel, and the signup link', () => {
    render(<LoginPage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByTestId('auth-panel')).toHaveLength(1);
    expect(screen.getByTestId('auth-shell')).toContainElement(screen.getByTestId('auth-panel'));
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup');
  });

  it('keeps the login success redirect', () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Complete login' }));
    expect(navigation.push).toHaveBeenCalledWith('/dashboard');
  });
});
