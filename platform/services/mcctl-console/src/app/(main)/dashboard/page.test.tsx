import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from './page';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock the hooks
vi.mock('@/hooks/useMcctl', () => ({
  useServers: vi.fn(),
  useWorlds: vi.fn(),
}));

// Import the mocked hooks
import { useServers, useWorlds } from '@/hooks/useMcctl';

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

const renderWithProviders = (component: React.ReactNode) => {
  const queryClient = createTestQueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </ThemeProvider>
  );
};

describe('DashboardPage', () => {
  it('should render loading state', () => {
    vi.mocked(useServers).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);
    vi.mocked(useWorlds).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    renderWithProviders(<DashboardPage />);

    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
  });

  it('should render statistics cards when data is loaded', async () => {
    vi.mocked(useServers).mockReturnValue({
      data: {
        servers: [
          { name: 'server1', status: 'running', health: 'healthy', container: 'mc-server1', hostname: 'server1.local' },
          { name: 'server2', status: 'stopped', health: 'none', container: 'mc-server2', hostname: 'server2.local' },
          { name: 'server3', status: 'running', health: 'healthy', container: 'mc-server3', hostname: 'server3.local' },
        ],
        total: 3,
      },
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useWorlds).mockReturnValue({
      data: {
        worlds: [
          { name: 'world1', path: '/worlds/world1', isLocked: true, lockedBy: 'server1' },
          { name: 'world2', path: '/worlds/world2', isLocked: false },
        ],
        total: 2,
      },
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Servers')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();

      expect(screen.getByText('Online Servers')).toBeInTheDocument();
      expect(screen.getByText('Total Worlds')).toBeInTheDocument();

      // Both Online Servers and Total Worlds show 2, so check they both exist
      const twos = screen.getAllByText('2');
      expect(twos.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('should display zero when no servers', async () => {
    vi.mocked(useServers).mockReturnValue({
      data: {
        servers: [],
        total: 0,
      },
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useWorlds).mockReturnValue({
      data: {
        worlds: [],
        total: 0,
      },
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      // Multiple stat cards show 0
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThan(0);
    });
  });

  it('should render server overview section', async () => {
    vi.mocked(useServers).mockReturnValue({
      data: {
        servers: [
          { name: 'server1', status: 'running', health: 'healthy', container: 'mc-server1', hostname: 'server1.local' },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useWorlds).mockReturnValue({
      data: { worlds: [], total: 0 },
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Servers')).toBeInTheDocument();
      expect(screen.getByText('server1')).toBeInTheDocument();
    });
  });

  it('should render activity feed section', async () => {
    vi.mocked(useServers).mockReturnValue({
      data: { servers: [], total: 0 },
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useWorlds).mockReturnValue({
      data: { worlds: [], total: 0 },
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Activity Feed')).toBeInTheDocument();
    });
  });
});
