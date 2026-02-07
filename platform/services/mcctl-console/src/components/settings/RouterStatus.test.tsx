import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterStatus } from './RouterStatus';
import type { RouterDetail } from '@/ports/api/IMcctlApiClient';

const mockRouter: RouterDetail = {
  name: 'mc-router',
  status: 'running',
  health: 'healthy',
  port: 25565,
  uptime: '3d 14h 22m',
  uptimeSeconds: 314520,
  mode: 'auto-scale',
  routes: [],
};

describe('RouterStatus', () => {
  it('should render router status', () => {
    render(<RouterStatus router={mockRouter} />);

    expect(screen.getByText('MC-Router Status')).toBeInTheDocument();
  });

  it('should display running status', () => {
    render(<RouterStatus router={mockRouter} />);

    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('should display health status', () => {
    render(<RouterStatus router={mockRouter} />);

    expect(screen.getByText('healthy')).toBeInTheDocument();
  });

  it('should display routing table section', () => {
    render(<RouterStatus router={mockRouter} />);

    expect(screen.getByText('Routing Table')).toBeInTheDocument();
  });

  it('should show no routes message when empty', () => {
    render(<RouterStatus router={mockRouter} />);

    expect(screen.getByText('No routes configured')).toBeInTheDocument();
  });

  it('should display routes when available', () => {
    const routerWithRoutes = {
      ...mockRouter,
      routes: [
        {
          hostname: 'survival.local',
          target: 'mc-survival:25565',
          serverStatus: 'running' as const,
          serverType: 'PAPER',
          serverVersion: '1.21.1',
        },
      ],
    };
    render(<RouterStatus router={routerWithRoutes} />);

    expect(screen.getByText('survival')).toBeInTheDocument();
  });
});
