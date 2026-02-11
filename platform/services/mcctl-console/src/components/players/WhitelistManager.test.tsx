/**
 * WhitelistManager Component Tests
 * TDD: Tests written first following Red-Green-Refactor cycle
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/theme';
import { WhitelistManager } from './WhitelistManager';

// Mock hooks
vi.mock('@/hooks/useMcctl', () => ({
  useWhitelist: vi.fn(),
  useWhitelistStatus: vi.fn(),
  useSetWhitelistStatus: vi.fn(),
  useAddToWhitelist: vi.fn(),
  useRemoveFromWhitelist: vi.fn(),
}));

import {
  useWhitelist,
  useWhitelistStatus,
  useSetWhitelistStatus,
  useAddToWhitelist,
  useRemoveFromWhitelist,
} from '@/hooks/useMcctl';

const mockUseWhitelist = useWhitelist as Mock;
const mockUseWhitelistStatus = useWhitelistStatus as Mock;
const mockUseSetWhitelistStatus = useSetWhitelistStatus as Mock;
const mockUseAddToWhitelist = useAddToWhitelist as Mock;
const mockUseRemoveFromWhitelist = useRemoveFromWhitelist as Mock;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

const renderWithProviders = (component: React.ReactNode) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{component}</ThemeProvider>
    </QueryClientProvider>
  );
};

// Helper to set up default mock return values
function setupMocks(overrides?: {
  players?: { name: string; uuid: string }[];
  isLoading?: boolean;
  error?: Error | null;
  source?: 'rcon' | 'file' | 'config';
  enabled?: boolean;
}) {
  const {
    players = [],
    isLoading = false,
    error = null,
    source = 'file',
    enabled = true,
  } = overrides ?? {};

  mockUseWhitelist.mockReturnValue({
    data: isLoading ? undefined : { players, total: players.length, source },
    isLoading,
    error,
  });

  mockUseWhitelistStatus.mockReturnValue({
    data: { enabled, source: 'config' },
  });

  const mutateFn = vi.fn();
  const mutateAsyncFn = vi.fn().mockResolvedValue({ success: true, message: 'ok' });

  mockUseSetWhitelistStatus.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  });

  mockUseAddToWhitelist.mockReturnValue({
    mutate: mutateFn,
    mutateAsync: mutateAsyncFn,
    isPending: false,
    error: null,
  });

  mockUseRemoveFromWhitelist.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  });

  return { mutateFn, mutateAsyncFn };
}

describe('WhitelistManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the whitelist manager container', () => {
      setupMocks();
      renderWithProviders(<WhitelistManager serverName="test-server" />);
      expect(screen.getByTestId('whitelist-manager')).toBeInTheDocument();
    });

    it('should render the title', () => {
      setupMocks();
      renderWithProviders(<WhitelistManager serverName="test-server" />);
      expect(screen.getByText('Whitelist')).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      setupMocks({ isLoading: true });
      renderWithProviders(<WhitelistManager serverName="test-server" />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Whitelist Display', () => {
    it('should display whitelisted players', () => {
      setupMocks({
        players: [
          { name: 'Player1', uuid: 'uuid-1' },
          { name: 'Player2', uuid: 'uuid-2' },
        ],
      });

      renderWithProviders(<WhitelistManager serverName="test-server" />);

      expect(screen.getByText('Player1')).toBeInTheDocument();
      expect(screen.getByText('Player2')).toBeInTheDocument();
    });

    it('should show empty state when whitelist is empty', () => {
      setupMocks();
      renderWithProviders(<WhitelistManager serverName="test-server" />);
      expect(screen.getByText(/no players whitelisted/i)).toBeInTheDocument();
    });
  });

  describe('Add Player', () => {
    it('should render add player input', () => {
      setupMocks();
      renderWithProviders(<WhitelistManager serverName="test-server" />);
      expect(screen.getByPlaceholderText(/player name/i)).toBeInTheDocument();
    });

    it('should render add button', () => {
      setupMocks();
      renderWithProviders(<WhitelistManager serverName="test-server" />);
      expect(screen.getByRole('button', { name: /add player to whitelist/i })).toBeInTheDocument();
    });

    it('should call add mutation when add button is clicked', () => {
      const { mutateFn } = setupMocks();
      renderWithProviders(<WhitelistManager serverName="test-server" />);

      const input = screen.getByPlaceholderText(/player name/i);
      fireEvent.change(input, { target: { value: 'NewPlayer' } });

      const addButton = screen.getByRole('button', { name: /add player to whitelist/i });
      fireEvent.click(addButton);

      expect(mutateFn).toHaveBeenCalledWith(
        { serverName: 'test-server', player: 'NewPlayer' },
        expect.objectContaining({ onSuccess: expect.any(Function) })
      );
    });
  });

  describe('Remove Player', () => {
    it('should render remove button for each player', () => {
      setupMocks({
        players: [{ name: 'Player1', uuid: 'uuid-1' }],
      });

      renderWithProviders(<WhitelistManager serverName="test-server" />);
      expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
    });

    it('should call remove mutation when remove button is clicked', () => {
      setupMocks({
        players: [{ name: 'Player1', uuid: 'uuid-1' }],
      });

      const removeMutateFn = vi.fn();
      mockUseRemoveFromWhitelist.mockReturnValue({
        mutate: removeMutateFn,
        isPending: false,
        error: null,
      });

      renderWithProviders(<WhitelistManager serverName="test-server" />);

      const removeButton = screen.getByRole('button', { name: /remove/i });
      fireEvent.click(removeButton);

      expect(removeMutateFn).toHaveBeenCalledWith(
        { serverName: 'test-server', player: 'Player1' },
        expect.objectContaining({ onSettled: expect.any(Function) })
      );
    });
  });

  describe('Error Handling', () => {
    it('should show error message on fetch failure', () => {
      setupMocks({ error: new Error('Failed to load whitelist') });
      renderWithProviders(<WhitelistManager serverName="test-server" />);
      expect(screen.getByText('Failed to load whitelist')).toBeInTheDocument();
    });
  });

  // ==================== NEW FEATURES ====================

  describe('Whitelist Toggle', () => {
    it('should render toggle switch', () => {
      setupMocks();
      renderWithProviders(<WhitelistManager serverName="test-server" />);
      expect(screen.getByTestId('whitelist-toggle')).toBeInTheDocument();
    });

    it('should show ON chip when whitelist is enabled', () => {
      setupMocks({ enabled: true });
      renderWithProviders(<WhitelistManager serverName="test-server" />);
      expect(screen.getByTestId('whitelist-status-chip')).toHaveTextContent('ON');
    });

    it('should show OFF chip when whitelist is disabled', () => {
      setupMocks({ enabled: false });
      renderWithProviders(<WhitelistManager serverName="test-server" />);
      expect(screen.getByTestId('whitelist-status-chip')).toHaveTextContent('OFF');
    });

    it('should call setStatus mutation when toggle is clicked', () => {
      setupMocks({ enabled: true });

      const setStatusMutateFn = vi.fn();
      mockUseSetWhitelistStatus.mockReturnValue({
        mutate: setStatusMutateFn,
        isPending: false,
        error: null,
      });

      renderWithProviders(<WhitelistManager serverName="test-server" />);

      const toggle = screen.getByRole('checkbox', { name: /toggle whitelist/i });
      fireEvent.click(toggle);

      expect(setStatusMutateFn).toHaveBeenCalledWith({
        serverName: 'test-server',
        enabled: false,
      });
    });

    it('should disable toggle while mutation is pending', () => {
      setupMocks();
      mockUseSetWhitelistStatus.mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        error: null,
      });

      renderWithProviders(<WhitelistManager serverName="test-server" />);

      const toggle = screen.getByRole('checkbox', { name: /toggle whitelist/i });
      expect(toggle).toBeDisabled();
    });
  });

  describe('Bulk Add', () => {
    it('should render bulk toggle button', () => {
      setupMocks();
      renderWithProviders(<WhitelistManager serverName="test-server" />);
      expect(screen.getByTestId('bulk-toggle')).toBeInTheDocument();
    });

    it('should show multiline input when bulk mode is active', () => {
      setupMocks();
      renderWithProviders(<WhitelistManager serverName="test-server" />);

      fireEvent.click(screen.getByTestId('bulk-toggle'));

      expect(screen.getByTestId('bulk-input')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add players in bulk/i })).toBeInTheDocument();
    });

    it('should call add mutation for each player in bulk mode', async () => {
      const { mutateAsyncFn } = setupMocks();
      renderWithProviders(<WhitelistManager serverName="test-server" />);

      // Switch to bulk mode
      fireEvent.click(screen.getByTestId('bulk-toggle'));

      // Type bulk input
      const textarea = screen.getByTestId('bulk-input').querySelector('textarea')!;
      fireEvent.change(textarea, { target: { value: 'Player1, Player2, Player3' } });

      // Click Add All
      fireEvent.click(screen.getByRole('button', { name: /add players in bulk/i }));

      await waitFor(() => {
        expect(mutateAsyncFn).toHaveBeenCalledTimes(3);
        expect(mutateAsyncFn).toHaveBeenCalledWith({ serverName: 'test-server', player: 'Player1' });
        expect(mutateAsyncFn).toHaveBeenCalledWith({ serverName: 'test-server', player: 'Player2' });
        expect(mutateAsyncFn).toHaveBeenCalledWith({ serverName: 'test-server', player: 'Player3' });
      });
    });

    it('should show bulk result summary after completion', async () => {
      const { mutateAsyncFn } = setupMocks();
      renderWithProviders(<WhitelistManager serverName="test-server" />);

      fireEvent.click(screen.getByTestId('bulk-toggle'));

      const textarea = screen.getByTestId('bulk-input').querySelector('textarea')!;
      fireEvent.change(textarea, { target: { value: 'Player1, Player2' } });

      fireEvent.click(screen.getByRole('button', { name: /add players in bulk/i }));

      await waitFor(() => {
        expect(screen.getByTestId('bulk-result')).toHaveTextContent('Added 2 of 2 players');
      });
    });
  });

  describe('Search/Filter', () => {
    const manyPlayers = [
      { name: 'Alpha', uuid: 'uuid-1' },
      { name: 'Beta', uuid: 'uuid-2' },
      { name: 'Charlie', uuid: 'uuid-3' },
      { name: 'Delta', uuid: 'uuid-4' },
      { name: 'Echo', uuid: 'uuid-5' },
    ];

    it('should show search field when 5+ players', () => {
      setupMocks({ players: manyPlayers });
      renderWithProviders(<WhitelistManager serverName="test-server" />);
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    it('should not show search field when fewer than 5 players', () => {
      setupMocks({
        players: [
          { name: 'Alpha', uuid: 'uuid-1' },
          { name: 'Beta', uuid: 'uuid-2' },
        ],
      });
      renderWithProviders(<WhitelistManager serverName="test-server" />);
      expect(screen.queryByTestId('search-input')).not.toBeInTheDocument();
    });

    it('should filter players by search query', () => {
      setupMocks({ players: manyPlayers });
      renderWithProviders(<WhitelistManager serverName="test-server" />);

      const searchInput = screen.getByTestId('search-input').querySelector('input')!;
      fireEvent.change(searchInput, { target: { value: 'alp' } });

      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Beta')).not.toBeInTheDocument();
      expect(screen.queryByText('Charlie')).not.toBeInTheDocument();
    });

    it('should show no matching players message', () => {
      setupMocks({ players: manyPlayers });
      renderWithProviders(<WhitelistManager serverName="test-server" />);

      const searchInput = screen.getByTestId('search-input').querySelector('input')!;
      fireEvent.change(searchInput, { target: { value: 'zzz' } });

      expect(screen.getByTestId('no-match-message')).toHaveTextContent('No matching players');
    });
  });
});
