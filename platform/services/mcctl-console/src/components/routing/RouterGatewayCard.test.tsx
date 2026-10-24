import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { RouterGatewayCard } from './RouterGatewayCard';
import type { RouterDetail } from '@/ports/api/IMcctlApiClient';

const router: RouterDetail = {
  name: 'mc-router',
  status: 'running',
  health: 'healthy',
  port: 25565,
  uptime: '3d 14h 22m',
  uptimeSeconds: 314520,
  mode: 'auto-scale',
  routes: [
    { hostname: 'a.local', target: 'mc-a:25565', serverStatus: 'running' },
    { hostname: 'b.local', target: 'mc-b:25565', serverStatus: 'exited' },
    { hostname: 'c.local', target: 'mc-c:25565', serverStatus: 'running' },
  ],
};

const renderCard = (r: RouterDetail = router) =>
  render(
    <ThemeProvider>
      <RouterGatewayCard router={r} />
    </ThemeProvider>
  );

describe('RouterGatewayCard', () => {
  it('renders the mc-router Gateway title', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'mc-router Gateway' })).toBeInTheDocument();
  });

  it('shows status and health', () => {
    renderCard();
    expect(screen.getByLabelText('Router container status')).toHaveTextContent('running');
    expect(screen.getByLabelText('Router health')).toHaveTextContent('healthy');
  });

  it('shows port, mode, uptime and active routes once each', () => {
    renderCard();
    expect(screen.getAllByText('25565')).toHaveLength(1);
    expect(screen.getByLabelText('Port')).toBeInTheDocument();
    expect(screen.getAllByText('auto-scale')).toHaveLength(1);
    expect(screen.getByText('3d 14h 22m')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('maps auto-discovery modes and falls back for unknown ones', () => {
    renderCard({ ...router, mode: 'in-docker' });
    expect(screen.getByText('Auto Discovery')).toBeInTheDocument();
  });

  it('shows placeholders when uptime and mode are missing', () => {
    renderCard({ ...router, uptime: undefined, mode: undefined });
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renders a stopped router as an error: mc-router never wakes on connect', () => {
    renderCard({ ...router, status: 'exited' });
    expect(screen.getByLabelText('Router container status')).toHaveClass('MuiChip-colorError');
  });

  it('shows the router container name', () => {
    renderCard({ ...router, name: 'custom-router' });
    expect(screen.getByText('custom-router')).toBeInTheDocument();
  });

  it('lets the metric tiles stack instead of squeezing the port value', () => {
    renderCard();
    const grid = screen.getByLabelText('Port').closest('[data-testid="gateway-metrics"]');
    expect(grid).not.toBeNull();
    expect(getComputedStyle(grid as Element).gridTemplateColumns).toContain('auto-fit');
  });

  describe('router details (#768)', () => {
    const detailed: RouterDetail = {
      ...router,
      image: 'itzg/mc-router:latest',
      autoScale: { up: true, down: false, downAfter: '10m', asleepMotd: '§eSleeping\\n§7Connect to wake' },
    };

    it('shows image, auto-scale flags and idle time', () => {
      renderCard(detailed);
      expect(screen.getByText('itzg/mc-router:latest')).toBeInTheDocument();
      expect(screen.getByLabelText('Auto-scale up')).toHaveTextContent('On');
      expect(screen.getByLabelText('Auto-scale down')).toHaveTextContent('Off');
      expect(screen.getByText('10m')).toBeInTheDocument();
    });

    it('previews the asleep MOTD as plain text with line breaks and no formatting codes', () => {
      renderCard(detailed);
      const motd = screen.getByLabelText('Asleep MOTD preview');
      expect(motd.textContent).toBe('Sleeping\nConnect to wake');
      expect(getComputedStyle(motd).whiteSpace).toBe('pre-line');
    });

    it('does not interpret markup in the MOTD', () => {
      renderCard({ ...router, autoScale: { up: true, down: true, asleepMotd: '<b>bold</b>' } });
      const motd = screen.getByLabelText('Asleep MOTD preview');
      expect(motd.textContent).toBe('<b>bold</b>');
      expect(motd.querySelector('b')).toBeNull();
    });

    it('omits each item when its field is absent', () => {
      renderCard(router);
      expect(screen.queryByText('Image')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Auto-scale up')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Auto-scale down')).not.toBeInTheDocument();
      expect(screen.queryByText('Idle time')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Asleep MOTD preview')).not.toBeInTheDocument();
    });

    it('omits idle time and MOTD when autoScale has only the flags', () => {
      renderCard({ ...router, autoScale: { up: false, down: false } });
      expect(screen.getByLabelText('Auto-scale up')).toHaveTextContent('Off');
      expect(screen.queryByText('Idle time')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Asleep MOTD preview')).not.toBeInTheDocument();
    });
  });
});
