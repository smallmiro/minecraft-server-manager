import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { RouterLogPanel } from './RouterLogPanel';
import { useRouterLogStream, type RouterLogEntry } from '@/hooks/useRouterLogStream';

vi.mock('@/hooks/useRouterLogStream', () => ({
  useRouterLogStream: vi.fn(),
}));

const clear = vi.fn();

const mockStream = (events: RouterLogEntry[], status: 'connecting' | 'live' | 'disconnected' | 'ended' = 'live') =>
  vi.mocked(useRouterLogStream).mockReturnValue({ events, status, clear });

const entry = (id: number, e: Partial<RouterLogEntry> & Pick<RouterLogEntry, 'kind' | 'raw'>): RouterLogEntry => ({
  id,
  ...e,
});

const renderPanel = () =>
  render(
    <ThemeProvider>
      <RouterLogPanel />
    </ThemeProvider>
  );

describe('RouterLogPanel', () => {
  beforeEach(() => {
    clear.mockReset();
  });

  it('has a heading and an empty state', () => {
    mockStream([]);
    renderPanel();
    expect(screen.getByRole('heading', { name: 'Live Router Log' })).toBeInTheDocument();
    expect(screen.getByText('No router log lines yet.')).toBeInTheDocument();
  });

  it.each([
    ['connecting', 'Connecting'],
    ['live', 'Live'],
    ['disconnected', 'Disconnected'],
    ['ended', 'Ended'],
  ] as const)('shows the %s connection status', (status, label) => {
    mockStream([], status);
    renderPanel();
    expect(screen.getByLabelText('Log stream status')).toHaveTextContent(label);
  });

  it('shows time, hostname -> target and player for connect and wake events', () => {
    mockStream([
      entry(1, {
        kind: 'connect',
        ts: '2026-10-24T09:08:07Z',
        hostname: 'survival.local',
        target: 'mc-survival:25565',
        player: 'Steve',
        raw: 'raw connect',
      }),
      entry(2, { kind: 'wake', hostname: 'creative.local', target: 'mc-creative:25565', raw: 'raw wake' }),
    ]);
    renderPanel();
    const rows = screen.getAllByTestId('router-log-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('09:08:07');
    expect(rows[0]).toHaveTextContent('survival.local → mc-survival:25565');
    expect(rows[0]).toHaveTextContent('Steve');
    expect(rows[0]).toHaveAttribute('data-kind', 'connect');
    expect(rows[1]).toHaveTextContent('creative.local → mc-creative:25565');
    expect(rows[1]).toHaveAttribute('data-kind', 'wake');
  });

  it('labels each line with its kind in text, so wake-ups stand out without relying on colour', () => {
    mockStream([
      entry(1, { kind: 'connect', hostname: 'a.local', target: 'mc-a:25565', raw: 'c' }),
      entry(2, { kind: 'wake', hostname: 'b.local', raw: 'w' }),
      entry(3, { kind: 'error', raw: 'e' }),
    ]);
    renderPanel();
    const rows = screen.getAllByTestId('router-log-row');
    expect(rows[0]).toHaveTextContent('CONNECT');
    expect(rows[1]).toHaveTextContent('WAKE');
    expect(rows[2]).toHaveTextContent('ERROR');
  });

  it('shows only the hostname for a scale-up line that has no target yet', () => {
    mockStream([entry(1, { kind: 'wake', hostname: 'creative.local', raw: 'scaling up' })]);
    renderPanel();
    const row = screen.getByTestId('router-log-row');
    expect(row).toHaveTextContent('creative.local');
    expect(row).not.toHaveTextContent('?');
    expect(row).not.toHaveTextContent('→');
  });

  it('shows raw for info and error events', () => {
    mockStream([entry(1, { kind: 'info', raw: 'Listening on 25565' }), entry(2, { kind: 'error', raw: 'boom' })]);
    renderPanel();
    expect(screen.getByText('Listening on 25565')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('renders log content as text, never as HTML', () => {
    mockStream([entry(1, { kind: 'info', raw: '<b>bold</b> <img src=x onerror=alert(1)>' })]);
    const { container } = renderPanel();
    expect(screen.getByText('<b>bold</b> <img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('clears the log', () => {
    mockStream([entry(1, { kind: 'info', raw: 'x' })]);
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('has an auto-scroll switch that is on by default and keeps the log scrolled to the end', () => {
    mockStream([entry(1, { kind: 'info', raw: 'x' })]);
    renderPanel();
    const toggle = screen.getByRole('checkbox', { name: 'Auto-scroll' });
    expect(toggle).toBeChecked();
    const log = screen.getByRole('log');
    Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 1234 });
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
  });

  it('scrolls to the bottom on new events only while auto-scroll is on', () => {
    mockStream([entry(1, { kind: 'info', raw: 'a' })]);
    const { rerender } = renderPanel();
    const log = screen.getByRole('log');
    Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 900 });

    mockStream([entry(1, { kind: 'info', raw: 'a' }), entry(2, { kind: 'info', raw: 'b' })]);
    rerender(
      <ThemeProvider>
        <RouterLogPanel />
      </ThemeProvider>
    );
    expect(log.scrollTop).toBe(900);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Auto-scroll' }));
    log.scrollTop = 5;
    Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 1800 });
    mockStream([
      entry(1, { kind: 'info', raw: 'a' }),
      entry(2, { kind: 'info', raw: 'b' }),
      entry(3, { kind: 'info', raw: 'c' }),
    ]);
    rerender(
      <ThemeProvider>
        <RouterLogPanel />
      </ThemeProvider>
    );
    expect(log.scrollTop).toBe(5);
  });

  it('wraps long lines instead of scrolling the page horizontally', () => {
    mockStream([entry(1, { kind: 'info', raw: 'x'.repeat(500) })]);
    renderPanel();
    expect(within(screen.getByRole('log')).getByTestId('router-log-row')).toHaveStyle({ overflowWrap: 'anywhere' });
  });
});
