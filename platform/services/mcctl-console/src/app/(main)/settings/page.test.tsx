import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from './page';
import { useSession } from '@/lib/auth-client';

vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }));

vi.mock('@/components/settings', () => ({
  ProfileSection: ({ onSuccess, onError }: any) => (
    <div>
      Profile content
      <button onClick={() => onSuccess('Profile saved')}>Profile success</button>
      <button onClick={() => onError('Profile failed')}>Profile error</button>
    </div>
  ),
  AccountInfoSection: () => <div>Account content</div>,
  PasswordSection: ({ onSuccess, onError }: any) => (
    <div>
      Password content
      <button onClick={() => onSuccess('Password saved')}>Password success</button>
      <button onClick={() => onError('Password failed')}>Password error</button>
    </div>
  ),
  PlatformSettingsSection: () => <div data-testid="platform-section">Platform content</div>,
}));

function asRole(role: string | undefined) {
  vi.mocked(useSession).mockReturnValue({
    data: role ? { user: { role } } : null,
  } as never);
}

describe('SettingsPage', () => {
  beforeEach(() => asRole('user'));

  it('renders one compact hero and three ordered settings panels', () => {
    render(<SettingsPage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId('page-hero')).toHaveAttribute('data-compact', 'true');

    const profile = screen.getByRole('region', { name: 'Profile settings' });
    const account = screen.getByRole('region', { name: 'Account information' });
    const password = screen.getByRole('region', { name: 'Password settings' });
    expect(profile.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(account.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not render the platform section for non-admins', () => {
    render(<SettingsPage />);
    expect(screen.queryByTestId('platform-section')).not.toBeInTheDocument();
  });

  it('does not render the platform section while the session is unresolved', () => {
    asRole(undefined);
    render(<SettingsPage />);
    expect(screen.queryByTestId('platform-section')).not.toBeInTheDocument();
  });

  it('renders the platform section above the account panels for admins', () => {
    asRole('admin');
    render(<SettingsPage />);

    const platform = screen.getByTestId('platform-section');
    const profile = screen.getByRole('region', { name: 'Profile settings' });
    expect(platform.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('preserves success feedback from settings sections', () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Profile success' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Profile saved');
  });

  it('preserves error feedback from settings sections', () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Password error' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Password failed');
  });
});
