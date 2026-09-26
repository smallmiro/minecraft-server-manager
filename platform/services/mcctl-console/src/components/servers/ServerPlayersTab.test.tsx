import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ServerPlayersTab } from './ServerPlayersTab';
import type { PlayerSummary } from '@/ports/api/IMcctlApiClient';

const mockUseServerPlayers = vi.fn();
vi.mock('@/hooks/useServerPlayers', () => ({
  useServerPlayers: (...args: unknown[]) => mockUseServerPlayers(...args),
}));

const mockAddToWhitelist = vi.fn();
const mockRemoveFromWhitelist = vi.fn();
vi.mock('@/hooks/useMcctl', () => ({
  useAddToWhitelist: () => ({ mutate: mockAddToWhitelist, isPending: false }),
  useRemoveFromWhitelist: () => ({ mutate: mockRemoveFromWhitelist, isPending: false }),
}));

const renderWithProviders = (component: React.ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
    </ThemeProvider>
  );
};

const onlinePlayer: PlayerSummary = {
  uuid: 'uuid-online',
  name: 'Steve',
  online: true,
  lastSeen: null,
  isOp: false,
  isBanned: false,
  isWhitelisted: true,
};

const offlinePlayer: PlayerSummary = {
  uuid: 'uuid-offline',
  name: 'Alex',
  online: false,
  lastSeen: '2024-01-01T00:00:00Z',
  isOp: true,
  isBanned: true,
  isWhitelisted: false,
};

function mockRoster(roster: PlayerSummary[], overrides: Partial<ReturnType<typeof mockUseServerPlayers>> = {}) {
  mockUseServerPlayers.mockReturnValue({
    roster,
    online: roster.filter((p) => p.online).length,
    max: 20,
    running: true,
    isConnected: true,
    reconnect: vi.fn(),
    retryCount: 0,
    ...overrides,
  });
}

describe('ServerPlayersTab (#528)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
  });

  it('shows an empty state when the roster is empty', () => {
    mockRoster([]);
    renderWithProviders(<ServerPlayersTab serverName="survival" />);
    expect(screen.getByText(/no players/i)).toBeInTheDocument();
  });

  it('renders online and offline players with their badges', () => {
    mockRoster([onlinePlayer, offlinePlayer]);
    renderWithProviders(<ServerPlayersTab serverName="survival" />);

    expect(screen.getByText('Steve')).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('OP')).toBeInTheDocument();
    expect(screen.getByText('Banned')).toBeInTheDocument();
  });

  it('shows the online/max count', () => {
    mockRoster([onlinePlayer, offlinePlayer]);
    renderWithProviders(<ServerPlayersTab serverName="survival" />);
    expect(screen.getByText('1 / 20')).toBeInTheDocument();
  });

  it('shows a labeled last-saved value for offline players', () => {
    mockRoster([offlinePlayer]);
    renderWithProviders(<ServerPlayersTab serverName="survival" />);
    expect(screen.getByText(/last saved/i)).toBeInTheDocument();
  });

  it('offers Kick only for online players', () => {
    mockRoster([onlinePlayer, offlinePlayer]);
    renderWithProviders(<ServerPlayersTab serverName="survival" />);

    fireEvent.click(screen.getAllByLabelText(/player actions/i)[0]);
    expect(screen.getByText('Kick')).toBeInTheDocument();
    fireEvent.click(document.body); // close menu
  });

  it('kicks a player after confirming', async () => {
    mockRoster([onlinePlayer]);
    renderWithProviders(<ServerPlayersTab serverName="survival" />);

    fireEvent.click(screen.getByLabelText(/player actions/i));
    fireEvent.click(screen.getByText('Kick'));
    fireEvent.click(screen.getByRole('button', { name: /confirm kick/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/players/kick',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ player: 'Steve', server: 'survival' }),
        })
      );
    });
  });

  it('bans a player after confirming', async () => {
    mockRoster([onlinePlayer]);
    renderWithProviders(<ServerPlayersTab serverName="survival" />);

    fireEvent.click(screen.getByLabelText(/player actions/i));
    fireEvent.click(screen.getByText('Ban'));
    fireEvent.click(screen.getByRole('button', { name: /confirm ban/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/players/ban',
        expect.objectContaining({ method: 'POST' })
      );
      const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(opts.body)).toMatchObject({ player: 'Steve', server: 'survival' });
    });
  });

  it('unbans a banned player directly (no confirm dialog)', async () => {
    mockRoster([offlinePlayer]);
    renderWithProviders(<ServerPlayersTab serverName="survival" />);

    fireEvent.click(screen.getByLabelText(/player actions/i));
    fireEvent.click(screen.getByText('Unban'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/players/ban?player=Alex&server=survival'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  it('makes a player OP', async () => {
    mockRoster([onlinePlayer]);
    renderWithProviders(<ServerPlayersTab serverName="survival" />);

    fireEvent.click(screen.getByLabelText(/player actions/i));
    fireEvent.click(screen.getByText('Make OP'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/players/op',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('removes OP from a player', async () => {
    mockRoster([offlinePlayer]);
    renderWithProviders(<ServerPlayersTab serverName="survival" />);

    fireEvent.click(screen.getByLabelText(/player actions/i));
    fireEvent.click(screen.getByText('Remove OP'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/players/op?player=Alex&server=survival'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  it('adds a player to the whitelist', () => {
    mockRoster([offlinePlayer]); // not whitelisted
    renderWithProviders(<ServerPlayersTab serverName="survival" />);

    fireEvent.click(screen.getByLabelText(/player actions/i));
    fireEvent.click(screen.getByText('Add to Whitelist'));

    expect(mockAddToWhitelist).toHaveBeenCalledWith({ serverName: 'survival', player: 'Alex' });
  });

  it('removes a player from the whitelist', () => {
    mockRoster([onlinePlayer]); // whitelisted
    renderWithProviders(<ServerPlayersTab serverName="survival" />);

    fireEvent.click(screen.getByLabelText(/player actions/i));
    fireEvent.click(screen.getByText('Remove from Whitelist'));

    expect(mockRemoveFromWhitelist).toHaveBeenCalledWith({ serverName: 'survival', player: 'Steve' });
  });
});
