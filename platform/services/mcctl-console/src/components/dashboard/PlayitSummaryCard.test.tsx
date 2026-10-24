import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlayitSummaryCard } from './PlayitSummaryCard';
import * as usePlayitHooks from '@/hooks/usePlayit';
import type { PlayitAgentStatus } from '@/ports/api/IMcctlApiClient';

// Mock hooks
vi.mock('@/hooks/usePlayit');

const copyHook = vi.hoisted(() => ({
  status: 'idle' as 'idle' | 'copied' | 'failed',
  copy: vi.fn(),
}));
vi.mock('@/hooks/useCopy', () => ({ useCopy: () => copyHook }));

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('PlayitSummaryCard', () => {
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
        playitDomain: 'creative.example.playit.gg',
        lanHostname: 'creative.10.0.0.1.nip.io',
      },
      {
        serverName: 'vanilla',
        playitDomain: null,
        lanHostname: 'vanilla.10.0.0.1.nip.io',
      },
    ],
  };

  beforeEach(() => {
    copyHook.status = 'idle';
    copyHook.copy.mockReset();
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
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <PlayitSummaryCard />
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

  it('renders not configured state when playit is disabled', () => {
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

    expect(screen.getByText('External Access')).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });

  it('renders running agent status', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: mockPlayitStatus,
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText('External Access')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('renders stopped agent status', () => {
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

    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });

  it('displays configured server count', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: mockPlayitStatus,
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    // 2 out of 3 servers have playitDomain configured
    expect(screen.getByText('2 / 3 servers')).toBeInTheDocument();
    expect(screen.getByText('With external domains')).toBeInTheDocument();
  });

  it('renders link to routing page', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: mockPlayitStatus,
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const link = screen.getByRole('link', { name: /manage/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/routing');
  });

  it('handles zero configured servers', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: {
        ...mockPlayitStatus,
        servers: [
          {
            serverName: 'test',
            playitDomain: null,
            lanHostname: 'test.nip.io',
          },
        ],
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText('0 / 1 servers')).toBeInTheDocument();
  });

  it('handles empty servers array', () => {
    vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
      data: {
        ...mockPlayitStatus,
        servers: [],
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText('0 / 0 servers')).toBeInTheDocument();
  });

  describe('public addresses', () => {
    const withStatus = (overrides: Partial<PlayitAgentStatus>) =>
      vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
        data: { ...mockPlayitStatus, ...overrides },
        isLoading: false,
        error: null,
      } as any);

    it('lists servers that have a public domain with their address', () => {
      withStatus({});

      renderComponent();

      expect(screen.getByText('survival')).toBeInTheDocument();
      expect(screen.getByText('survival.example.playit.gg')).toBeInTheDocument();
      expect(screen.getByText('creative')).toBeInTheDocument();
      expect(screen.getByText('creative.example.playit.gg')).toBeInTheDocument();
      expect(screen.queryByText('vanilla')).not.toBeInTheDocument();
    });

    it('shows at most three servers', () => {
      withStatus({
        servers: ['a', 'b', 'c', 'd'].map((n) => ({
          serverName: `srv-${n}`,
          playitDomain: `${n}.playit.gg`,
          lanHostname: `${n}.nip.io`,
        })),
      });

      renderComponent();

      expect(screen.getByText('srv-a')).toBeInTheDocument();
      expect(screen.getByText('srv-c')).toBeInTheDocument();
      expect(screen.queryByText('srv-d')).not.toBeInTheDocument();
      // summary still counts every configured server
      expect(screen.getByText('4 / 4 servers')).toBeInTheDocument();
    });

    it('copies the public address', () => {
      withStatus({});

      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: 'Copy address of creative' }));

      expect(copyHook.copy).toHaveBeenCalledWith('creative.example.playit.gg');
    });

    it.each([
      ['copied', 'Copied!'],
      ['failed', 'Copy failed'],
    ] as const)('shows %s feedback on the copy button tooltip', async (status, text) => {
      copyHook.status = status;
      withStatus({});

      renderComponent();
      fireEvent.mouseOver(screen.getByRole('button', { name: 'Copy address of survival' }));

      expect(await screen.findByRole('tooltip')).toHaveTextContent(text);
    });

    it('shows the agent uptime when the status payload has one', () => {
      withStatus({});

      renderComponent();

      expect(screen.getByText(/uptime 2h 15m/i)).toBeInTheDocument();
    });

    it('does not invent an uptime when the payload has none', () => {
      withStatus({ uptime: undefined, uptimeSeconds: undefined });

      renderComponent();

      expect(screen.queryByText(/uptime/i)).not.toBeInTheDocument();
    });

    it('does not list addresses when playit is not configured', () => {
      vi.mocked(usePlayitHooks.usePlayitStatus).mockReturnValue({
        data: { ...mockPlayitStatus, enabled: false },
        isLoading: false,
        error: null,
      } as any);

      renderComponent();

      expect(screen.queryByText('survival.example.playit.gg')).not.toBeInTheDocument();
    });
  });
});
