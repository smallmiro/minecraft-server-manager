import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import PlayersPage from './page';

vi.mock('@/components/players', () => ({
  PlayerList: () => <div>Online player manager</div>,
  WhitelistManager: ({ serverName }: { serverName: string }) => (
    <div>Whitelist manager for {serverName}</div>
  ),
  OpManager: ({ serverName }: { serverName: string }) => (
    <div>Operator manager for {serverName}</div>
  ),
  BanManager: ({ serverName }: { serverName: string }) => (
    <div>Ban manager for {serverName}</div>
  ),
}));

vi.mock('@/hooks/useMcctl', () => ({
  useServers: vi.fn(),
}));

import { useServers } from '@/hooks/useMcctl';

const servers = [
  { name: 'alpha', status: 'running', health: 'healthy' },
  { name: 'beta', status: 'stopped', health: 'none' },
];

function renderPage() {
  return render(
    <ThemeProvider>
      <PlayersPage />
    </ThemeProvider>,
  );
}

describe('PlayersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useServers).mockReturnValue({
      data: { servers, total: servers.length },
      isLoading: false,
      error: null,
    } as never);
  });

  it('renders one compact player-management hero', () => {
    renderPage();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Player Management' })).toBeInTheDocument();
    expect(screen.getByTestId('page-hero')).toHaveAttribute('data-compact', 'true');
  });

  it('derives available and running server metrics from useServers', () => {
    renderPage();

    expect(screen.getByRole('article', { name: 'Available servers' })).toHaveTextContent('2');
    expect(screen.getByRole('article', { name: 'Running servers' })).toHaveTextContent('1');
  });

  it('selects the first server and passes selector changes to managers', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Server' })).toHaveTextContent('alpha'));
    fireEvent.click(screen.getByRole('tab', { name: 'Whitelist' }));
    expect(screen.getByRole('region', { name: 'Player manager' })).toHaveTextContent(
      'Whitelist manager for alpha',
    );

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Server' }));
    fireEvent.click(screen.getByRole('option', { name: 'beta' }));
    expect(screen.getByRole('region', { name: 'Player manager' })).toHaveTextContent(
      'Whitelist manager for beta',
    );
  });

  it('keeps all four tabs in DOM order', () => {
    renderPage();

    const tablist = screen.getByRole('tablist', { name: 'Player management tabs' });
    const labels = ['Online Players', 'Whitelist', 'Operators', 'Ban List'];
    const tabs = labels.map((label) => within(tablist).getByRole('tab', { name: label }));
    tabs.slice(0, -1).forEach((tab, index) => {
      expect(tab.compareDocumentPosition(tabs[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('disables server-specific tabs when no server is available', () => {
    vi.mocked(useServers).mockReturnValue({
      data: { servers: [], total: 0 },
      isLoading: false,
      error: null,
    } as never);
    renderPage();

    expect(screen.getByRole('tab', { name: 'Online Players' })).toBeEnabled();
    expect(screen.getByRole('tab', { name: 'Whitelist' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Operators' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Ban List' })).toBeDisabled();
    expect(screen.getByText('No servers available')).toBeInTheDocument();
  });

  it('keeps the selector disabled while servers load', () => {
    vi.mocked(useServers).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as never);
    renderPage();

    expect(screen.getByRole('combobox', { name: 'Server' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByText('Loading servers...')).toBeInTheDocument();
  });

  it('shows unavailable metrics and error context when servers fail to load', () => {
    vi.mocked(useServers).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('servers unavailable'),
    } as never);

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('servers unavailable');
    expect(screen.getAllByText('Unavailable')).toHaveLength(2);
    expect(screen.queryByText('No servers available')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Server' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders only the active manager in one dense full-width panel', () => {
    renderPage();

    const manager = screen.getByRole('region', { name: 'Player manager' });
    expect(manager).toHaveTextContent('Online player manager');
    expect(manager).not.toHaveTextContent('Whitelist manager');
  });
});
