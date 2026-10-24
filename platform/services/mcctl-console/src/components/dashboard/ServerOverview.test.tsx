import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

  describe('status filter', () => {
    it('shows All / Running / Stopped toggles with counts', () => {
      renderWithTheme(<ServerOverview servers={mockServers} isLoading={false} />);

      const group = screen.getByRole('group', { name: /filter servers by status/i });
      expect(group).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'All 3' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Running 2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Stopped 1' })).toBeInTheDocument();
    });

    it('filters to running servers', () => {
      renderWithTheme(<ServerOverview servers={mockServers} isLoading={false} />);

      fireEvent.click(screen.getByRole('button', { name: 'Running 2' }));

      expect(screen.getByText('server1')).toBeInTheDocument();
      expect(screen.getByText('server3')).toBeInTheDocument();
      expect(screen.queryByText('server2')).not.toBeInTheDocument();
    });

    it('treats every non-running status as stopped', () => {
      const servers: ServerSummary[] = [
        ...mockServers,
        { name: 'server4', container: 'mc-server4', status: 'exited', health: 'none', hostname: 'server4.local' },
        { name: 'server5', container: 'mc-server5', status: 'not_created', health: 'none', hostname: 'server5.local' },
      ];
      renderWithTheme(<ServerOverview servers={servers} isLoading={false} />);

      expect(screen.getByRole('button', { name: 'Stopped 3' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Stopped 3' }));

      expect(screen.getByText('server2')).toBeInTheDocument();
      expect(screen.getByText('server4')).toBeInTheDocument();
      expect(screen.getByText('server5')).toBeInTheDocument();
      expect(screen.queryByText('server1')).not.toBeInTheDocument();
    });

    it('uses the SSE status overlay for counts and filtering', () => {
      const statusMap = {
        server2: { status: 'running', health: 'healthy', timestamp: '2026-01-01T00:00:00.000Z' },
        server1: { status: 'stopped', health: 'none', timestamp: '2026-01-01T00:00:00.000Z' },
      } as never;
      const { rerender } = renderWithTheme(
        <ServerOverview servers={mockServers} statusMap={{}} isLoading={false} />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Running 2' }));
      expect(screen.queryByText('server2')).not.toBeInTheDocument();

      rerender(
        <ThemeProvider>
          <ServerOverview servers={mockServers} statusMap={statusMap} isLoading={false} />
        </ThemeProvider>
      );

      // server2 came online, server1 went offline: filter follows live
      expect(screen.getByText('server2')).toBeInTheDocument();
      expect(screen.queryByText('server1')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Running 2' })).toBeInTheDocument();
    });

    it('applies maxItems after filtering', () => {
      renderWithTheme(<ServerOverview servers={mockServers} isLoading={false} maxItems={1} />);

      fireEvent.click(screen.getByRole('button', { name: 'Stopped 1' }));

      expect(screen.getByText('server2')).toBeInTheDocument();
    });

    it('shows an empty message when the filter matches nothing', () => {
      renderWithTheme(
        <ServerOverview servers={[mockServers[0]]} isLoading={false} />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Stopped 0' }));

      expect(screen.getByText(/no stopped servers/i)).toBeInTheDocument();
    });
  });
});
