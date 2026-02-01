/**
 * WhitelistManager Component Tests
 * TDD: Tests written first following Red-Green-Refactor cycle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { WhitelistManager } from './WhitelistManager';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('WhitelistManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the whitelist manager container', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ players: [] }),
      });

      renderWithTheme(<WhitelistManager serverName="test-server" />);

      expect(screen.getByTestId('whitelist-manager')).toBeInTheDocument();
    });

    it('should render the title', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ players: [] }),
      });

      renderWithTheme(<WhitelistManager serverName="test-server" />);

      expect(screen.getByText(/whitelist/i)).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      mockFetch.mockReturnValue(new Promise(() => {}));

      renderWithTheme(<WhitelistManager serverName="test-server" />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Whitelist Display', () => {
    it('should display whitelisted players', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            players: [
              { name: 'Player1', uuid: 'uuid-1' },
              { name: 'Player2', uuid: 'uuid-2' },
            ],
          }),
      });

      renderWithTheme(<WhitelistManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('Player1')).toBeInTheDocument();
        expect(screen.getByText('Player2')).toBeInTheDocument();
      });
    });

    it('should show empty state when whitelist is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ players: [] }),
      });

      renderWithTheme(<WhitelistManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText(/no players whitelisted/i)).toBeInTheDocument();
      });
    });
  });

  describe('Add Player', () => {
    it('should render add player input', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ players: [] }),
      });

      renderWithTheme(<WhitelistManager serverName="test-server" />);

      expect(screen.getByPlaceholderText(/player name/i)).toBeInTheDocument();
    });

    it('should render add button', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ players: [] }),
      });

      renderWithTheme(<WhitelistManager serverName="test-server" />);

      expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
    });

    it('should call add API when add button is clicked', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ players: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              players: [{ name: 'NewPlayer', uuid: 'uuid-new' }],
            }),
        });

      renderWithTheme(<WhitelistManager serverName="test-server" />);

      const input = screen.getByPlaceholderText(/player name/i);
      fireEvent.change(input, { target: { value: 'NewPlayer' } });

      const addButton = screen.getByRole('button', { name: /add/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/players/whitelist',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('NewPlayer'),
          })
        );
      });
    });

    it('should clear input after successful add', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ players: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ players: [] }),
        });

      renderWithTheme(<WhitelistManager serverName="test-server" />);

      const input = screen.getByPlaceholderText(/player name/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'NewPlayer' } });

      const addButton = screen.getByRole('button', { name: /add/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });
  });

  describe('Remove Player', () => {
    it('should render remove button for each player', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            players: [{ name: 'Player1', uuid: 'uuid-1' }],
          }),
      });

      renderWithTheme(<WhitelistManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
      });
    });

    it('should call remove API when remove button is clicked', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              players: [{ name: 'Player1', uuid: 'uuid-1' }],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ players: [] }),
        });

      renderWithTheme(<WhitelistManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('Player1')).toBeInTheDocument();
      });

      const removeButton = screen.getByRole('button', { name: /remove/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/players/whitelist?player=Player1&server=test-server',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message on API failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      renderWithTheme(<WhitelistManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });
  });
});
