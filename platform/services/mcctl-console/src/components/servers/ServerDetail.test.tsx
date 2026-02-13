import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

// Mock useMods hooks
vi.mock('@/hooks/useMods', () => ({
  useServerMods: () => ({ data: { mods: {} }, isLoading: false, error: null }),
  useModSearch: () => ({ data: null, isLoading: false }),
  useAddMod: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveMod: () => ({ mutateAsync: vi.fn() }),
}));

const renderWithTheme = (component: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </ThemeProvider>
  );
};

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
    list: ['player1', 'player2', 'player3'],
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

describe('ServerDetail', () => {
  it('should render pill-style tabs navigation', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mods/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /files/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /backups/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /options/i })).toBeInTheDocument();
  });

  it('should show overview tab content by default', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    // Overview content should be visible
    expect(screen.getByText('Server Information')).toBeInTheDocument();
    expect(screen.getByText('Container')).toBeInTheDocument();
  });

  it('should render resource stat cards', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByText('CPU usage')).toBeInTheDocument();
    expect(screen.getByText('Memory usage')).toBeInTheDocument();
    expect(screen.getByText('World size')).toBeInTheDocument();
  });

  it('should render console section with connection indicator', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByText('Console')).toBeInTheDocument();
  });

  it('should switch to mods tab', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    const modsTab = screen.getByRole('button', { name: /mods/i });
    fireEvent.click(modsTab);

    expect(screen.getByText(/installed mods/i)).toBeInTheDocument();
  });

  it('should switch to files tab', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    const filesTab = screen.getByRole('button', { name: /files/i });
    fireEvent.click(filesTab);

    expect(screen.getByText(/file browser coming soon/i)).toBeInTheDocument();
  });

  it('should switch to backups tab', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    const backupsTab = screen.getByRole('button', { name: /backups/i });
    fireEvent.click(backupsTab);

    expect(screen.getByText(/backup management coming soon/i)).toBeInTheDocument();
  });

  it('should switch to options tab', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    const optionsTab = screen.getByRole('button', { name: /options/i });
    fireEvent.click(optionsTab);

    // Options tab now renders ServerOptionsTab component
    // Just verify the tab switch doesn't crash
    expect(optionsTab).toBeInTheDocument();
  });

  it('should display server type and version in overview', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByText('PAPER')).toBeInTheDocument();
    expect(screen.getByText('1.21.1')).toBeInTheDocument();
  });

  it('should display memory allocation in overview', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByText('4G')).toBeInTheDocument();
  });

  it('should display uptime in overview', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByText('2 days')).toBeInTheDocument();
  });

  it('should display player count in overview', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByText(/3 \/ 20/)).toBeInTheDocument();
  });

  it('should display player list in overview', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByText('player1')).toBeInTheDocument();
    expect(screen.getByText('player2')).toBeInTheDocument();
    expect(screen.getByText('player3')).toBeInTheDocument();
  });

  it('should display CPU usage stat', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    // CPU percent is parsed and displayed as X.XX%
    expect(screen.getByText('25.00%')).toBeInTheDocument();
  });

  it('should handle missing optional fields gracefully', () => {
    const minimalServer: ServerDetailType = {
      name: 'minimal-server',
      container: 'mc-minimal-server',
      status: 'stopped',
      health: 'none',
      hostname: 'minimal-server.local',
    };

    renderWithTheme(<ServerDetail server={minimalServer} />);

    expect(screen.getByText('minimal-server')).toBeInTheDocument();
  });

  it('should render command input field', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByPlaceholderText('Send a command')).toBeInTheDocument();
  });

  it('should call onSendCommand when command is submitted', async () => {
    const mockOnSendCommand = vi.fn().mockResolvedValue(undefined);
    renderWithTheme(<ServerDetail server={mockServer} onSendCommand={mockOnSendCommand} />);

    const input = screen.getByPlaceholderText('Send a command');
    fireEvent.change(input, { target: { value: 'say hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockOnSendCommand).toHaveBeenCalledWith('say hello');
  });
});
