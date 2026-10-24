import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServerDetail } from './ServerDetail';
import type { ServerDetail as ServerDetailType } from '@/ports/api/IMcctlApiClient';

// Mock useServerLogs hook
vi.mock('@/hooks/useServerLogs', () => ({
  useServerLogs: () => ({
    logs: [],
    isConnected: true,
    clearLogs: vi.fn(),
    reconnect: vi.fn(),
    retryCount: 0,
  }),
}));

vi.mock('@/hooks/useServerPlayers', () => ({
  useServerPlayers: () => ({
    roster: [],
    online: 0,
    max: 0,
    running: true,
    isConnected: true,
    reconnect: vi.fn(),
    retryCount: 0,
  }),
}));

vi.mock('@/hooks/usePlayit', () => ({
  usePlayitStatus: () => ({ data: undefined, isLoading: false }),
}));

// Mock useMods hooks
vi.mock('@/hooks/useMods', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMods')>();
  return {
    ...actual,
    useServerMods: () => ({ data: { mods: {} }, isLoading: false, error: null }),
    useModSearch: () => ({ data: null, isLoading: false }),
    useModProjects: () => ({ data: null, isLoading: false }),
    useAddMod: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useRemoveMod: () => ({ mutateAsync: vi.fn() }),
    useToggleModExclude: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

// Tab bodies are implemented components with their own data hooks;
// stub them so these tests stay focused on the detail frame.
vi.mock('./files/ServerFilesTab', () => ({
  ServerFilesTab: () => <div>Files Tab Content</div>,
}));

vi.mock('./ServerBackupTab', () => ({
  ServerBackupTab: () => <div>Backup Tab Content</div>,
}));

vi.mock('./ServerPlayersTab', () => ({
  ServerPlayersTab: () => <div>Players Tab Content</div>,
}));

vi.mock('./ServerModsTab', () => ({
  ServerModsTab: () => <div>Mods Tab Content</div>,
}));

vi.mock('./ServerActivityTab', () => ({
  ServerActivityTab: () => <div>Activity Tab Content</div>,
}));

vi.mock('./ServerConsole', () => ({
  ServerConsole: () => <div>Full console</div>,
}));

const makeQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderWithTheme = (component: React.ReactNode, queryClient = makeQueryClient()) =>
  render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
    </ThemeProvider>,
  );

const mockServer: ServerDetailType = {
  name: 'test-server',
  container: 'mc-test-server',
  status: 'running',
  health: 'healthy',
  hostname: 'test-server.local',
  type: 'PAPER',
  version: '1.21.1',
  memory: '4G',
  uptime: '2 days',
  uptimeSeconds: 172800,
  players: {
    online: 3,
    max: 20,
    players: ['player1', 'player2', 'player3'],
  },
  stats: {
    cpuPercent: 25,
    memoryUsage: 2684354560, // 2560 MiB in bytes
    memoryLimit: 4294967296, // 4 GB in bytes
    memoryPercent: 62.5,
  },
  worldName: 'survival-world',
  worldSize: '1.2GB',
};

const TAB_LABELS = [
  'Overview',
  'Players',
  'World',
  'Activity',
  'Mods',
  'Files',
  'Config History',
  'Backups',
  'Access',
  'Options',
];

const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^${name}`) });

describe('ServerDetail', () => {
  describe('tabs', () => {
    it('renders every tab in one scrollable tablist, in reading order', () => {
      renderWithTheme(<ServerDetail server={mockServer} />);

      const tablist = screen.getByRole('tablist', { name: 'Server detail sections' });
      const tabs = within(tablist).getAllByRole('tab');
      expect(tabs.map((t) => t.textContent?.replace(/\d+$/, ''))).toEqual(TAB_LABELS);
      expect(document.querySelector('.MuiTabs-scrollableX')).not.toBeNull();
      expect(tab('Overview')).toHaveAttribute('aria-selected', 'true');
    });

    it('shows the online player count on the Players tab', () => {
      renderWithTheme(<ServerDetail server={mockServer} />);

      expect(within(tab('Players')).getByText('3')).toBeInTheDocument();
    });

    it('shows a Mods count only when the installed mods are already cached', () => {
      const { unmount } = renderWithTheme(<ServerDetail server={mockServer} />);
      expect(tab('Mods')).toHaveTextContent(/^Mods$/);
      unmount();

      const queryClient = makeQueryClient();
      queryClient.setQueryData(['servers', 'test-server', 'mods', 'installed'], {
        mods: [{}, {}],
      });
      renderWithTheme(<ServerDetail server={mockServer} />, queryClient);
      expect(within(tab('Mods')).getByText('2')).toBeInTheDocument();
    });

    it('shows the selected tab content directly under the tabs in the same panel', () => {
      renderWithTheme(<ServerDetail server={mockServer} />);

      fireEvent.click(tab('Files'));

      const panel = screen.getByRole('region', { name: 'Server details' });
      const tabpanel = screen.getByRole('tabpanel');
      expect(panel).toContainElement(screen.getByRole('tablist'));
      expect(panel).toContainElement(tabpanel);
      expect(tabpanel).toHaveTextContent('Files Tab Content');
      expect(tabpanel).toHaveAttribute('aria-labelledby', tab('Files').id);
    });

    it.each([
      ['Players', 'Players Tab Content'],
      ['Mods', 'Mods Tab Content'],
      ['Backups', 'Backup Tab Content'],
      ['Activity', 'Activity Tab Content'],
    ])('switches to the %s tab', (name, content) => {
      renderWithTheme(<ServerDetail server={mockServer} />);

      fireEvent.click(tab(name));

      expect(screen.getByRole('tabpanel')).toHaveTextContent(content);
    });
  });

  describe('metrics', () => {
    it('renders the three metric cards above the tab panel', () => {
      renderWithTheme(<ServerDetail server={mockServer} />);

      const cpu = screen.getByRole('article', { name: 'CPU usage' });
      expect(screen.getByRole('article', { name: 'Memory usage' })).toBeInTheDocument();
      expect(screen.getByRole('article', { name: 'World size' })).toBeInTheDocument();
      expect(
        cpu.compareDocumentPosition(screen.getByRole('tablist')) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('shows CPU with one decimal and no /100% unit', () => {
      renderWithTheme(<ServerDetail server={mockServer} />);

      const cpu = screen.getByRole('article', { name: 'CPU usage' });
      expect(cpu).toHaveTextContent('25.0%');
      expect(cpu).not.toHaveTextContent('/ 100%');
      expect(cpu).toHaveTextContent('Normal');
      expect(cpu).toHaveAttribute('data-accent', 'success');
    });

    it('shows memory as used / allocated GB with the percentage as description', () => {
      renderWithTheme(<ServerDetail server={mockServer} />);

      const memory = screen.getByRole('article', { name: 'Memory usage' });
      expect(memory).toHaveTextContent('2.50 / 4.00 GB');
      expect(memory).toHaveTextContent('62.5% · Normal');
    });

    it('shows the world size without an invented cap or progress bar', () => {
      renderWithTheme(<ServerDetail server={mockServer} />);

      const world = screen.getByRole('article', { name: 'World size' });
      expect(world).toHaveTextContent('1.2GB');
      expect(world).not.toHaveTextContent('10 GB');
      expect(within(world).queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('marks high usage with the warning and error accents', () => {
      renderWithTheme(
        <ServerDetail
          server={{
            ...mockServer,
            stats: { ...mockServer.stats!, cpuPercent: 95, memoryPercent: 75 },
          }}
        />,
      );

      const cpu = screen.getByRole('article', { name: 'CPU usage' });
      const memory = screen.getByRole('article', { name: 'Memory usage' });
      expect(cpu).toHaveAttribute('data-accent', 'error');
      expect(cpu).toHaveTextContent('Critical');
      expect(memory).toHaveAttribute('data-accent', 'warning');
      expect(memory).toHaveTextContent('High');
    });

    it('shows a placeholder when stats are unavailable', () => {
      renderWithTheme(<ServerDetail server={{ ...mockServer, stats: undefined }} />);

      expect(screen.getByRole('article', { name: 'CPU usage' })).toHaveTextContent('—');
      expect(screen.getByRole('article', { name: 'Memory usage' })).toHaveTextContent('—');
    });
  });

  describe('overview', () => {
    it('summarises settings that the hero does not show', () => {
      renderWithTheme(<ServerDetail server={mockServer} />);

      const settings = screen.getByRole('region', { name: 'Server settings' });
      expect(settings).toHaveTextContent('mc-test-server');
      expect(settings).toHaveTextContent('4G');
      expect(settings).toHaveTextContent('survival-world');
      expect(settings).not.toHaveTextContent('PAPER');
      expect(settings).not.toHaveTextContent('1.21.1');
      expect(screen.queryByText('Server Information')).not.toBeInTheDocument();
    });

    it('uses Bento panels only, without MUI Cards', () => {
      renderWithTheme(<ServerDetail server={mockServer} />);

      expect(screen.getByRole('region', { name: 'Server console' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Players' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Connection' })).toBeInTheDocument();
      expect(document.querySelector('.MuiCard-root')).toBeNull();
    });

    it('lists online players as rows', () => {
      renderWithTheme(<ServerDetail server={mockServer} />);

      const players = screen.getByRole('region', { name: 'Players' });
      expect(players).toHaveTextContent('3 / 20');
      expect(within(players).getByRole('button', { name: /player1/ })).toBeInTheDocument();
    });

    it('handles missing optional fields gracefully', () => {
      renderWithTheme(
        <ServerDetail
          server={{
            name: 'minimal-server',
            container: 'mc-minimal-server',
            status: 'stopped',
            health: 'none',
            hostname: 'minimal-server.local',
          }}
        />,
      );

      expect(screen.getByRole('region', { name: 'Server settings' })).toHaveTextContent(
        'mc-minimal-server',
      );
      expect(screen.getByText('No players online')).toBeInTheDocument();
    });
  });

  describe('console', () => {
    it('shows the console only on the Overview tab', () => {
      renderWithTheme(<ServerDetail server={mockServer} />);

      expect(screen.getByRole('region', { name: 'Server console' })).toBeInTheDocument();
      fireEvent.click(tab('Activity'));
      expect(screen.queryByRole('region', { name: 'Server console' })).not.toBeInTheDocument();
      fireEvent.click(tab('Overview'));
      expect(screen.getByRole('region', { name: 'Server console' })).toBeInTheDocument();
    });

    it('calls onSendCommand when a command is submitted', () => {
      const onSendCommand = vi.fn().mockResolvedValue(undefined);
      renderWithTheme(<ServerDetail server={mockServer} onSendCommand={onSendCommand} />);

      const input = screen.getByRole('textbox', { name: 'Console command' });
      fireEvent.change(input, { target: { value: 'say hello' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onSendCommand).toHaveBeenCalledWith('say hello');
    });

    it('opens the full console from the toolbar', () => {
      renderWithTheme(<ServerDetail server={mockServer} />);

      fireEvent.click(screen.getByRole('button', { name: 'Expand console' }));

      expect(screen.getByRole('dialog')).toHaveTextContent('Full console');
    });
  });
});
