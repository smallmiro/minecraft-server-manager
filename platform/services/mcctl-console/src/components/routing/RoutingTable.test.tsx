import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { ThemeProvider } from '@/theme';
import { RoutingTable } from './RoutingTable';
import type { RouteInfo } from '@/ports/api/IMcctlApiClient';

const routes: RouteInfo[] = [
  { hostname: 'survival.local', target: 'mc-survival:25565', serverStatus: 'running', serverType: 'PAPER', serverVersion: '1.21.1' },
  { hostname: 'survival.192.168.1.5.nip.io', target: 'mc-survival:25565', serverStatus: 'running', serverType: 'PAPER', serverVersion: '1.21.1' },
  { hostname: 'aa-bb.craft.playit.gg', target: 'mc-survival:25565', serverStatus: 'running' },
  { hostname: 'creative.local', target: 'mc-creative:25565', serverStatus: 'exited', serverType: 'FABRIC', serverVersion: '1.20.4' },
  { hostname: 'mc.example.com', target: 'mc-modded:25565', serverStatus: 'dead' },
];

const setMobile = (matches: boolean) =>
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }),
  });

const renderTable = (r: RouteInfo[] = routes, playit: Array<string | null> = ['aa-bb.craft.playit.gg', null]) =>
  render(
    <ThemeProvider>
      <RoutingTable routes={r} playitDomains={playit} />
    </ThemeProvider>
  );

afterEach(() => {
  // @ts-expect-error restore jsdom default (no matchMedia)
  delete window.matchMedia;
});

describe('RoutingTable', () => {
  it('renders every hostname on its own row without expanding anything', () => {
    renderTable();
    const rows = screen.getAllByRole('row');
    // header + 5 routes
    expect(rows).toHaveLength(6);
    for (const r of routes) expect(screen.getByText(r.hostname)).toBeInTheDocument();
  });

  it('offers a copy button for each hostname', () => {
    renderTable();
    expect(screen.getAllByLabelText('Copy to clipboard')).toHaveLength(routes.length);
  });

  it('shows the correct type badge per hostname', () => {
    renderTable();
    const rowOf = (host: string) => screen.getByText(host).closest('tr') as HTMLElement;
    expect(within(rowOf('survival.local')).getByText('mDNS')).toBeInTheDocument();
    expect(within(rowOf('survival.192.168.1.5.nip.io')).getByText('nip.io')).toBeInTheDocument();
    expect(within(rowOf('aa-bb.craft.playit.gg')).getByText('WAN')).toBeInTheDocument();
    expect(within(rowOf('mc.example.com')).getByText('Custom')).toBeInTheDocument();
  });

  it('shows target server name with type and version', () => {
    renderTable();
    const row = screen.getByText('creative.local').closest('tr') as HTMLElement;
    expect(within(row).getByText('creative')).toBeInTheDocument();
    expect(within(row).getByText('FABRIC 1.20.4')).toBeInTheDocument();
  });

  it('shows exited servers as warning with wakes-on-connect, not error', () => {
    renderTable();
    const row = screen.getByText('creative.local').closest('tr') as HTMLElement;
    const chip = within(row).getByText('Stopped · wakes on connect').closest('.MuiChip-root') as HTMLElement;
    expect(chip).toHaveClass('MuiChip-colorWarning');
    const dead = within(screen.getByText('mc.example.com').closest('tr') as HTMLElement)
      .getByText('Dead')
      .closest('.MuiChip-root');
    expect(dead).toHaveClass('MuiChip-colorError');
  });

  it('links each row to the server detail page', () => {
    renderTable();
    const row = screen.getByText('creative.local').closest('tr') as HTMLElement;
    expect(within(row).getByRole('link', { name: 'Open creative' })).toHaveAttribute('href', '/servers/creative');
  });

  it('filters by hostname', () => {
    renderTable();
    fireEvent.change(screen.getByLabelText('Search routes'), { target: { value: 'nip.io' } });
    expect(screen.getByText('survival.192.168.1.5.nip.io')).toBeInTheDocument();
    expect(screen.queryByText('survival.local')).not.toBeInTheDocument();
  });

  it('filters by server name, case-insensitively', () => {
    renderTable();
    fireEvent.change(screen.getByLabelText('Search routes'), { target: { value: 'CREATIVE' } });
    expect(screen.getByText('creative.local')).toBeInTheDocument();
    expect(screen.queryByText('survival.local')).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', () => {
    renderTable();
    fireEvent.change(screen.getByLabelText('Search routes'), { target: { value: 'zzz' } });
    expect(screen.getByText('No routes match "zzz"')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no routes', () => {
    renderTable([]);
    expect(screen.getByText('No routes configured')).toBeInTheDocument();
  });

  it('renders a card list instead of a table on xs', () => {
    setMobile(true);
    renderTable();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Routes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(routes.length);
    expect(within(list).getAllByLabelText('Copy to clipboard')).toHaveLength(routes.length);
  });

  it('keeps the hidden Actions header label 1px wide so it cannot widen the page', () => {
    renderTable();
    // sx treats width: 1 as 100%, which made this absolutely positioned label page-wide.
    const label = screen.getByText('Actions');
    expect(getComputedStyle(label).width).toBe('1px');
    expect(getComputedStyle(label).height).toBe('1px');
  });

  it('renders rows that share a hostname without duplicate keys', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderTable([
      { hostname: 'play.example.com', target: 'mc-a:25565', serverStatus: 'running' },
      { hostname: 'play.example.com', target: 'mc-b:25565', serverStatus: 'exited' },
    ]);
    expect(screen.getAllByText('play.example.com')).toHaveLength(2);
    expect(errorSpy.mock.calls.flat().join(' ')).not.toMatch(/same key/);
    errorSpy.mockRestore();
  });

  it('picks the xs card list on the first render, without a table pass', () => {
    setMobile(true);
    const html = renderToString(
      <ThemeProvider>
        <RoutingTable routes={routes} playitDomains={[]} />
      </ThemeProvider>
    );
    expect(html).toContain('aria-label="Routes"');
    expect(html).not.toContain('<table');
  });
});
