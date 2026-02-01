/**
 * PlayerList Component Tests
 * TDD: Tests written first following Red-Green-Refactor cycle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { PlayerList } from './PlayerList';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('PlayerList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the player list container', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ servers: [] }),
      });

      renderWithTheme(<PlayerList />);

      expect(screen.getByTestId('player-list')).toBeInTheDocument();
    });

    it('should render the title', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ servers: [] }),
      });

      renderWithTheme(<PlayerList />);

      expect(screen.getByText(/online players/i)).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      mockFetch.mockReturnValue(new Promise(() => {})); // Never resolves

      renderWithTheme(<PlayerList />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Player Display', () => {
    it('should display players grouped by server', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            servers: [
              {
                name: 'survival',
                players: [
                  { name: 'Player1', uuid: 'uuid-1' },
                  { name: 'Player2', uuid: 'uuid-2' },
                ],
              },
              {
                name: 'creative',
                players: [{ name: 'Player3', uuid: 'uuid-3' }],
              },
            ],
          }),
      });

      renderWithTheme(<PlayerList />);

      await waitFor(() => {
        expect(screen.getByText('survival')).toBeInTheDocument();
        expect(screen.getByText('Player1')).toBeInTheDocument();
        expect(screen.getByText('Player2')).toBeInTheDocument();
        expect(screen.getByText('creative')).toBeInTheDocument();
        expect(screen.getByText('Player3')).toBeInTheDocument();
      });
    });

    it('should show empty state when no players online', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            servers: [{ name: 'survival', players: [] }],
          }),
      });

      renderWithTheme(<PlayerList />);

      await waitFor(() => {
        expect(screen.getByText(/no players online/i)).toBeInTheDocument();
      });
    });

    it('should display player count per server', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            servers: [
              {
                name: 'survival',
                players: [
                  { name: 'Player1', uuid: 'uuid-1' },
                  { name: 'Player2', uuid: 'uuid-2' },
                ],
              },
            ],
          }),
      });

      renderWithTheme(<PlayerList />);

      await waitFor(() => {
        expect(screen.getByText(/2 players?/i)).toBeInTheDocument();
      });
    });
  });

  describe('Player Actions', () => {
    it('should render kick button for each player', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            servers: [
              {
                name: 'survival',
                players: [{ name: 'Player1', uuid: 'uuid-1' }],
              },
            ],
          }),
      });

      renderWithTheme(<PlayerList />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /kick/i })).toBeInTheDocument();
      });
    });

    it('should show confirmation dialog when kick is clicked', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            servers: [
              {
                name: 'survival',
                players: [{ name: 'Player1', uuid: 'uuid-1' }],
              },
            ],
          }),
      });

      renderWithTheme(<PlayerList />);

      await waitFor(() => {
        expect(screen.getByText('Player1')).toBeInTheDocument();
      });

      const kickButton = screen.getByRole('button', { name: /kick/i });
      fireEvent.click(kickButton);

      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    it('should call kick API when confirmed', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              servers: [
                {
                  name: 'survival',
                  players: [{ name: 'Player1', uuid: 'uuid-1' }],
                },
              ],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      renderWithTheme(<PlayerList />);

      await waitFor(() => {
        expect(screen.getByText('Player1')).toBeInTheDocument();
      });

      // Click kick button
      const kickButton = screen.getByRole('button', { name: /kick/i });
      fireEvent.click(kickButton);

      // Confirm kick
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/players/kick',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Player1'),
          })
        );
      });
    });
  });

  describe('Refresh', () => {
    it('should render refresh button', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ servers: [] }),
      });

      renderWithTheme(<PlayerList />);

      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('should refetch data when refresh is clicked', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ servers: [] }),
      });

      renderWithTheme(<PlayerList />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message on API failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      renderWithTheme(<PlayerList />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });
  });
});
