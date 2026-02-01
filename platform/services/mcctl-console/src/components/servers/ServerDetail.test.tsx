import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { ServerDetail } from './ServerDetail';
import type { ServerDetail as ServerDetailType } from '@/ports/api/IMcctlApiClient';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

const mockServer: ServerDetailType = {
  name: 'test-server',
  container: 'mc-test-server',
  status: 'running',
  health: 'healthy',
  hostname: 'test-server.local',
  type: 'PAPER',
  version: '1.21.1',
  memory: '4G',
  uptime: '2 days',
  uptimeSeconds: 172800,
  players: {
    online: 3,
    max: 20,
    list: ['player1', 'player2', 'player3'],
  },
  stats: {
    cpu: '25%',
    memory: '2.5G / 4G',
    memoryPercent: '62.5%',
    network: '1.2MB / 800KB',
    blockIO: '50MB / 20MB',
  },
  worldName: 'survival-world',
  worldSize: '1.2GB',
};

describe('ServerDetail', () => {
  it('should render tabs navigation', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /console/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /config/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /players/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /logs/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /backups/i })).toBeInTheDocument();
  });

  it('should show overview tab by default', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    // Overview content should be visible
    expect(screen.getByText('Server Information')).toBeInTheDocument();
    expect(screen.getByText('Container')).toBeInTheDocument();
  });

  it('should switch to console tab', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    const consoleTab = screen.getByRole('tab', { name: /console/i });
    fireEvent.click(consoleTab);

    expect(screen.getByText(/console coming soon/i)).toBeInTheDocument();
  });

  it('should switch to config tab', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    const configTab = screen.getByRole('tab', { name: /config/i });
    fireEvent.click(configTab);

    expect(screen.getByText(/configuration coming soon/i)).toBeInTheDocument();
  });

  it('should switch to players tab', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    const playersTab = screen.getByRole('tab', { name: /players/i });
    fireEvent.click(playersTab);

    expect(screen.getByText(/player management coming soon/i)).toBeInTheDocument();
  });

  it('should switch to logs tab', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    const logsTab = screen.getByRole('tab', { name: /logs/i });
    fireEvent.click(logsTab);

    expect(screen.getByText(/logs coming soon/i)).toBeInTheDocument();
  });

  it('should switch to backups tab', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    const backupsTab = screen.getByRole('tab', { name: /backups/i });
    fireEvent.click(backupsTab);

    expect(screen.getByText(/backups coming soon/i)).toBeInTheDocument();
  });

  it('should display server status in overview', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('healthy')).toBeInTheDocument();
  });

  it('should display server type and version in overview', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByText('PAPER')).toBeInTheDocument();
    expect(screen.getByText('1.21.1')).toBeInTheDocument();
  });

  it('should display memory allocation in overview', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByText('4G')).toBeInTheDocument();
  });

  it('should display uptime in overview', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByText('2 days')).toBeInTheDocument();
  });

  it('should display player count in overview', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByText(/3 \/ 20/)).toBeInTheDocument();
  });

  it('should display player list in overview', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByText('player1')).toBeInTheDocument();
    expect(screen.getByText('player2')).toBeInTheDocument();
    expect(screen.getByText('player3')).toBeInTheDocument();
  });

  it('should display resource stats when available', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByText(/25%/)).toBeInTheDocument(); // CPU
    expect(screen.getByText(/2.5G \/ 4G/)).toBeInTheDocument(); // Memory usage
  });

  it('should display world information when available', () => {
    renderWithTheme(<ServerDetail server={mockServer} />);

    expect(screen.getByText('survival-world')).toBeInTheDocument();
    expect(screen.getByText('1.2GB')).toBeInTheDocument();
  });

  it('should handle missing optional fields gracefully', () => {
    const minimalServer: ServerDetailType = {
      name: 'minimal-server',
      container: 'mc-minimal-server',
      status: 'stopped',
      health: 'none',
      hostname: 'minimal-server.local',
    };

    renderWithTheme(<ServerDetail server={minimalServer} />);

    expect(screen.getByText('minimal-server')).toBeInTheDocument();
    expect(screen.getByText('stopped')).toBeInTheDocument();
  });
});
