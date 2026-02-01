/**
 * BanManager Component Tests
 * TDD: Tests written first following Red-Green-Refactor cycle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { BanManager } from './BanManager';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('BanManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the ban manager container', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ players: [] }),
      });

      renderWithTheme(<BanManager serverName="test-server" />);

      expect(screen.getByTestId('ban-manager')).toBeInTheDocument();
    });

    it('should render the title', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ players: [] }),
      });

      renderWithTheme(<BanManager serverName="test-server" />);

      expect(screen.getByText(/ban list/i)).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      mockFetch.mockReturnValue(new Promise(() => {}));

      renderWithTheme(<BanManager serverName="test-server" />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should render ban player button', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ players: [] }),
      });

      renderWithTheme(<BanManager serverName="test-server" />);

      expect(screen.getByRole('button', { name: /ban player/i })).toBeInTheDocument();
    });
  });

  describe('Ban List Display', () => {
    it('should display banned players', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            players: [
              { name: 'Hacker1', uuid: 'uuid-1', reason: 'Cheating', created: '2026-01-01', source: 'Admin' },
              { name: 'Griefer1', uuid: 'uuid-2', reason: 'Griefing', created: '2026-01-02', source: 'Admin' },
            ],
          }),
      });

      renderWithTheme(<BanManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('Hacker1')).toBeInTheDocument();
        expect(screen.getByText('Griefer1')).toBeInTheDocument();
      });
    });

    it('should display ban reasons', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            players: [
              { name: 'Hacker1', uuid: 'uuid-1', reason: 'Cheating', created: '2026-01-01', source: 'Admin' },
            ],
          }),
      });

      renderWithTheme(<BanManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText(/cheating/i)).toBeInTheDocument();
      });
    });

    it('should show empty state when no bans', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ players: [] }),
      });

      renderWithTheme(<BanManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText(/no players banned/i)).toBeInTheDocument();
      });
    });
  });

  describe('Ban Player Dialog', () => {
    it('should open dialog when ban button is clicked', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ players: [] }),
      });

      renderWithTheme(<BanManager serverName="test-server" />);

      const banButton = screen.getByRole('button', { name: /ban player/i });
      fireEvent.click(banButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should render player name input in dialog', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ players: [] }),
      });

      renderWithTheme(<BanManager serverName="test-server" />);

      const banButton = screen.getByRole('button', { name: /ban player/i });
      fireEvent.click(banButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/player name/i)).toBeInTheDocument();
      });
    });

    it('should render reason input in dialog', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ players: [] }),
      });

      renderWithTheme(<BanManager serverName="test-server" />);

      const banButton = screen.getByRole('button', { name: /ban player/i });
      fireEvent.click(banButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
      });
    });

    it('should call ban API when ban is confirmed', async () => {
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
              players: [{ name: 'BadPlayer', uuid: 'uuid-new', reason: 'Testing', created: '2026-01-01', source: 'Admin' }],
            }),
        });

      renderWithTheme(<BanManager serverName="test-server" />);

      // Open dialog
      const banButton = screen.getByRole('button', { name: /ban player/i });
      fireEvent.click(banButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fill form
      const playerInput = screen.getByLabelText(/player name/i);
      fireEvent.change(playerInput, { target: { value: 'BadPlayer' } });

      const reasonInput = screen.getByLabelText(/reason/i);
      fireEvent.change(reasonInput, { target: { value: 'Testing' } });

      // Submit
      const confirmButton = screen.getByRole('button', { name: /^ban$/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/players/ban',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('BadPlayer'),
          })
        );
      });
    });

    it('should close dialog after successful ban', async () => {
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

      renderWithTheme(<BanManager serverName="test-server" />);

      // Open dialog
      const banButton = screen.getByRole('button', { name: /ban player/i });
      fireEvent.click(banButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fill and submit
      const playerInput = screen.getByLabelText(/player name/i);
      fireEvent.change(playerInput, { target: { value: 'BadPlayer' } });

      const confirmButton = screen.getByRole('button', { name: /^ban$/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Unban Player', () => {
    it('should render unban button for each banned player', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            players: [{ name: 'Hacker1', uuid: 'uuid-1', reason: 'Cheating', created: '2026-01-01', source: 'Admin' }],
          }),
      });

      renderWithTheme(<BanManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /unban/i })).toBeInTheDocument();
      });
    });

    it('should call unban API when unban button is clicked', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              players: [{ name: 'Hacker1', uuid: 'uuid-1', reason: 'Cheating', created: '2026-01-01', source: 'Admin' }],
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

      renderWithTheme(<BanManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('Hacker1')).toBeInTheDocument();
      });

      const unbanButton = screen.getByRole('button', { name: /unban/i });
      fireEvent.click(unbanButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/players/ban?player=Hacker1&server=test-server',
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

      renderWithTheme(<BanManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });

    it('should show error on ban failure', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ players: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
        });

      renderWithTheme(<BanManager serverName="test-server" />);

      // Open dialog
      const banButton = screen.getByRole('button', { name: /ban player/i });
      fireEvent.click(banButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fill and submit
      const playerInput = screen.getByLabelText(/player name/i);
      fireEvent.change(playerInput, { target: { value: 'BadPlayer' } });

      const confirmButton = screen.getByRole('button', { name: /^ban$/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to ban/i)).toBeInTheDocument();
      });
    });
  });
});
