import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { ThemeProvider } from '@/theme';
import { RoutingTable } from './RoutingTable';
import { useStartServer } from '@/hooks/useMcctl';
import type { RouteInfo } from '@/ports/api/IMcctlApiClient';

vi.mock('@/hooks/useMcctl', () => ({
  useStartServer: vi.fn(),
}));

const mockStart = vi.fn();
const mockStartHook = (isPending = false) =>
  vi.mocked(useStartServer).mockReturnValue({ mutate: mockStart, isPending } as any);

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

beforeEach(() => {
  mockStart.mockReset();
  mockStartHook();
});

afterEach(() => {
  // @ts-expect-error restore jsdom default (no matchMedia)
  delete window.matchMedia;
});

describe('RoutingTable', () => {
  // A server row is the <tr> holding its name; expanded hostnames live in the next row.
  const rowOf = (server: string) => screen.getByText(server, { selector: 'p, span' }).closest('tr') as HTMLElement;
  const expand = (server: string) => fireEvent.click(screen.getByRole('button', { name: `Show hostnames of ${server}` }));

  it('renders one collapsed row per server', () => {
    renderTable();
    // header + survival, creative, modded
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getByText('3 servers · 5 hostnames')).toBeInTheDocument();
    for (const name of ['survival', 'creative', 'modded']) {
      expect(screen.getByRole('button', { name: `Show hostnames of ${name}` })).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('has Target, Status and Actions columns only', () => {
    renderTable();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Target', 'Status', 'Actions']);
  });

  it('shows the representative hostname with its type and the count of the others', () => {
    renderTable();
    const row = rowOf('survival');
    expect(within(row).getByText('survival.192.168.1.5.nip.io')).toBeInTheDocument();
    expect(within(row).getByText('nip.io')).toBeInTheDocument();
    expect(within(row).getByText('+2')).toBeInTheDocument();
    expect(within(row).getAllByLabelText('Copy to clipboard')).toHaveLength(1);
    expect(screen.queryByText('survival.local')).not.toBeInTheDocument();
    expect(screen.queryByText('aa-bb.craft.playit.gg')).not.toBeInTheDocument();
  });

  it('omits the count when a server has a single hostname', () => {
    renderTable();
    expect(within(rowOf('creative')).queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it('expands a server to list every hostname with type and copy button', () => {
    renderTable();
    expand('survival');
    expect(screen.getByRole('button', { name: 'Hide hostnames of survival' })).toHaveAttribute('aria-expanded', 'true');
    const list = screen.getByRole('list', { name: 'Hostnames of survival' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText('survival.local')).toBeInTheDocument();
    expect(within(items[0]).getByText('mDNS')).toBeInTheDocument();
    expect(within(items[2]).getByText('WAN')).toBeInTheDocument();
    expect(within(list).getAllByLabelText('Copy to clipboard')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Hide hostnames of survival' }));
    expect(screen.queryByRole('list', { name: 'Hostnames of survival' })).not.toBeInTheDocument();
  });

  it('shows target server name with type and version', () => {
    renderTable();
    expect(within(rowOf('creative')).getByText('FABRIC 1.20.4')).toBeInTheDocument();
  });

  it('shows status once per server, exited as warning and dead as error', () => {
    renderTable();
    const chip = within(rowOf('creative')).getByText('Stopped · wakes on connect').closest('.MuiChip-root');
    expect(chip).toHaveClass('MuiChip-colorWarning');
    expect(within(rowOf('modded')).getByText('Dead').closest('.MuiChip-root')).toHaveClass('MuiChip-colorError');
    expect(screen.getAllByText('Running')).toHaveLength(1);
  });

  it('links each row to the server detail page', () => {
    renderTable();
    expect(within(rowOf('creative')).getByRole('link', { name: 'Open creative' })).toHaveAttribute('href', '/servers/creative');
    expect(screen.getAllByRole('link', { name: 'Open survival' })).toHaveLength(1);
  });

  it('filters by hostname and opens the matching server', () => {
    renderTable();
    fireEvent.change(screen.getByLabelText('Search routes'), { target: { value: 'playit' } });
    expect(screen.queryByText('creative')).not.toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Hostnames of survival' });
    expect(within(list).getByText('aa-bb.craft.playit.gg')).toBeInTheDocument();
  });

  it('filters by server name, case-insensitively, without opening it', () => {
    renderTable();
    fireEvent.change(screen.getByLabelText('Search routes'), { target: { value: 'CREATIVE' } });
    expect(rowOf('creative')).toBeInTheDocument();
    expect(screen.queryByText('survival')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Hostnames of creative' })).not.toBeInTheDocument();
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

  it('renders one card per server instead of a table on xs', () => {
    setMobile(true);
    renderTable();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Routes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getAllByLabelText('Copy to clipboard')).toHaveLength(3);
    expand('survival');
    expect(within(screen.getByRole('list', { name: 'Hostnames of survival' })).getAllByRole('listitem')).toHaveLength(3);
  });

  it('keeps the hidden Actions header label 1px wide so it cannot widen the page', () => {
    renderTable();
    // sx treats width: 1 as 100%, which made this absolutely positioned label page-wide.
    const label = screen.getByText('Actions');
    expect(getComputedStyle(label).width).toBe('1px');
    expect(getComputedStyle(label).height).toBe('1px');
  });

  it('keeps servers that share a hostname apart without duplicate keys', () => {
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

  describe('row actions (#768)', () => {
    it('offers Start for stopped servers when auto-scale-up is off or unknown, and nothing for running ones', () => {
      renderTable();
      expect(within(rowOf('creative')).getByRole('button', { name: 'Start creative' })).toBeInTheDocument();
      expect(within(rowOf('survival')).queryByRole('button', { name: /^(Start|Wake)/ })).not.toBeInTheDocument();
      expect(within(rowOf('modded')).queryByRole('button', { name: /^(Start|Wake)/ })).not.toBeInTheDocument();
    });

    it('labels the action Wake and the status Sleeping when auto-scale-up is on', () => {
      renderTable([{ hostname: 'a.local', target: 'mc-a:25565', serverStatus: 'exited', autoScaleUp: true }]);
      const row = rowOf('a');
      expect(within(row).getByRole('button', { name: 'Wake a' })).toHaveTextContent('Wake');
      expect(within(row).getByText('Sleeping · wakes on connect')).toBeInTheDocument();
    });

    it('labels the action Start and the status Stopped when auto-scale-up is off', () => {
      renderTable([{ hostname: 'a.local', target: 'mc-a:25565', serverStatus: 'exited', autoScaleUp: false }]);
      const row = rowOf('a');
      expect(within(row).getByRole('button', { name: 'Start a' })).toHaveTextContent('Start');
      expect(within(row).getByText('Stopped')).toBeInTheDocument();
    });

    it('starts the server by name when clicked', () => {
      renderTable();
      fireEvent.click(within(rowOf('creative')).getByRole('button', { name: 'Start creative' }));
      expect(mockStart).toHaveBeenCalledWith('creative', expect.anything());
    });

    it('shows why a start failed instead of failing silently', async () => {
      mockStart.mockImplementation((_name, opts) => opts?.onError?.(new Error('Forbidden: manage permission required')));
      renderTable();
      fireEvent.click(within(rowOf('creative')).getByRole('button', { name: 'Start creative' }));
      expect(await within(rowOf('creative')).findByText('Start failed')).toBeInTheDocument();
      expect(within(rowOf('creative')).getByLabelText(/Forbidden: manage permission required/)).toBeInTheDocument();
    });

    it('does not bubble the click to the row', () => {
      const onClick = vi.fn();
      render(
        <ThemeProvider>
          <div onClick={onClick}>
            <RoutingTable routes={[routes[3]]} playitDomains={[]} />
          </div>
        </ThemeProvider>
      );
      fireEvent.click(screen.getByRole('button', { name: 'Start creative' }));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('disables the action and shows a spinner while starting', () => {
      mockStartHook(true);
      renderTable();
      const button = within(rowOf('creative')).getByRole('button', { name: 'Start creative' });
      expect(button).toBeDisabled();
      expect(within(button).getByRole('progressbar')).toBeInTheDocument();
    });

    it('links straight to the hostnames section of the server', () => {
      renderTable();
      expect(within(rowOf('creative')).getByRole('link', { name: 'Edit hostnames of creative' })).toHaveAttribute(
        'href',
        '/servers/creative?tab=Options#hostnames'
      );
    });

    it('summarises unrouted hostnames on the collapsed row and flags each one when expanded', () => {
      renderTable([
        { hostname: 'a.local', target: 'mc-a:25565', serverStatus: 'running', discoveredByRouter: false },
        { hostname: 'a.1.2.3.4.nip.io', target: 'mc-a:25565', serverStatus: 'running', discoveredByRouter: true },
        { hostname: 'b.local', target: 'mc-b:25565', serverStatus: 'running', discoveredByRouter: true },
        { hostname: 'c.local', target: 'mc-c:25565', serverStatus: 'running' },
      ]);
      const chip = within(rowOf('a')).getByText('1 not routed').closest('.MuiChip-root');
      expect(chip).toHaveClass('MuiChip-colorWarning');
      expect(within(rowOf('b')).queryByText(/not routed/i)).not.toBeInTheDocument();
      expect(within(rowOf('c')).queryByText(/not routed/i)).not.toBeInTheDocument();

      expand('a');
      const items = within(screen.getByRole('list', { name: 'Hostnames of a' })).getAllByRole('listitem');
      expect(within(items[0]).getByText('Not routed')).toBeInTheDocument();
      expect(within(items[1]).queryByText('Not routed')).not.toBeInTheDocument();
    });

    it('explains Not routed in a tooltip', () => {
      renderTable([{ hostname: 'a.local', target: 'mc-a:25565', serverStatus: 'running', discoveredByRouter: false }]);
      expect(screen.getByLabelText(/mc-router has not registered/i)).toBeInTheDocument();
    });

    it('renders the same actions in the xs card list', () => {
      setMobile(true);
      renderTable([
        { hostname: 'a.local', target: 'mc-a:25565', serverStatus: 'exited', autoScaleUp: true, discoveredByRouter: false },
      ]);
      const item = within(screen.getByRole('list', { name: 'Routes' })).getAllByRole('listitem')[0];
      expect(within(item).getByRole('button', { name: 'Wake a' })).toBeInTheDocument();
      expect(within(item).getByRole('link', { name: 'Edit hostnames of a' })).toBeInTheDocument();
      expect(within(item).getByRole('link', { name: 'Open a' })).toBeInTheDocument();
      expect(within(item).getByText('1 not routed')).toBeInTheDocument();
      fireEvent.click(within(item).getByRole('button', { name: 'Wake a' }));
      expect(mockStart).toHaveBeenCalledWith('a', expect.anything());
    });
  });
});
