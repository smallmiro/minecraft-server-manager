import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlayitSummaryCard } from './PlayitSummaryCard';
import * as usePlayitHooks from '@/hooks/usePlayit';
import type { PlayitAgentStatus } from '@/ports/api/IMcctlApiClient';

// Mock hooks
vi.mock('@/hooks/usePlayit');

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
});
