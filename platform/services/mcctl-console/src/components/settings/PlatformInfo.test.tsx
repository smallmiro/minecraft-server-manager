import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformInfo } from './PlatformInfo';
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

describe('PlatformInfo', () => {
  it('should render platform information', () => {
    render(<PlatformInfo router={mockRouter} />);

    expect(screen.getByText('Platform Information')).toBeInTheDocument();
  });

  it('should display router name', () => {
    render(<PlatformInfo router={mockRouter} />);

    expect(screen.getByText('Router Name')).toBeInTheDocument();
    expect(screen.getByText('mc-router')).toBeInTheDocument();
  });

  it('should display port', () => {
    render(<PlatformInfo router={mockRouter} />);

    expect(screen.getByText('Port')).toBeInTheDocument();
    expect(screen.getByText('25565')).toBeInTheDocument();
  });

  it('should display uptime', () => {
    render(<PlatformInfo router={mockRouter} />);

    expect(screen.getByText('Uptime')).toBeInTheDocument();
    expect(screen.getByText('3d 14h 22m')).toBeInTheDocument();
  });

  it('should display mode', () => {
    render(<PlatformInfo router={mockRouter} />);

    expect(screen.getByText('Mode')).toBeInTheDocument();
  });
});
