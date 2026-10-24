import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RoutingPage from './page';
import { useRouterStatus, useRestartRouter } from '@/hooks/useMcctl';
import { usePlayitStatus } from '@/hooks/usePlayit';

// Mock the hooks
vi.mock('@/hooks/useMcctl', () => ({
  useRouterStatus: vi.fn(),
  useRestartRouter: vi.fn(),
  useStartServer: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('@/hooks/useRouterLogStream', () => ({
  useRouterLogStream: vi.fn(() => ({ events: [], status: 'live', clear: vi.fn() })),
}));

const mockRestart = vi.fn();
const mockSession = vi.fn(() => ({ data: { user: { role: 'admin' } }, isPending: false }));

vi.mock('@/lib/auth-client', () => ({
  useSession: () => mockSession(),
}));

vi.mock('@/hooks/usePlayit', () => ({
  usePlayitStatus: vi.fn(() => ({
    data: { enabled: false, agentRunning: false, secretKeyConfigured: false, containerStatus: 'not_created', servers: [] },
    isLoading: false,
    error: null,
  })),
  useStartPlayit: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
  useStopPlayit: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
}));

const mockRouterStatusData = {
  router: {
    name: 'mc-router',
    status: 'running' as const,
    health: 'healthy' as const,
    port: 25565,
    uptime: '3d 14h 22m',
    uptimeSeconds: 314520,
    mode: 'auto-scale',
    routes: [
      {
        hostname: 'survival.local',
        target: 'mc-survival:25565',
        serverStatus: 'running' as const,
        serverType: 'PAPER',
        serverVersion: '1.21.1',
      },
      {
        hostname: 'creative.local',
        target: 'mc-creative:25565',
        serverStatus: 'exited' as const,
        serverType: 'PAPER',
        serverVersion: '1.21.1',
      },
    ],
  },
  avahi: {
    name: 'avahi-daemon',
    status: 'running',
    type: 'system',
  },
};

const mockLoaded = () =>
  vi.mocked(useRouterStatus).mockReturnValue({ data: mockRouterStatusData, isLoading: false, error: null } as any);

describe('RoutingPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    vi.mocked(useRestartRouter).mockReturnValue({ mutate: mockRestart, isPending: false } as any);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <RoutingPage />
      </QueryClientProvider>
    );

  it('renders one hero and matched loading panels', () => {
    vi.mocked(useRouterStatus).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId('page-hero')).toHaveAttribute('data-compact', 'true');
    expect(screen.getByLabelText('Router status')).toHaveTextContent('Checking');
    expect(screen.getAllByTestId('routing-skeleton-panel')).toHaveLength(4);
  });

  it('renders an explicit unavailable error state', () => {
    const errorMessage = 'Failed to fetch router status';
    vi.mocked(useRouterStatus).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error(errorMessage),
    } as any);

    renderComponent();
    expect(screen.getByLabelText('Router status')).toHaveTextContent('Unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
    expect(screen.getByText(new RegExp(errorMessage, 'i'))).toBeInTheDocument();
  });

  it('renders an explicit unavailable state when router data is absent', () => {
    vi.mocked(useRouterStatus).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByLabelText('Router status')).toHaveTextContent('Unavailable');
    expect(screen.getByText('Router status is unavailable.')).toBeInTheDocument();
  });

  it('should render router status when data is loaded', async () => {
    vi.mocked(useRouterStatus).mockReturnValue({
      data: mockRouterStatusData,
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByLabelText('Router status')).toHaveTextContent('running');
      expect(screen.getByLabelText('Route count')).toHaveTextContent('2 routes');
      expect(screen.getByText('mc-router Gateway')).toBeInTheDocument();
    });
  });

  it('shows each server with its main hostname in the routing table', () => {
    vi.mocked(useRouterStatus).mockReturnValue({
      data: mockRouterStatusData,
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('survival.local')).toBeInTheDocument();
    expect(screen.getByText('creative.local')).toBeInTheDocument();
    expect(screen.getByText('Stopped · wakes on connect')).toBeInTheDocument();
  });

  it('classifies playit domains as WAN using the playit status', () => {
    vi.mocked(usePlayitStatus).mockReturnValue({
      data: {
        enabled: true,
        agentRunning: true,
        secretKeyConfigured: true,
        containerStatus: 'running',
        servers: [{ serverName: 'survival', playitDomain: 'aa-bb.craft.playit.gg', lanHostname: 'survival.local' }],
      },
      isLoading: false,
      error: null,
    } as any);
    vi.mocked(useRouterStatus).mockReturnValue({
      data: {
        ...mockRouterStatusData,
        router: {
          ...mockRouterStatusData.router,
          routes: [
            { hostname: 'aa-bb.craft.playit.gg', target: 'mc-survival:25565', serverStatus: 'running' as const },
          ],
        },
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    // the diagram also names the access type, so scope to the routes table
    expect(within(screen.getByRole('region', { name: 'Router routes' })).getByText('WAN')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Routing flow' })).getByText('WAN')).toBeInTheDocument();
  });

  it('shows port and mode only once (no duplicate platform/network cards)', () => {
    vi.mocked(useRouterStatus).mockReturnValue({
      data: mockRouterStatusData,
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getAllByText('25565')).toHaveLength(1);
    expect(screen.queryByText('Platform Information')).not.toBeInTheDocument();
    expect(screen.queryByText('Network Settings')).not.toBeInTheDocument();
  });

  it('should render avahi status section', async () => {
    vi.mocked(useRouterStatus).mockReturnValue({
      data: mockRouterStatusData,
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('mDNS (Avahi)')).toBeInTheDocument();
    });
  });

  it('groups the routing content into named Bento regions', () => {
    vi.mocked(useRouterStatus).mockReturnValue({
      data: mockRouterStatusData,
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByRole('region', { name: 'Router routes' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'mc-router Gateway' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Hostname resolver' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Avahi status' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Playit tunnel' })).toBeInTheDocument();
  });

  it('shows Avahi status once, inside the resolver card', () => {
    mockLoaded();
    renderComponent();
    expect(screen.getAllByText('mDNS (Avahi)')).toHaveLength(1);
    const resolver = screen.getByRole('region', { name: 'Hostname resolver' });
    expect(within(resolver).getByLabelText('Avahi status')).toHaveTextContent('running');
  });

  it('uses the first route server in the resolver nip.io example', () => {
    vi.mocked(useRouterStatus).mockReturnValue({
      data: {
        ...mockRouterStatusData,
        router: {
          ...mockRouterStatusData.router,
          resolver: { hostIp: '192.168.1.5', hostIps: ['192.168.1.5'] },
        },
      },
      isLoading: false,
      error: null,
    } as any);
    renderComponent();
    expect(screen.getByText('survival.192.168.1.5.nip.io')).toBeInTheDocument();
  });

  describe('flow diagram and live log', () => {
    it('renders the flow diagram panel from the router routes', () => {
      mockLoaded();
      renderComponent();
      const region = screen.getByRole('region', { name: 'Routing flow' });
      expect(within(region).getByRole('img')).toHaveAttribute('aria-label', expect.stringContaining('2 servers'));
      expect(within(region).getAllByTestId('flow-server-node')).toHaveLength(2);
    });

    it('renders the live router log panel', () => {
      mockLoaded();
      renderComponent();
      const region = screen.getByRole('region', { name: 'Live router log' });
      expect(within(region).getByRole('heading', { name: 'Live Router Log' })).toBeInTheDocument();
      expect(within(region).getByLabelText('Log stream status')).toHaveTextContent('Live');
    });

    it('does not open the log stream while router data is loading', () => {
      vi.mocked(useRouterStatus).mockReturnValue({ data: undefined, isLoading: true, error: null } as any);
      renderComponent();
      expect(screen.queryByRole('region', { name: 'Live router log' })).not.toBeInTheDocument();
    });
  });

  describe('Restart mc-router', () => {
    it('is offered in the hero actions', () => {
      mockLoaded();
      renderComponent();
      expect(within(screen.getByTestId('page-hero')).getByRole('button', { name: 'Restart mc-router' })).toBeInTheDocument();
    });

    it('asks for confirmation and does nothing on cancel', () => {
      mockLoaded();
      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: 'Restart mc-router' }));
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText(/will be disconnected/i)).toBeInTheDocument();
      expect(mockRestart).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(mockRestart).not.toHaveBeenCalled();
    });

    it('restarts on confirm and reports success', async () => {
      mockLoaded();
      mockRestart.mockImplementation((_v, opts) => opts.onSuccess({ success: true, message: 'mc-router restarted' }));
      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: 'Restart mc-router' }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restart' }));
      expect(mockRestart).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('mc-router restarted')).toBeInTheDocument();
    });

    it('reports a failed restart', async () => {
      mockLoaded();
      mockRestart.mockImplementation((_v, opts) => opts.onError(new Error('docker restart failed')));
      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: 'Restart mc-router' }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restart' }));
      expect(await screen.findByText(/docker restart failed/)).toBeInTheDocument();
    });

    it('is not offered to non-admins, since the restart route is admin only', () => {
      mockLoaded();
      mockSession.mockReturnValueOnce({ data: { user: { role: 'user' } }, isPending: false });
      renderComponent();
      expect(screen.queryByRole('button', { name: 'Restart mc-router' })).not.toBeInTheDocument();
    });

    it('is disabled when the mc-router container does not exist', () => {
      vi.mocked(useRouterStatus).mockReturnValue({
        data: { ...mockRouterStatusData, router: { ...mockRouterStatusData.router, status: 'not_found' } },
        isLoading: false,
        error: null,
      } as any);
      vi.mocked(useRestartRouter).mockReturnValue({ mutate: mockRestart, isPending: false } as any);
      renderComponent();
      expect(screen.getByRole('button', { name: 'Restart mc-router' })).toBeDisabled();
    });

    it('disables the hero action while a restart is pending', () => {
      mockLoaded();
      vi.mocked(useRestartRouter).mockReturnValue({ mutate: mockRestart, isPending: true } as any);
      renderComponent();
      expect(screen.getByRole('button', { name: 'Restart mc-router' })).toBeDisabled();
    });
  });
});
