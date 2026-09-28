import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import ServerDetailPage from './page';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useParams: () => ({ name: 'test-server' }),
}));

vi.mock('@/hooks/useAppRouter', () => ({
  useAppRouter: () => ({ push }),
}));

vi.mock('@/hooks/useMcctl', () => ({
  useServer: vi.fn(),
  useStartServer: vi.fn(),
  useStopServer: vi.fn(),
  useRestartServer: vi.fn(),
  useDeleteServer: vi.fn(),
}));

vi.mock('@/hooks/useServerStatus', () => ({
  useServerStatus: vi.fn(),
}));

vi.mock('@/components/servers/ServerDetail', () => ({
  ServerDetail: () => <div aria-label="Server detail tabs">Detail content</div>,
}));

import {
  useDeleteServer,
  useRestartServer,
  useServer,
  useStartServer,
  useStopServer,
} from '@/hooks/useMcctl';
import { useServerStatus } from '@/hooks/useServerStatus';

const server = {
  name: 'test-server',
  container: 'mc-test-server',
  status: 'running',
  health: 'healthy',
  hostname: 'test-server.local',
  type: 'PAPER',
  version: '1.21.1',
  uptime: '2 days',
};

const asyncMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
};
const deleteMutation = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
};

function renderPage() {
  return render(
    <ThemeProvider>
      <ServerDetailPage />
    </ThemeProvider>,
  );
}

describe('ServerDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useServer).mockReturnValue({
      data: { server },
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useServerStatus).mockReturnValue({
      status: 'running',
      health: 'healthy',
      isConnected: true,
    } as never);
    vi.mocked(useStartServer).mockReturnValue({ ...asyncMutation } as never);
    vi.mocked(useStopServer).mockReturnValue({ ...asyncMutation } as never);
    vi.mocked(useRestartServer).mockReturnValue({ ...asyncMutation } as never);
    vi.mocked(useDeleteServer).mockReturnValue({ ...deleteMutation } as never);
  });

  it('renders one server h1 with explicit status and health text', () => {
    renderPage();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'test-server' })).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Server overview' })).toBeInTheDocument();
  });

  it('keeps back navigation and lifecycle actions reachable', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'All servers' }));
    expect(push).toHaveBeenCalledWith('/servers');
    expect(screen.getByRole('group', { name: 'Server actions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
  });

  it('uses SSE-overlaid stopped state for the Start action', () => {
    vi.mocked(useServerStatus).mockReturnValue({
      status: 'stopped',
      health: 'none',
      isConnected: true,
    } as never);

    renderPage();

    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
  });

  it('falls back to API status when a stale SSE value is disconnected', () => {
    vi.mocked(useServerStatus).mockReturnValue({
      status: 'stopped',
      health: 'none',
      isConnected: false,
    } as never);

    renderPage();

    expect(screen.getByText('Reconnecting')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
  });

  it('shows the error without hiding server context', () => {
    vi.mocked(useServer).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('API unavailable'),
    } as never);

    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'test-server' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load server: API unavailable');
  });

  it('renders a matching loading hero', () => {
    vi.mocked(useServer).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as never);

    renderPage();

    expect(screen.getByRole('region', { name: 'Server overview' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'test-server' })).toBeInTheDocument();
    expect(document.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });

  it('keeps typed-name delete confirmation intact', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Server actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete Server' }));

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(deleteButton).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Server name' }), {
      target: { value: 'test-server' },
    });
    expect(deleteButton).toBeEnabled();
  });
});
