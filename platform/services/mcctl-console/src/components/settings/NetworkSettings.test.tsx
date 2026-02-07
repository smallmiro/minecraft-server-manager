import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NetworkSettings } from './NetworkSettings';
import type { RouterDetail } from '@/ports/api/IMcctlApiClient';

const mockRouter: RouterDetail = {
  name: 'mc-router',
  status: 'running',
  health: 'healthy',
  port: 25565,
  uptime: '3d 14h 22m',
  uptimeSeconds: 314520,
  mode: 'auto-scale',
  routes: [
    {
      hostname: 'survival.local',
      target: 'mc-survival:25565',
      serverStatus: 'running',
      serverType: 'PAPER',
      serverVersion: '1.21.1',
    },
    {
      hostname: 'creative.local',
      target: 'mc-creative:25565',
      serverStatus: 'exited' as const,
      serverType: 'VANILLA',
      serverVersion: '1.20.4',
    },
  ],
};

describe('NetworkSettings', () => {
  it('should render network settings section', () => {
    render(<NetworkSettings router={mockRouter} />);

    expect(screen.getByText('Network Settings')).toBeInTheDocument();
  });

  it('should display listening port', () => {
    render(<NetworkSettings router={mockRouter} />);

    expect(screen.getByText('Listening Port')).toBeInTheDocument();
    expect(screen.getByText('25565')).toBeInTheDocument();
  });

  it('should display routing mode', () => {
    render(<NetworkSettings router={mockRouter} />);

    expect(screen.getByText('Routing Mode')).toBeInTheDocument();
  });

  it('should display total routes count', () => {
    render(<NetworkSettings router={mockRouter} />);

    expect(screen.getByText('Total Routes')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should display active routes count', () => {
    render(<NetworkSettings router={mockRouter} />);

    expect(screen.getByText('Active Routes')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('should handle router with no routes', () => {
    const emptyRouter = { ...mockRouter, routes: [] };
    render(<NetworkSettings router={emptyRouter} />);

    expect(screen.getByText('0 / 0')).toBeInTheDocument();
  });
});
