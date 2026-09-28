import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RoutingPage from './page';
import { useRouterStatus } from '@/hooks/useMcctl';

// Mock the hooks
vi.mock('@/hooks/useMcctl', () => ({
  useRouterStatus: vi.fn(),
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
        serverStatus: 'stopped' as const,
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
    expect(screen.getAllByTestId('routing-skeleton-panel')).toHaveLength(5);
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
      // Check page title
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByLabelText('Router status')).toHaveTextContent('running');
      expect(screen.getByLabelText('Route count')).toHaveTextContent('2 routes');

      // Check router status section
      expect(screen.getByText('MC-Router Status')).toBeInTheDocument();
      // "running" appears multiple times (status chip, avahi status), so use getAllByText
      expect(screen.getAllByText('running').length).toBeGreaterThan(0);

      // Check routes (server names are extracted from targets)
      expect(screen.getByText('survival')).toBeInTheDocument();
    });
  });

  it('should render platform info section', async () => {
    vi.mocked(useRouterStatus).mockReturnValue({
      data: mockRouterStatusData,
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Platform Information')).toBeInTheDocument();
    });
  });

  it('should render network settings section', async () => {
    vi.mocked(useRouterStatus).mockReturnValue({
      data: mockRouterStatusData,
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Network Settings')).toBeInTheDocument();
    });
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
    expect(screen.getByRole('region', { name: 'Platform information' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Network settings' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Avahi status' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Playit tunnel' })).toBeInTheDocument();
  });
});
