import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import ServersPage from './page';

vi.mock('@/hooks/useAppRouter', () => ({
  useAppRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/useMcctl', () => ({
  useServers: vi.fn(),
  useStartServer: vi.fn(),
  useStopServer: vi.fn(),
}));

vi.mock('@/hooks/useServersSSE', () => ({
  useServersSSE: vi.fn(),
}));

vi.mock('@/hooks/useCreateServerSSE', () => ({
  useCreateServerSSE: vi.fn(),
}));

vi.mock('@/components/servers/CreateServerDialog', () => ({
  CreateServerDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Create New Server" /> : null,
}));

import { useServers, useStartServer, useStopServer } from '@/hooks/useMcctl';
import { useServersSSE } from '@/hooks/useServersSSE';
import { useCreateServerSSE } from '@/hooks/useCreateServerSSE';

const servers = [
  {
    name: 'survival',
    status: 'stopped',
    health: 'none',
    container: 'mc-survival',
    hostname: 'survival.local',
  },
  {
    name: 'creative',
    status: 'running',
    health: 'healthy',
    container: 'mc-creative',
    hostname: 'creative.local',
  },
  {
    name: 'events',
    status: 'stopped',
    health: 'none',
    container: 'mc-events',
    hostname: 'events.local',
  },
];

const mutation = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
};

function renderPage() {
  return render(
    <ThemeProvider>
      <ServersPage />
    </ThemeProvider>,
  );
}

describe('ServersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useServers).mockReturnValue({
      data: { servers, total: servers.length },
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useServersSSE).mockReturnValue({
      statusMap: {},
      isConnected: true,
    } as never);
    vi.mocked(useStartServer).mockReturnValue({ ...mutation } as never);
    vi.mocked(useStopServer).mockReturnValue({ ...mutation } as never);
    vi.mocked(useCreateServerSSE).mockReturnValue({
      createServer: vi.fn(),
      reset: vi.fn(),
      isCreating: false,
      status: 'idle',
      progress: 0,
      message: '',
      error: null,
    } as never);
  });

  it('renders an operational hero with one h1', () => {
    renderPage();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Servers' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Servers overview' })).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('derives running and attention counts from SSE-overlaid status and health', () => {
    vi.mocked(useServersSSE).mockReturnValue({
      statusMap: {
        survival: { status: 'running', health: 'healthy' },
        creative: { status: 'running', health: 'unhealthy' },
      },
      isConnected: true,
    } as never);

    renderPage();

    expect(within(screen.getByRole('article', { name: 'Total servers' })).getByText('3')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Running servers' })).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Needs attention' })).getByText('2')).toBeInTheDocument();
  });

  it('keeps Create Server as the primary action', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Create Server' }));

    expect(screen.getByRole('dialog', { name: 'Create New Server' })).toBeInTheDocument();
  });

  it('renders matching skeleton landmarks while loading', () => {
    vi.mocked(useServers).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as never);

    renderPage();

    expect(screen.getByRole('region', { name: 'Servers overview' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(document.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });

  it('shows the API error without hiding the page context', () => {
    vi.mocked(useServers).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('API unavailable'),
    } as never);

    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Servers' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load servers: API unavailable');
    expect(screen.getAllByText('Unavailable')).toHaveLength(3);
    expect(screen.getByRole('region', { name: 'Server inventory' })).toHaveTextContent(
      'Server inventory unavailable',
    );
    expect(screen.queryByText(/No servers found/i)).not.toBeInTheDocument();
  });

  it('keeps cached server data visible when a refresh fails', () => {
    vi.mocked(useServers).mockReturnValue({
      data: { servers, total: servers.length },
      isLoading: false,
      error: new Error('refresh unavailable'),
    } as never);

    renderPage();

    expect(screen.getByRole('article', { name: 'Total servers' })).toHaveTextContent('3');
    expect(screen.getByRole('region', { name: 'Server inventory' })).toHaveTextContent('survival');
    expect(screen.getByRole('alert')).toHaveTextContent('refresh unavailable');
  });

  it('ignores stale SSE overlays while reconnecting', () => {
    vi.mocked(useServersSSE).mockReturnValue({
      statusMap: {
        survival: { status: 'running', health: 'healthy' },
      },
      isConnected: false,
    } as never);

    renderPage();

    expect(screen.getByText('Reconnecting')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Running servers' })).toHaveTextContent('1');
    expect(screen.getByRole('article', { name: 'Needs attention' })).toHaveTextContent('2');
  });

  it('keeps a very long server name inside the content region', () => {
    const longName = 'survival-server-with-a-very-long-name-that-must-stay-inside-the-grid';
    vi.mocked(useServers).mockReturnValue({
      data: {
        servers: [{ ...servers[0], name: longName }],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as never);

    renderPage();

    expect(
      within(screen.getByRole('region', { name: 'Server inventory' })).getByText(longName),
    ).toBeInTheDocument();
  });
});
