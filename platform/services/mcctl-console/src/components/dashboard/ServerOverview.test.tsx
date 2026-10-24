import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

const hooks = vi.hoisted(() => ({
  start: { mutate: vi.fn(), isPending: false },
  stop: { mutate: vi.fn(), isPending: false },
  restart: { mutate: vi.fn(), isPending: false },
  copy: { status: 'idle' as 'idle' | 'copied' | 'failed', copy: vi.fn() },
}));

vi.mock('@/hooks/useMcctl', () => ({
  useStartServer: () => hooks.start,
  useStopServer: () => hooks.stop,
  useRestartServer: () => hooks.restart,
}));

const providers = vi.hoisted(() => ({ startLoading: vi.fn() }));
vi.mock('@/components/providers', () => providers);

vi.mock('@/hooks/useCopy', () => ({
  useCopy: () => hooks.copy,
}));

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

beforeEach(() => {
  mockPush.mockClear();
  for (const key of ['start', 'stop', 'restart'] as const) {
    hooks[key].mutate.mockReset();
    hooks[key].isPending = false;
  }
  hooks.copy.status = 'idle';
  hooks.copy.copy.mockReset();
  providers.startLoading.mockReset();
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

    it('leaves unknown (e.g. restarting) servers out of Running and Stopped', () => {
      const servers: ServerSummary[] = [
        ...mockServers,
        { name: 'server6', container: 'mc-server6', status: 'unknown', health: 'unknown', hostname: 'server6.local' },
      ];
      renderWithTheme(<ServerOverview servers={servers} isLoading={false} />);

      expect(screen.getByRole('button', { name: 'All 4' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Stopped 1' }));

      expect(screen.queryByText('server6')).not.toBeInTheDocument();
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

  describe('quick actions', () => {
    const one = (index: number) => [mockServers[index]];

    it('offers Console, Restart and Stop for a running server (no Start)', () => {
      renderWithTheme(<ServerOverview servers={one(0)} isLoading={false} />);

      expect(screen.getByRole('link', { name: 'Console server1' })).toHaveAttribute(
        'href',
        '/servers/server1/console'
      );
      expect(screen.getByRole('button', { name: 'Restart server1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Stop server1' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Start server1' })).not.toBeInTheDocument();
    });

    it.each(['stopped', 'exited', 'created', 'not_created'] as const)(
      'offers only Start for a %s server',
      (status) => {
        renderWithTheme(
          <ServerOverview servers={[{ ...mockServers[1], status }]} isLoading={false} />
        );

        expect(screen.getByRole('button', { name: 'Start server2' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Stop server2' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Restart server2' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Console server2' })).not.toBeInTheDocument();
      }
    );

    it('uses the SSE status to pick the actions', () => {
      const statusMap = {
        server2: { status: 'running', health: 'healthy', timestamp: '2026-01-01T00:00:00.000Z' },
      } as never;
      renderWithTheme(<ServerOverview servers={one(1)} statusMap={statusMap} isLoading={false} />);

      expect(screen.getByRole('button', { name: 'Stop server2' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Start server2' })).not.toBeInTheDocument();
    });

    it('starts a server without confirmation and without navigating', () => {
      const onServerClick = vi.fn();
      renderWithTheme(
        <ServerOverview servers={one(1)} isLoading={false} onServerClick={onServerClick} />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Start server2' }));

      expect(hooks.start.mutate).toHaveBeenCalledWith('server2', expect.any(Object));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onServerClick).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not navigate when the Console link is clicked', () => {
      const onServerClick = vi.fn();
      renderWithTheme(
        <ServerOverview servers={one(0)} isLoading={false} onServerClick={onServerClick} />
      );

      fireEvent.click(screen.getByRole('link', { name: 'Console server1' }));

      expect(onServerClick).not.toHaveBeenCalled();
      expect(providers.startLoading).toHaveBeenCalled();
    });

    it.each([
      ['Stop', 'stop'],
      ['Restart', 'restart'],
    ] as const)('asks for confirmation before %s and calls the mutation on confirm', (label, key) => {
      const onServerClick = vi.fn();
      renderWithTheme(
        <ServerOverview servers={one(0)} isLoading={false} onServerClick={onServerClick} />
      );

      fireEvent.click(screen.getByRole('button', { name: `${label} server1` }));

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText(new RegExp(`${label} server1`, 'i'))).toBeInTheDocument();
      expect(hooks[key].mutate).not.toHaveBeenCalled();

      fireEvent.click(within(dialog).getByRole('button', { name: label }));

      expect(hooks[key].mutate).toHaveBeenCalledWith('server1', expect.any(Object));
      expect(onServerClick).not.toHaveBeenCalled();
    });

    it.each([
      ['Stop', 'stop'],
      ['Restart', 'restart'],
    ] as const)('does not call the mutation when %s is cancelled', (label, key) => {
      const onServerClick = vi.fn();
      renderWithTheme(
        <ServerOverview servers={one(0)} isLoading={false} onServerClick={onServerClick} />
      );

      fireEvent.click(screen.getByRole('button', { name: `${label} server1` }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

      expect(hooks[key].mutate).not.toHaveBeenCalled();
      expect(onServerClick).not.toHaveBeenCalled();
    });

    it('disables the buttons and shows a spinner while a mutation is pending', () => {
      hooks.stop.isPending = true;
      renderWithTheme(<ServerOverview servers={one(0)} isLoading={false} />);

      const stop = screen.getByRole('button', { name: 'Stop server1' });
      expect(stop).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Restart server1' })).toBeDisabled();
      expect(within(stop).getByRole('progressbar')).toBeInTheDocument();
    });

    it('shows an alert when a mutation fails', () => {
      hooks.start.mutate.mockImplementation(
        (_name: string, options: { onError: (error: Error) => void }) =>
          options.onError(new Error('Docker unavailable'))
      );
      renderWithTheme(<ServerOverview servers={one(1)} isLoading={false} />);

      fireEvent.click(screen.getByRole('button', { name: 'Start server2' }));

      expect(screen.getByRole('alert')).toHaveTextContent('Failed to start server2: Docker unavailable');
    });
  });

  describe('row navigation', () => {
    it('navigates with Enter and Space on the focusable row', () => {
      const onServerClick = vi.fn();
      renderWithTheme(
        <ServerOverview servers={[mockServers[0]]} isLoading={false} onServerClick={onServerClick} />
      );

      const row = screen.getByRole('button', { name: 'Open server1' });
      expect(row).toHaveAttribute('tabindex', '0');
      fireEvent.keyDown(row, { key: 'Enter' });
      fireEvent.keyDown(row, { key: ' ' });

      expect(onServerClick).toHaveBeenCalledTimes(2);
      expect(onServerClick).toHaveBeenCalledWith('server1');
    });

    it('does not navigate when keys are pressed on a quick action', () => {
      const onServerClick = vi.fn();
      renderWithTheme(
        <ServerOverview servers={[mockServers[1]]} isLoading={false} onServerClick={onServerClick} />
      );

      fireEvent.keyDown(screen.getByRole('button', { name: 'Start server2' }), { key: 'Enter' });

      expect(onServerClick).not.toHaveBeenCalled();
    });

    it('marks running, unhealthy and stopped rows with success, error and neutral accents', () => {
      const servers: ServerSummary[] = [
        mockServers[0],
        { ...mockServers[0], name: 'sick', container: 'mc-sick', health: 'unhealthy' },
        mockServers[1],
      ];
      renderWithTheme(<ServerOverview servers={servers} isLoading={false} />);

      const accentOf = (name: string) =>
        screen.getByRole('button', { name: `Open ${name}` }).closest('[data-accent]')?.getAttribute('data-accent');
      expect(accentOf('server1')).toBe('success');
      expect(accentOf('sick')).toBe('error');
      expect(accentOf('server2')).toBe('neutral');
      expect(
        screen.getByRole('button', { name: 'Open server1' }).closest('[data-interactive]')
      ).toHaveAttribute('data-interactive', 'true');
    });
  });

  describe('hostname copy', () => {
    it('copies the primary hostname without navigating', () => {
      const onServerClick = vi.fn();
      renderWithTheme(
        <ServerOverview servers={[mockServers[0]]} isLoading={false} onServerClick={onServerClick} />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Copy hostname of server1' }));

      expect(hooks.copy.copy).toHaveBeenCalledWith('server1.local');
      expect(onServerClick).not.toHaveBeenCalled();
    });

    it('offers no copy button when the server has no hostname', () => {
      renderWithTheme(
        <ServerOverview servers={[{ ...mockServers[0], hostname: '-' }]} isLoading={false} />
      );

      expect(screen.queryByRole('button', { name: 'Copy hostname of server1' })).not.toBeInTheDocument();
    });

    it('does not navigate when the hostname area is clicked', () => {
      const onServerClick = vi.fn();
      renderWithTheme(
        <ServerOverview servers={[mockServers[0]]} isLoading={false} onServerClick={onServerClick} />
      );

      fireEvent.click(screen.getByText('server1.local'));

      expect(onServerClick).not.toHaveBeenCalled();
    });

    it.each([
      ['copied', 'Copied!'],
      ['failed', 'Copy failed'],
    ] as const)('shows %s feedback in the tooltip', async (status, text) => {
      hooks.copy.status = status;
      renderWithTheme(<ServerOverview servers={[mockServers[0]]} isLoading={false} />);

      fireEvent.mouseOver(screen.getByRole('button', { name: 'Copy hostname of server1' }));

      expect(await screen.findByRole('tooltip')).toHaveTextContent(text);
    });
  });

  describe('optional metrics slot', () => {
    it('renders nothing when the summary carries no metrics', () => {
      renderWithTheme(<ServerOverview servers={[mockServers[0]]} isLoading={false} />);

      expect(screen.queryByTestId('server-row-metrics')).not.toBeInTheDocument();
    });

    it('renders players, memory and type/version when present', () => {
      const server = {
        ...mockServers[0],
        type: 'PAPER',
        version: '1.21.1',
        players: { online: 3, max: 20 },
        stats: { memoryUsage: 2 * 1024 ** 3, memoryLimit: 4 * 1024 ** 3 },
      } as ServerSummary;
      renderWithTheme(<ServerOverview servers={[server]} isLoading={false} />);

      const slot = screen.getByTestId('server-row-metrics');
      expect(slot).toHaveTextContent('3 / 20');
      expect(slot).toHaveTextContent('2.0 GB / 4.0 GB');
      expect(slot).toHaveTextContent('PAPER · 1.21.1');
    });

    it('shows no players cell when player data is null', () => {
      const server = { ...mockServers[0], type: 'PAPER', players: null } as ServerSummary;
      renderWithTheme(<ServerOverview servers={[server]} isLoading={false} />);

      expect(screen.getByTestId('server-row-metrics')).not.toHaveTextContent(/players/i);
    });
  });
});
