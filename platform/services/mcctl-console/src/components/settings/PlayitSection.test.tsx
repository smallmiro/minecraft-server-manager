import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlayitSection } from './PlayitSection';
import * as usePlayitHooks from '@/hooks/usePlayit';
import type { PlayitAgentStatus } from '@/ports/api/IMcctlApiClient';

// Mock hooks
vi.mock('@/hooks/usePlayit');

describe('PlayitSection', () => {
  let queryClient: QueryClient;

  const mockPlayitStatus: PlayitAgentStatus = {
    enabled: true,
    agentRunning: true,
    secretKeyConfigured: true,
    containerStatus: 'running',
    uptime: '2h 15m',
    uptimeSeconds: 8100,
    servers: [
      {
        serverName: 'survival',
        playitDomain: 'survival.example.playit.gg',
        lanHostname: 'survival.10.0.0.1.nip.io',
      },
      {
        serverName: 'creative',
        playitDomain: null,
        lanHostname: 'creative.10.0.0.1.nip.io',
      },
    ],
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(usePlayitHooks.useStartPlayit).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(usePlayitHooks.useStopPlayit).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <PlayitSection />
      </QueryClientProvider>
    );

  it('renders loading skeleton when loading', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    renderComponent();

    // MUI Skeleton renders as span with MuiSkeleton-root class
    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders not configured state when playit is not enabled', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: {
        enabled: false,
        agentRunning: false,
        secretKeyConfigured: false,
        containerStatus: 'not_created',
        servers: [],
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText(/not configured/i)).toBeInTheDocument();
    expect(screen.getByText(/playit.gg agent is not set up/i)).toBeInTheDocument();
  });

  it('renders agent status and servers when configured', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: mockPlayitStatus,
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText('External Access (playit.gg)')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('2h 15m')).toBeInTheDocument();

    // Server table
    expect(screen.getByText('survival')).toBeInTheDocument();
    expect(screen.getByText('survival.example.playit.gg')).toBeInTheDocument();
    expect(screen.getByText('creative')).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });

  it('shows stop button when agent is running', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: mockPlayitStatus,
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const stopButton = screen.getByRole('button', { name: /stop agent/i });
    expect(stopButton).toBeInTheDocument();
  });

  it('shows start button when agent is stopped', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: {
        ...mockPlayitStatus,
        agentRunning: false,
        containerStatus: 'exited',
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const startButton = screen.getByRole('button', { name: /start agent/i });
    expect(startButton).toBeInTheDocument();
  });

  it('calls start mutation when start button is clicked', async () => {
    const mockMutate = vi.fn();
    vi.mocked(usePlayitHooks.useStartPlayit).mockReturnValue({
      mutate: mockMutate,
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: {
        ...mockPlayitStatus,
        agentRunning: false,
        containerStatus: 'exited',
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const startButton = screen.getByRole('button', { name: /start agent/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledOnce();
    });
  });

  it('calls stop mutation when stop button is clicked', async () => {
    const mockMutate = vi.fn();
    vi.mocked(usePlayitHooks.useStopPlayit).mockReturnValue({
      mutate: mockMutate,
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: mockPlayitStatus,
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const stopButton = screen.getByRole('button', { name: /stop agent/i });
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledOnce();
    });
  });

  it('shows dashboard link', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: mockPlayitStatus,
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const link = screen.getByRole('link', { name: /view dashboard/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://playit.gg/account/tunnels');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders error state', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch status'),
    } as any);

    renderComponent();

    expect(screen.getByText(/failed to load playit status/i)).toBeInTheDocument();
  });

  it('disables buttons when action is pending', () => {
    vi.mocked(usePlayitHooks.useStartPlayit).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
    } as any);

    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: {
        ...mockPlayitStatus,
        agentRunning: false,
        containerStatus: 'exited',
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const startButton = screen.getByRole('button', { name: /starting/i });
    expect(startButton).toBeDisabled();
  });
});
