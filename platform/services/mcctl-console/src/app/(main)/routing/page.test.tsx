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

  it('should render loading state with skeleton', () => {
    vi.mocked(useRouterStatus).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    renderComponent();

    // Loading state shows skeletons, not progress bar
    expect(screen.getByText('Routing')).toBeInTheDocument();
  });

  it('should render error state', () => {
    const errorMessage = 'Failed to fetch router status';
    vi.mocked(useRouterStatus).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error(errorMessage),
    } as any);

    renderComponent();
    expect(screen.getByText(new RegExp(errorMessage, 'i'))).toBeInTheDocument();
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
      expect(screen.getByText('Routing')).toBeInTheDocument();

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
});
