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
              { name: 'Admin1', uuid: 'uuid-1', level: 4, role: 'Owner', bypassesPlayerLimit: true },
              { name: 'Mod1', uuid: 'uuid-2', level: 3, role: 'Admin', bypassesPlayerLimit: false },
            ],
            count: 2,
          }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('Admin1')).toBeInTheDocument();
        expect(screen.getByText('Mod1')).toBeInTheDocument();
      });
    });

    it('should display operator levels with badges', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            operators: [{ name: 'Admin1', uuid: 'uuid-1', level: 4, role: 'Owner', bypassesPlayerLimit: true }],
            count: 1,
          }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText(/Level 4/i)).toBeInTheDocument();
        expect(screen.getByText(/Owner/i)).toBeInTheDocument();
      });
    });

    it('should show empty state when no operators', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ operators: [], count: 0 }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText(/no operators configured/i)).toBeInTheDocument();
      });
    });
  });

  describe('Add Operator', () => {
    it('should render add operator button', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ operators: [], count: 0 }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add operator/i })).toBeInTheDocument();
      });
    });

    it('should open add dialog when button clicked', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ operators: [], count: 0 }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add operator/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add operator/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByLabelText(/player name/i)).toBeInTheDocument();
      });
    });

    it('should call add API with level when submitting', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ operators: [], count: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              operators: [{ name: 'NewOp', uuid: 'uuid-new', level: 4, role: 'Owner', bypassesPlayerLimit: true }],
              count: 1,
            }),
        });

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /add operator/i });
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/player name/i);
      fireEvent.change(input, { target: { value: 'NewOp' } });

      const submitButton = screen.getByRole('button', { name: /add op/i });
      fireEvent.click(submitButton);

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
  });

  describe('Operator Actions', () => {
    it('should render action menu button for each operator', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            operators: [{ name: 'Admin1', uuid: 'uuid-1', level: 4, role: 'Owner', bypassesPlayerLimit: true }],
            count: 1,
          }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /operator actions/i })).toBeInTheDocument();
      });
    });

    it('should open menu when action button clicked', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            operators: [{ name: 'Admin1', uuid: 'uuid-1', level: 4, role: 'Owner', bypassesPlayerLimit: true }],
            count: 1,
          }),
      });

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('Admin1')).toBeInTheDocument();
      });

      const menuButton = screen.getByRole('button', { name: /operator actions/i });
      fireEvent.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText(/change level/i)).toBeInTheDocument();
        expect(screen.getByText(/remove op/i)).toBeInTheDocument();
      });
    });

    it('should call remove API when remove menu item clicked', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              operators: [{ name: 'Admin1', uuid: 'uuid-1', level: 4, role: 'Owner', bypassesPlayerLimit: true }],
              count: 1,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ operators: [], count: 0 }),
        });

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        expect(screen.getByText('Admin1')).toBeInTheDocument();
      });

      const menuButton = screen.getByRole('button', { name: /operator actions/i });
      fireEvent.click(menuButton);

      await waitFor(() => {
        const removeItem = screen.getByText(/remove op/i);
        fireEvent.click(removeItem);
      });

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
          json: () => Promise.resolve({ operators: [], count: 0 }),
        })
        .mockResolvedValueOnce({
          ok: false,
        });

      renderWithTheme(<OpManager serverName="test-server" />);

      await waitFor(() => {
        const openButton = screen.getByRole('button', { name: /add operator/i });
        fireEvent.click(openButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/player name/i);
      fireEvent.change(input, { target: { value: 'NewOp' } });

      const addButton = screen.getByRole('button', { name: /add op/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to add/i)).toBeInTheDocument();
      });
    });
  });
});
