import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionInfoCard } from './ConnectionInfoCard';
import * as usePlayitHooks from '@/hooks/usePlayit';
import type { PlayitAgentStatus } from '@/ports/api/IMcctlApiClient';

// Mock hooks
vi.mock('@/hooks/usePlayit');

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

describe('ConnectionInfoCard', () => {
  let queryClient: QueryClient;

  const mockPlayitStatus: PlayitAgentStatus = {
    enabled: true,
    agentRunning: true,
    secretKeyConfigured: true,
    containerStatus: 'running',
    servers: [
      {
        serverName: 'survival',
        playitDomain: 'survival.example.playit.gg',
        lanHostname: 'survival.10.0.0.1.nip.io',
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

    vi.clearAllMocks();
  });

  const renderComponent = (serverName: string, hostname?: string) =>
    render(
      <QueryClientProvider client={queryClient}>
        <ConnectionInfoCard serverName={serverName} hostname={hostname} />
      </QueryClientProvider>
    );

  it('renders loading skeleton when playit status is loading', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    renderComponent('survival', 'survival.10.0.0.1.nip.io');

    // MUI Skeleton renders as span with MuiSkeleton-root class
    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders LAN address only when playit is not configured', () => {
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

    renderComponent('survival', 'survival.10.0.0.1.nip.io');

    expect(screen.getByText('Connection')).toBeInTheDocument();
    expect(screen.getByText('LAN Address')).toBeInTheDocument();
    expect(screen.getByText('survival.10.0.0.1.nip.io:25565')).toBeInTheDocument();
    expect(screen.queryByText('External Address')).not.toBeInTheDocument();
  });

  it('renders both LAN and external address when configured', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: mockPlayitStatus,
      isLoading: false,
      error: null,
    } as any);

    renderComponent('survival', 'survival.10.0.0.1.nip.io');

    expect(screen.getByText('LAN Address')).toBeInTheDocument();
    expect(screen.getByText('survival.10.0.0.1.nip.io:25565')).toBeInTheDocument();
    expect(screen.getByText('External Address')).toBeInTheDocument();
    expect(screen.getByText('survival.example.playit.gg')).toBeInTheDocument();
  });

  it('shows "Not configured" for external address when server has no playit domain', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: {
        ...mockPlayitStatus,
        servers: [
          {
            serverName: 'survival',
            playitDomain: null,
            lanHostname: 'survival.10.0.0.1.nip.io',
          },
        ],
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent('survival', 'survival.10.0.0.1.nip.io');

    expect(screen.getByText('External Address')).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });

  it('copies LAN address to clipboard when copy button clicked', async () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: { enabled: false, agentRunning: false, secretKeyConfigured: false, containerStatus: 'not_created', servers: [] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent('survival', 'survival.10.0.0.1.nip.io');

    const copyButtons = screen.getAllByLabelText('Copy to clipboard');
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('survival.10.0.0.1.nip.io:25565');
    });
  });

  it('copies external address to clipboard when copy button clicked', async () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: mockPlayitStatus,
      isLoading: false,
      error: null,
    } as any);

    renderComponent('survival', 'survival.10.0.0.1.nip.io');

    const copyButtons = screen.getAllByLabelText('Copy to clipboard');
    // Second button is external address
    fireEvent.click(copyButtons[1]);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('survival.example.playit.gg');
    });
  });

  it('shows "Copied" state after copying', async () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: { enabled: false, agentRunning: false, secretKeyConfigured: false, containerStatus: 'not_created', servers: [] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent('survival', 'survival.10.0.0.1.nip.io');

    const copyButton = screen.getByLabelText('Copy to clipboard');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Copied')).toBeInTheDocument();
    });
  });

  it('handles missing hostname gracefully', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: { enabled: false, agentRunning: false, secretKeyConfigured: false, containerStatus: 'not_created', servers: [] },
      isLoading: false,
      error: null,
    } as any);

    renderComponent('survival');

    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });

  it('handles server not found in playit servers list', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: {
        ...mockPlayitStatus,
        servers: [
          {
            serverName: 'creative',
            playitDomain: 'creative.example.playit.gg',
            lanHostname: 'creative.10.0.0.1.nip.io',
          },
        ],
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent('survival', 'survival.10.0.0.1.nip.io');

    expect(screen.getByText('External Address')).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });
});
