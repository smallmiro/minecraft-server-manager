import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
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

const toggleOf = (server: string) => screen.getByRole('button', { name: `Show domains of ${server}` });
const rowOf = (server: string) => toggleOf(server).closest('tr') as HTMLElement;
const domainsOf = (server: string) =>
  document.getElementById(toggleOf(server).getAttribute('aria-controls') as string) as HTMLElement;
const expand = (server: string) => fireEvent.click(toggleOf(server));

describe('RoutingTable', () => {
  it('renders one collapsed row per server', () => {
    renderTable();
    expect(screen.getAllByRole('button', { name: /^Show domains of / })).toHaveLength(3);
    for (const server of ['survival', 'creative', 'modded']) {
      expect(toggleOf(server)).toHaveAttribute('aria-expanded', 'false');
    }
    expect(screen.queryByText('survival.local')).not.toBeInTheDocument();
  });

  it('counts servers and hostnames in the header', () => {
    renderTable();
    expect(screen.getByText('3 servers · 5 hostnames')).toBeInTheDocument();
  });

  it('uses singular words for one server with one hostname', () => {
    renderTable([routes[3]]);
    expect(screen.getByText('1 server · 1 hostname')).toBeInTheDocument();
  });

  it('has no separate Domains column', () => {
    renderTable();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['', 'Server', 'Status', 'Actions']);
  });

  it('shows only the primary address, its type and how many more there are in the collapsed row', () => {
    renderTable();
    const row = rowOf('survival');
    expect(within(row).getByText('survival.192.168.1.5.nip.io')).toBeInTheDocument();
    expect(within(row).getByText('+2')).toBeInTheDocument();
    expect(within(row).getByText('nip.io')).toBeInTheDocument();
    expect(within(row).queryByText('mDNS')).not.toBeInTheDocument();
    expect(within(row).queryByText('WAN')).not.toBeInTheDocument();
    expect(within(rowOf('modded')).getByText('Custom')).toBeInTheDocument();
    expect(within(rowOf('creative')).queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('shows the primary address under the server name', () => {
    renderTable();
    const cell = within(rowOf('survival')).getByText('survival').closest('td') as HTMLElement;
    expect(within(cell).getByText('survival.192.168.1.5.nip.io')).toBeInTheDocument();
  });

  it('does not count hostnames per type in the collapsed row', () => {
    renderTable([
      { hostname: 'a.1.1.1.1.nip.io', target: 'mc-a:25565', serverStatus: 'running' },
      { hostname: 'a.2.2.2.2.nip.io', target: 'mc-a:25565', serverStatus: 'running' },
    ]);
    expect(within(rowOf('a')).queryByText(/×/)).not.toBeInTheDocument();
    expect(within(rowOf('a')).getByText('+1')).toBeInTheDocument();
  });

  it('does not show an unrouted hostname as the primary address when a routed one exists', () => {
    renderTable([
      { hostname: 'a.1.1.1.1.nip.io', target: 'mc-a:25565', serverStatus: 'running', discoveredByRouter: false },
      { hostname: 'a.local', target: 'mc-a:25565', serverStatus: 'running', discoveredByRouter: true },
    ]);
    expect(within(rowOf('a')).getByText('a.local')).toBeInTheDocument();
    expect(within(rowOf('a')).queryByText('a.1.1.1.1.nip.io')).not.toBeInTheDocument();
  });

  it('offers a copy button for the primary address of each collapsed server', () => {
    renderTable();
    expect(screen.getAllByLabelText('Copy to clipboard')).toHaveLength(3);
  });

  it('lists every hostname of a server with copy and type when expanded', () => {
    renderTable();
    expand('survival');
    expect(toggleOf('survival')).toHaveAttribute('aria-expanded', 'true');
    const domains = domainsOf('survival');
    const items = within(domains).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('survival.192.168.1.5.nip.io'),
      expect.stringContaining('survival.local'),
      expect.stringContaining('aa-bb.craft.playit.gg'),
    ]);
    expect(within(domains).getAllByLabelText('Copy to clipboard')).toHaveLength(3);
    expect(within(items[1]).getByText('mDNS')).toBeInTheDocument();
    expect(within(items[2]).getByText('WAN')).toBeInTheDocument();
  });

  it('expands when the row itself is clicked and collapses on the next click', async () => {
    renderTable();
    fireEvent.click(within(rowOf('survival')).getByText('PAPER 1.21.1'));
    expect(screen.getByText('survival.local')).toBeInTheDocument();
    fireEvent.click(within(rowOf('survival')).getByText('PAPER 1.21.1'));
    expect(toggleOf('survival')).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.queryByText('survival.local')).not.toBeInTheDocument());
  });

  it('keeps several servers open at once', () => {
    renderTable();
    expand('survival');
    expand('creative');
    expect(toggleOf('survival')).toHaveAttribute('aria-expanded', 'true');
    expect(toggleOf('creative')).toHaveAttribute('aria-expanded', 'true');
  });

  it('expands and collapses every server at once', () => {
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    for (const server of ['survival', 'creative', 'modded']) {
      expect(toggleOf(server)).toHaveAttribute('aria-expanded', 'true');
    }
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    for (const server of ['survival', 'creative', 'modded']) {
      expect(toggleOf(server)).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('shows the server type and version', () => {
    renderTable();
    expect(within(rowOf('creative')).getByText('FABRIC 1.20.4')).toBeInTheDocument();
  });

  it('shows exited servers as warning with wakes-on-connect, not error', () => {
    renderTable();
    const chip = within(rowOf('creative')).getByText('Stopped · wakes on connect').closest('.MuiChip-root');
    expect(chip).toHaveClass('MuiChip-colorWarning');
    const dead = within(rowOf('modded')).getByText('Dead').closest('.MuiChip-root');
    expect(dead).toHaveClass('MuiChip-colorError');
  });

  it('links each server to its detail page', () => {
    renderTable();
    expect(within(rowOf('creative')).getByRole('link', { name: 'Open creative' })).toHaveAttribute(
      'href',
      '/servers/creative'
    );
  });

  it('filters by hostname and opens the matching server with the match marked', () => {
    renderTable();
    fireEvent.change(screen.getByLabelText('Search routes'), { target: { value: 'local' } });
    expect(screen.queryByRole('button', { name: 'Show domains of modded' })).not.toBeInTheDocument();
    expect(toggleOf('survival')).toHaveAttribute('aria-expanded', 'true');
    const items = within(domainsOf('survival')).getAllByRole('listitem');
    expect(items.filter((item) => item.dataset.match === 'true').map((item) => item.textContent)).toEqual([
      expect.stringContaining('survival.local'),
    ]);
  });

  it('filters by server name, case-insensitively, without opening the server', () => {
    renderTable();
    fireEvent.change(screen.getByLabelText('Search routes'), { target: { value: 'MODDED' } });
    expect(toggleOf('modded')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Show domains of survival' })).not.toBeInTheDocument();
  });

  it('returns to the servers the user opened once the search is cleared', () => {
    renderTable();
    expand('creative');
    const search = screen.getByLabelText('Search routes');
    fireEvent.change(search, { target: { value: 'survival.local' } });
    expect(toggleOf('survival')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(search, { target: { value: '' } });
    expect(toggleOf('survival')).toHaveAttribute('aria-expanded', 'false');
    expect(toggleOf('creative')).toHaveAttribute('aria-expanded', 'true');
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
    expect(screen.queryByRole('button', { name: 'Expand all' })).not.toBeInTheDocument();
  });

  it('renders one card per server instead of a table on xs, expandable the same way', () => {
    setMobile(true);
    renderTable();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Routes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByText('survival.local')).not.toBeInTheDocument();
    expand('survival');
    expect(within(domainsOf('survival')).getByText('survival.local')).toBeInTheDocument();
  });

  it('keeps the hidden Actions header label 1px wide so it cannot widen the page', () => {
    renderTable();
    // sx treats width: 1 as 100%, which made this absolutely positioned label page-wide.
    const label = screen.getByText('Actions');
    expect(getComputedStyle(label).width).toBe('1px');
    expect(getComputedStyle(label).height).toBe('1px');
  });

  it('renders a hostname shared by two servers without duplicate keys', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderTable([
      { hostname: 'play.example.com', target: 'mc-a:25565', serverStatus: 'running' },
      { hostname: 'play.example.com', target: 'mc-b:25565', serverStatus: 'exited' },
      { hostname: 'play.example.com', target: 'mc-b:25565', serverStatus: 'exited' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getAllByText('play.example.com').length).toBeGreaterThanOrEqual(3);
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

    it('offers a single Wake per server however many hostnames it has', () => {
      renderTable([
        { hostname: 'a.local', target: 'mc-a:25565', serverStatus: 'exited', autoScaleUp: true },
        { hostname: 'a.1.1.1.1.nip.io', target: 'mc-a:25565', serverStatus: 'exited', autoScaleUp: true },
      ]);
      expand('a');
      expect(screen.getAllByRole('button', { name: 'Wake a' })).toHaveLength(1);
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

    it('starts the server by name when clicked, without toggling the row', () => {
      renderTable();
      fireEvent.click(within(rowOf('creative')).getByRole('button', { name: 'Start creative' }));
      expect(mockStart).toHaveBeenCalledWith('creative', expect.anything());
      expect(toggleOf('creative')).toHaveAttribute('aria-expanded', 'false');
    });

    it('does not toggle the row from the links or the copy button', () => {
      // jsdom cannot navigate; keep the link click in the page.
      const preventNavigation = (event: Event) => event.preventDefault();
      window.addEventListener('click', preventNavigation, true);
      renderTable();
      fireEvent.click(within(rowOf('creative')).getByRole('link', { name: 'Open creative' }));
      fireEvent.click(within(rowOf('creative')).getByLabelText('Copy to clipboard'));
      window.removeEventListener('click', preventNavigation, true);
      expect(toggleOf('creative')).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows why a start failed instead of failing silently', async () => {
      mockStart.mockImplementation((_name, opts) => opts?.onError?.(new Error('Forbidden: manage permission required')));
      renderTable();
      fireEvent.click(within(rowOf('creative')).getByRole('button', { name: 'Start creative' }));
      expect(await within(rowOf('creative')).findByText('Start failed')).toBeInTheDocument();
      expect(within(rowOf('creative')).getByLabelText(/Forbidden: manage permission required/)).toBeInTheDocument();
    });

    it('does not bubble the click out of the table', () => {
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

    it('warns on the collapsed row when some hostnames are not routed', () => {
      renderTable([
        { hostname: 'a.local', target: 'mc-a:25565', serverStatus: 'running', discoveredByRouter: false },
        { hostname: 'a.1.1.1.1.nip.io', target: 'mc-a:25565', serverStatus: 'running', discoveredByRouter: true },
        { hostname: 'b.local', target: 'mc-b:25565', serverStatus: 'running' },
      ]);
      const chip = within(rowOf('a')).getByText('1 not routed').closest('.MuiChip-root');
      expect(chip).toHaveClass('MuiChip-colorWarning');
      expect(within(rowOf('b')).queryByText(/not routed/i)).not.toBeInTheDocument();
    });

    it('marks each unrouted hostname in the expanded list and explains it in a tooltip', () => {
      renderTable([
        { hostname: 'a.local', target: 'mc-a:25565', serverStatus: 'running', discoveredByRouter: false },
        { hostname: 'a.1.1.1.1.nip.io', target: 'mc-a:25565', serverStatus: 'running', discoveredByRouter: true },
      ]);
      expand('a');
      const [nip, local] = within(domainsOf('a')).getAllByRole('listitem');
      expect(within(local).getByText('Not routed')).toBeInTheDocument();
      expect(within(nip).queryByText('Not routed')).not.toBeInTheDocument();
      expect(within(local).getByLabelText(/mc-router has not registered this hostname/i)).toBeInTheDocument();
    });

    it('renders the same actions in the xs card list', () => {
      setMobile(true);
      renderTable([
        { hostname: 'a.local', target: 'mc-a:25565', serverStatus: 'exited', autoScaleUp: true, discoveredByRouter: false },
      ]);
      const item = within(screen.getByRole('list', { name: 'Routes' })).getByRole('listitem');
      expect(within(item).getByRole('button', { name: 'Wake a' })).toBeInTheDocument();
      expect(within(item).getByRole('link', { name: 'Edit hostnames of a' })).toBeInTheDocument();
      expect(within(item).getByRole('link', { name: 'Open a' })).toBeInTheDocument();
      expect(within(item).getByText('1 not routed')).toBeInTheDocument();
      fireEvent.click(within(item).getByRole('button', { name: 'Wake a' }));
      expect(mockStart).toHaveBeenCalledWith('a', expect.anything());
      expect(toggleOf('a')).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
