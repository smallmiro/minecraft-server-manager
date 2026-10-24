import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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
  useServers: vi.fn(),
  useStartServer: vi.fn(),
  useStopServer: vi.fn(),
  useRestartServer: vi.fn(),
  useDeleteServer: vi.fn(),
}));

vi.mock('@/hooks/useServerStatus', () => ({
  useServerStatus: vi.fn(),
}));

const detailProps = vi.hoisted(() => ({
  current: null as null | { onSendCommand?: (command: string) => Promise<void> },
}));

vi.mock('@/components/servers/ServerDetail', () => ({
  ServerDetail: (props: { onSendCommand?: (command: string) => Promise<void> }) => {
    detailProps.current = props;
    return <div aria-label="Server detail tabs">Detail content</div>;
  },
}));

import {
  useDeleteServer,
  useRestartServer,
  useServer,
  useServers,
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
    vi.mocked(useServers).mockReturnValue({
      data: { servers: [server, { ...server, name: 'other', status: 'stopped' }], total: 2 },
      isLoading: false,
    } as never);
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

  it('shows the Start action for a created server', () => {
    vi.mocked(useServerStatus).mockReturnValue({
      status: 'created',
      health: 'none',
      isConnected: true,
    } as never);

    renderPage();

    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
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

  describe('delete world handling (#652)', () => {
    const openDialog = () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Server actions' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete Server' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Server name' }), {
        target: { value: 'test-server' },
      });
    };

    it('defaults to keeping the world and sends deleteWorld=false', () => {
      openDialog();
      expect(screen.getByRole('radio', { name: /keep the world.*worlds\//i })).toBeChecked();
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(deleteMutation.mutate).toHaveBeenCalledWith(
        { name: 'test-server', force: true, deleteWorld: false },
        expect.anything(),
      );
    });

    it('sends deleteWorld=true when choosing to delete the world too', () => {
      openDialog();
      fireEvent.click(screen.getByRole('radio', { name: /delete the world inside the server too/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(deleteMutation.mutate).toHaveBeenCalledWith(
        { name: 'test-server', force: true, deleteWorld: true },
        expect.anything(),
      );
    });

    it('sends the typed sudo password with the delete (#761)', () => {
      openDialog();
      fireEvent.change(screen.getByLabelText(/sudo password/i), { target: { value: 'pw' } });
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(deleteMutation.mutate).toHaveBeenCalledWith(
        { name: 'test-server', force: true, deleteWorld: false, sudoPassword: 'pw' },
        expect.anything(),
      );
    });

    it('omits sudoPassword when the field is left empty (#761)', () => {
      openDialog();
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(deleteMutation.mutate.mock.calls[0][0]).not.toHaveProperty('sudoPassword');
    });

    it('shows the API warning instead of navigating away (#761)', () => {
      openDialog();
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      push.mockClear();
      const { onSuccess } = deleteMutation.mutate.mock.calls[0][1];
      act(() => onSuccess({ success: true, server: 'test-server', message: 'ok', warning: 'mDNS hostname test-server.local was not removed: sudo failed' }));
      expect(screen.getByText(/was not removed: sudo failed/)).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(push).toHaveBeenCalledWith('/servers');
    });

    it('shows the API error message when delete fails', () => {
      vi.mocked(useDeleteServer).mockReturnValue({
        ...deleteMutation,
        isError: true,
        error: new Error('worlds/x already exists. Nothing was deleted.'),
      } as never);
      renderPage();
      expect(screen.getByText(/already exists\. Nothing was deleted\./)).toBeInTheDocument();
    });
  });

  describe('hero (#770, #771)', () => {
    it('lets the hostname be copied', () => {
      renderPage();

      const hero = screen.getByRole('region', { name: 'Server overview' });
      expect(hero).toHaveTextContent('test-server.local');
      expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeInTheDocument();
    });

    it('shows type and version as chips instead of a sentence, without emoji', () => {
      renderPage();

      const hero = screen.getByRole('region', { name: 'Server overview' });
      expect(screen.getByText('PAPER').closest('.MuiChip-root')).not.toBeNull();
      expect(screen.getByText('1.21.1').closest('.MuiChip-root')).not.toBeNull();
      expect(hero).not.toHaveTextContent('Minecraft 1.21.1 · PAPER');
      expect(hero.textContent).not.toMatch(/🔌|🔧|🎮/);
    });

    it('formats uptime with a day unit', () => {
      vi.mocked(useServer).mockReturnValue({
        data: { server: { ...server, uptimeSeconds: 4 * 86400 + 18 * 3600 + 42 * 60 } },
        isLoading: false,
        error: null,
      } as never);

      renderPage();

      expect(screen.getByText('4d 18h 42m')).toBeInTheDocument();
    });

    it('gives Stop and Restart the same secondary weight', () => {
      renderPage();

      expect(screen.getByRole('button', { name: 'Stop' })).toHaveClass('MuiButton-outlined');
      expect(screen.getByRole('button', { name: 'Restart' })).toHaveClass('MuiButton-outlined');
    });

    it('offers a server switcher beside the title', () => {
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Switch server' }));
      fireEvent.click(screen.getByRole('menuitem', { name: /other/ }));

      expect(push).toHaveBeenCalledWith('/servers/other');
      expect(screen.getByRole('heading', { level: 1, name: 'test-server' })).toBeInTheDocument();
    });
  });

  describe('sending commands', () => {
    it('rejects with the API message when the command fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 503,
          json: async () => ({ error: 'ServiceUnavailable', message: 'RCON is not ready' }),
        }),
      );
      renderPage();

      await expect(detailProps.current?.onSendCommand?.('list')).rejects.toThrow(
        'RCON is not ready',
      );
      vi.unstubAllGlobals();
    });

    it('resolves when the command succeeds', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, output: '' }) }),
      );
      renderPage();

      await expect(detailProps.current?.onSendCommand?.('list')).resolves.toBeUndefined();
      vi.unstubAllGlobals();
    });
  });
});
