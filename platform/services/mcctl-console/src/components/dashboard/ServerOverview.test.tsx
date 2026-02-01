import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { ServerOverview } from './ServerOverview';
import type { ServerSummary } from '@/ports/api/IMcctlApiClient';

// Mock Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

beforeEach(() => {
  mockPush.mockClear();
});

const mockServers: ServerSummary[] = [
  {
    name: 'server1',
    container: 'mc-server1',
    status: 'running',
    health: 'healthy',
    hostname: 'server1.local',
  },
  {
    name: 'server2',
    container: 'mc-server2',
    status: 'stopped',
    health: 'none',
    hostname: 'server2.local',
  },
  {
    name: 'server3',
    container: 'mc-server3',
    status: 'running',
    health: 'starting',
    hostname: 'server3.local',
  },
];

describe('ServerOverview', () => {
  it('should render loading state', () => {
    renderWithTheme(
      <ServerOverview servers={[]} isLoading={true} />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should render empty state when no servers', () => {
    renderWithTheme(
      <ServerOverview servers={[]} isLoading={false} />
    );

    expect(screen.getByText(/no servers/i)).toBeInTheDocument();
  });

  it('should render server list', () => {
    renderWithTheme(
      <ServerOverview servers={mockServers} isLoading={false} />
    );

    expect(screen.getByText('server1')).toBeInTheDocument();
    expect(screen.getByText('server2')).toBeInTheDocument();
    expect(screen.getByText('server3')).toBeInTheDocument();
  });

  it('should display server status', () => {
    renderWithTheme(
      <ServerOverview servers={mockServers} isLoading={false} />
    );

    const runningChips = screen.getAllByText('running');
    expect(runningChips.length).toBeGreaterThan(0);
    expect(screen.getByText('stopped')).toBeInTheDocument();
  });

  it('should display server health', () => {
    renderWithTheme(
      <ServerOverview servers={mockServers} isLoading={false} />
    );

    expect(screen.getByText('healthy')).toBeInTheDocument();
    expect(screen.getByText('starting')).toBeInTheDocument();
  });

  it('should call onServerClick when server is clicked', () => {
    const onServerClick = vi.fn();
    const { container } = renderWithTheme(
      <ServerOverview
        servers={mockServers}
        isLoading={false}
        onServerClick={onServerClick}
      />
    );

    const serverCard = screen.getByText('server1').closest('div[role="button"]');
    if (serverCard && serverCard instanceof HTMLElement) {
      serverCard.click();
      expect(onServerClick).toHaveBeenCalledWith('server1');
    }
  });

  it('should limit displayed servers when maxItems is set', () => {
    renderWithTheme(
      <ServerOverview servers={mockServers} isLoading={false} maxItems={2} />
    );

    expect(screen.getByText('server1')).toBeInTheDocument();
    expect(screen.getByText('server2')).toBeInTheDocument();
    expect(screen.queryByText('server3')).not.toBeInTheDocument();
  });

  it('should show "View All" link when servers exceed maxItems', () => {
    renderWithTheme(
      <ServerOverview
        servers={mockServers}
        isLoading={false}
        maxItems={2}
        showViewAll={true}
      />
    );

    expect(screen.getByText(/view all/i)).toBeInTheDocument();
  });
});
