/**
 * OpManager Component Tests
 * TDD: Tests written first following Red-Green-Refactor cycle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { OpManager } from './OpManager';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('OpManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the op manager container', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ operators: [] }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      expect(screen.getByTestId('op-manager')).toBeInTheDocument();
    });

    it('should render the title', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ operators: [] }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      expect(screen.getByText(/operators/i)).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      mockFetch.mockReturnValue(new Promise(() => {}));

      renderWithTheme(<OpManager serverName="test-server" />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Operators Display', () => {
    it('should display operators', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            operators: [
              { name: 'Admin1', uuid: 'uuid-1', level: 4 },
              { name: 'Mod1', uuid: 'uuid-2', level: 3 },
            ],
          }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('Admin1')).toBeInTheDocument();
        expect(screen.getByText('Mod1')).toBeInTheDocument();
      });
    });

    it('should display operator levels', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            operators: [{ name: 'Admin1', uuid: 'uuid-1', level: 4 }],
          }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('Level 4')).toBeInTheDocument();
      });
    });

    it('should show empty state when no operators', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ operators: [] }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText(/no operators configured/i)).toBeInTheDocument();
      });
    });
  });

  describe('Add Operator', () => {
    it('should render add operator input', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ operators: [] }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      expect(screen.getByPlaceholderText(/player name/i)).toBeInTheDocument();
    });

    it('should render add button', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ operators: [] }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
    });

    it('should call add API when add button is clicked', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ operators: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              operators: [{ name: 'NewOp', uuid: 'uuid-new', level: 4 }],
            }),
        });

      renderWithTheme(<OpManager serverName="test-server" />);

      const input = screen.getByPlaceholderText(/player name/i);
      fireEvent.change(input, { target: { value: 'NewOp' } });

      const addButton = screen.getByRole('button', { name: /add/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/players/op',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('NewOp'),
          })
        );
      });
    });

    it('should clear input after successful add', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ operators: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ operators: [] }),
        });

      renderWithTheme(<OpManager serverName="test-server" />);

      const input = screen.getByPlaceholderText(/player name/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'NewOp' } });

      const addButton = screen.getByRole('button', { name: /add/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('should disable add button when input is empty', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ operators: [] }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      const addButton = screen.getByRole('button', { name: /add/i });
      expect(addButton).toBeDisabled();
    });
  });

  describe('Remove Operator', () => {
    it('should render remove button for each operator', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            operators: [{ name: 'Admin1', uuid: 'uuid-1', level: 4 }],
          }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /remove operator/i })).toBeInTheDocument();
      });
    });

    it('should call remove API when remove button is clicked', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              operators: [{ name: 'Admin1', uuid: 'uuid-1', level: 4 }],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ operators: [] }),
        });

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('Admin1')).toBeInTheDocument();
      });

      const removeButton = screen.getByRole('button', { name: /remove operator/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/players/op?player=Admin1&server=test-server',
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

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });

    it('should show error on add failure', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ operators: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
        });

      renderWithTheme(<OpManager serverName="test-server" />);

      const input = screen.getByPlaceholderText(/player name/i);
      fireEvent.change(input, { target: { value: 'NewOp' } });

      const addButton = screen.getByRole('button', { name: /add/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to add/i)).toBeInTheDocument();
      });
    });
  });
});
