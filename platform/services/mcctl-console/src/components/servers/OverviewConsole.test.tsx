import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { OverviewConsole, getConsoleUnavailableReason } from './OverviewConsole';

const logsState = vi.hoisted(() => ({
  logs: [] as string[],
  isConnected: true,
  retryCount: 0,
  clearLogs: vi.fn(),
}));

vi.mock('@/hooks/useServerLogs', () => ({
  useServerLogs: () => ({
    logs: logsState.logs,
    isConnected: logsState.isConnected,
    retryCount: logsState.retryCount,
    clearLogs: logsState.clearLogs,
    reconnect: vi.fn(),
  }),
}));

function renderConsole(props: Partial<React.ComponentProps<typeof OverviewConsole>> = {}) {
  return render(
    <ThemeProvider>
      <OverviewConsole serverName="alpha" serverStatus="running" {...props} />
    </ThemeProvider>,
  );
}

const input = () => screen.getByRole('textbox', { name: 'Console command' });

describe('getConsoleUnavailableReason', () => {
  it('returns null when the console is usable', () => {
    expect(getConsoleUnavailableReason('running', true, 0)).toBeNull();
  });

  it('explains a stopped server', () => {
    expect(getConsoleUnavailableReason('stopped', false, 0)).toMatch(/not running/i);
  });

  it('explains connecting and reconnecting', () => {
    expect(getConsoleUnavailableReason('running', false, 0)).toMatch(/connecting/i);
    expect(getConsoleUnavailableReason('running', false, 3)).toMatch(/reconnecting.*3/i);
  });
});

describe('OverviewConsole', () => {
  beforeEach(() => {
    logsState.logs = [];
    logsState.isConnected = true;
    logsState.retryCount = 0;
    logsState.clearLogs.mockClear();
  });

  it('colours lines by event and wraps long lines', () => {
    logsState.logs = [
      '[10:00:00] [Server thread/WARN]: Can\'t keep up!',
      '[10:00:01] [Server thread/ERROR]: Boom',
      '[10:00:02] [Server thread/INFO]: Steve joined the game',
      '[10:00:03] [Server thread/INFO]: Steve left the game',
      '[10:00:04] [Server thread/INFO]: Done (3.1s)! For help, type "help"',
    ];
    renderConsole();

    const lines = screen.getAllByTestId('console-line');
    expect(lines.map((line) => line.getAttribute('data-log-event'))).toEqual([
      'warn',
      'error',
      'join',
      'leave',
      'done',
    ]);
    expect(screen.getByRole('log', { name: 'Console output' })).toHaveStyle({
      whiteSpace: 'pre-wrap',
    });
  });

  it('sends with the Send button and clears the input', async () => {
    const onSendCommand = vi.fn().mockResolvedValue(undefined);
    renderConsole({ onSendCommand });

    fireEvent.change(input(), { target: { value: '/say hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send command' }));

    await waitFor(() => expect(onSendCommand).toHaveBeenCalledWith('/say hi'));
    await waitFor(() => expect(input()).toHaveValue(''));
  });

  it('sends with Enter', async () => {
    const onSendCommand = vi.fn().mockResolvedValue(undefined);
    renderConsole({ onSendCommand });

    fireEvent.change(input(), { target: { value: 'list' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    await waitFor(() => expect(onSendCommand).toHaveBeenCalledWith('list'));
  });

  it('shows a failed send inline and keeps the command', async () => {
    const onSendCommand = vi.fn().mockRejectedValue(new Error('RCON unavailable'));
    renderConsole({ onSendCommand });

    fireEvent.change(input(), { target: { value: '/list' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send command' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('RCON unavailable');
    expect(input()).toHaveValue('/list');
  });

  it('disables sending while a command is in flight', async () => {
    let resolve: () => void = () => {};
    const onSendCommand = vi.fn(
      () => new Promise<void>((done) => {
        resolve = done;
      }),
    );
    renderConsole({ onSendCommand });

    fireEvent.change(input(), { target: { value: '/list' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send command' }));

    expect(screen.getByRole('button', { name: 'Send command' })).toBeDisabled();
    await act(async () => resolve());
  });

  it('fills the input from a quick command chip without running it', () => {
    const onSendCommand = vi.fn();
    renderConsole({ onSendCommand });

    fireEvent.click(screen.getByRole('button', { name: '/save-all' }));

    expect(input()).toHaveValue('/save-all');
    expect(onSendCommand).not.toHaveBeenCalled();
  });

  it('offers expand, clear and download in the header toolbar', () => {
    const onExpand = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:logs');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    logsState.logs = ['[10:00:00] [Server thread/INFO]: hello'];
    renderConsole({ onExpand });

    const toolbar = screen.getByRole('toolbar', { name: 'Console tools' });
    fireEvent.click(screen.getByRole('button', { name: 'Expand console' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear console' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download logs' }));

    expect(toolbar).toContainElement(screen.getByRole('button', { name: 'Expand console' }));
    expect(onExpand).toHaveBeenCalled();
    expect(logsState.clearLogs).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('shows why the console is unavailable and disables input', () => {
    logsState.isConnected = false;
    logsState.retryCount = 2;
    renderConsole();

    expect(input()).toBeDisabled();
    expect(screen.getByText(/reconnecting.*2/i)).toBeInTheDocument();
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('uses a prompt and an example placeholder', () => {
    renderConsole();

    expect(screen.getByText('>')).toBeInTheDocument();
    expect(input()).toHaveAttribute('placeholder', expect.stringMatching(/\/say.*\/whitelist.*\/tp/));
  });
});
