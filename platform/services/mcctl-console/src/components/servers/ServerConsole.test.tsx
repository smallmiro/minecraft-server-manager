/**
 * ServerConsole Component Tests
 * TDD: Tests written first following Red-Green-Refactor cycle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { ServerConsole } from './ServerConsole';

// Mock the useServerLogs hook
const mockUseServerLogs = vi.fn();
vi.mock('@/hooks/useServerLogs', () => ({
  useServerLogs: (options: { serverName: string }) => mockUseServerLogs(options),
}));

// Mock fetch for command execution
const mockFetch = vi.fn();
global.fetch = mockFetch;

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('ServerConsole', () => {
  const defaultHookReturn = {
    logs: [],
    isConnected: true,
    clearLogs: vi.fn(),
    reconnect: vi.fn(),
    retryCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseServerLogs.mockReturnValue(defaultHookReturn);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ output: 'Command executed' }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the console container', () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      expect(screen.getByTestId('server-console')).toBeInTheDocument();
    });

    it('should display connection status indicator when connected', () => {
      mockUseServerLogs.mockReturnValue({
        ...defaultHookReturn,
        isConnected: true,
      });

      renderWithTheme(<ServerConsole serverName="test-server" />);

      expect(screen.getByTestId('connection-status')).toBeInTheDocument();
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });

    it('should display disconnected status when not connected', () => {
      mockUseServerLogs.mockReturnValue({
        ...defaultHookReturn,
        isConnected: false,
      });

      renderWithTheme(<ServerConsole serverName="test-server" />);

      expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
    });

    it('should display reconnecting status with retry count', () => {
      mockUseServerLogs.mockReturnValue({
        ...defaultHookReturn,
        isConnected: false,
        retryCount: 3,
      });

      renderWithTheme(<ServerConsole serverName="test-server" />);

      expect(screen.getByText(/retry.*3/i)).toBeInTheDocument();
    });

    it('should render command input field', () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      expect(screen.getByPlaceholderText(/enter command/i)).toBeInTheDocument();
    });

    it('should render send button', () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });
  });

  describe('Log Display', () => {
    it('should display log messages', () => {
      mockUseServerLogs.mockReturnValue({
        ...defaultHookReturn,
        logs: [
          '[12:00:00] [Server thread/INFO]: Server started',
          '[12:00:01] [Server thread/INFO]: Player joined',
        ],
      });

      renderWithTheme(<ServerConsole serverName="test-server" />);

      expect(screen.getByText(/Server started/)).toBeInTheDocument();
      expect(screen.getByText(/Player joined/)).toBeInTheDocument();
    });

    it('should render empty state when no logs', () => {
      mockUseServerLogs.mockReturnValue({
        ...defaultHookReturn,
        logs: [],
      });

      renderWithTheme(<ServerConsole serverName="test-server" />);

      expect(screen.getByText(/waiting for logs/i)).toBeInTheDocument();
    });

    it('should call clearLogs when clear button is clicked', () => {
      const clearLogs = vi.fn();
      mockUseServerLogs.mockReturnValue({
        ...defaultHookReturn,
        logs: ['[12:00:00] [Server thread/INFO]: Test log'],
        clearLogs,
      });

      renderWithTheme(<ServerConsole serverName="test-server" />);

      const clearButton = screen.getByRole('button', { name: /clear/i });
      fireEvent.click(clearButton);

      expect(clearLogs).toHaveBeenCalled();
    });
  });

  describe('Log Level Filtering', () => {
    it('should render log level filter buttons', () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /info/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /warn/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /error/i })).toBeInTheDocument();
    });

    it('should filter logs by INFO level', () => {
      mockUseServerLogs.mockReturnValue({
        ...defaultHookReturn,
        logs: [
          '[12:00:00] [Server thread/INFO]: Info message',
          '[12:00:01] [Server thread/WARN]: Warn message',
          '[12:00:02] [Server thread/ERROR]: Error message',
        ],
      });

      renderWithTheme(<ServerConsole serverName="test-server" />);

      const infoButton = screen.getByRole('button', { name: /info/i });
      fireEvent.click(infoButton);

      expect(screen.getByText(/Info message/)).toBeInTheDocument();
      expect(screen.queryByText(/Warn message/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Error message/)).not.toBeInTheDocument();
    });

    it('should filter logs by WARN level', () => {
      mockUseServerLogs.mockReturnValue({
        ...defaultHookReturn,
        logs: [
          '[12:00:00] [Server thread/INFO]: Info message',
          '[12:00:01] [Server thread/WARN]: Warn message',
          '[12:00:02] [Server thread/ERROR]: Error message',
        ],
      });

      renderWithTheme(<ServerConsole serverName="test-server" />);

      const warnButton = screen.getByRole('button', { name: /warn/i });
      fireEvent.click(warnButton);

      expect(screen.queryByText(/Info message/)).not.toBeInTheDocument();
      expect(screen.getByText(/Warn message/)).toBeInTheDocument();
      expect(screen.queryByText(/Error message/)).not.toBeInTheDocument();
    });

    it('should filter logs by ERROR level', () => {
      mockUseServerLogs.mockReturnValue({
        ...defaultHookReturn,
        logs: [
          '[12:00:00] [Server thread/INFO]: Info message',
          '[12:00:01] [Server thread/WARN]: Warn message',
          '[12:00:02] [Server thread/ERROR]: Error message',
        ],
      });

      renderWithTheme(<ServerConsole serverName="test-server" />);

      const errorButton = screen.getByRole('button', { name: /error/i });
      fireEvent.click(errorButton);

      expect(screen.queryByText(/Info message/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Warn message/)).not.toBeInTheDocument();
      expect(screen.getByText(/Error message/)).toBeInTheDocument();
    });

    it('should show all logs when ALL filter is selected', () => {
      mockUseServerLogs.mockReturnValue({
        ...defaultHookReturn,
        logs: [
          '[12:00:00] [Server thread/INFO]: Info message',
          '[12:00:01] [Server thread/WARN]: Warn message',
        ],
      });

      renderWithTheme(<ServerConsole serverName="test-server" />);

      // First filter to INFO only
      const infoButton = screen.getByRole('button', { name: /info/i });
      fireEvent.click(infoButton);

      // Then click ALL
      const allButton = screen.getByRole('button', { name: /all/i });
      fireEvent.click(allButton);

      expect(screen.getByText(/Info message/)).toBeInTheDocument();
      expect(screen.getByText(/Warn message/)).toBeInTheDocument();
    });
  });

  describe('Command Execution', () => {
    it('should execute command when send button is clicked', async () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      const input = screen.getByPlaceholderText(/enter command/i);
      fireEvent.change(input, { target: { value: 'say Hello World' } });

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/servers/test-server/exec',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ command: 'say Hello World' }),
          })
        );
      });
    });

    it('should execute command on Enter key press', async () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      const input = screen.getByPlaceholderText(/enter command/i);
      fireEvent.change(input, { target: { value: 'list' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/servers/test-server/exec',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ command: 'list' }),
          })
        );
      });
    });

    it('should clear input after command execution', async () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      const input = screen.getByPlaceholderText(/enter command/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'say Hello' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('should not execute empty command', () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should disable send button when input is empty', () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeDisabled();
    });

    it('should disable send button while command is executing', async () => {
      // Make fetch return a promise that doesn't resolve immediately
      let resolvePromise: (value: unknown) => void;
      mockFetch.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      renderWithTheme(<ServerConsole serverName="test-server" />);

      const input = screen.getByPlaceholderText(/enter command/i);
      fireEvent.change(input, { target: { value: 'say Hello' } });

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(sendButton).toBeDisabled();
      });

      // Resolve the promise
      act(() => {
        resolvePromise!({ ok: true, json: () => Promise.resolve({ output: '' }) });
      });
    });
  });

  describe('Command History', () => {
    it('should navigate to previous command with ArrowUp', async () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      const input = screen.getByPlaceholderText(/enter command/i) as HTMLInputElement;

      // Execute first command
      fireEvent.change(input, { target: { value: 'command1' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Wait for command to execute
      await waitFor(() => {
        expect(input.value).toBe('');
      });

      // Execute second command
      fireEvent.change(input, { target: { value: 'command2' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(input.value).toBe('');
      });

      // Press ArrowUp to get last command
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      expect(input.value).toBe('command2');
    });

    it('should navigate to next command with ArrowDown', async () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      const input = screen.getByPlaceholderText(/enter command/i) as HTMLInputElement;

      // Execute commands
      fireEvent.change(input, { target: { value: 'command1' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(input.value).toBe(''));

      fireEvent.change(input, { target: { value: 'command2' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(input.value).toBe(''));

      // Navigate up twice, then down once
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      expect(input.value).toBe('command2');
    });

    it('should clear input on ArrowDown past the end of history', async () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      const input = screen.getByPlaceholderText(/enter command/i) as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'command1' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(input.value).toBe(''));

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      expect(input.value).toBe('');
    });
  });

  describe('Quick Command Buttons', () => {
    it('should render quick command buttons', () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      expect(screen.getByRole('button', { name: /^say$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^give$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^tp$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^gamemode$/i })).toBeInTheDocument();
    });

    it('should populate input with quick command template', () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      const sayButton = screen.getByRole('button', { name: /^say$/i });
      fireEvent.click(sayButton);

      const input = screen.getByPlaceholderText(/enter command/i) as HTMLInputElement;
      expect(input.value).toBe('say ');
    });

    it('should focus input after clicking quick command', () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      const giveButton = screen.getByRole('button', { name: /^give$/i });
      fireEvent.click(giveButton);

      const input = screen.getByPlaceholderText(/enter command/i);
      expect(document.activeElement).toBe(input);
    });
  });

  describe('Auto-scroll Toggle', () => {
    it('should render auto-scroll toggle', () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      expect(screen.getByRole('checkbox', { name: /auto-scroll/i })).toBeInTheDocument();
    });

    it('should have auto-scroll enabled by default', () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      const toggle = screen.getByRole('checkbox', { name: /auto-scroll/i });
      expect(toggle).toBeChecked();
    });

    it('should toggle auto-scroll when clicked', () => {
      renderWithTheme(<ServerConsole serverName="test-server" />);

      const toggle = screen.getByRole('checkbox', { name: /auto-scroll/i });
      fireEvent.click(toggle);

      expect(toggle).not.toBeChecked();
    });
  });

  describe('Reconnect Button', () => {
    it('should call reconnect when reconnect button is clicked', () => {
      const reconnect = vi.fn();
      mockUseServerLogs.mockReturnValue({
        ...defaultHookReturn,
        isConnected: false,
        reconnect,
      });

      renderWithTheme(<ServerConsole serverName="test-server" />);

      const reconnectButton = screen.getByRole('button', { name: /reconnect/i });
      fireEvent.click(reconnectButton);

      expect(reconnect).toHaveBeenCalled();
    });

    it('should not show reconnect button when connected', () => {
      mockUseServerLogs.mockReturnValue({
        ...defaultHookReturn,
        isConnected: true,
      });

      renderWithTheme(<ServerConsole serverName="test-server" />);

      expect(screen.queryByRole('button', { name: /reconnect/i })).not.toBeInTheDocument();
    });
  });

  describe('Hook Integration', () => {
    it('should call useServerLogs with correct server name', () => {
      renderWithTheme(<ServerConsole serverName="my-server" />);

      expect(mockUseServerLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          serverName: 'my-server',
        })
      );
    });
  });
});
