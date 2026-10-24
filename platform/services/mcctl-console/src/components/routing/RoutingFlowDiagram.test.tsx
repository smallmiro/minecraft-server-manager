import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider, darkTheme } from '@/theme';
import { RoutingFlowDiagram } from './RoutingFlowDiagram';
import type { RouteInfo, RouterDetail } from '@/ports/api/IMcctlApiClient';

const makeRouter = (routes: RouteInfo[], status: RouterDetail['status'] = 'running'): RouterDetail => ({
  name: 'mc-router',
  status,
  health: 'healthy',
  port: 25565,
  routes,
});

const route = (hostname: string, name: string, serverStatus: RouteInfo['serverStatus'] = 'running', extra = {}): RouteInfo => ({
  hostname,
  target: `mc-${name}:25565`,
  serverStatus,
  ...extra,
});

const renderDiagram = (routes: RouteInfo[], playitDomains: string[] = [], status: RouterDetail['status'] = 'running') =>
  render(
    <ThemeProvider>
      <RoutingFlowDiagram router={makeRouter(routes, status)} playitDomains={playitDomains} />
    </ThemeProvider>
  );

describe('RoutingFlowDiagram', () => {
  it('is an accessible image with a title and a summary label', () => {
    renderDiagram([route('a.local', 'a'), route('b.192.168.1.5.nip.io', 'b', 'exited')]);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('aria-label', expect.stringContaining('2 access types'));
    expect(img).toHaveAttribute('aria-label', expect.stringContaining('2 servers'));
    expect(img).toHaveAttribute('aria-label', expect.stringContaining('port 25565'));
    expect(within(img).getByText('Routing flow', { selector: 'title' })).toBeInTheDocument();
  });

  it('is responsive: viewBox and full width, no fixed pixel size', () => {
    renderDiagram([route('a.local', 'a')]);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('viewBox');
    expect(img).not.toHaveAttribute('height');
    expect(img).toHaveStyle({ width: '100%' });
  });

  it('shows only access types that exist with their route counts', () => {
    renderDiagram(
      [route('a.local', 'a'), route('b.local', 'b'), route('c.10.0.0.1.nip.io', 'c'), route('x-y.craft.playit.gg', 'a')],
      ['x-y.craft.playit.gg']
    );
    const nodes = screen.getAllByTestId('flow-type-node');
    expect(nodes.map((n) => n.getAttribute('data-type'))).toEqual(['mdns', 'nipio', 'wan']);
    expect(within(nodes[0]).getByText('mDNS')).toBeInTheDocument();
    expect(within(nodes[0]).getByText('2 routes')).toBeInTheDocument();
    expect(within(nodes[1]).getByText('1 route')).toBeInTheDocument();
    expect(within(nodes[2]).getByText('WAN')).toBeInTheDocument();
    expect(screen.queryByText('Custom')).not.toBeInTheDocument();
  });

  it('shows the mc-router node with its status and port', () => {
    renderDiagram([route('a.local', 'a')]);
    const node = screen.getByTestId('flow-router-node');
    expect(node).toHaveTextContent('mc-router');
    expect(node).toHaveTextContent('running');
    expect(node).toHaveTextContent('25565');
    expect(node).toHaveAttribute('data-color', 'success');
  });

  it('marks a stopped router as an error', () => {
    renderDiagram([route('a.local', 'a')], [], 'exited');
    expect(screen.getByTestId('flow-router-node')).toHaveAttribute('data-color', 'error');
  });

  it('draws one node per server with a status colour from routeStatusDisplay', () => {
    renderDiagram([
      route('a.local', 'run', 'running'),
      route('b.local', 'sleep', 'exited', { autoScaleUp: true }),
      route('c.local', 'stop', 'exited', { autoScaleUp: false }),
      route('d.local', 'dead', 'dead'),
      route('e.local', 'gone', 'not_found'),
    ]);
    const nodes = screen.getAllByTestId('flow-server-node');
    expect(nodes.map((n) => [n.getAttribute('data-server'), n.getAttribute('data-color')])).toEqual([
      ['run', 'success'],
      ['sleep', 'warning'],
      ['stop', 'default'],
      ['dead', 'error'],
      ['gone', 'error'],
    ]);
  });

  it('uses theme palette colours for strokes', () => {
    renderDiagram([route('a.local', 'run', 'running')]);
    const node = screen.getByTestId('flow-server-node');
    expect(node.querySelector('rect')).toHaveAttribute('stroke', darkTheme.palette.success.main);
  });

  it('merges several routes to the same server into one node', () => {
    renderDiagram([route('a.local', 'a'), route('a.10.0.0.1.nip.io', 'a')]);
    expect(screen.getAllByTestId('flow-server-node')).toHaveLength(1);
    expect(screen.getAllByTestId('flow-edge-type')).toHaveLength(2);
    expect(screen.getAllByTestId('flow-edge-server')).toHaveLength(1);
  });

  it('draws type -> router edges and router -> server edges', () => {
    renderDiagram([route('a.local', 'a'), route('b.10.0.0.1.nip.io', 'b')]);
    expect(screen.getAllByTestId('flow-edge-type')).toHaveLength(2);
    expect(screen.getAllByTestId('flow-edge-server')).toHaveLength(2);
  });

  it('renders text as SVG text nodes and escapes hostile names', () => {
    renderDiagram([route('a.local', '<b>x</b>')]);
    expect(screen.getByRole('img').querySelector('b')).toBeNull();
    expect(screen.getByText('<b>x</b>')).toBeInTheDocument();
  });

  it('shows the first 8 servers plus a "+N more" node that can be expanded and collapsed', () => {
    const routes = Array.from({ length: 11 }, (_, i) => route(`s${i}.local`, `s${i}`));
    renderDiagram(routes);
    expect(screen.getAllByTestId('flow-server-node')).toHaveLength(8);
    expect(screen.getByTestId('flow-more-node')).toHaveTextContent('+3 more');

    fireEvent.click(screen.getByRole('button', { name: 'Show all 11 servers' }));
    expect(screen.getAllByTestId('flow-server-node')).toHaveLength(11);
    expect(screen.queryByTestId('flow-more-node')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show fewer servers' }));
    expect(screen.getAllByTestId('flow-server-node')).toHaveLength(8);
  });

  it('offers no toggle with 8 or fewer servers', () => {
    renderDiagram(Array.from({ length: 8 }, (_, i) => route(`s${i}.local`, `s${i}`)));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('flow-more-node')).not.toBeInTheDocument();
  });

  it('shows an empty state without routes', () => {
    renderDiagram([]);
    expect(screen.getByText('No routes configured.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  describe('on xs screens', () => {
    afterEach(() => {
      // @ts-expect-error restore jsdom default (no matchMedia)
      delete window.matchMedia;
    });

    const mobile = () =>
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: (query: string) => ({
          matches: true,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
        }),
      });

    it('stacks the flow as readable chips instead of a scaled-down SVG', () => {
      mobile();
      renderDiagram([route('a.local', 'alpha'), route('a.1.2.3.4.nip.io', 'alpha'), route('b.local', 'beta', 'dead')]);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      const flow = screen.getByRole('group', { name: /Routing flow/ });
      expect(within(flow).getByText('mDNS · 2')).toBeInTheDocument();
      expect(within(flow).getByText('nip.io · 1')).toBeInTheDocument();
      expect(within(flow).getByText('mc-router · running · 25565')).toBeInTheDocument();
      expect(within(flow).getByText('beta · Dead').closest('.MuiChip-root')).toHaveClass('MuiChip-colorError');
    });
  });
});
