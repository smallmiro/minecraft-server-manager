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

  it('renders a stopped router as a warning, not an error', () => {
    renderCard({ ...router, status: 'exited' });
    expect(screen.getByLabelText('Router container status')).toHaveClass('MuiChip-colorWarning');
  });
});
